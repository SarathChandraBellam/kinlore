import { describe, expect, it } from 'vitest';
import { assertReleaseAssets, missingReleaseAssets } from './release-assets.mjs';

describe('release assets', () => {
  it('requires installers for Linux, Windows, and macOS plus checksums', () => {
    expect(missingReleaseAssets(['Kinlore.AppImage', 'Kinlore.exe'])).toEqual([
      'macOS disk image',
      'SHA256SUMS',
    ]);
    expect(() =>
      assertReleaseAssets(['Kinlore.AppImage', 'Kinlore.exe', 'Kinlore.dmg', 'SHA256SUMS']),
    ).not.toThrow();
  });
});
