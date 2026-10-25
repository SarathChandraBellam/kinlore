import path from 'node:path';

export function resolveAllowedArchivePath(
  rootPath: unknown,
  allowedRoots: ReadonlySet<string>,
): string {
  if (typeof rootPath !== 'string' || rootPath.trim() === '') {
    throw new Error('Archive path is required');
  }
  const resolved = path.resolve(rootPath);
  if (!allowedRoots.has(resolved)) {
    throw new Error('Archive path is not allowed');
  }
  return resolved;
}

export function isAppFrameUrl(senderUrl: string, appUrl: string): boolean {
  let sender: URL;
  let app: URL;
  try {
    sender = new URL(senderUrl);
    app = new URL(appUrl);
  } catch {
    return false;
  }
  if (app.protocol === 'file:') {
    return sender.protocol === 'file:' && sender.pathname === app.pathname;
  }
  return sender.origin === app.origin;
}
