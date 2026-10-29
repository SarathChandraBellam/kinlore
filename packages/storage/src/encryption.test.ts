import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Person } from '@kinlore/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptExistingArchive } from './encrypt-archive.js';
import { ENCRYPTION_ENVELOPE_NAME } from './layout.js';
import { LocalJsonStorage } from './local-json-archive.js';
import {
  parseEncryptionEnvelope,
  unlockWithPassphrase,
  unlockWithRecovery,
} from './passphrase-encryption.js';

const storage = new LocalJsonStorage();
const cleanup: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-encrypted-'));
  cleanup.push(dir);
  return dir;
}

describe('opt-in archive encryption', () => {
  it('round-trips people and media with a passphrase or the recovery key', async () => {
    const root = await tempDir();
    const created = await storage.create(root);
    const person: Person = {
      id: 'ada',
      displayName: 'Ada',
      createdAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
    };
    await created.savePerson(person);
    const media = new Uint8Array([9, 8, 7, 6]);
    await created.writeMedia('recordings/media/ada.webm', media);

    const { recoveryKey } = await encryptExistingArchive(created, 'family-passphrase');
    const envelopeRaw = await readFile(path.join(root, ENCRYPTION_ENVELOPE_NAME), 'utf8');
    expect(envelopeRaw.includes(recoveryKey)).toBe(false);
    await expect(storage.open(root)).rejects.toThrow(/encrypted/);

    const envelope = parseEncryptionEnvelope(JSON.parse(envelopeRaw) as unknown);
    const withPassphrase = await unlockWithPassphrase(envelope, 'family-passphrase');
    const unlocked = await storage.openWithCodec(root, withPassphrase);
    await expect(unlocked.listPeople()).resolves.toEqual([person]);
    await expect(unlocked.readMedia('recordings/media/ada.webm')).resolves.toEqual(media);

    const withRecovery = await unlockWithRecovery(envelope, recoveryKey);
    const recovered = await storage.openWithCodec(root, withRecovery);
    await expect(recovered.getPerson('ada')).resolves.toEqual(person);
  });

  it('persists wrapped keys before a migration write can fail', async () => {
    const root = await tempDir();
    const archive = await storage.create(root);
    const person: Person = {
      id: 'ada',
      displayName: 'Synthetic name',
      createdAt: '2026-10-29T00:00:00.000Z',
      updatedAt: '2026-10-29T00:00:00.000Z',
    };
    await archive.savePerson(person);
    const original = archive.savePerson.bind(archive);
    vi.spyOn(archive, 'savePerson').mockImplementationOnce(async (value) => {
      await original(value);
      throw new Error('Simulated interruption');
    });
    await expect(encryptExistingArchive(archive, 'synthetic-passphrase')).rejects.toThrow(
      'Simulated interruption',
    );
    const raw = await archive.readEncryptionEnvelope();
    const codec = await unlockWithPassphrase(parseEncryptionEnvelope(raw), 'synthetic-passphrase');
    const encrypted = await readFile(path.join(root, 'people', 'ada.json'));
    const decoded = await codec.open(encrypted);
    expect(JSON.parse(Buffer.from(decoded).toString('utf8'))).toEqual(person);
  });

  it('rejects the wrong passphrase and still blocks path escape', async () => {
    const root = await tempDir();
    const created = await storage.create(root);
    await encryptExistingArchive(created, 'family-passphrase');
    const envelope = parseEncryptionEnvelope(
      JSON.parse(await readFile(path.join(root, ENCRYPTION_ENVELOPE_NAME), 'utf8')) as unknown,
    );
    await expect(unlockWithPassphrase(envelope, 'wrong-passphrase')).rejects.toThrow(/unlock/);
    await expect(created.writeMedia('../outside.webm', new Uint8Array([1]))).rejects.toThrow(
      /escapes the archive root/,
    );
  });
});
