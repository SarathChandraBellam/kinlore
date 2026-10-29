import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { askFamily, askQuestion, buildAskCorpus } from '@kinlore/ask';
import { coveredTopics, nextPrompts as choosePrompts } from '@kinlore/interview';
import {
  consentAllows,
  isPreferredLanguage,
  isRecordingSealed,
  outboundDisclosure,
  parseConsent,
  parseEntityId,
  parseKeepsake,
  parsePerson,
  parseRecipe,
  parseStory,
  parseTimelineEvent,
  remoteStepResult,
  generatedVoiceDecision,
  type AskResponse,
  type Consent,
  type FamilyAsk,
  type Interview,
  type InterviewPrompt,
  type Keepsake,
  type OutboundDisclosure,
  type OutboundPurpose,
  type Person,
  type PreferredLanguage,
  type Recipe,
  type Recording,
  type Story,
  type TimelineEvent,
  type Transcript,
  type VoiceDecision,
} from '@kinlore/core';
import { NoVoiceEngine, UnavailableSpeechEngine } from '@kinlore/engine';
import {
  classifyImport,
  extractZipMedia,
  mediaRelativePath,
  parseSubtitles,
} from '@kinlore/ingest';
import type {
  ArchiveStatus,
  ArchivePresence,
  CaptureResult,
  EncryptedArchiveResult,
  EngineStatus,
  ImportResult,
  LibrarySnapshot,
  SecretStatus,
} from '@kinlore/ipc-contract';
import { FileSecretStore, type SecretProtection } from '@kinlore/secrets';
import {
  ArchiveEncryptedError,
  createArchiveKeys,
  LocalJsonArchive,
  LocalJsonStorage,
  encryptExistingArchive,
  parseEncryptionEnvelope,
  unlockWithPassphrase,
  unlockWithRecovery,
} from '@kinlore/storage';
import { resolveAllowedArchivePath } from './ipc-guard.js';
import { AssistanceSession } from './assistance.js';

const speechEngine = new UnavailableSpeechEngine();
const voiceEngine = new NoVoiceEngine();
const storage = new LocalJsonStorage();

function nowIso(): string {
  return new Date().toISOString();
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > max) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function decodeMedia(mediaBase64: string): Uint8Array {
  if (!/^[A-Za-z0-9+/=\s]+$/.test(mediaBase64)) {
    throw new Error('Recording data is invalid');
  }
  const bytes = new Uint8Array(Buffer.from(mediaBase64, 'base64'));
  if (bytes.length === 0 || bytes.length > 200 * 1024 * 1024) {
    throw new Error('Recording data is invalid');
  }
  return bytes;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function titleFromName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'Recording';
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^\p{L}\p{N} ._-]+/gu, '').trim();
  return stem.slice(0, 200) || 'Recording';
}

export class ArchiveSession {
  private archive: LocalJsonArchive | undefined;
  private encryptedRoot: string | undefined;
  private encrypted = false;
  private readonly secrets: FileSecretStore;
  private readonly assistance: AssistanceSession;
  private mutating = false;
  readonly allowedArchiveRoots = new Set<string>();
  readonly allowedImports = new Set<string>();

  constructor(secretFile: string, secretProtection?: SecretProtection) {
    this.secrets = new FileSecretStore(secretFile, secretProtection);
    this.assistance = new AssistanceSession(
      this.secrets,
      () => this.archive,
      () => this.loadLibrary(),
    );
  }

  initializeSecretProtection(): Promise<void> {
    return this.secrets.migrate();
  }

  allowRoot(rootPath: string): string {
    const resolved = path.resolve(rootPath);
    this.allowedArchiveRoots.add(resolved);
    return resolved;
  }

  allowImport(filePath: string): string {
    const resolved = path.resolve(filePath);
    this.allowedImports.add(resolved);
    return resolved;
  }

