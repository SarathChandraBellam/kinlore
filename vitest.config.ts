import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@kinlore/core': path.resolve(rootDir, 'packages/core/src/index.ts'),
      '@kinlore/storage': path.resolve(rootDir, 'packages/storage/src/index.ts'),
      '@kinlore/ipc-contract': path.resolve(rootDir, 'packages/ipc-contract/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    environment: 'node',
  },
});
