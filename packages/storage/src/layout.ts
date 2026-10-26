import path from 'node:path';

export const ARCHIVE_FORMAT = 'kinlore-archive';
/** Version written for a plaintext archive. */
export const ARCHIVE_VERSION = 1;
/** Newest manifest version this app can open. Version 2 is an encrypted archive. */
export const MAX_ARCHIVE_VERSION = 2;
export const ENCRYPTED_ARCHIVE_VERSION = 2;
export const MANIFEST_NAME = 'kinlore.json';
export const ENCRYPTION_ENVELOPE_NAME = 'encryption.json';
export const DEFAULT_ARCHIVE_DIRNAME = 'KinloreArchive';

/**
 * Portable on-disk layout of a Kinlore archive folder.
 *
 * ```
 * <root>/                          # user-chosen folder, or <appData>/KinloreArchive
 *   kinlore.json                   # { format, version, createdAt, updatedAt }
 *   people/<id>.json
 *   recordings/<id>.json
 *   recordings/media/<file>
 *   stories/<id>.json
 *   keepsakes/<id>.json
 *   keepsakes/media/<file>
 *   consent/<id>.json
 *   transcripts/<id>.json
 *   interviews/<id>.json
 *   timeline/<id>.json
 *   recipes/<id>.json
 *   encryption.json            # only when the archive is encrypted; wrapped keys, not the data key
 * ```
 *
 * Metadata is pretty-printed JSON so the archive can be copied, inspected, and
 * backed up without Kinlore. SQLite may replace JSON later behind StorageProvider.
 */
export const ARCHIVE_DIRS = {
  people: 'people',
  recordings: 'recordings',
  recordingMedia: path.join('recordings', 'media'),
  stories: 'stories',
  keepsakes: 'keepsakes',
  keepsakeMedia: path.join('keepsakes', 'media'),
  consent: 'consent',
  transcripts: 'transcripts',
  interviews: 'interviews',
  timeline: 'timeline',
  recipes: 'recipes',
} as const;

const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function assertEntityId(id: string): void {
  if (!ENTITY_ID_PATTERN.test(id)) {
    throw new Error(`Invalid entity id: ${id}`);
  }
}

export function resolveInsideArchive(rootPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error('Absolute paths are not allowed inside an archive');
  }
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error('Path escapes the archive root');
  }
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Path escapes the archive root');
  }
  return resolved;
}
