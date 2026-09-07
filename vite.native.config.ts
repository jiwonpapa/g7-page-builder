import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig({
  plugins: [react(), bundleInventory('native-editor'), {
    name: 'native-editor-styles',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'css/page-builder-native.css',
        source: readFileSync('resources/css/page-builder-native.css', 'utf8') });
    },
  }],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: 'resources/js/native-editor/entry.ts', name: 'JiwonpapaNativeEditor', formats: ['iife'],
      fileName: () => 'js/page-builder-native.iife.js' },
    outDir: 'dist', emptyOutDir: false, sourcemap: false,
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM', 'react/jsx-runtime': 'ReactJSXRuntime' } } },
  },
});
