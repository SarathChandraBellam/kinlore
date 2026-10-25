import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  Consent,
  Interview,
  Keepsake,
  Person,
  Recipe,
  Recording,
  Story,
  TimelineEvent,
  Transcript,
} from '@kinlore/core';
import { identityCodec, type ArchiveCodec } from './codec.js';
import {
  ARCHIVE_DIRS,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  ENCRYPTION_ENVELOPE_NAME,
  ENCRYPTED_ARCHIVE_VERSION,
  MANIFEST_NAME,
  MAX_ARCHIVE_VERSION,
  assertEntityId,
  resolveInsideArchive,
} from './layout.js';
import type { Archive, ArchiveManifest, StorageProvider } from './provider.js';

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export class ArchiveEncryptedError extends Error {
  constructor() {
    super('This archive is encrypted. Unlock it with the passphrase or recovery key.');
    this.name = 'ArchiveEncryptedError';
  }
}

export function parseManifest(raw: string, root: string): ArchiveManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Archive manifest is not valid JSON: ${root}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Not a Kinlore archive: ${root}`);
  }
  const value = parsed as Record<string, unknown>;
  if (value.format !== ARCHIVE_FORMAT || typeof value.version !== 'number') {
    throw new Error(`Not a Kinlore archive: ${root}`);
  }
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error(`Archive manifest is missing timestamps: ${root}`);
  }
  if (value.version > MAX_ARCHIVE_VERSION) {
    throw new Error(
      `Archive version ${String(value.version)} is newer than this app supports (${String(MAX_ARCHIVE_VERSION)})`,
    );
  }
  if (value.encrypted !== undefined && typeof value.encrypted !== 'boolean') {
    throw new Error(`Archive manifest encryption flag is invalid: ${root}`);
  }
  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (value.encrypted === true) {
    if (value.version < ENCRYPTED_ARCHIVE_VERSION) {
      throw new Error(`Encrypted archive version is not supported: ${root}`);
    }
    manifest.encrypted = true;
  }
  return manifest;
}

async function readManifestFile(root: string): Promise<ArchiveManifest> {
  const manifestPath = path.join(root, MANIFEST_NAME);
  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`No Kinlore archive found at ${root}`);
    }
    throw error;
  }
  return parseManifest(raw, root);
}

export class LocalJsonStorage implements StorageProvider {
  async create(rootPath: string): Promise<LocalJsonArchive> {
    const root = path.resolve(rootPath);
    await mkdir(root, { recursive: true });
    const manifestPath = path.join(root, MANIFEST_NAME);
    if (await pathExists(manifestPath)) {
      throw new Error(`An archive already exists at ${root}`);
    }
    const now = new Date().toISOString();
    const manifest: ArchiveManifest = {
      format: ARCHIVE_FORMAT,
      version: ARCHIVE_VERSION,
      createdAt: now,
      updatedAt: now,
    };
    await writePlainJson(manifestPath, manifest);
    await ensureArchiveDirs(root);
    return new LocalJsonArchive(root);
  }

  async open(rootPath: string): Promise<LocalJsonArchive> {
    const root = path.resolve(rootPath);
    const manifest = await readManifestFile(root);
    if (manifest.encrypted === true) {
      throw new ArchiveEncryptedError();
    }
    await ensureArchiveDirs(root);
    return new LocalJsonArchive(root);
  }

  async openWithCodec(rootPath: string, codec: ArchiveCodec): Promise<LocalJsonArchive> {
    if (codec.id === 'identity') {
      throw new Error('An encryption key is required');
    }
    const root = path.resolve(rootPath);
    const manifest = await readManifestFile(root);
    if (manifest.encrypted !== true) {
      throw new Error('This archive is not encrypted');
    }
    await ensureArchiveDirs(root);
    const archive = new LocalJsonArchive(root);
    archive.useCodec(codec);
    return archive;
  }
}

export class LocalJsonArchive implements Archive {
  private codec: ArchiveCodec = identityCodec;

  constructor(readonly rootPath: string) {}

  useCodec(codec: ArchiveCodec): void {
    this.codec = codec;
  }

  async getManifest(): Promise<ArchiveManifest> {
    return readManifestFile(this.rootPath);
  }

  listPeople(): Promise<Person[]> {
    return this.listEntities(ARCHIVE_DIRS.people);
  }

  async getPerson(id: string): Promise<Person | undefined> {
    assertEntityId(id);
    const filePath = path.join(this.rootPath, ARCHIVE_DIRS.people, `${id}.json`);
    if (!(await pathExists(filePath))) {
      return undefined;
    }
    return this.readEntity<Person>(filePath);
  }

  savePerson(person: Person): Promise<Person> {
    return this.saveEntity(ARCHIVE_DIRS.people, person);
  }

  listRecordings(): Promise<Recording[]> {
    return this.listEntities(ARCHIVE_DIRS.recordings);
  }

  saveRecording(recording: Recording): Promise<Recording> {
    return this.saveEntity(ARCHIVE_DIRS.recordings, recording);
  }

  listStories(): Promise<Story[]> {
    return this.listEntities(ARCHIVE_DIRS.stories);
  }

  saveStory(story: Story): Promise<Story> {
    return this.saveEntity(ARCHIVE_DIRS.stories, story);
  }

  listKeepsakes(): Promise<Keepsake[]> {
    return this.listEntities(ARCHIVE_DIRS.keepsakes);
  }

  saveKeepsake(keepsake: Keepsake): Promise<Keepsake> {
    return this.saveEntity(ARCHIVE_DIRS.keepsakes, keepsake);
  }

  listConsents(): Promise<Consent[]> {
    return this.listEntities(ARCHIVE_DIRS.consent);
  }

  saveConsent(consent: Consent): Promise<Consent> {
    return this.saveEntity(ARCHIVE_DIRS.consent, consent);
  }

  listTranscripts(): Promise<Transcript[]> {
    return this.listEntities(ARCHIVE_DIRS.transcripts);
  }

  saveTranscript(transcript: Transcript): Promise<Transcript> {
    return this.saveEntity(ARCHIVE_DIRS.transcripts, transcript);
  }

  listInterviews(): Promise<Interview[]> {
    return this.listEntities(ARCHIVE_DIRS.interviews);
  }

  saveInterview(interview: Interview): Promise<Interview> {
    return this.saveEntity(ARCHIVE_DIRS.interviews, interview);
  }

  listTimeline(): Promise<TimelineEvent[]> {
    return this.listEntities(ARCHIVE_DIRS.timeline);
  }

  saveTimelineEvent(event: TimelineEvent): Promise<TimelineEvent> {
    return this.saveEntity(ARCHIVE_DIRS.timeline, event);
  }

  listRecipes(): Promise<Recipe[]> {
    return this.listEntities(ARCHIVE_DIRS.recipes);
  }

  saveRecipe(recipe: Recipe): Promise<Recipe> {
    return this.saveEntity(ARCHIVE_DIRS.recipes, recipe);
  }

  async writeMedia(relativePath: string, data: Uint8Array): Promise<void> {
    const target = resolveInsideArchive(this.rootPath, relativePath);
    const stored = await this.codec.seal(data);
    await writeBytesAtomic(target, stored);
    await this.touchManifest();
  }

  async readMedia(relativePath: string): Promise<Uint8Array> {
    const target = resolveInsideArchive(this.rootPath, relativePath);
    const stored = new Uint8Array(await readFile(target));
    return this.codec.open(stored);
  }

  async listMediaFiles(): Promise<{ relativePath: string; bytes: Uint8Array }[]> {
    const dirs = [ARCHIVE_DIRS.recordingMedia, ARCHIVE_DIRS.keepsakeMedia];
    const found: { relativePath: string; bytes: Uint8Array }[] = [];
    for (const dir of dirs) {
      const absolute = path.join(this.rootPath, dir);
      if (!(await pathExists(absolute))) {
        continue;
      }
      const entries = await readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.name.endsWith('.tmp')) {
          continue;
        }
        const relativePath = `${dir.replaceAll('\\', '/')}/${entry.name}`;
        found.push({ relativePath, bytes: await this.readMedia(relativePath) });
      }
    }
    return found;
  }

  async readEncryptionEnvelope(): Promise<unknown | undefined> {
    const filePath = path.join(this.rootPath, ENCRYPTION_ENVELOPE_NAME);
    if (!(await pathExists(filePath))) {
      return undefined;
    }
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  }

  async writeEncryptionEnvelope(envelope: unknown): Promise<void> {
    await writePlainJson(path.join(this.rootPath, ENCRYPTION_ENVELOPE_NAME), envelope);
  }

  async markEncrypted(): Promise<void> {
    const manifest = await this.getManifest();
    manifest.encrypted = true;
    manifest.version = ENCRYPTED_ARCHIVE_VERSION;
    manifest.updatedAt = new Date().toISOString();
    await writePlainJson(path.join(this.rootPath, MANIFEST_NAME), manifest);
  }

  private async listEntities<T>(dir: string): Promise<T[]> {
    const absolute = path.join(this.rootPath, dir);
    const entries = await readdir(absolute, { withFileTypes: true });
    const entities: T[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      entities.push(await this.readEntity<T>(path.join(absolute, entry.name)));
    }
    return entities;
  }

  private async saveEntity<T extends { id: string }>(dir: string, entity: T): Promise<T> {
    assertEntityId(entity.id);
    const target = path.join(this.rootPath, dir, `${entity.id}.json`);
    await this.writeEntity(target, entity);
    await this.touchManifest();
    return entity;
  }

  private async writeEntity(filePath: string, value: unknown): Promise<void> {
    const plain = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
    const stored = await this.codec.seal(plain);
    await writeBytesAtomic(filePath, stored);
  }

  private async readEntity<T>(filePath: string): Promise<T> {
    const stored = new Uint8Array(await readFile(filePath));
    const plain = await this.codec.open(stored);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }

  private async touchManifest(): Promise<void> {
    const manifest = await this.getManifest();
    manifest.updatedAt = new Date().toISOString();
    await writePlainJson(path.join(this.rootPath, MANIFEST_NAME), manifest);
  }
}

async function ensureArchiveDirs(root: string): Promise<void> {
  for (const dir of Object.values(ARCHIVE_DIRS)) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
}

async function writePlainJson(filePath: string, value: unknown): Promise<void> {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  await writeBytesAtomic(filePath, bytes);
}

async function writeBytesAtomic(filePath: string, data: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, data);
  try {
    await rename(tmpPath, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') {
      throw error;
    }
    await unlink(filePath);
    await rename(tmpPath, filePath);
  }
}
