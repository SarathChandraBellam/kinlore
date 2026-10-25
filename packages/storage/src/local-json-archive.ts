import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Consent, Keepsake, Person, Recording, Story } from '@kinlore/core';
import {
  ARCHIVE_DIRS,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  MANIFEST_NAME,
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

function parseManifest(raw: string, root: string): ArchiveManifest {
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
  if (value.version > ARCHIVE_VERSION) {
    throw new Error(
      `Archive version ${String(value.version)} is newer than this app supports (${String(ARCHIVE_VERSION)})`,
    );
  }
  return {
    format: ARCHIVE_FORMAT,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export class LocalJsonStorage implements StorageProvider {
  async create(rootPath: string): Promise<Archive> {
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
    await writeJson(manifestPath, manifest);
    await ensureArchiveDirs(root);
    return new LocalJsonArchive(root);
  }

  async open(rootPath: string): Promise<Archive> {
    const root = path.resolve(rootPath);
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
    parseManifest(raw, root);
    await ensureArchiveDirs(root);
    return new LocalJsonArchive(root);
  }
}

export class LocalJsonArchive implements Archive {
  constructor(readonly rootPath: string) {}

  async getManifest(): Promise<ArchiveManifest> {
    const raw = await readFile(path.join(this.rootPath, MANIFEST_NAME), 'utf8');
    return parseManifest(raw, this.rootPath);
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
    return readJson<Person>(filePath);
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

  async writeMedia(relativePath: string, data: Uint8Array): Promise<void> {
    const target = resolveInsideArchive(this.rootPath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    await this.touchManifest();
  }

  async readMedia(relativePath: string): Promise<Uint8Array> {
    const target = resolveInsideArchive(this.rootPath, relativePath);
    const buffer = await readFile(target);
    return new Uint8Array(buffer);
  }

  private async listEntities<T>(dir: string): Promise<T[]> {
    const abs = path.join(this.rootPath, dir);
    const entries = await readdir(abs, { withFileTypes: true });
    const entities: T[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      entities.push(await readJson<T>(path.join(abs, entry.name)));
    }
    return entities;
  }

  private async saveEntity<T extends { id: string }>(dir: string, entity: T): Promise<T> {
    assertEntityId(entity.id);
    const target = path.join(this.rootPath, dir, `${entity.id}.json`);
    await writeJson(target, entity);
    await this.touchManifest();
    return entity;
  }

  private async touchManifest(): Promise<void> {
    const manifest = await this.getManifest();
    manifest.updatedAt = new Date().toISOString();
    await writeJson(path.join(this.rootPath, MANIFEST_NAME), manifest);
  }
}

async function ensureArchiveDirs(root: string): Promise<void> {
  for (const dir of Object.values(ARCHIVE_DIRS)) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}
