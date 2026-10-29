import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalJsonStorage } from '@kinlore/storage';
import { ArchiveSession } from './archive-session.js';

const cleanup: string[] = [];
const passphrase = 'synthetic-family-passphrase';
const stamp = '2026-10-29T00:00:00.000Z';

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'kinlore-encrypted-session-'));
  cleanup.push(root);
  const session = new ArchiveSession(path.join(root, 'private', 'secrets.json'));
  const archiveRoot = session.allowRoot(path.join(root, 'archive'));
  return { root, session, archiveRoot };
}

describe('encrypted desktop archives', () => {
  it('requires a passphrase before creating any archive files', async () => {
    const { session, archiveRoot } = await fixture();
    await expect(session.createArchive(archiveRoot, '')).rejects.toThrow(/passphrase/i);
    await expect(session.createArchive(archiveRoot, 'short')).rejects.toThrow(/passphrase/i);
    await expect(readFile(path.join(archiveRoot, 'kinlore.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('encrypts every family write and reopens locked with passphrase or recovery', async () => {
    const { session, archiveRoot, root } = await fixture();
    const created = await session.createArchive(archiveRoot, passphrase);
    expect(created.status).toMatchObject({ encrypted: true, unlocked: true });
    expect(created.recoveryKey).toBeTruthy();
    const person = {
      id: 'ada',
      displayName: 'A private family name',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await session.savePerson(person);
    await session.saveConsent({
      id: 'ada-recording',
      personId: 'ada',
      scope: 'recording',
      granted: true,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const saved = await session.saveCapturedAnswer({
      personId: 'ada',
      language: 'en',
      question: 'A private memory',
      spokenWords: 'Private spoken words',
      mediaBase64: Buffer.from('private audio bytes').toString('base64'),
      extension: '.webm',
    });
    const personBytes = await readFile(path.join(archiveRoot, 'people', 'ada.json'));
    expect(personBytes.subarray(0, 4).toString()).toBe('KLOR');
    expect(personBytes.toString()).not.toContain(person.displayName);
    expect(
      (await readFile(path.join(archiveRoot, saved.recording.mediaRelativePath))).toString(),
    ).not.toContain('private audio bytes');
    if (saved.transcript === undefined) throw new Error('Expected transcript');
    expect(
      (
        await readFile(path.join(archiveRoot, 'transcripts', `${saved.transcript.id}.json`))
      ).toString(),
    ).not.toContain('Private spoken words');
    const envelope = await readFile(path.join(archiveRoot, 'encryption.json'), 'utf8');
    expect(envelope).not.toContain(passphrase);
    expect(envelope).not.toContain(created.recoveryKey);
    const reopened = new ArchiveSession(path.join(root, 'other-private', 'secrets.json'));
    reopened.allowRoot(archiveRoot);
    expect(await reopened.openArchive(archiveRoot)).toMatchObject({
      encrypted: true,
      unlocked: false,
    });
    await expect(reopened.savePerson(person)).rejects.toThrow(/archive/i);
    await expect(reopened.unlockArchive('wrong-passphrase')).rejects.toThrow(/unlock/i);
    await reopened.unlockArchive(passphrase);
    expect(await reopened.listPeople()).toEqual([person]);
    reopened.lockArchive();
    await reopened.unlockArchiveWithRecovery(created.recoveryKey);
    expect(await reopened.listPeople()).toEqual([person]);
  });

  it('opens legacy plaintext read-only and refuses all family writes until migration', async () => {
    const { session, archiveRoot } = await fixture();
    const legacy = await new LocalJsonStorage().create(archiveRoot);
    const person = { id: 'ada', displayName: 'Legacy person', createdAt: stamp, updatedAt: stamp };
    await legacy.savePerson(person);
    expect(await session.openArchive(archiveRoot)).toMatchObject({
      encrypted: false,
      unlocked: true,
    });
    expect(await session.listPeople()).toEqual([person]);
    await expect(session.savePerson(person)).rejects.toThrow(/encrypt/i);
    await expect(session.saveConsent({})).rejects.toThrow(/encrypt/i);
    await expect(session.saveCapturedAnswer({})).rejects.toThrow(/encrypt/i);
    await expect(session.importSelected({})).rejects.toThrow(/encrypt/i);
    await expect(session.attachKeepsakeMedia({})).rejects.toThrow(/encrypt/i);
    await expect(session.saveStory({})).rejects.toThrow(/encrypt/i);
    await expect(session.saveKeepsake({})).rejects.toThrow(/encrypt/i);
    await expect(session.saveRecipe({})).rejects.toThrow(/encrypt/i);
    await expect(session.saveTimelineEvent({})).rejects.toThrow(/encrypt/i);
    await expect(session.sealRecording({})).rejects.toThrow(/encrypt/i);
    const result = await session.enableEncryption(passphrase);
    expect(result.recoveryKey).toBeTruthy();
    await session.savePerson({ ...person, displayName: 'Protected person' });
    expect(
      (await readFile(path.join(archiveRoot, 'people', 'ada.json'))).subarray(0, 4).toString(),
    ).toBe('KLOR');
  });
});
