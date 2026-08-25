import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig(({ command }) => ({
  plugins: [react(), bundleInventory('site-part')],
  define: command === 'build'
    ? { 'process.env.NODE_ENV': JSON.stringify('production') }
    : undefined,
  build: {
    lib: {
      entry: 'resources/js/editor/sitePartMain.tsx',
      name: 'JiwonpapaPageBuilderSitePart',
      formats: ['iife'],
      fileName: () => 'js/page-builder-site-part.iife.js',
      cssFileName: 'css/page-builder-site-part',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
  },
}));
