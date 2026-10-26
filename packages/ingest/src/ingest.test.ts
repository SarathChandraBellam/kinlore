import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { classifyImport, mediaRelativePath } from './media.js';
import { parseSubtitles } from './subtitles.js';
import { extractZipMedia } from './zip.js';

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return ~crc >>> 0;
}

function zipWith(name: string, data: Buffer, method: 0 | 8): Uint8Array {
  const stored = method === 0 ? data : deflateRawSync(data);
  const nameBuf = Buffer.from(name);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(stored.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const file = Buffer.concat([local, nameBuf, stored]);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(stored.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const directory = Buffer.concat([central, nameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(file.length, 16);
  return new Uint8Array(Buffer.concat([file, directory, eocd]));
}

describe('ingest', () => {
  it('classifies voice notes, video, and subtitles', () => {
    expect(classifyImport('PTT-2026.opus')).toBe('audio');
    expect(classifyImport('home.mp4')).toBe('video');
    expect(classifyImport('WhatsApp Chat.zip')).toBe('zip');
    expect(classifyImport('notes.txt')).toBeUndefined();
  });

  it('keeps media inside the archive folders', () => {
    expect(mediaRelativePath('rec_1', '.webm')).toBe('recordings/media/rec_1.webm');
    expect(() => mediaRelativePath('../x', '.webm')).toThrow(/invalid/);
    expect(() => mediaRelativePath('rec_1', '.txt')).toThrow(/not supported/);
  });

  it('reads srt cues as spoken words', () => {
    const cues = parseSubtitles('1\n00:00:01,000 --> 00:00:04,200\nWe made pongal.\n');
    expect(cues).toEqual([{ startMs: 1000, endMs: 4200, text: 'We made pongal.' }]);
  });

  it('extracts an audio file from a zip and rejects path escape', () => {
    const audio = extractZipMedia(zipWith('Voice Notes/amma.opus', Buffer.from('abc'), 0));
    expect(audio).toEqual([
      { name: 'Voice Notes/amma.opus', bytes: new Uint8Array(Buffer.from('abc')) },
    ]);
    const deflated = extractZipMedia(zipWith('clip.mp3', Buffer.from('song-bytes'), 8));
    expect(deflated[0]?.bytes).toEqual(new Uint8Array(Buffer.from('song-bytes')));
    expect(() => extractZipMedia(zipWith('../outside.mp3', Buffer.from('no'), 0))).toThrow(
      /escapes/,
    );
  });
});
