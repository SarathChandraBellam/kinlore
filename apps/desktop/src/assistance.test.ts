import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchiveSession } from './archive-session.js';
import {
  LocalJsonArchive,
  LocalJsonStorage,
  parseEncryptionEnvelope,
  unlockWithPassphrase,
} from '@kinlore/storage';
const passphrase = 'synthetic-test-passphrase';
async function directArchive(root: string) {
  const raw = await new LocalJsonArchive(root).readEncryptionEnvelope();
  const codec = await unlockWithPassphrase(parseEncryptionEnvelope(raw), passphrase);
  return new LocalJsonStorage().openWithCodec(root, codec);
}

const cleanup: string[] = [];
const stamp = '2026-10-29T00:00:00.000Z';

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  await Promise.all(cleanup.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'kinlore-assistance-'));
  cleanup.push(root);
  const secretFile = path.join(root, 'private', 'secrets.json');
  const archiveRoot = path.join(root, 'archive');
  const session = new ArchiveSession(secretFile);
  session.allowRoot(archiveRoot);
  await session.createArchive(archiveRoot, passphrase);
  for (const id of ['ada', 'lin']) {
    await session.savePerson({ id, displayName: id, createdAt: stamp, updatedAt: stamp });
    for (const scope of ['recording', 'export']) {
      await session.saveConsent({
        id: `${id}-${scope}`,
        personId: id,
        scope,
        granted: true,
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
  }
  const saved = await session.saveCapturedAnswer({
    personId: 'ada',
    language: 'en',
    question: 'What did you cook?',
    spokenWords: 'We cooked rice with lentils.',
    mediaBase64: Buffer.from('synthetic audio').toString('base64'),
    extension: '.webm',
    durationMs: 1200,
  });
  await session.saveOpenRouterConfig({ model: 'test/model', apiKey: 'synthetic-test-key' });
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  return { session, saved, root, secretFile, archiveRoot, fetcher };
}

function response(value: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }),
  );
}

