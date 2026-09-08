import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleInventory } from './vite.bundle-inventory';

export default defineConfig(({ mode }) => {
  const compositions = mode === 'compositions';
  return {
  plugins: [react(), bundleInventory(compositions ? 'native-compositions' : 'native-editor'), {
    name: 'native-editor-styles',
    generateBundle() {
      if (compositions) return;
      this.emitFile({ type: 'asset', fileName: 'css/page-builder-native.css',
        source: readFileSync('resources/css/page-builder-native.css', 'utf8') });
    },
  }],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: compositions ? 'resources/js/native-editor/compositionEntry.tsx' : 'resources/js/native-editor/entry.ts',
      name: compositions ? 'JiwonpapaNativeCompositions' : 'JiwonpapaNativeEditor', formats: ['iife'],
      fileName: () => compositions ? 'js/page-builder-native-compositions.iife.js' : 'js/page-builder-native.iife.js' },
    outDir: 'dist', emptyOutDir: false, sourcemap: false,
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM', 'react/jsx-runtime': 'ReactJSXRuntime' } } },
  },
  };
});
