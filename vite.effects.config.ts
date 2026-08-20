import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

function publicPageStyles(): string {
  const template = readFileSync(new URL('./resources/views/viewer.blade.php', import.meta.url), 'utf8');
  const style = template.match(/<style>\s*([\s\S]*?)\s*<\/style>/u)?.[1] ?? '';
  const start = style.indexOf('.g7pb-page {');

  if (start < 0) {
    throw new Error('The scoped public page styles could not be extracted from viewer.blade.php.');
  }

  const scoped = style.slice(start)
    .split('\n')
    .map((line) => line.replace(/^ {8}/u, ''))
    .join('\n')
    .trim();

  return `${scoped}\n\n.g7pb-template-preview-banner {\n  position: relative;\n  z-index: 2;\n  padding: .7rem 1rem;\n  color: #fff;\n  background: #172033;\n  font-size: .82rem;\n  font-weight: 750;\n  text-align: center;\n}\n`;
}

export default defineConfig({
  plugins: [{
    name: 'g7pb-public-page-styles',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'css/page-builder-public.css',
        source: publicPageStyles(),
      });
    },
  }],
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
