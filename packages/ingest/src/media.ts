const MEDIA_EXTENSIONS = new Set([
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.webm',
  '.flac',
  '.mp4',
  '.mov',
  '.mkv',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export type ImportKind = 'audio' | 'video' | 'zip' | 'image' | 'subtitle';

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) {
    return '';
  }
  return base.slice(dot).toLowerCase();
}

export function classifyImport(fileName: string): ImportKind | undefined {
  const extension = extensionOf(fileName);
  if (extension === '.zip') {
    return 'zip';
  }
  if (extension === '.srt' || extension === '.vtt') {
    return 'subtitle';
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (extension === '.mp4' || extension === '.mov' || extension === '.mkv') {
    return 'video';
  }
  if (MEDIA_EXTENSIONS.has(extension)) {
    return 'audio';
  }
  return undefined;
}

export function mediaRelativePath(id: string, extension: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('Recording id is invalid');
  }
  const normalized = extension.toLowerCase();
  if (!MEDIA_EXTENSIONS.has(normalized) && !IMAGE_EXTENSIONS.has(normalized)) {
    throw new Error('File type is not supported');
  }
  const folder = IMAGE_EXTENSIONS.has(normalized) ? 'keepsakes/media' : 'recordings/media';
  return `${folder}/${id}${normalized}`;
}
