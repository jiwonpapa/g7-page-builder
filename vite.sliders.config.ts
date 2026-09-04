import { defineConfig } from 'vite';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig({
  plugins: [bundleInventory('public-sliders')],
  build: {
    lib: {
      entry: 'resources/js/public/publicSliderEntry.ts',
      name: 'JiwonpapaPageSliders',
      formats: ['iife'],
      fileName: () => 'js/page-sliders.iife.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
  },
});
