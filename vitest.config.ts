import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@kinlore/core': path.resolve(rootDir, 'packages/core/src/index.ts'),
      '@kinlore/interview': path.resolve(rootDir, 'packages/interview/src/index.ts'),
      '@kinlore/ask': path.resolve(rootDir, 'packages/ask/src/index.ts'),
      '@kinlore/ingest': path.resolve(rootDir, 'packages/ingest/src/index.ts'),
      '@kinlore/secrets': path.resolve(rootDir, 'packages/secrets/src/index.ts'),
      '@kinlore/engine': path.resolve(rootDir, 'packages/engine/src/index.ts'),
      '@kinlore/storage': path.resolve(rootDir, 'packages/storage/src/index.ts'),
      '@kinlore/ipc-contract': path.resolve(rootDir, 'packages/ipc-contract/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/desktop/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
