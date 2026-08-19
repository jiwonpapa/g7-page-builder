import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'resources/js/editor/main.tsx',
      name: 'JiwonpapaPageBuilder',
      formats: ['iife'],
      fileName: () => 'page-builder.iife.js',
    },
    outDir: 'dist/js',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
  },
});
