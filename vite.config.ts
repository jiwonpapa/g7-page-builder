import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig(({ command }) => ({
  plugins: [react(), bundleInventory('editor')],
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
      fileName: () => 'js/page-builder-editor.iife.js',
      cssFileName: 'css/page-builder-editor',
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
      include: ['resources/js/**/*.{ts,tsx}', 'scripts/lib/blockQualityEvidence.ts', 'scripts/lib/blockQualityInventory.ts', 'scripts/lib/blockQualityStates.ts'],
      exclude: [
        'resources/js/editor/main.tsx',
        // React/Puck lifecycle wiring is exercised in Playwright; typed conversion stays unit-covered.
        'resources/js/editor/SitePartEditor.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'output/coverage',
      thresholds: {
        'scripts/lib/blockQualityEvidence.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'scripts/lib/blockQualityInventory.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'scripts/lib/blockQualityStates.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
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
