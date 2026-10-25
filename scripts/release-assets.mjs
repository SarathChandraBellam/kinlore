import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED = [
  { label: 'Linux AppImage', test: (name) => name.endsWith('.AppImage') },
  { label: 'Windows installer', test: (name) => name.endsWith('.exe') },
  { label: 'macOS disk image', test: (name) => name.endsWith('.dmg') },
  { label: 'SHA256SUMS', test: (name) => name === 'SHA256SUMS' },
];

export function missingReleaseAssets(fileNames) {
  return REQUIRED.filter((required) => !fileNames.some((name) => required.test(name))).map(
    (required) => required.label,
  );
}

export function assertReleaseAssets(fileNames) {
  const missing = missingReleaseAssets(fileNames);
  if (missing.length > 0) {
    throw new Error(`Release is missing assets: ${missing.join(', ')}`);
  }
}

async function main() {
  const dir = process.argv[2];
  if (dir === undefined || dir === '') {
    throw new Error('Usage: node scripts/release-assets.mjs <directory>');
  }
  const names = await readdir(dir);
  assertReleaseAssets(names);
  console.log(`Release assets ok (${String(names.length)} files)`);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Release asset check failed');
    process.exitCode = 1;
  });
}
