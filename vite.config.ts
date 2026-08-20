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
    coverage: {
      provider: 'v8',
      include: ['resources/js/**/*.{ts,tsx}'],
      exclude: [
        'resources/js/editor/main.tsx',
        // React/Puck lifecycle wiring is exercised in Playwright; typed conversion stays unit-covered.
        'resources/js/editor/SitePartEditor.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'output/coverage',
      thresholds: {
        statements: 54,
        branches: 54,
        functions: 47,
        lines: 56,
        'resources/js/editor/PuckEditorAdapter.tsx': {
          statements: 80,
          branches: 77,
          functions: 76,
          lines: 81,
        },
      },
    },
  },
}));
