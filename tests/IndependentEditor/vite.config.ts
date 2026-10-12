import { defineConfig } from 'vite';
import { patchPuckHistory } from '../../vite.puck-history';

let corrected = false;

export default defineConfig({
  plugins: [{
    name: 'ip1-reviewed-puck-history', enforce: 'pre', apply: 'build',
    transform(source, id) {
      if (id.endsWith('/@puckeditor/core/dist/index.css')) {
        const remoteFont = '@import "https://rsms.me/inter/inter.css";';
        if (!source.startsWith(remoteFont)) throw new Error('Review changed Puck font import');
        return source.replace(remoteFont, '/* IP1 offline fixture uses system font. */');
      }
      if (!id.includes('/@puckeditor/core/dist/') || !source.includes('createHistorySlice = (set, get) => {')) return;
      const code = patchPuckHistory(source);
      corrected = true;
      return { code, map: null };
    },
    buildEnd(error) { if (!error && !corrected) throw new Error('Reviewed product Puck history correction was not applied'); },
  }],
  build: { target: 'es2022', manifest: true },
});
