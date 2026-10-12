import { describe, expect, it } from 'vitest';
import documents from '../../resources/compositions/builtin-v3.json';
import { compositionChoices, compositionClipboard } from '../../resources/js/editor-application/v3/compositions';
import { exportStarterCompositions } from '../../scripts/lib/exportV3Compositions';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('declarative built-in starter documents', () => {
  it('preserves the exact 63 existing starter trees as versioned data, not runtime factories', () => {
    const reference = validateDocumentV3(structuredClone(fixture)); reference.blocks = [];
    reference.assets[0].url = '/modules/jiwonpapa-page_builder/store/previews/local-business-hero.webp';
    expect(documents).toEqual(exportStarterCompositions(reference).map(entry => entry.document));
    const choices = compositionChoices(documents);
    expect(choices).toHaveLength(63);
    for (const choice of choices) {
      expect(compositionClipboard(choice).ids).toHaveLength(1);
      for (const asset of choice.source.assets) {
        const prefix = '/modules/jiwonpapa-page_builder/store/previews/';
        expect(asset.url.startsWith(prefix)).toBe(true);
        expect(existsSync(resolve('resources/store/dist/previews', asset.url.slice(prefix.length)))).toBe(true);
      }
    }
  });
  it('keeps every legacy block factory and manifest outside the editor source graph', () => {
    const script = "import {readEditorSourceGraph} from './scripts/lib/editorSourceGraph.mjs';"
      + "const graph=await readEditorSourceGraph(process.cwd(),['resources/js/editor/v3/mount.tsx']);console.log(JSON.stringify(graph.files));";
    const files: string[] = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }));
    expect(files).toContain('resources/compositions/builtin-v3.json');
    expect(files).toContain('resources/js/editor-application/v3/compositions.ts');
    expect(files.filter(file => file.startsWith('resources/js/blocks/') || file.startsWith('resources/block-packs/') || file.startsWith('scripts/'))).toEqual([]);
    const core = readFileSync('resources/js/editor/v3/StructureEditor.tsx', 'utf8');
    expect(core).not.toMatch(/createBasicComposition|createRepeatedComposition|createStaticComposition/);
  });
});
