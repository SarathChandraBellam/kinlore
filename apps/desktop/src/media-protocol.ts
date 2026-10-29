import path from 'node:path';
import { protocol } from 'electron';
import type { ArchiveSession } from './archive-session.js';

const MIME: Record<string, string> = {
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'kinlore',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

export function handleMediaProtocol(session: ArchiveSession): void {
  protocol.handle('kinlore', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'media') {
        return new Response('Not found', { status: 404 });
      }
      const relative = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const bytes = await session.readMediaIfAllowed(relative);
      if (bytes === undefined) {
        return new Response('Not available', { status: 403 });
      }
      const type = MIME[path.extname(relative).toLowerCase()] ?? 'application/octet-stream';
      return new Response(bytes, {
        headers: {
          'Content-Type': type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