  status(): ArchiveStatus {
    return {
      rootPath: this.archive?.rootPath ?? this.encryptedRoot,
      encrypted: this.encrypted,
      unlocked: this.archive !== undefined,
    };
  }

  private requireArchive(): LocalJsonArchive {
    if (this.archive === undefined) {
      throw new Error('No archive is open');
    }
    return this.archive;
  }

  private requireWritableArchive(): LocalJsonArchive {
    const archive = this.requireArchive();
    if (!this.encrypted) throw new Error('Encrypt this legacy archive before changing family data');
    return archive;
  }

  private async mutate<T>(work: () => Promise<T>): Promise<T> {
    if (this.mutating)
      throw new Error('Another archive change is in progress. Try again afterward.');
    this.mutating = true;
    const finish = this.assistance.beginArchiveChange();
    try {
      return await work();
    } finally {
      this.mutating = false;
      finish();
    }
  }

  private assertRoot(rootPath: string): string {
    return resolveAllowedArchivePath(rootPath, this.allowedArchiveRoots);
  }

  async createArchive(
    rootPath: string,
    passphrase: string,
    replaceExisting = false,
  ): Promise<EncryptedArchiveResult> {
    return this.mutate(async () => {
      this.assistance.invalidate();
      if (typeof passphrase !== 'string')
        throw new Error('A passphrase is required for a new archive');
      const root = this.assertRoot(rootPath);
      const created = await createArchiveKeys(passphrase);
      const replaced = replaceExisting
        ? await storage.replaceWithCodec(root, created.encryption, created.envelope)
        : undefined;
      const archive =
        replaced?.archive ??
        (await storage.createWithCodec(root, created.encryption, created.envelope));
      this.archive = archive;
      this.encrypted = true;
      this.encryptedRoot = root;
      return {
        status: this.status(),
        recoveryKey: created.recoveryKey,
        ...(replaced === undefined ? {} : { backupPath: replaced.backupPath }),
      };
    });
  }

  async inspectArchive(rootPath: string): Promise<ArchivePresence> {
    return storage.inspect(this.assertRoot(rootPath));
  }

  async openArchive(rootPath: string): Promise<ArchiveStatus> {
    return this.mutate(async () => {
      this.assistance.invalidate();
      const root = this.assertRoot(rootPath);
      try {
        this.archive = await storage.open(root);
        this.encrypted = false;
        this.encryptedRoot = undefined;
        return this.status();
      } catch (error) {
        if (error instanceof ArchiveEncryptedError) {
          this.archive = undefined;
          this.encrypted = true;
          this.encryptedRoot = root;
          return this.status();
        }
        throw error;
      }
    });
  }

  async enableEncryption(passphrase: string): Promise<{ recoveryKey: string }> {
    return this.mutate(async () => {
      this.assistance.invalidate();
      const archive = this.requireArchive();
      if (this.encrypted) {
        throw new Error('Archive is already encrypted');
      }
      const result = await encryptExistingArchive(archive, passphrase);
      this.encrypted = true;
      this.encryptedRoot = archive.rootPath;
      return result;
    });
  }

  async unlockArchive(passphrase: string): Promise<ArchiveStatus> {
    await this.unlock(passphrase, 'passphrase');
    return this.status();
  }

  async unlockArchiveWithRecovery(recoveryKey: string): Promise<ArchiveStatus> {
    await this.unlock(recoveryKey, 'recovery');
    return this.status();
  }

  private async unlock(secret: string, mode: 'passphrase' | 'recovery'): Promise<void> {
    return this.mutate(async () => {
      this.assistance.invalidate();
      if (this.encryptedRoot === undefined) {
        throw new Error('No encrypted archive is waiting');
      }
      const probe = new LocalJsonArchive(this.encryptedRoot);
      const raw = await probe.readEncryptionEnvelope();
      if (raw === undefined) {
        throw new Error('Encryption envelope is missing');
      }
      const envelope = parseEncryptionEnvelope(raw);
      const codec =
        mode === 'passphrase'
          ? await unlockWithPassphrase(envelope, secret)
          : await unlockWithRecovery(envelope, secret);
      this.archive = await storage.openWithCodec(this.encryptedRoot, codec);
      this.encrypted = true;
    });
  }