describe('optional assistance', () => {
  it('blocks new previews while an export-consent change is awaiting disk and invalidates both sides', async () => {
    const { session, saved, fetcher } = await fixture();
    const before = await session.prepareLlm({
      task: 'story',
      language: 'en',
      recordingIds: [saved.recording.id],
    });
    const original = LocalJsonArchive.prototype.saveConsent;
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((ready) => {
      started = ready;
    });
    const deferred = new Promise<void>((ready) => {
      release = ready;
    });
    vi.spyOn(LocalJsonArchive.prototype, 'saveConsent').mockImplementationOnce(
      async function (consent) {
        started();
        await deferred;
        return original.call(this, consent);
      },
    );
    const change = session.saveConsent({
      id: 'ada-export',
      personId: 'ada',
      scope: 'export',
      granted: false,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await waiting;
    try {
      await expect(
        session.prepareLlm({ task: 'story', language: 'en', recordingIds: [saved.recording.id] }),
      ).rejects.toThrow(/progress|changing|change/i);
      await expect(session.runLlm({ token: before.token, approved: true })).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      release();
      await change;
    }
    await expect(
      session.prepareLlm({ task: 'story', language: 'en', recordingIds: [saved.recording.id] }),
    ).rejects.toThrow(/consent/i);
  });

  it('previews persona text exactly and requires the selected person export consent without sources', async () => {
    const { session, fetcher } = await fixture();
    const persona = 'A retired teacher who grew up speaking Telugu';
    const preview = await session.prepareLlm({
      task: 'interview',
      language: 'te',
      personId: 'ada',
      persona,
    });
    expect(preview.text).toContain(persona);
    expect(preview.recordingIds).toEqual([]);
    expect(preview.text).not.toContain('We cooked rice');
    await session.saveConsent({
      id: 'ada-export',
      personId: 'ada',
      scope: 'export',
      granted: false,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await expect(
      session.prepareLlm({ task: 'interview', language: 'te', personId: 'ada', persona }),
    ).rejects.toThrow(/consent/i);
    await expect(session.runLlm({ token: preview.token, approved: true })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      session.prepareLlm({ task: 'interview', language: 'en', persona: 'x'.repeat(1001) }),
    ).rejects.toThrow();
    await expect(
      session.prepareLlm({ task: 'story', language: 'en', persona, recordingIds: [] }),
    ).rejects.toThrow();
  });
  // TC2 / AC2
  it('saves real captured audio without inventing a transcript when words are omitted or blank', async () => {
    const { session } = await fixture();
    for (const spokenWords of [undefined, '   ']) {
      const result = await session.saveCapturedAnswer({
        personId: 'lin',
        language: 'en',
        question: 'A story',
        ...(spokenWords === undefined ? {} : { spokenWords }),
        mediaBase64: Buffer.from('voice').toString('base64'),
        extension: '.webm',
      });
      expect(result.transcript).toBeUndefined();
      expect(await session.mediaUrl(result.recording.mediaRelativePath)).toContain(
        'kinlore://media/',
      );
    }
    const library = await session.loadLibrary();
    expect(library.recordings).toHaveLength(3);
    expect(library.transcripts).toHaveLength(1);
    expect(await session.ask({ question: 'a story' })).toEqual({ kind: 'unknown' });
  });

  // TC7–TC9 / AC4–AC5
  it('persists only configuration outside the archive and never exposes the key or sends on save/preview', async () => {
    const { session, secretFile, archiveRoot, fetcher, saved } = await fixture();
    const config = await session.getOpenRouterConfig();
    expect(config).toEqual({ model: 'test/model', keyStored: true, location: 'secret-file' });
    expect(await new ArchiveSession(secretFile).getOpenRouterConfig()).toEqual(config);
    const preview = await session.prepareLlm({
      task: 'ask',
      language: 'en',
      question: 'What was cooked?',
      recordingIds: [saved.recording.id],
    });
    expect(preview.text).toContain('We cooked rice with lentils.');
    expect(preview.destination).toContain('OpenRouter');
    expect(preview.text).not.toContain('synthetic-test-key');
    expect(preview.text).not.toContain(archiveRoot);
    expect(preview.text).not.toContain(saved.recording.mediaRelativePath);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(session.runLlm({ token: preview.token, approved: false })).rejects.toThrow(
      /approv/i,
    );
    expect(fetcher).not.toHaveBeenCalled();
    await session.saveOpenRouterConfig({ model: 'test/model', removeKey: true });
    expect((await session.getOpenRouterConfig()).keyStored).toBe(false);
    expect(await readFile(path.join(archiveRoot, 'kinlore.json'), 'utf8')).not.toContain(
      'test/model',
    );
  });

  // TC8 / AC4
  it.each([
    { model: '' },
    { model: 'x'.repeat(201) },
    { model: 'test/model', apiKey: '\nprivate' },
    { model: 'test/model', apiKey: '   ' },
  ])('rejects invalid settings without replacing valid configuration', async (input) => {
    const { session, fetcher } = await fixture();
    await expect(session.saveOpenRouterConfig(input)).rejects.toThrow();
    expect(await session.getOpenRouterConfig()).toMatchObject({
      model: 'test/model',
      keyStored: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  // TC10, TC16 / AC5, AC7
  it('sends an approved preview exactly once and returns bounded interview questions', async () => {
    const { session, fetcher } = await fixture();
    const preview = await session.prepareLlm({
      task: 'interview',
      language: 'te',
      question: 'Childhood',
    });
    fetcher.mockResolvedValue(response({ questions: ['మీ చిన్ననాటి గురించి చెప్పండి?'] }));
    const result = await session.runLlm({ token: preview.token, approved: true });
    expect(result).toEqual({ task: 'interview', questions: ['మీ చిన్ననాటి గురించి చెప్పండి?'] });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: preview.model,
      messages: preview.messages,
    });
    await expect(session.runLlm({ token: preview.token, approved: true })).rejects.toThrow(
      /preview|approv/i,
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects expired approvals before sending', async () => {
    const { session, fetcher } = await fixture();
    const preview = await session.prepareLlm({ task: 'interview', language: 'en' });
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(preview.expiresAt) + 1);
    await expect(session.runLlm({ token: preview.token, approved: true })).rejects.toThrow(
      /preview|expir/i,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  // TC11 / AC5–AC6
  it.each(['seal', 'consent', 'model', 'switch', 'source'] as const)(
    'blocks stale approvals after %s changes',
    async (change) => {
      const { session, saved, fetcher, root } = await fixture();
      const preview = await session.prepareLlm({
        task: 'ask',
        language: 'en',
        question: 'Rice?',
        recordingIds: [saved.recording.id],
      });
      if (change === 'seal')
        await session.sealRecording({
          id: saved.recording.id,
          sealedUntil: '2099-01-01T00:00:00Z',
        });
      if (change === 'consent')
        await session.saveConsent({
          id: 'ada-export',
          personId: 'ada',
          scope: 'export',
          granted: false,
          createdAt: stamp,
          updatedAt: stamp,
        });
      if (change === 'model') await session.saveOpenRouterConfig({ model: 'other/model' });
      if (change === 'switch') {
        const other = session.allowRoot(path.join(root, 'other'));
        await session.createArchive(other, passphrase);
      }
      if (change === 'source') {
        const archive = await directArchive(session.status().rootPath ?? '');
        if (saved.transcript === undefined) throw new Error('Fixture transcript missing');
        await archive.saveTranscript({
          ...saved.transcript,
          segments: saved.transcript.segments.map((segment) => ({
            ...segment,
            text: 'Changed words',
          })),
        });
      }
      await expect(session.runLlm({ token: preview.token, approved: true })).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  // TC12 / AC5
  it('rejects an in-flight result after consent is revoked', async () => {
    const { session, saved, fetcher } = await fixture();
    const preview = await session.prepareLlm({
      task: 'story',
      language: 'en',
      recordingIds: [saved.recording.id],
    });
    let resolve!: (response: Response) => void;
    let started!: () => void;
    const sending = new Promise<void>((ready) => {
      started = ready;
    });
    fetcher.mockImplementation(() => {
      started();
      return new Promise<Response>((ready) => {
        resolve = ready;
      });
    });
    const pending = session.runLlm({ token: preview.token, approved: true });
    await sending;
    await session.saveConsent({
      id: 'ada-export',
      personId: 'ada',
      scope: 'export',
      granted: false,
      createdAt: stamp,
      updatedAt: stamp,
    });
    resolve(
      response({ title: 'Meal', summary: 'Rice and lentils.', recordingIds: [saved.recording.id] }),
    );
    await expect(pending).rejects.toThrow(/changed|consent|preview/i);
    expect((await session.loadLibrary()).stories).toHaveLength(0);
  });

  // TC13, TC14 / AC6
  it('requires export consent for every recording participant and excludes sealed sources', async () => {
    const { session, saved, fetcher, archiveRoot } = await fixture();
    const archive = await directArchive(archiveRoot);
    await archive.saveRecording({ ...saved.recording, personIds: ['ada', 'lin'] });
    await session.saveConsent({
      id: 'lin-export',
      personId: 'lin',
      scope: 'export',
      granted: false,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await expect(
      session.prepareLlm({ task: 'story', language: 'en', recordingIds: [saved.recording.id] }),
    ).rejects.toThrow(/consent/i);
    await session.sealRecording({ id: saved.recording.id, sealedUntil: '2099-01-01T00:00:00Z' });
    await expect(
      session.prepareLlm({ task: 'story', language: 'en', recordingIds: [saved.recording.id] }),
    ).rejects.toThrow(/sealed/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  // TC17–TC18 / AC7
  it('maps selected clip IDs back to original words and timestamps and rejects invented IDs', async () => {
    const { session, saved, fetcher } = await fixture();
    const segment = saved.transcript?.segments[0];
    if (segment === undefined) throw new Error('Fixture missing');
    let preview = await session.prepareLlm({
      task: 'ask',
      language: 'en',
      question: 'Food?',
      recordingIds: [saved.recording.id],
    });
    fetcher.mockResolvedValue(
      response({ segmentIds: [segment.id], text: 'invented', startMs: 99999 }),
    );
    expect(await session.runLlm({ token: preview.token, approved: true })).toMatchObject({
      task: 'ask',
      response: {
        kind: 'clips',
        clips: [{ text: 'We cooked rice with lentils.', startMs: 0, endMs: 1200 }],
      },
    });
    preview = await session.prepareLlm({
      task: 'ask',
      language: 'en',
      question: 'Food?',
      recordingIds: [saved.recording.id],
    });
    fetcher.mockResolvedValue(response({ segmentIds: ['invented'] }));
    await expect(session.runLlm({ token: preview.token, approved: true })).rejects.toThrow(
      /source|citation/i,
    );
    preview = await session.prepareLlm({
      task: 'ask',
      language: 'en',
      question: 'Unknown?',
      recordingIds: [saved.recording.id],
    });
    fetcher.mockResolvedValue(response({ segmentIds: [] }));
    expect(await session.runLlm({ token: preview.token, approved: true })).toEqual({
      task: 'ask',
      response: { kind: 'unknown' },
    });
  });

  // TC19–TC20 / AC8
  it.each(['story', 'recipe', 'timeline'] as const)(
    'returns a valid %s draft without writing archive records',
    async (task) => {
      const { session, saved, fetcher } = await fixture();
      const draft =
        task === 'story'
          ? { title: 'Meal', summary: 'Rice with lentils.', recordingIds: [saved.recording.id] }
          : task === 'recipe'
            ? {
                title: 'Meal',
                ingredients: ['rice', 'lentils'],
                steps: ['Cook together.'],
                recordingIds: [saved.recording.id],
              }
            : { title: 'Meal', notes: 'Rice with lentils.', recordingIds: [saved.recording.id] };
      const before = await session.loadLibrary();
      const preview = await session.prepareLlm({
        task,
        language: 'en',
        recordingIds: [saved.recording.id],
      });
      fetcher.mockResolvedValue(response(draft));
      expect(await session.runLlm({ token: preview.token, approved: true })).toEqual({
        task,
        draft,
      });
      expect(await session.loadLibrary()).toEqual(before);
    },
  );

  it.each([
    { title: 'Meal', summary: 'Draft', recordingIds: ['invented'] },
    { title: '', summary: 'Draft', recordingIds: [] },
    { title: 'Meal', summary: 'x'.repeat(8001), recordingIds: [] },
  ])('rejects invalid draft content/citations', async (draft) => {
    const { session, saved, fetcher } = await fixture();
    const preview = await session.prepareLlm({
      task: 'story',
      language: 'en',
      recordingIds: [saved.recording.id],
    });
    fetcher.mockResolvedValue(response(draft));
    await expect(session.runLlm({ token: preview.token, approved: true })).rejects.toThrow();
    expect((await session.loadLibrary()).stories).toHaveLength(0);
  });

  // TC15 / AC6, AC9
  it.each([
    { task: 'bad', language: 'en' },
    { task: 'interview', language: 'bad' },
    { task: 'ask', language: 'en', question: 'Food?', recordingIds: [] },
    { task: 'story', language: 'en', recordingIds: ['missing'] },
    { task: 'interview', language: 'en', question: 'x'.repeat(501) },
  ])('rejects invalid requests before network access', async (input) => {
    const { session, fetcher } = await fixture();
    await expect(session.prepareLlm(input)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    {task:'story',fields:{title:'Meal',summary:'x'.repeat(4001)}},
    {task:'timeline',fields:{title:'Meal',notes:'x'.repeat(4001)}},
    {task:'recipe',fields:{title:'Meal',ingredients:Array.from({length:81},()=> 'rice'),steps:['Cook.']}},
    {task:'recipe',fields:{title:'Meal',ingredients:['rice'],steps:['x'.repeat(501)]}},
  ] as const)('rejects a $task draft that cannot fit the archive save parser',async({task,fields})=>{
    const {session,saved,fetcher}=await fixture();
    const preview=await session.prepareLlm({task,language:'en',recordingIds:[saved.recording.id]});
    fetcher.mockResolvedValue(response({...fields,recordingIds:[saved.recording.id]}));
    await expect(session.runLlm({token:preview.token,approved:true})).rejects.toThrow();
  });

});
