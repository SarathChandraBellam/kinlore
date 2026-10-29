import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ArchiveSession } from './archive-session.js';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function session(): Promise<{ session: ArchiveSession; root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'kinlore-session-'));
  cleanup.push(root);
  const created = new ArchiveSession(path.join(root, 'secrets.json'));
  created.allowRoot(root);
  await created.createArchive(root, 'synthetic-test-passphrase');
  return { session: created, root };
}

const stamp = '2026-10-26T00:00:00.000Z';

describe('ArchiveSession', () => {
  it('refuses to keep a recording without consent, then answers from the words that were typed', async () => {
    const { session: archive } = await session();
    const person = await archive.savePerson({
      id: 'ada',
      displayName: 'Ada',
      preferredLanguage: 'te',
      createdAt: stamp,
      updatedAt: stamp,
    });
    const capture = {
      personId: person.id,
      language: 'te',
      question: 'How did your family celebrate Sankranti?',
      spokenWords: 'We made pongal before sunrise.',
      mediaBase64: Buffer.from('voice').toString('base64'),
      extension: '.webm',
      promptId: 'te-festival',
    };
    await expect(archive.saveCapturedAnswer(capture)).rejects.toThrow(/consent/);
    await archive.saveConsent({
      id: 'consent-ada',
      personId: person.id,
      scope: 'recording',
      granted: true,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await archive.saveCapturedAnswer(capture);
    await expect(
      archive.ask({ question: 'How did the family celebrate Sankranti?' }),
    ).resolves.toMatchObject({
      kind: 'clips',
      clips: [expect.objectContaining({ text: 'We made pongal before sunrise.' })],
    });
    await expect(archive.ask({ question: 'What was the school called?' })).resolves.toEqual({
      kind: 'unknown',
    });
  });

  it('hides a sealed recording from playback and from the family question', async () => {
    const { session: archive } = await session();
    await archive.savePerson({
      id: 'lin',
      displayName: 'Lin',
      createdAt: stamp,
      updatedAt: stamp,
    });
    await archive.saveConsent({
      id: 'consent-lin',
      personId: 'lin',
      scope: 'recording',
      granted: true,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const saved = await archive.saveCapturedAnswer({
      personId: 'lin',
      language: 'en',
      question: 'A note for the wedding',
      spokenWords: 'Open this on the wedding morning.',
      mediaBase64: Buffer.from('sealed-voice').toString('base64'),
      extension: '.webm',
    });
    expect(await archive.mediaUrl(saved.recording.mediaRelativePath)).toContain('kinlore://media/');
    const sealed = await archive.sealRecording({
      id: saved.recording.id,
      sealedUntil: '2099-06-01T00:00:00.000Z',
      occasion: 'wedding',
    });
    expect(await archive.mediaUrl(sealed.mediaRelativePath)).toBeNull();
    await expect(archive.ask({ question: 'wedding morning' })).resolves.toEqual({
      kind: 'unknown',
    });
    await expect(
      archive.sealRecording({ id: saved.recording.id, sealedUntil: '2080-01-01T00:00:00.000Z' }),
    ).rejects.toThrow(/cannot be opened early/);
  });

  it('imports only a chosen file and keeps a sibling subtitle as the words', async () => {
    const { session: archive, root } = await session();
    await archive.savePerson({ id: 'ada', displayName: 'Ada', createdAt: stamp, updatedAt: stamp });
    await archive.saveConsent({
      id: 'consent-ada',
      personId: 'ada',
      scope: 'recording',
      granted: true,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const media = path.join(root, 'amma.mp3');
    const subtitle = path.join(root, 'amma.srt');
    await writeFile(media, 'audio');
    await writeFile(subtitle, '1\n00:00:00,000 --> 00:00:02,000\nWe made pongal.\n');
    archive.allowImport(media);
    const imported = await archive.importSelected({ paths: [media], personIds: ['ada'] });
    expect(imported.recordings[0]?.origin).toBe('file');
    expect(imported.transcripts[0]?.segments[0]?.text).toBe('We made pongal.');
    await expect(
      archive.importSelected({ paths: ['/tmp/not-chosen.mp3'], personIds: ['ada'] }),
    ).rejects.toThrow(/not allowed/);
  });

  it('stores an API key outside the archive and still sends nothing', async () => {
    const { session: archive } = await session();
    await archive.saveSecret('transcribe', 'test-key-value');
    await expect(archive.secretStatus('transcribe')).resolves.toEqual({
      stored: true,
      location: 'secret-file',
    });
    const disclosure = archive.showOutbound('transcribe');
    expect(disclosure.contactedHost).toBeNull();
    expect(archive.runRemoteStep('transcribe', true, 'none').sent).toBe(false);
    expect(await archive.voiceDecision('ada', true)).toEqual({
      allowed: false,
      reason: 'no-consent',
    });
  });
});
