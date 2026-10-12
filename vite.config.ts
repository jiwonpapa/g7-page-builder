import { defineConfig } from 'vitest/config';
import { normalizePath, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { puckHistoryCorrection } from './vite.puck-history';
import { bundleInventory } from './vite.bundle-inventory';

function jsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Build-only encoding of the existing JSON. Share immutable strings and object
// constructors, never mutable catalog objects. No decoder, eval, or extra fetch
// is shipped; ordinary ESM exports remain tree-shakeable.
export function compileBuiltinCatalog(source: string): string {
  const data: unknown = JSON.parse(source);
  if (!jsonObject(data)) throw new Error('The builtin catalog must be a JSON object.');
  const counts = new Map<string, number>();
  const shapes = new Map<string, { keys: string[]; count: number }>();
  function collect(value: unknown): void {
    if (typeof value === 'string') counts.set(value, (counts.get(value) ?? 0) + 1);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (jsonObject(value)) {
      const keys = Object.keys(value);
      const signature = JSON.stringify(keys);
      const shape = shapes.get(signature) ?? { keys, count: 0 };
      shape.count++;
      shapes.set(signature, shape);
      Object.values(value).forEach(collect);
    }
  }
  collect(data);
  // Short/rare literals and shapes cost more indirection than they save.
  const strings = [...counts].filter(([value, count]) => value.length >= 12 && count >= 2)
    .map(([value]) => value).sort();
  const names = new Map(strings.map((value, index) => [value, `s${index}`]));
  const factories = new Map([...shapes].filter(([, shape]) => shape.keys.length >= 3 && shape.count >= 3)
    .map(([signature, shape], index) => [signature, { ...shape, name: `o${index}` }]));
  const property = (key: string): string => key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);
  function literal(value: unknown): string {
    if (typeof value === 'string') return names.get(value) ?? JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(literal).join(',')}]`;
    if (jsonObject(value)) {
      const factory = factories.get(JSON.stringify(Object.keys(value)));
      if (factory) return `${factory.name}(${Object.values(value).map(literal).join(',')})`;
      return `{${Object.entries(value).map(([key, item]) => `${property(key)}:${literal(item)}`).join(',')}}`;
    }
    if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
    if (value === null || typeof value === 'boolean') return String(value);
    throw new Error('Unsupported builtin catalog value.');
  }
  const constructors = [...factories.values()].map(({ keys, name }) =>
    `const ${name}=(${keys.map((_, index) => `a${index}`).join(',')})=>({${keys.map((key, index) => `${property(key)}:a${index}`).join(',')}});`,
  ).join('');
  const declarations = strings.map((value, index) => `const s${index}=${JSON.stringify(value)};`).join('');
  const entries = Object.entries(data);
  const exports = entries.map(([key, value], index) =>
    `const e${index}=${literal(value)};${key === 'default' ? '' : `export {e${index} as ${JSON.stringify(key)}};`}`,
  ).join('');
  const defaults = entries.map(([key], index) => `${property(key)}:e${index}`).join(',');
  return `${constructors}${declarations}${exports}export default {${defaults}};`;
}

export function builtinCatalogLiterals(): Plugin {
  let catalogPath = '';
  return {
    name: 'g7pb-builtin-catalog-literals',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      catalogPath = normalizePath(resolve(config.root, 'resources/block-packs/builtin-core/manifest.json'));
    },
    transform(_code, id) {
      if (normalizePath(id) !== catalogPath) return;
      return { code: compileBuiltinCatalog(readFileSync(catalogPath, 'utf8')), map: null };
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [puckHistoryCorrection(), react(), builtinCatalogLiterals(), bundleInventory('editor')],
  define: command === 'build'
    ? {
        'process.env.NODE_ENV': JSON.stringify('production'),
      }
    : undefined,
  build: {
    lib: {
      entry: 'resources/js/editor/main.tsx',
      name: 'JiwonpapaPageBuilder',
      formats: ['iife'],
      fileName: () => 'js/page-builder-editor.iife.js',
      cssFileName: 'css/page-builder-editor',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/Unit/**/*.test.ts', 'tests/Unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['resources/js/**/*.{ts,tsx}', 'scripts/lib/blockQualityEvidence.ts', 'scripts/lib/blockQualityInventory.ts', 'scripts/lib/blockQualityStates.ts'],
      exclude: [
        'resources/js/editor/main.tsx',
        // React/Puck lifecycle wiring is exercised in Playwright; typed conversion stays unit-covered.
        'resources/js/editor/SitePartEditor.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'output/coverage',
      thresholds: {
        'resources/js/editor/puckDocumentAdapter.ts': { statements: 80, branches: 77, functions: 76, lines: 81 },
        'resources/js/documents/layoutPolicy.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'resources/js/documents/layoutTree.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'scripts/lib/blockQualityEvidence.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'scripts/lib/blockQualityInventory.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'scripts/lib/blockQualityStates.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        statements: 54,
        branches: 54,
        functions: 47,
        lines: 56,
        'resources/js/editor/PuckEditorAdapter.tsx': {
          statements: 80,
          branches: 77,
          functions: 76,
          lines: 81,
        },
      },
    },
  },
}));
