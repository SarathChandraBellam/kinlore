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

type ByteRange = {
  start: number;
  end: number;
};

function parseByteRange(header: string, totalLength: number): ByteRange | undefined {
  const suffixMatch = /^bytes=-(\d+)$/i.exec(header);
  if (suffixMatch !== null) {
    const rawSuffix = suffixMatch[1];
    if (rawSuffix === undefined) {
      return undefined;
    }
    const suffixLength = Number(rawSuffix);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return undefined;
    }
    return {
      start: Math.max(0, totalLength - suffixLength),
      end: totalLength - 1,
    };
  }

  const rangeMatch = /^bytes=(\d+)-(\d*)$/i.exec(header);
  if (rangeMatch === null) {
    return undefined;
  }
  const rawStart = rangeMatch[1];
  const rawEnd = rangeMatch[2];
  if (rawStart === undefined) {
    return undefined;
  }
  const start = Number(rawStart);
  if (!Number.isSafeInteger(start) || start >= totalLength) {
    return undefined;
  }
  if (rawEnd === undefined || rawEnd === '') {
    return { start, end: totalLength - 1 };
  }
  const parsedEnd = Number(rawEnd);
  if (!Number.isSafeInteger(parsedEnd) || parsedEnd < start) {
    return undefined;
  }
  return {
    start,
    end: Math.min(parsedEnd, totalLength - 1),
  };
}

function unsatisfiableRange(totalLength: number): Response {
  return new Response(null, {
    status: 416,
    headers: {
      'Content-Range': `bytes */${totalLength}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function buildMediaResponse(
  bytes: Uint8Array,
  mimeType: string,
  rangeHeader: string | null,
): Response {
  const trimmedRange = rangeHeader?.trim() ?? '';
  if (trimmedRange === '') {
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(bytes.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (bytes.length === 0) {
    return unsatisfiableRange(0);
  }

  const range = parseByteRange(trimmedRange, bytes.length);
  if (range === undefined) {
    return unsatisfiableRange(bytes.length);
  }

  const slice = new Uint8Array(bytes.subarray(range.start, range.end + 1));
  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}`,
      'Content-Length': String(slice.length),
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

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
      return buildMediaResponse(bytes, type, request.headers.get('range'));
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
