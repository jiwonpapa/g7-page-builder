import { describe, expect, it } from 'vitest';
import documents from '../../resources/compositions/builtin-v3.json';
import { compositionChoices, compositionClipboard } from '../../resources/js/editor-application/v3/compositions';
import { exportStarterCompositions } from '../../scripts/lib/exportV3Compositions';
import fixture from '../Contract/document-v3.fixture.json';
import { designPolicyV3, validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { copyTree } from '../../resources/js/documents/v3/clipboard';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('declarative built-in starter documents', () => {
  it('inserts every declared data capability through the same paste and remaps authored control references', () => {
    const choices = compositionChoices(documents).filter(choice => [...indexTree(choice.source).values()].some(item => item.node.data));
    const sources = new Set<string>();
    for (const choice of choices) {
      const original = [...indexTree(choice.source).values()].find(item => item.node.data)!;
      sources.add(original.node.data!.source);
      const target = validateDocumentV3(structuredClone(fixture)); target.blocks = []; target.assets = [];
      let counter = 0;
      const nextId = () => '88000000-0000-4000-8000-' + String(++counter).padStart(12, '0');
      const result = executeTreeCommand(target, { kind: 'paste', clipboard: compositionClipboard(choice), destination: { parentId: null, index: 0 } }, nextId);
      const tree = indexTree(result.document), inserted = [...tree.values()].find(item => item.node.data)!.node.data!;
      expect(validateDocumentV3(result.document)).toEqual(result.document);
      for (const field of inserted.fields) expect(tree.has(field.node_id)).toBe(true);
      expect(inserted.fields.map(field => field.node_id)).not.toEqual(original.node.data!.fields.map(field => field.node_id));
      if (inserted.controls) {
        for (const value of Object.values(inserted.controls)) if (typeof value === 'string') expect(tree.has(value)).toBe(true);
        expect(inserted.controls).not.toEqual(original.node.data!.controls);
        const before = JSON.stringify(target);
        expect(() => executeTreeCommand(target, { kind: 'paste', clipboard: copyTree(choice.source, [original.node.instance_id]), destination: { parentId: null, index: 0 } }, nextId)).toThrow('data_clipboard:');
        expect(JSON.stringify(target)).toBe(before);
      }
    }
    expect([...sources].sort()).toEqual(Object.keys(designPolicyV3.data.feeds).sort());
  });

  it('preserves the exact 63 existing starter trees as versioned data, not runtime factories', () => {
    const reference = validateDocumentV3(structuredClone(fixture)); reference.blocks = [];
    reference.assets[0].url = '/modules/jiwonpapa-page_builder/store/previews/local-business-hero.webp';
    expect(documents.slice(0, 63)).toEqual(exportStarterCompositions(reference).map(entry => entry.document));
    const choices = compositionChoices(documents.slice(0, 68));
    expect(choices).toHaveLength(68);
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
