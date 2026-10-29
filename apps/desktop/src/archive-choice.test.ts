import { mkdtemp, readFile, readdir, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchiveSession } from './archive-session.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
const cleanup: string[] = [];
const phrase = 'synthetic-archive-passphrase';
afterEach(async () => {
  vi.mocked(rename).mockReset();
  await Promise.all(cleanup.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const parent = await mkdtemp(path.join(tmpdir(), 'kinlore-archive-choice-'));
  cleanup.push(parent);
  const root = path.join(parent, 'archive');
  const session = new ArchiveSession(path.join(parent, 'private', 'secrets.json'));
  session.allowRoot(root);
  return { session, root, parent };
}
describe('existing archive choices', () => {
  it('detects existing encrypted archives and preserves them when creation is not replacement', async () => {
    const { session, root } = await fixture();
    expect(await session.inspectArchive(root)).toBe('missing');
    await session.createArchive(root, phrase);
    expect(await session.inspectArchive(root)).toBe('existing');
    const before = await readFile(path.join(root, 'encryption.json'));
    await expect(session.createArchive(root, phrase)).rejects.toThrow(/already exists/);
    expect(await readFile(path.join(root, 'encryption.json'))).toEqual(before);
  });
  it('keeps the original encrypted family data in a backup on explicit replacement', async () => {
    const { session, root } = await fixture();
    await session.createArchive(root, phrase);
    const person = {
      id: 'ada',
      displayName: 'Synthetic elder',
      createdAt: '2026-10-29T00:00:00Z',
      updatedAt: '2026-10-29T00:00:00Z',
    };
    await session.savePerson(person);
    const bytes = await readFile(path.join(root, 'people', 'ada.json'));
    const replaced = await session.createArchive(root, 'different-synthetic-passphrase', true);
    expect(replaced.backupPath).toBeTruthy();
    expect(await session.listPeople()).toEqual([]);
    expect(await readFile(path.join(replaced.backupPath ?? '', 'people', 'ada.json'))).toEqual(
      bytes,
    );
    const backup = new ArchiveSession(path.join(root, 'ignored-secrets.json'));
    backup.allowRoot(replaced.backupPath ?? '');
    await backup.openArchive(replaced.backupPath ?? '');
    await backup.unlockArchive(phrase);
    expect(await backup.listPeople()).toEqual([person]);
  });
  it('restores the original location if installing the staged archive fails', async () => {
    const { session, root, parent } = await fixture();
    await session.createArchive(root, phrase);
    const before = await readFile(path.join(root, 'encryption.json'));
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    vi.mocked(rename).mockImplementation(async (from, to) => {
      if (path.basename(String(from)).startsWith('archive.new-') && String(to) === root)
        throw new Error('Synthetic swap failure');
      return actual.rename(from, to);
    });
    await expect(session.createArchive(root, phrase, true)).rejects.toThrow(/replacement failed/i);
    expect(await readFile(path.join(root, 'encryption.json'))).toEqual(before);
    expect((await readdir(parent)).filter((name) => name.startsWith('archive.new-'))).toEqual([]);
  });
  it('does not inspect a folder outside allowed roots or replace a non-archive folder', async () => {
    const { session, root, parent } = await fixture();
    await expect(session.inspectArchive(parent)).rejects.toThrow(/not allowed/);
    await expect(session.createArchive(root, phrase, true)).rejects.toThrow(/archive/i);
    expect(await session.inspectArchive(root)).toBe('missing');
  });
  it('recognizes a partial archive rather than offering overwrite', async () => {
    const { session, root } = await fixture();
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(root);
    await writeFile(path.join(root, 'encryption.json'), '{}');
    expect(await session.inspectArchive(root)).toBe('incomplete');
  });
});
