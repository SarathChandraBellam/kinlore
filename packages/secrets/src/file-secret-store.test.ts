import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSecretStore } from './file-secret-store.js';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('FileSecretStore', () => {
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
