import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: command === 'build'
    ? {
        'process.env.NODE_ENV': JSON.stringify('production'),
      }
    : undefined,
  build: {
    lib: {
      entry: 'resources/js/editor/main.tsx',
      name: 'JiwonpapaPageBuilder',
      formats: ['iife'],
      fileName: () => 'js/page-builder.iife.js',
      cssFileName: 'css/page-builder',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/Unit/**/*.test.ts', 'tests/Unit/**/*.test.tsx'],
  },
}));
