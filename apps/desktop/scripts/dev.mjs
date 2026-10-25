import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild, createServer } from 'vite';

const require = createRequire(import.meta.url);
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(desktopRoot, '../..');

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${String(code)}`));
    });
  });
}

const tsc = require.resolve('typescript/bin/tsc');
await run(process.execPath, [tsc, '-b', path.join(repoRoot, 'tsconfig.json')], repoRoot);
await viteBuild({
  configFile: path.join(desktopRoot, 'vite.preload.config.ts'),
  root: desktopRoot,
});

const server = await createServer({
  configFile: path.join(desktopRoot, 'vite.config.ts'),
  root: desktopRoot,
});
await server.listen();

const viteUrl = server.resolvedUrls?.local[0];
if (viteUrl === undefined) {
  throw new Error('Vite did not expose a local URL');
}

const electronBinary = require('electron');
const electron = spawn(electronBinary, ['.'], {
  cwd: desktopRoot,
  env: { ...process.env, VITE_DEV_SERVER_URL: viteUrl },
  stdio: 'inherit',
});

electron.on('exit', (code) => {
  void server.close().finally(() => {
    process.exit(code ?? 0);
  });
});
