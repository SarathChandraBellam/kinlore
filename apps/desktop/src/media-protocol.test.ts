import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchiveSession } from './archive-session.js';
import { buildMediaResponse, handleMediaProtocol, registerMediaScheme } from './media-protocol.js';

const wire = vi.hoisted(() => ({
  handler: null as ((request: Request) => Promise<Response>) | null,
  schemes: [] as unknown[],
}));

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: (schemes: unknown[]) => {
      wire.schemes.push(...schemes);
    },
    handle: (_scheme: string, handler: (request: Request) => Promise<Response>) => {
      wire.handler = handler;
    },
  },
}));

afterEach(() => {
  wire.handler = null;
  wire.schemes = [];
});

async function readBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
}

describe('buildMediaResponse', () => {
  const sample = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

  it('returns 200 OK with full payload and security headers when Range is absent or blank', async () => {
    for (const rangeHeader of [null, '', '   ']) {
      const response = buildMediaResponse(sample, 'audio/webm', rangeHeader);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('audio/webm');
      expect(response.headers.get('Content-Length')).toBe('10');
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
      expectSecurityHeaders(response);
      expect(await readBytes(response)).toEqual(sample);
    }
  });

  it('returns 200 OK with Content-Length 0 for empty media when Range is absent', async () => {
    const response = buildMediaResponse(new Uint8Array(0), 'audio/wav', null);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/wav');
    expect(response.headers.get('Content-Length')).toBe('0');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expectSecurityHeaders(response);
    expect(await readBytes(response)).toEqual(new Uint8Array(0));
  });

  it('returns 206 Partial Content for bounded bytes=start-end ranges', async () => {
    const response = buildMediaResponse(sample, 'video/mp4', 'bytes=2-5');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expectSecurityHeaders(response);
    expect(await readBytes(response)).toEqual(new Uint8Array([30, 40, 50, 60]));

    const singleByte = buildMediaResponse(sample, 'audio/mpeg', 'bytes=0-0');
    expect(singleByte.status).toBe(206);
    expect(singleByte.headers.get('Content-Range')).toBe('bytes 0-0/10');
    expect(singleByte.headers.get('Content-Length')).toBe('1');
    expect(await readBytes(singleByte)).toEqual(new Uint8Array([10]));
  });

  it('returns 206 Partial Content for open-ended bytes=N- ranges', async () => {
    const response = buildMediaResponse(sample, 'audio/ogg', 'bytes=6-');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 6-9/10');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Type')).toBe('audio/ogg');
    expectSecurityHeaders(response);
    expect(await readBytes(response)).toEqual(new Uint8Array([70, 80, 90, 100]));
  });

  it('returns 206 Partial Content for suffix bytes=-N ranges', async () => {
    const response = buildMediaResponse(sample, 'audio/flac', 'bytes=-3');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 7-9/10');
    expect(response.headers.get('Content-Length')).toBe('3');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Type')).toBe('audio/flac');
    expectSecurityHeaders(response);
    expect(await readBytes(response)).toEqual(new Uint8Array([80, 90, 100]));
  });

  it('clamps end and oversized suffix lengths to resource boundaries', async () => {
    const clampedEnd = buildMediaResponse(sample, 'video/mp4', 'bytes=7-999');
    expect(clampedEnd.status).toBe(206);
    expect(clampedEnd.headers.get('Content-Range')).toBe('bytes 7-9/10');
    expect(clampedEnd.headers.get('Content-Length')).toBe('3');
    expectSecurityHeaders(clampedEnd);
    expect(await readBytes(clampedEnd)).toEqual(new Uint8Array([80, 90, 100]));

    const oversizedSuffix = buildMediaResponse(sample, 'video/mp4', 'bytes=-250');
    expect(oversizedSuffix.status).toBe(206);
    expect(oversizedSuffix.headers.get('Content-Range')).toBe('bytes 0-9/10');
    expect(oversizedSuffix.headers.get('Content-Length')).toBe('10');
    expectSecurityHeaders(oversizedSuffix);
    expect(await readBytes(oversizedSuffix)).toEqual(sample);
  });

  it('returns an independent buffer slice when input is a subarray', async () => {
    const backing = new Uint8Array([99, 1, 2, 3, 4, 88]);
    const view = backing.subarray(1, 5);
    const response = buildMediaResponse(view, 'audio/wav', 'bytes=1-2');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4');
    expect(await readBytes(response)).toEqual(new Uint8Array([2, 3]));
  });

  it('returns 416 Range Not Satisfiable for empty payloads when Range is present', () => {
    for (const rangeHeader of ['bytes=0-0', 'bytes=0-', 'bytes=-1', 'malformed']) {
      const response = buildMediaResponse(new Uint8Array(0), 'audio/webm', rangeHeader);
      expect(response.status).toBe(416);
      expect(response.headers.get('Content-Range')).toBe('bytes */0');
      expectSecurityHeaders(response);
    }
  });

  it.each([
    'bytes=10-12',
    'bytes=10-',
    'bytes=999-',
    'bytes=7-3',
    'bytes=-0',
    'bytes=-5-10',
    'bytes=2--5',
    'bytes=-',
    'bytes=',
    'bytes=abc-def',
    'bytes=0-1, 2-3',
    'items=0-3',
    'bytes = 0-3',
    'bytes=0 - 3',
    '0-3',
    'bytes=9999999999999999999999-',
    'bytes=0-9999999999999999999999',
  ])('returns 416 Range Not Satisfiable for out-of-range or malformed %s', (badRange) => {
    const response = buildMediaResponse(sample, 'audio/webm', badRange);
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */10');
    expectSecurityHeaders(response);
  });
});

describe('handleMediaProtocol', () => {
  it('registers the privileged kinlore scheme', () => {
    registerMediaScheme();
    expect(wire.schemes).toEqual([
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
  });

  it('wires request Range headers into buildMediaResponse and enforces host/session guards', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const readMediaIfAllowed = vi.fn(async (relative: string) =>
      relative === 'recordings/media/clip.mp3' ? bytes : undefined,
    );
    const session = { readMediaIfAllowed } as unknown as ArchiveSession;
    handleMediaProtocol(session);
    if (wire.handler === null) {
      throw new Error('Protocol handler was not registered');
    }
    const handler = wire.handler;

    const partial = await handler(
      new Request('kinlore://media/recordings/media/clip.mp3', {
        headers: { Range: 'bytes=1-4' },
      }),
    );
    expect(readMediaIfAllowed).toHaveBeenCalledWith('recordings/media/clip.mp3');
    expect(partial.status).toBe(206);
    expect(partial.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(partial.headers.get('Content-Range')).toBe('bytes 1-4/6');
    expectSecurityHeaders(partial);
    expect(await readBytes(partial)).toEqual(new Uint8Array([2, 3, 4, 5]));

    const wrongHost = await handler(new Request('kinlore://other/recordings/media/clip.mp3'));
    expect(wrongHost.status).toBe(404);

    const forbidden = await handler(new Request('kinlore://media/recordings/media/sealed.mp3'));
    expect(forbidden.status).toBe(403);

    readMediaIfAllowed.mockRejectedValueOnce(new Error('No archive is open'));
    const failed = await handler(new Request('kinlore://media/recordings/media/clip.mp3'));
    expect(failed.status).toBe(404);
  });
});
