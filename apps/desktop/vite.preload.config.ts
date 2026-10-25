import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/preload.ts',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    target: 'node20',
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'preload.cjs',
        inlineDynamicImports: true,
      },
    },
  },
});
