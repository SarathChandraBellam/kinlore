import { inflateRawSync } from 'node:zlib';
import { classifyImport } from './media.js';

const MAX_FILES = 200;
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

function crc32(data: Uint8Array): number {
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

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - (22 + 65535));
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  throw new Error('Zip archive is not valid');
}

function readU16(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint16(offset, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, true);
}

function safeZipName(name: string): string {
  const normalized = name.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('Zip entry escapes the archive');
  }
  if (normalized.split('/').some((part) => part === '..' || part === '')) {
    throw new Error('Zip entry escapes the archive');
  }
  return normalized;
}

export function extractZipMedia(zip: Uint8Array): ZipEntry[] {
  const eocd = findEocd(zip);
  const entryCount = readU16(zip, eocd + 10);
  const directorySize = readU32(zip, eocd + 12);
  const directoryOffset = readU32(zip, eocd + 16);
  if (entryCount > MAX_FILES) {
    throw new Error('Zip archive has too many files');
  }
  if (directoryOffset + directorySize > zip.length) {
    throw new Error('Zip archive is not valid');
  }

  const found: ZipEntry[] = [];
  let total = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (readU32(zip, cursor) !== 0x02014b50) {
      throw new Error('Zip archive is not valid');
    }
    const flags = readU16(zip, cursor + 8);
    const method = readU16(zip, cursor + 10);
    const crc = readU32(zip, cursor + 16);
    const compressedSize = readU32(zip, cursor + 20);
    const uncompressedSize = readU32(zip, cursor + 24);
    const nameLength = readU16(zip, cursor + 28);
    const extraLength = readU16(zip, cursor + 30);
    const commentLength = readU16(zip, cursor + 32);
    const localOffset = readU32(zip, cursor + 42);
    const nameBytes = zip.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = safeZipName(new TextDecoder().decode(nameBytes));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) {
      continue;
    }
    if ((flags & 0b1) !== 0 || (flags & 0b1000) !== 0) {
      throw new Error('Zip entry cannot be read');
    }
    if ((flags & ~0x800) !== 0) {
      throw new Error('Zip entry cannot be read');
    }
    if (uncompressedSize > MAX_ENTRY_BYTES || compressedSize > MAX_ENTRY_BYTES) {
      throw new Error('Zip entry is too large');
    }
    if (classifyImport(name) !== 'audio' && classifyImport(name) !== 'video') {
      continue;
    }
    if (readU32(zip, localOffset) !== 0x04034b50) {
      throw new Error('Zip archive is not valid');
    }
    const localNameLength = readU16(zip, localOffset + 26);
    const localExtraLength = readU16(zip, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zip.length) {
      throw new Error('Zip archive is not valid');
    }
    const compressed = zip.subarray(dataStart, dataEnd);
    const inflated =
      method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : undefined;
    if (inflated === undefined) {
      throw new Error('Zip compression is not supported');
    }
    const bytes = Uint8Array.from(inflated);
    if (bytes.length !== uncompressedSize || crc32(bytes) !== crc) {
      throw new Error('Zip entry is not valid');
    }
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error('Zip archive is too large');
    }
    found.push({ name, bytes });
  }
  return found;
}