  lockArchive(): ArchiveStatus {
    if (this.mutating) throw new Error('An archive change is in progress. Try locking afterward.');
    this.assistance.invalidate();
    if (this.encrypted) {
      this.encryptedRoot = this.archive?.rootPath ?? this.encryptedRoot;
      this.archive = undefined;
    }
    return this.status();
  }

  async listPeople(): Promise<Person[]> {
    return this.requireArchive().listPeople();
  }

  async savePerson(value: unknown): Promise<Person> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      this.assistance.invalidate();
      return this.requireArchive().savePerson(parsePerson(value));
    });
  }

  async listConsents(): Promise<Consent[]> {
    return this.requireArchive().listConsents();
  }

  async saveConsent(value: unknown): Promise<Consent> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      this.assistance.invalidate();
      const consent = parseConsent(value);
      const people = await this.requireArchive().listPeople();
      if (!people.some((person) => person.id === consent.personId)) {
        throw new Error('That person is not in the archive');
      }
      return this.requireArchive().saveConsent(consent);
    });
  }

  async loadLibrary(): Promise<LibrarySnapshot> {
    const archive = this.requireArchive();
    const [
      people,
      consents,
      recordings,
      transcripts,
      interviews,
      stories,
      keepsakes,
      timeline,
      recipes,
    ] = await Promise.all([
      archive.listPeople(),
      archive.listConsents(),
      archive.listRecordings(),
      archive.listTranscripts(),
      archive.listInterviews(),
      archive.listStories(),
      archive.listKeepsakes(),
      archive.listTimeline(),
      archive.listRecipes(),
    ]);
    return {
      people,
      consents,
      recordings,
      transcripts,
      interviews,
      stories,
      keepsakes,
      timeline,
      recipes,
    };
  }

  async nextPrompts(value: unknown): Promise<InterviewPrompt[]> {
    const record = asRecord(value, 'Prompt request');
    if (typeof record.language !== 'string' || !isPreferredLanguage(record.language)) {
      throw new Error('Language is invalid');
    }
    const language = record.language;
    const personId =
      record.personId === undefined ? undefined : parseEntityId(record.personId, 'Person id');
    const library = await this.loadLibrary();
    const related = library.transcripts.filter((transcript) => {
      if (personId === undefined) {
        return true;
      }
      const recording = library.recordings.find((item) => item.id === transcript.recordingId);
      return recording?.personIds.includes(personId) === true;
    });
    const texts = related.flatMap((transcript) => [
      transcript.question ?? '',
      ...transcript.segments.map((segment) => segment.text),
    ]);
    const usedPromptIds = related.flatMap((transcript) =>
      transcript.promptId === undefined ? [] : [transcript.promptId],
    );
    return choosePrompts({
      language,
      coveredTopics: coveredTopics(texts),
      usedPromptIds,
    });
  }

  async saveCapturedAnswer(value: unknown): Promise<CaptureResult> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      const record = asRecord(value, 'Recording');
      const archive = this.requireArchive();
      const personId = parseEntityId(record.personId, 'Person id');
      if (typeof record.language !== 'string' || !isPreferredLanguage(record.language)) {
        throw new Error('Language is invalid');
      }
      const language = record.language;
      const question = requiredText(record.question, 'Question', 500);
      if (
        record.spokenWords !== undefined &&
        (typeof record.spokenWords !== 'string' || record.spokenWords.trim().length > 8000)
      ) {
        throw new Error('Spoken words are invalid or too long');
      }
      const spokenWords = typeof record.spokenWords === 'string' ? record.spokenWords.trim() : '';
      if (typeof record.extension !== 'string') {
        throw new Error('File type is not supported');
      }
      const extension = record.extension.startsWith('.')
        ? record.extension.toLowerCase()
        : `.${record.extension.toLowerCase()}`;
      const kind = classifyImport(`answer${extension}`);
      if (kind !== 'audio' && kind !== 'video') {
        throw new Error('File type is not supported');
      }
      await this.assertRecordingConsent([personId]);
      if (typeof record.mediaBase64 !== 'string') {
        throw new Error('Recording data is invalid');
      }
      const bytes = decodeMedia(record.mediaBase64);
      const stamp = nowIso();
      const recordingId = randomUUID();
      const recording: Recording = {
        id: recordingId,
        title: question.slice(0, 200),
        personIds: [personId],
        mediaRelativePath: mediaRelativePath(recordingId, extension),
        recordedAt: stamp,
        language,
        origin: 'capture',
        createdAt: stamp,
        updatedAt: stamp,
      };
      if (
        typeof record.durationMs === 'number' &&
        Number.isFinite(record.durationMs) &&
        record.durationMs > 0
      ) {
        recording.durationMs = record.durationMs;
      }
      const transcript: Transcript | undefined =
        spokenWords === ''
          ? undefined
          : {
              id: randomUUID(),
              recordingId,
              source: 'typed',
              question,
              segments: [
                {
                  id: randomUUID(),
                  speakerId: personId,
                  startMs: 0,
                  endMs: recording.durationMs ?? 0,
                  text: spokenWords,
                  language,
                },
              ],
              createdAt: stamp,
              updatedAt: stamp,
            };
      if (transcript !== undefined && record.promptId !== undefined) {
        transcript.promptId = parseEntityId(record.promptId, 'Prompt id');
      }
      await archive.writeMedia(recording.mediaRelativePath, bytes);
      await archive.saveRecording(recording);
      if (transcript !== undefined) await archive.saveTranscript(transcript);
      const interviewId =
        record.interviewId === undefined
          ? undefined
          : parseEntityId(record.interviewId, 'Interview id');
      const interview = await this.rememberInterview(
        interviewId === undefined
          ? { personId, language, question }
          : { personId, language, question, interviewId },
        recordingId,
        stamp,
      );
      return { recording, ...(transcript === undefined ? {} : { transcript }), interview };
    });
  }

  private async rememberInterview(
    input: {
      personId: string;
      language: PreferredLanguage;
      question: string;
      interviewId?: string;
    },
    recordingId: string,
    stamp: string,
  ): Promise<Interview> {
    const archive = this.requireArchive();
    if (input.interviewId !== undefined) {
      const id = parseEntityId(input.interviewId, 'Interview id');
      const existing = (await archive.listInterviews()).find((item) => item.id === id);
      if (existing === undefined) {
        throw new Error('Interview was not found');
      }
      if (!existing.personIds.includes(input.personId)) {
        throw new Error('That person is not part of this interview');
      }
      const interview: Interview = {
        ...existing,
        recordingIds: existing.recordingIds.includes(recordingId)
          ? existing.recordingIds
          : [...existing.recordingIds, recordingId],
        updatedAt: stamp,
      };
      return archive.saveInterview(interview);
    }
    const interview: Interview = {
      id: randomUUID(),
      title: input.question.trim().slice(0, 200),
      personIds: [input.personId],
      language: input.language,
      recordingIds: [recordingId],
      createdAt: stamp,
      updatedAt: stamp,
    };
    return archive.saveInterview(interview);
  }

  async importSelected(value: unknown): Promise<ImportResult> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      const request = asRecord(value, 'Import');
      const archive = this.requireArchive();
      if (!Array.isArray(request.paths) || request.paths.length === 0) {
        throw new Error('Choose a recording to import');
      }
      if (!Array.isArray(request.personIds)) {
        throw new Error('Choose who is speaking');
      }
      const personIds = request.personIds.map((id: unknown, index: number) =>
        parseEntityId(id, `Person id ${String(index)}`),
      );
      await this.assertRecordingConsent(personIds);
      const recordings: Recording[] = [];
      const transcripts: Transcript[] = [];
      for (const candidate of request.paths) {
        if (typeof candidate !== 'string') {
          throw new Error('Import path is not allowed');
        }
        const filePath = path.resolve(candidate);
        if (!this.allowedImports.has(filePath)) {
          throw new Error('Import path is not allowed');
        }
        const imported = await this.importOne(archive, filePath, personIds);
        recordings.push(...imported.recordings);
        transcripts.push(...imported.transcripts);
      }
      if (recordings.length === 0) {
        throw new Error('No audio or video to import');
      }
      return { recordings, transcripts };
    });
  }

  private async importOne(
    archive: LocalJsonArchive,
    filePath: string,
    personIds: string[],
  ): Promise<ImportResult> {
    const kind = classifyImport(filePath);
    const bytes = new Uint8Array(await readFile(filePath));
    if (kind === 'zip') {
      const entries = extractZipMedia(bytes);
      const recordings: Recording[] = [];
      for (const entry of entries) {
        const saved = await this.storeImportedMedia(
          archive,
          entry.name,
          entry.bytes,
          personIds,
          'whatsapp',
        );
        recordings.push(saved);
      }
      return { recordings, transcripts: [] };
    }
    if (kind !== 'audio' && kind !== 'video') {
      return { recordings: [], transcripts: [] };
    }
    const recording = await this.storeImportedMedia(
      archive,
      path.basename(filePath),
      bytes,
      personIds,
      kind === 'video' ? 'video' : 'file',
    );
    const transcript = await this.sidecarTranscript(filePath, recording);
    return {
      recordings: [recording],
      transcripts: transcript === undefined ? [] : [transcript],
    };
  }

  private async storeImportedMedia(
    archive: LocalJsonArchive,
    name: string,
    bytes: Uint8Array,
    personIds: string[],
    origin: NonNullable<Recording['origin']>,
  ): Promise<Recording> {
    const extension = path.extname(name).toLowerCase();
    const stamp = nowIso();
    const id = randomUUID();
    const recording: Recording = {
      id,
      title: titleFromName(name),
      personIds,
      mediaRelativePath: mediaRelativePath(id, extension),
      origin,
      recordedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await archive.writeMedia(recording.mediaRelativePath, bytes);
    return archive.saveRecording(recording);
  }

  private async sidecarTranscript(
    filePath: string,
    recording: Recording,
  ): Promise<Transcript | undefined> {
    const directory = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    for (const extension of ['.srt', '.vtt']) {
      const sidecar = path.join(directory, `${base}${extension}`);
      let raw: string;
      try {
        raw = await readFile(sidecar, 'utf8');
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          continue;
        }
        throw error;
      }
      const cues = parseSubtitles(raw);
      const stamp = nowIso();
      const speakerId = recording.personIds[0];
      const transcript: Transcript = {
        id: randomUUID(),
        recordingId: recording.id,
        source: 'subtitle',
        segments: cues.map((cue) => {
          const segment: Transcript['segments'][number] = {
            id: randomUUID(),
            startMs: cue.startMs,
            endMs: cue.endMs,
            text: cue.text,
          };
          if (speakerId !== undefined) {
            segment.speakerId = speakerId;
          }
          return segment;
        }),
        createdAt: stamp,
        updatedAt: stamp,
      };
      return this.requireArchive().saveTranscript(transcript);
    }
    return undefined;
  }

  async saveStory(value: unknown): Promise<Story> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      const story = parseStory(value);
      await this.assertRecordingsExist(story.recordingIds);
      return this.requireArchive().saveStory(story);
    });
  }

  async saveKeepsake(value: unknown): Promise<Keepsake> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      return this.requireArchive().saveKeepsake(parseKeepsake(value));
    });
  }

  async attachKeepsakeMedia(value: unknown): Promise<Keepsake> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      const request = asRecord(value, 'Keepsake');
      const archive = this.requireArchive();
      const keepsakeId = parseEntityId(request.keepsakeId, 'Keepsake id');
      if (
        typeof request.sourcePath !== 'string' ||
        !this.allowedImports.has(path.resolve(request.sourcePath))
      ) {
        throw new Error('Import path is not allowed');
      }
      const source = path.resolve(request.sourcePath);
      if (classifyImport(source) !== 'image') {
        throw new Error('File type is not supported');
      }
      const keepsake = (await archive.listKeepsakes()).find((item) => item.id === keepsakeId);
      if (keepsake === undefined) {
        throw new Error('Keepsake was not found');
      }
      const bytes = new Uint8Array(await readFile(source));
      const relative = mediaRelativePath(randomUUID(), path.extname(source).toLowerCase());
      await archive.writeMedia(relative, bytes);
      return archive.saveKeepsake({
        ...keepsake,
        mediaRelativePath: relative,
        updatedAt: nowIso(),
      });
    });
  }

  async saveTimelineEvent(value: unknown): Promise<TimelineEvent> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      const event = parseTimelineEvent(value);
      await this.assertRecordingsExist(event.recordingIds);
      return this.requireArchive().saveTimelineEvent(event);
    });
  }

  async saveRecipe(value: unknown): Promise<Recipe> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      const recipe = parseRecipe(value);
      await this.assertRecordingsExist(recipe.recordingIds);
      return this.requireArchive().saveRecipe(recipe);
    });
  }

  async sealRecording(value: unknown): Promise<Recording> {
    return this.mutate(async () => {
      this.requireWritableArchive();
      this.assistance.invalidate();
      const request = asRecord(value, 'Seal');
      const archive = this.requireArchive();
      const id = parseEntityId(request.id, 'Recording id');
      const sealedUntil = requiredText(request.sealedUntil, 'Seal date', 40);
      if (Number.isNaN(Date.parse(sealedUntil)) || Date.parse(sealedUntil) <= Date.now()) {
        throw new Error('Choose a future date');
      }
      const existing = (await archive.listRecordings()).find((item) => item.id === id);
      if (existing === undefined) {
        throw new Error('Recording was not found');
      }
      if (
        existing.sealedUntil !== undefined &&
        Date.parse(sealedUntil) < Date.parse(existing.sealedUntil)
      ) {
        throw new Error('A sealed recording cannot be opened early');
      }
      const recording: Recording = {
        ...existing,
        sealedUntil,
        updatedAt: nowIso(),
      };
      const occasion = typeof request.occasion === 'string' ? request.occasion.trim() : '';
      if (occasion !== '') {
        recording.occasion = occasion.slice(0, 200);
      }
      return archive.saveRecording(recording);
    });
  }

  async ask(value: unknown): Promise<AskResponse> {
    const request = asRecord(value, 'Question');
    const question = requiredText(request.question, 'Question', 500);
    const personId =
      request.personId === undefined ? undefined : parseEntityId(request.personId, 'Person id');
    const corpus = await this.corpus(personId);
    return askQuestion(question, corpus, personId);
  }

  async askEveryone(question: string): Promise<FamilyAsk> {
    const text = requiredText(question, 'Question', 500);
    return askFamily(text, await this.corpus(undefined));
  }

  async mediaUrl(relativePath: string): Promise<string | null> {
    const archive = this.requireArchive();
    if (typeof relativePath !== 'string') {
      return null;
    }
    const normalized = relativePath.replaceAll('\\', '/');
    if (
      normalized.startsWith('/') ||
      normalized.split('/').includes('..') ||
      (!normalized.startsWith('recordings/media/') && !normalized.startsWith('keepsakes/media/'))
    ) {
      return null;
    }
    if (normalized.startsWith('recordings/media/')) {
      const recording = (await archive.listRecordings()).find(
        (item) => item.mediaRelativePath === normalized,
      );
      if (recording === undefined || isRecordingSealed(recording, new Date())) {
        return null;
      }
    }
    const encoded = normalized
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return `kinlore://media/${encoded}`;
  }

  async readMediaIfAllowed(relativePath: string): Promise<Uint8Array | undefined> {
    const url = await this.mediaUrl(relativePath);
    if (url === null) {
      return undefined;
    }
    return this.requireArchive().readMedia(relativePath);
  }

  async secretStatus(account: string): Promise<SecretStatus> {
    return { stored: await this.secrets.has(account), location: 'secret-file' };
  }

  async saveSecret(account: string, secret: string): Promise<void> {
    this.assistance.invalidate();
    await this.secrets.set(account, secret);
  }

  async deleteSecret(account: string): Promise<void> {
    this.assistance.invalidate();
    await this.secrets.delete(account);
  }

  showOutbound(purpose: OutboundPurpose): OutboundDisclosure {
    if (purpose !== 'transcribe' && purpose !== 'interview') {
      throw new Error('Outbound purpose is invalid');
    }
    return outboundDisclosure(purpose);
  }

  runRemoteStep(purpose: OutboundPurpose, approved: boolean, host: string) {
    return remoteStepResult(this.showOutbound(purpose), { approved, purpose, host });
  }

  async voiceDecision(personId: string, enabled: boolean): Promise<VoiceDecision> {
    const id = parseEntityId(personId, 'Person id');
    const granted = consentAllows(
      await this.requireArchive().listConsents(),
      id,
      'generated-voice',
    );
    return generatedVoiceDecision({
      enabled,
      consentGranted: granted,
      modelInstalled: voiceEngine.installed,
    });
  }

  engineStatus(): EngineStatus {
    return {
      speechEngineId: 'none',
      voiceEngineId: 'none',
      voiceInstalled: voiceEngine.installed,
      runsLocally: speechEngine.runsLocally,
    };
  }

  getOpenRouterConfig() {
    return this.assistance.getConfig();
  }

  saveOpenRouterConfig(value: unknown) {
    return this.assistance.saveConfig(value);
  }

  prepareLlm(value: unknown) {
    return this.assistance.prepare(value);
  }

  runLlm(value: unknown) {
    return this.assistance.run(value);
  }

  private async corpus(personId: string | undefined) {
    if (personId !== undefined) {
      parseEntityId(personId, 'Person id');
    }
    const library = await this.loadLibrary();
    const corpus = buildAskCorpus({
      people: library.people,
      recordings: library.recordings,
      transcripts: library.transcripts,
      now: new Date(),
    });
    if (personId === undefined) {
      return corpus;
    }
    return {
      people: corpus.people.filter((person) => person.id === personId),
      segments: corpus.segments,
    };
  }

  private async assertRecordingConsent(personIds: string[]): Promise<void> {
    if (personIds.length === 0) {
      throw new Error('Choose a person who has agreed to be recorded');
    }
    const archive = this.requireArchive();
    const [people, consents] = await Promise.all([archive.listPeople(), archive.listConsents()]);
    for (const id of personIds) {
      if (!people.some((person) => person.id === id)) {
        throw new Error('That person is not in the archive');
      }
      if (!consentAllows(consents, id, 'recording')) {
        throw new Error("Recording needs this person's consent");
      }
    }
  }

  private async assertRecordingsExist(ids: string[]): Promise<void> {
    const recordings = await this.requireArchive().listRecordings();
    for (const id of ids) {
      if (!recordings.some((recording) => recording.id === id)) {
        throw new Error('That recording is not in the archive');
      }
    }
  }
}
