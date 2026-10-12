import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinCatalogLiterals } from './vite.config';
import { puckHistoryCorrection } from './vite.puck-history';
import { bundleInventory } from './vite.bundle-inventory';
import { localInterFonts } from './vite.inter-fonts.js';

export default defineConfig({
  base: '/api/modules/assets/jiwonpapa-page_builder/dist/',
  plugins: [puckHistoryCorrection(), react(), builtinCatalogLiterals(), bundleInventory('structure-editor'), localInterFonts(), {
    name: 'g7pb-composition-data-asset',
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !/^data\/builtin-v3-[\w-]+\.json$/.test(asset.fileName)) continue;
        const source = typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source);
        asset.source = JSON.stringify(JSON.parse(source));
      }
    },
  }],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: 'resources/js/editor/v3/entry.tsx', name: 'JiwonpapaStructureEditor', formats: ['iife'],
      fileName: () => 'js/page-builder-structure.iife.js', cssFileName: 'css/page-builder-structure' },
    outDir: 'dist', emptyOutDir: false, sourcemap: false,
    rollupOptions: { output: { assetFileNames: asset => asset.names.includes('builtin-v3.json')
      ? 'data/[name]-[hash][extname]' : '[name][extname]' } },
  },
});
