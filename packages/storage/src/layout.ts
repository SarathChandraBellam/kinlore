import path from 'node:path';

export const ARCHIVE_FORMAT = 'kinlore-archive';
export const ARCHIVE_VERSION = 1;
export const MANIFEST_NAME = 'kinlore.json';
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
 *   consent/<id>.json
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
  consent: 'consent',
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
