import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSecretStore, type SecretProtection } from './file-secret-store.js';

const cleanup: string[] = [];

function testProtection(): SecretProtection {
  const key = randomBytes(32);
  return {
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const bytes = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64');
    },
    decrypt(ciphertext) {
      const bytes = Buffer.from(ciphertext, 'base64');
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
    },
  };
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('FileSecretStore', () => {
  it('encrypts the whole secret-file payload with an injected OS protection adapter', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-secrets-'));
    cleanup.push(dir);
    const file = path.join(dir, 'secrets.json');
    const protection = testProtection();
    const store = new FileSecretStore(file, protection);
    await store.set('openrouter', 'synthetic-private-key');
    await store.set('openrouter-model', 'synthetic/model');
    const raw = await readFile(file, 'utf8');
    expect(raw).not.toContain('synthetic-private-key');
    expect(raw).not.toContain('synthetic/model');
    expect(raw).not.toContain('openrouter');
    expect(await new FileSecretStore(file, protection).get('openrouter')).toBe(
      'synthetic-private-key',
    );
    await expect(new FileSecretStore(file).get('openrouter')).rejects.toThrow(/protect|encrypt/i);
  });

  it('migrates a legacy secret file atomically before returning credentials', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-secrets-'));
    cleanup.push(dir);
    const file = path.join(dir, 'secrets.json');
    await writeFile(file, JSON.stringify({ accounts: { openrouter: 'legacy-synthetic-key' } }));
    const store = new FileSecretStore(file, testProtection());
    await store.migrate();
    expect(await readFile(file, 'utf8')).not.toContain('legacy-synthetic-key');
    expect(await store.get('openrouter')).toBe('legacy-synthetic-key');
  });

  it('refuses persistence when OS encryption is unavailable without creating plaintext', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-secrets-'));
    cleanup.push(dir);
    const file = path.join(dir, 'secrets.json');
    const protection: SecretProtection = {
      encrypt() {
        throw new Error('unavailable');
      },
      decrypt() {
        throw new Error('unavailable');
      },
    };
    const store = new FileSecretStore(file, protection);
    await expect(store.set('openrouter', 'synthetic-private-key')).rejects.toThrow(
      /protect|encrypt/i,
    );
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('stores a key outside the archive and does not require it to be read back by the UI', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-secrets-'));
    cleanup.push(dir);
    const store = new FileSecretStore(path.join(dir, 'secrets.json'));
    await store.set('transcribe', 'local-test-key');
    expect(await store.has('transcribe')).toBe(true);
    expect(await store.get('transcribe')).toBe('local-test-key');
    const info = await stat(path.join(dir, 'secrets.json'));
    if (process.platform !== 'win32') {
      expect(info.mode & 0o777).toBe(0o600);
    }
    await store.delete('transcribe');
    expect(await store.has('transcribe')).toBe(false);
  });

  it('rejects an account name that could be a path', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-secrets-'));
    cleanup.push(dir);
    const store = new FileSecretStore(path.join(dir, 'secrets.json'));
    await expect(store.set('../keys', 'nope')).rejects.toThrow(/invalid/);
  });
});
