import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  type ScryptOptions,
} from 'node:crypto';
import type { ArchiveCodec } from './codec.js';
import type { EncryptionProvider } from './encryption.js';

const MAGIC = Buffer.from('KLOR');
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

export interface KeyWrap {
  salt: string;
  N: number;
  r: number;
  p: number;
  wrappedKey: string;
}

export interface EncryptionEnvelope {
  algorithm: 'aes-256-gcm';
  kdf: 'scrypt';
  passphrase: KeyWrap;
  recovery: KeyWrap;
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.length < 8 || passphrase.length > 1024) {
    throw new Error('Passphrase must be at least 8 characters');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWrap(value: unknown, label: string): KeyWrap {
  if (!isRecord(value)) {
    throw new Error('Encryption envelope is invalid');
  }
  if (
    value.N !== PARAMS.N ||
    value.r !== PARAMS.r ||
    value.p !== PARAMS.p ||
    typeof value.salt !== 'string' ||
    typeof value.wrappedKey !== 'string'
  ) {
    throw new Error(`${label} is not supported`);
  }
  return {
    salt: value.salt,
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    wrappedKey: value.wrappedKey,
  };
}

export function parseEncryptionEnvelope(value: unknown): EncryptionEnvelope {
  if (!isRecord(value) || value.algorithm !== 'aes-256-gcm' || value.kdf !== 'scrypt') {
    throw new Error('Encryption envelope is invalid');
  }
  return {
    algorithm: 'aes-256-gcm',
    kdf: 'scrypt',
    passphrase: parseWrap(value.passphrase, 'Passphrase wrap'),
    recovery: parseWrap(value.recovery, 'Recovery wrap'),
  };
}

function derive(secret: string, salt: Buffer): Promise<Buffer> {
  const options: ScryptOptions = PARAMS;
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, 32, options, (error, key) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

function wrapKey(dataKey: Buffer, kek: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function unwrapKey(payload: string, kek: Buffer): Buffer {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 29) {
    throw new Error('Could not unlock the archive');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export class AesGcmEncryption implements EncryptionProvider, ArchiveCodec {
  readonly id = 'aes-256-gcm';

  constructor(private readonly dataKey: Buffer) {
    if (dataKey.length !== 32) {
      throw new Error('Encryption key is invalid');
    }
  }

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.dataKey, iv);
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return new Uint8Array(Buffer.concat([MAGIC, Buffer.from([1]), iv, tag, body]));
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    const buf = Buffer.from(ciphertext);
    if (buf.length < 33 || !buf.subarray(0, 4).equals(MAGIC) || buf[4] !== 1) {
      throw new Error('Archive data could not be decrypted');
    }
    try {
      const iv = buf.subarray(5, 17);
      const tag = buf.subarray(17, 33);
      const body = buf.subarray(33);
      const decipher = createDecipheriv('aes-256-gcm', this.dataKey, iv);
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
    } catch {
      throw new Error('Archive data could not be decrypted');
    }
  }

  seal(plaintext: Uint8Array): Promise<Uint8Array> {
    return this.encrypt(plaintext);
  }

  open(stored: Uint8Array): Promise<Uint8Array> {
    return this.decrypt(stored);
  }
}

export async function createArchiveKeys(passphrase: string): Promise<{
  encryption: AesGcmEncryption;
  envelope: EncryptionEnvelope;
  recoveryKey: string;
}> {
  assertPassphrase(passphrase);
  const dataKey = randomBytes(32);
  const recoveryKey = randomBytes(32).toString('base64url');
  const passphraseSalt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const passphraseKek = await derive(passphrase, passphraseSalt);
  const recoveryKek = await derive(recoveryKey, recoverySalt);
  return {
    encryption: new AesGcmEncryption(dataKey),
    recoveryKey,
    envelope: {
      algorithm: 'aes-256-gcm',
      kdf: 'scrypt',
      passphrase: {
        salt: passphraseSalt.toString('base64'),
        ...PARAMS,
        wrappedKey: wrapKey(dataKey, passphraseKek),
      },
      recovery: {
        salt: recoverySalt.toString('base64'),
        ...PARAMS,
        wrappedKey: wrapKey(dataKey, recoveryKek),
      },
    },
  };
}

async function unlockWrap(wrap: KeyWrap, secret: string): Promise<AesGcmEncryption> {
  try {
    const kek = await derive(secret, Buffer.from(wrap.salt, 'base64'));
    return new AesGcmEncryption(unwrapKey(wrap.wrappedKey, kek));
  } catch {
    throw new Error('Could not unlock the archive');
  }
}

export function unlockWithPassphrase(
  envelope: EncryptionEnvelope,
  passphrase: string,
): Promise<AesGcmEncryption> {
  assertPassphrase(passphrase);
  return unlockWrap(envelope.passphrase, passphrase);
}

export function unlockWithRecovery(
  envelope: EncryptionEnvelope,
  recoveryKey: string,
): Promise<AesGcmEncryption> {
  const trimmed = recoveryKey.trim();
  if (trimmed.length < 20 || trimmed.length > 128) {
    throw new Error('Could not unlock the archive');
  }
  return unlockWrap(envelope.recovery, trimmed);
}
