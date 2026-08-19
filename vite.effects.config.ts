import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'resources/js/public/pageEffects.ts',
      name: 'JiwonpapaPageEffects',
      formats: ['iife'],
      fileName: () => 'js/page-effects.iife.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
  },
});
