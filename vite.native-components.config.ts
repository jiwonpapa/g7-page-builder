import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleInventory } from './vite.bundle-inventory';
import { nativeEditorSpec, nativeComponentManifest } from './resources/js/native-components/spec';

export default defineConfig({
  plugins: [react(), bundleInventory('native-components'), {
    name: 'native-components-companion',
    generateBundle() {
      for (const [fileName, value] of Object.entries({ 'editor-spec.json': nativeEditorSpec, 'components.json': nativeComponentManifest })) {
        this.emitFile({ type: 'asset', fileName: 'native-components/' + fileName, source: JSON.stringify(value, null, 2) + '\n' });
      }
      this.emitFile({ type: 'asset', fileName: 'css/page-builder-native-components.css',
        source: readFileSync('resources/css/page-builder-native-components.css', 'utf8') });
    },
  }],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: 'resources/js/native-components/entry.ts', name: 'JiwonpapaNativeComponents', formats: ['iife'],
      fileName: () => 'js/page-builder-native-components.iife.js' },
    outDir: 'dist', emptyOutDir: false, sourcemap: false,
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM', 'react/jsx-runtime': 'ReactJSXRuntime' } } },
  },
});
