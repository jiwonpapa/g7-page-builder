import { defineConfig } from 'vite';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig({
  plugins: [bundleInventory('public-effects')],
  build: {
    lib: {
      entry: 'resources/js/public/pageEffects.ts',
      name: 'JiwonpapaPageEffects',
      formats: ['iife'],
      fileName: () => 'js/page-effects.iife.js',
      cssFileName: 'css/page-builder-public',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
  },
});
