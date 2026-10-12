import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinCatalogLiterals } from './vite.config';
import { puckHistoryCorrection } from './vite.puck-history';
import { bundleInventory } from './vite.bundle-inventory';
import { localInterFonts } from './vite.inter-fonts.js';

export default defineConfig({
  plugins: [puckHistoryCorrection(), react(), builtinCatalogLiterals(), bundleInventory('structure-editor'), localInterFonts()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: 'resources/js/editor/v3/entry.tsx', name: 'JiwonpapaStructureEditor', formats: ['iife'],
      fileName: () => 'js/page-builder-structure.iife.js', cssFileName: 'css/page-builder-structure' },
    outDir: 'dist', emptyOutDir: false, sourcemap: false,
  },
});
