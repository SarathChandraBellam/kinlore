import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Consent, Keepsake, Person, Recording, Story } from '@kinlore/core';
import { afterEach, describe, expect, it } from 'vitest';
import { ARCHIVE_FORMAT, ARCHIVE_VERSION, MANIFEST_NAME } from './layout.js';
import { LocalJsonStorage } from './local-json-archive.js';

const storage = new LocalJsonStorage();
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kinlore-archive-'));
  cleanup.push(dir);
  return dir;
}

function timestamps(): { createdAt: string; updatedAt: string } {
  const now = '2026-10-25T12:00:00.000Z';
  return { createdAt: now, updatedAt: now };
}

describe('LocalJsonStorage', () => {
  // TC1 / AC4
  it('creates a kinlore-archive manifest', async () => {
    const root = await tempDir();
    const archive = await storage.create(root);
    const manifest = await archive.getManifest();
    const raw = await readFile(path.join(root, MANIFEST_NAME), 'utf8');

    expect(archive.rootPath).toBe(path.resolve(root));
    expect(manifest.format).toBe(ARCHIVE_FORMAT);
    expect(manifest.version).toBe(ARCHIVE_VERSION);
    expect(JSON.parse(raw)).toMatchObject({ format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION });
  });

  // TC2 / AC4
  it('saves and lists a person', async () => {
    const archive = await storage.create(await tempDir());
    const person: Person = {
      id: 'person-ada',
      displayName: 'Ada',
      preferredLanguage: 'en',
      ...timestamps(),
    };

    await archive.savePerson(person);
    await expect(archive.listPeople()).resolves.toEqual([person]);
    await expect(archive.getPerson('person-ada')).resolves.toEqual(person);
  });

  // TC3 / AC4
  it('writes and reads media bytes', async () => {
    const archive = await storage.create(await tempDir());
    const relativePath = path.join('recordings', 'media', 'clip.bin');
    const bytes = new Uint8Array([1, 2, 3, 9]);

    await archive.writeMedia(relativePath, bytes);
    await expect(archive.readMedia(relativePath)).resolves.toEqual(bytes);
  });

  // TC4 / AC4
  it('reopens an archive and still lists saved people', async () => {
    const root = await tempDir();
    const created = await storage.create(root);
    const person: Person = { id: 'person-lin', displayName: 'Lin', ...timestamps() };
    await created.savePerson(person);

    const reopened = await storage.open(root);
    await expect(reopened.listPeople()).resolves.toEqual([person]);
  });

  // TC5 / AC4
  it('round-trips recording, story, keepsake, and consent', async () => {
    const archive = await storage.create(await tempDir());
    const recording: Recording = {
      id: 'rec-1',
      title: 'Kitchen stories',
      personIds: ['person-ada'],
      mediaRelativePath: path.join('recordings', 'media', 'rec-1.wav'),
      ...timestamps(),
    };
    const story: Story = {
      id: 'story-1',
      title: 'How we came here',
      personIds: ['person-ada'],
      recordingIds: ['rec-1'],
      ...timestamps(),
    };
    const keepsake: Keepsake = {
      id: 'keep-1',
      title: 'Wedding sari',
      personIds: ['person-ada'],
      notes: 'Kept in the teak chest',
      ...timestamps(),
    };
    const consent: Consent = {
      id: 'consent-1',
      personId: 'person-ada',
      scope: 'recording',
      granted: true,
      grantedAt: timestamps().createdAt,
      ...timestamps(),
    };

    await archive.saveRecording(recording);
    await archive.saveStory(story);
    await archive.saveKeepsake(keepsake);
    await archive.saveConsent(consent);

    await expect(archive.listRecordings()).resolves.toEqual([recording]);
    await expect(archive.listStories()).resolves.toEqual([story]);
    await expect(archive.listKeepsakes()).resolves.toEqual([keepsake]);
    await expect(archive.listConsents()).resolves.toEqual([consent]);
  });

  // TC6 / AC5
  it('rejects media paths that escape the archive', async () => {
    const root = await tempDir();
    const archive = await storage.create(root);
    const outside = path.join(root, '..', 'outside.txt');

    await expect(archive.writeMedia('../outside.txt', new Uint8Array([1]))).rejects.toThrow(
      /escapes the archive root/,
    );
    await expect(access(outside)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // TC7 / AC5
  it('rejects absolute media paths', async () => {
    const archive = await storage.create(await tempDir());
    await expect(
      archive.writeMedia('/tmp/not-in-archive.bin', new Uint8Array([1])),
    ).rejects.toThrow(/Absolute paths/);
  });

  // TC8 / AC5
  it('rejects entity ids that look like path traversal', async () => {
    const archive = await storage.create(await tempDir());
    const person: Person = {
      id: '../escape',
      displayName: 'Nope',
      ...timestamps(),
    };
    await expect(archive.savePerson(person)).rejects.toThrow(/Invalid entity id/);
  });

  // TC9 / AC4
  it('throws when opening a folder that is not an archive', async () => {
    const root = await tempDir();
    await expect(storage.open(root)).rejects.toThrow(/No Kinlore archive found/);
  });

  // TC10 / AC4
  it('throws when creating over an existing archive', async () => {
    const root = await tempDir();
    await storage.create(root);
    await expect(storage.create(root)).rejects.toThrow(/already exists/);
  });

  it('throws when the manifest is not a Kinlore archive', async () => {
    const root = await tempDir();
    await writeFile(path.join(root, MANIFEST_NAME), `${JSON.stringify({ format: 'other' })}\n`);
    await expect(storage.open(root)).rejects.toThrow(/Not a Kinlore archive/);
  });
});
