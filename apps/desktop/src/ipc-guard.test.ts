import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAppFrameUrl, resolveAllowedArchivePath } from './ipc-guard.js';

describe('resolveAllowedArchivePath', () => {
  it('accepts a path that is on the allowlist', () => {
    const allowed = path.resolve('/tmp/kinlore-archive');
    expect(resolveAllowedArchivePath(allowed, new Set([allowed]))).toBe(allowed);
  });

  it('rejects a path that was not selected or default', () => {
    const allowed = path.resolve('/tmp/kinlore-archive');
    expect(() => resolveAllowedArchivePath('/tmp/elsewhere', new Set([allowed]))).toThrow(
      /not allowed/,
    );
  });

  it('rejects a non-string path', () => {
    expect(() => resolveAllowedArchivePath(1, new Set())).toThrow(/required/);
  });
});

describe('isAppFrameUrl', () => {
  it('allows the same http origin as the Vite dev server', () => {
    expect(isAppFrameUrl('http://localhost:5173/index.html', 'http://localhost:5173/')).toBe(true);
  });

  it('rejects a different http origin', () => {
    expect(isAppFrameUrl('https://evil.example/', 'http://localhost:5173/')).toBe(false);
  });

  it('allows the renderer file URL', () => {
    const fileUrl = 'file:///tmp/app/out/renderer/index.html';
    expect(isAppFrameUrl(fileUrl, fileUrl)).toBe(true);
  });

  it('rejects another file URL', () => {
    expect(isAppFrameUrl('file:///tmp/other.html', 'file:///tmp/app/out/renderer/index.html')).toBe(
      false,
    );
  });
});
