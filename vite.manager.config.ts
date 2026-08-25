import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig(({ command }) => ({
  plugins: [react(), bundleInventory('manager')],
  define: command === 'build'
    ? { 'process.env.NODE_ENV': JSON.stringify('production') }
    : undefined,
  build: {
    lib: {
      entry: 'resources/js/manager/main.tsx',
      name: 'JiwonpapaPageBuilderManager',
      formats: ['iife'],
      fileName: () => 'js/page-builder-manager.iife.js',
      cssFileName: 'css/page-builder-manager',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
  },
}));
