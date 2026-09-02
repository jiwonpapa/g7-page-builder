import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPendingEvidence, fingerprintEvidence } from '../../scripts/lib/blockQualityEvidence';
// @ts-expect-error The Node CLI exposes a read-only JS diagnostic interface without a declaration file.
import { inspectStoredEvidence } from '../../scripts/check-block-quality-evidence.mjs';
import { collectBlockQualityInventory as collectInventory, compareEvidenceFingerprints, QUALITY_DEPENDENCY_FILES, QUALITY_DEPENDENCY_TREES } from '../../scripts/lib/blockQualityInventory';
import { collectBlockQualityStates, QUALITY_STATE_SOURCE_FILES } from '../../scripts/lib/blockQualityStates';
import stateFixtures from '../Fixtures/block-quality-states.json';

const collectBlockQualityInventory = (root: string, facts: unknown) => collectInventory(root, facts, collectBlockQualityStates(root));

const temporary: string[] = [];
const HASH = 'a'.repeat(64);
const URL = '/modules/jiwonpapa-page_builder/store/previews/demo.webp';
const block = { block_id: 'content.demo-01', block_version: 1, label: { ko: '데모' }, description: { ko: '검증용 설명' }, category: 'content', editor_component: 'Demo', compiler: 'builtin.demo', capabilities: [], thumbnail: 'thumbnails/demo.png' };
const preset = { preset_id: 'demo.first', block_id: block.block_id, block_version: 1, label: { ko: '데모 첫 구성' }, description: { ko: '예시 목적' }, props: { heading: '데모 문구' }, thumbnail: 'thumbnails/preset.png' };
const ids = [`block:${block.block_id}@1`, 'preset:jiwonpapa/builtin-core:demo.first'];
const facts = () => ids.map(catalog_id => ({ catalog_id, source_hash: HASH, semantic_hash: HASH, public_css_hash: HASH, asset_urls: [URL], evidence_version: 'g7pb-render-fixture-evidence/v1' }));
const fingerprints = (root: string, source: unknown = facts()) => collectBlockQualityInventory(root, source).items.map(item => fingerprintEvidence(item.catalog_id, item.inputs));

function write(root: string, path: string, contents: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), contents);
}
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'g7pb-evidence-inventory-'));
  temporary.push(root);
  for (const path of QUALITY_DEPENDENCY_FILES) write(root, path, '{}');
  for (const path of QUALITY_DEPENDENCY_TREES) write(root, `${path}/sample.txt`, 'dependency');
  write(root, 'resources/js/editor/Demo.tsx', 'export const components = { Demo: {} };');
  for (const path of QUALITY_STATE_SOURCE_FILES) write(root, path, 'state input');
  write(root, QUALITY_STATE_SOURCE_FILES[0], JSON.stringify(stateFixtures));
  write(root, 'resources/block-packs/builtin-core/manifest.json', JSON.stringify({ pack_id: 'jiwonpapa/builtin-core', blocks: [block], presets: [preset] }));
  write(root, 'docs/productization/inventory.json', JSON.stringify({ definitions: [{ id: block.block_id, block_version: 1, supply_kind: 'composite-section', current_editing: { fields: [], collections: [], directMedia: false, dynamicData: false } }], presets: [{ id: preset.preset_id, block_id: block.block_id, block_version: 1, supply_kind: 'section-candidate', required_states: ['default', 'long-copy', 'responsive', 'save-reload'] }] }));
  write(root, 'resources/block-packs/builtin-core/thumbnails/demo.png', 'block image');
  write(root, 'resources/block-packs/builtin-core/thumbnails/preset.png', 'preset image');
  write(root, 'resources/store/dist/previews/demo.webp', 'asset bytes');
  return root;
}

// Only exact directories created by this test fixture are removed.
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('actual block quality dependency inventory', () => {
  it('joins exact catalog identities and hashes actual assets without asserting rights approval', () => {
    const result = collectBlockQualityInventory(fixture(), facts());
    expect(result.items.map(item => item.catalog_id)).toEqual(ids);
    expect(result.items[0]!.assets[0]).toMatchObject({ url: URL, status: 'local-unreviewed', path: 'resources/store/dist/previews/demo.webp' });
    expect(result.items[0]!.assets[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.counts).toMatchObject({ definitions: 1, presets: 1, items: 2, uniqueAssets: 1 });
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(0);
  });

  it('keeps content and rights stable for actual CSS-only edits and reports render/editing impact', () => {
    const root = fixture(); const before = fingerprints(root);
    write(root, 'resources/css/new-rule.css', '.changed {color:red}');
    const changed = facts().map(item => ({ ...item, source_hash: 'b'.repeat(64), public_css_hash: 'b'.repeat(64) }));
    const result = compareEvidenceFingerprints(before, fingerprints(root, changed));
    expect(result.changed.map(item => item.scopes)).toEqual([['render', 'editing'], ['render', 'editing']]);
  });

  it('invalidates render and editing when module-owned template language changes', () => {
    const root = fixture(); const before = fingerprints(root);
    const path = 'resources/layouts/user/page_builder_preview.json';
    write(root, path, JSON.stringify({ props: { lang: '{{page?.data?.page?.locale}}' } }));
    const result = collectBlockQualityInventory(root, facts());
    expect(result.items.every(item => item.dependencies.render.includes(path))).toBe(true);
    expect(compareEvidenceFingerprints(before, fingerprints(root)).changed.map(item => item.scopes))
      .toEqual([['render', 'editing'], ['render', 'editing']]);
    const bound = fingerprints(root);
    write(root, path, JSON.stringify({ props: { lang: 'en' } }));
    expect(compareEvidenceFingerprints(bound, fingerprints(root)).changed.map(item => item.scopes))
      .toEqual([['render', 'editing'], ['render', 'editing']]);
  });

  it('tracks the shared layout policy and its cross-language fixture in both technical scopes', () => {
    const root = fixture();
    for (const path of ['schemas/layout-policy-v1.json', 'tests/Fixtures/layout-policy-cases.json']) {
      const before = fingerprints(root);
      write(root, path, '{"changed":true}');
      const result = collectBlockQualityInventory(root, facts());
      expect(result.items.every(item => item.dependencies.render.includes(path) && item.dependencies.editing.includes(path))).toBe(true);
      expect(compareEvidenceFingerprints(before, fingerprints(root)).changed.map(item => item.scopes)).toEqual([['render', 'editing'], ['render', 'editing']]);
    }
  });

  it('invalidates only the owning preset metadata for a copy change', () => {
    const root = fixture(); const before = fingerprints(root);
    const path = 'resources/block-packs/builtin-core/manifest.json';
    const manifest = JSON.parse(readFileSync(join(root, path), 'utf8'));
    manifest.presets[0].description.ko = '새로운 사용 목적';
    write(root, path, JSON.stringify(manifest));
    const result = compareEvidenceFingerprints(before, fingerprints(root));
    expect(result.changed.map(item => item.catalog_id)).toEqual([ids[1]]);
    expect(result.changed[0]!.scopes).toEqual(['content', 'render', 'editing']);
  });

  it('detects same-URL assets, actual per-item compiler output and owning editor changes', () => {
    const root = fixture(); const before = fingerprints(root);
    write(root, 'resources/store/dist/previews/demo.webp', 'replacement bytes');
    expect(compareEvidenceFingerprints(before, fingerprints(root)).changed.every(item => item.scopes.includes('rights'))).toBe(true);
    const afterAsset = fingerprints(root);
    const changed = facts().map(item => ({ ...item, source_hash: 'b'.repeat(64) }));
    expect(compareEvidenceFingerprints(afterAsset, fingerprints(root, changed)).changed[0]!.scopes).toEqual(['render', 'editing']);
    const afterCompiler = fingerprints(root, changed);
    write(root, 'resources/js/editor/Demo.tsx', 'export const components = { Demo: { changed: true } };');
    expect(compareEvidenceFingerprints(afterCompiler, fingerprints(root, changed)).changed[0]!.scopes).toEqual(['editing']);
  });

  it('does not invalidate product decisions for policy prose, unrelated source or unrelated tests', () => {
    const root = fixture(); const before = fingerprints(root);
    write(root, 'docs/productization/content-policy.md', 'clarified audit procedure');
    write(root, 'src/UnrelatedService.php', '<?php // unrelated');
    write(root, 'tests/E2E/unrelated.spec.ts', '// unrelated');
    write(root, 'tests/Unit/unrelated.test.ts', '// unrelated');
    write(root, 'resources/js/editor/Other.tsx', 'export const Other = { Other: { changed: true } };');
    expect(compareEvidenceFingerprints(before, fingerprints(root)).changed).toEqual([]);
  });

  it('follows owning component helper imports without including sibling catalog families', () => {
    const root = fixture();
    write(root, 'resources/js/editor/Demo.tsx', "import { helper } from './demoHelper'; export const components = { Demo: helper };");
    write(root, 'resources/js/editor/demoHelper.ts', 'export const helper = 1;');
    const before = fingerprints(root);
    write(root, 'resources/js/editor/demoHelper.ts', 'export const helper = 2;');
    expect(compareEvidenceFingerprints(before, fingerprints(root)).changed.map(item => item.scopes)).toEqual([['editing'], ['editing']]);
  });

  it('accepts only exact nonempty selected renderer inventories', () => {
    const root = fixture(); const states = collectBlockQualityStates(root);
    const result = collectInventory(root, facts().slice(0, 1), states, [ids[0]!]);
    expect(result.items.map(item => item.catalog_id)).toEqual([ids[0]]);
    expect(result.counts).toMatchObject({ definitions: 1, presets: 0, items: 1 });
    expect(() => collectInventory(root, [], states, [])).toThrow('nonempty');
    expect(() => collectInventory(root, facts(), states, [ids[0]!, ids[0]!])).toThrow('unique');
    expect(() => collectInventory(root, [], states, ['unknown'])).toThrow('Unknown');
  });

  it('preserves historical ledger decisions as diagnostics without implicit rendering or policy migration', () => {
    const root = fixture();
    const legacy = { source_path: 'resources/block-packs/builtin-core/product-quality.json', record: { status: 'historical' } };
    write(root, legacy.source_path, JSON.stringify({ approval: legacy.record }));
    const ledger = createPendingEvidence(fingerprints(root), legacy);
    write(root, 'resources/block-packs/builtin-core/quality-evidence.json', JSON.stringify(ledger));
    const before = readFileSync(join(root, 'resources/block-packs/builtin-core/quality-evidence.json'), 'utf8');
    write(root, 'docs/productization/content-policy.md', 'new audit procedure, not a product change');
    const result = inspectStoredEvidence(root, [ids[0]]);
    expect(result).toMatchObject({ mode: 'diagnostic', current_sources_checked: false, ready: null, release_authorized: false, errors: [] });
    expect(readFileSync(join(root, 'resources/block-packs/builtin-core/quality-evidence.json'), 'utf8')).toBe(before);
    write(root, legacy.source_path, JSON.stringify({ approval: { status: 'tampered' } }));
    expect(inspectStoredEvidence(root, [ids[0]]).errors).toContain('legacy-review-does-not-match-preserved-v1-record');
  });

  it('records external assets as unresolved without fetching or claiming their bytes', () => {
    const remote = facts().map(item => ({ ...item, asset_urls: ['https://media.example.com/image.webp'] }));
    const result = collectBlockQualityInventory(fixture(), remote);
    expect(result.items[0]!.assets[0]).toMatchObject({ status: 'external-unverified', sha256: null });
    expect(result.warnings.join('\n')).toContain('external-asset');
    const unresolved = collectBlockQualityInventory(fixture(), facts().map(item => ({ ...item, asset_urls: ['/'] })));
    expect(unresolved.items[0]!.assets[0]!.status).toBe('runtime-unverified');
    expect(unresolved.warnings).toEqual(['runtime-asset:/']);
  });

  it('fails closed on missing files, escaped/symlinked assets and malformed or incomplete renderer facts', () => {
    const root = fixture();
    for (const url of [URL.replace('demo.webp', 'missing.webp'), URL.replace('demo.webp', '../secret'), 'file:///etc/passwd']) {
      expect(() => collectBlockQualityInventory(root, facts().map(item => ({ ...item, asset_urls: [url] })))).toThrow();
    }
    const outside = fixture();
    symlinkSync(join(outside, 'resources/store/dist/previews/demo.webp'), join(root, 'resources/store/dist/previews/link.webp'));
    expect(() => collectBlockQualityInventory(root, facts().map(item => ({ ...item, asset_urls: [URL.replace('demo.webp', 'link.webp')] })))).toThrow('outside');
    expect(() => collectBlockQualityInventory(root, facts().slice(1))).toThrow('renderer inventory');
    expect(() => collectBlockQualityInventory(root, [...facts(), facts()[0]])).toThrow('duplicate');
    expect(() => collectBlockQualityInventory(root, facts().map(item => ({ ...item, semantic_hash: '' })))).toThrow('hash');
    expect(() => collectBlockQualityInventory(root, null)).toThrow('array');
  });

  it('rejects manifest/planning inventory drift and duplicate catalog IDs', () => {
    const root = fixture();
    write(root, 'docs/productization/inventory.json', JSON.stringify({ definitions: [], presets: [] }));
    expect(() => collectBlockQualityInventory(root, facts())).toThrow('planning inventory');
    const other = fixture();
    write(other, 'resources/block-packs/builtin-core/manifest.json', JSON.stringify({ pack_id: 'jiwonpapa/builtin-core', blocks: [block, block], presets: [preset] }));
    expect(() => collectBlockQualityInventory(other, facts())).toThrow('duplicate');
  });

  it('reports added/removed identities and refuses duplicate comparisons', () => {
    const before = fingerprints(fixture());
    const result = compareEvidenceFingerprints(before, before.slice(1));
    expect(result.removed).toEqual([ids[0]]); expect(result.changed).toEqual([]);
    expect(compareEvidenceFingerprints([], before).added).toEqual(ids);
    expect(() => compareEvidenceFingerprints([...before, before[0]!], before)).toThrow('duplicate');
  });

  it('rejects incomplete metadata, unsupported versions and non-JSON renderer inputs', () => {
    const root = fixture();
    for (const patch of [
      { evidence_version: 'future' }, { asset_urls: null }, { asset_urls: [''] },
      { public_css_hash: 'not-a-digest' }, { asset_urls: ['data:image/png;base64,eA=='] },
      { asset_urls: ['//outside.invalid/image.png'] }, { asset_urls: ['/../outside'] },
      { asset_urls: ['https://'] }, { unexpected: () => 1 }, { unexpected: Number.NaN },
    ]) expect(() => collectBlockQualityInventory(root, facts().map(item => ({ ...item, ...patch })))).toThrow();
    expect(() => collectBlockQualityInventory(root, [false])).toThrow('object');
  });

  it('fails on unsupported tree layouts and unsafe or non-file thumbnails', () => {
    for (const thumbnail of ['/etc/passwd', '../manifest.json', 'thumbnails\\demo.png', 'thumbnails']) {
      const root = fixture();
      write(root, 'resources/block-packs/builtin-core/manifest.json', JSON.stringify({ pack_id: 'jiwonpapa/builtin-core', blocks: [{ ...block, thumbnail }], presets: [preset] }));
      expect(() => collectBlockQualityInventory(root, facts())).toThrow();
    }
    const empty = fixture();
    rmSync(join(empty, 'resources/js/editor/sample.txt'));
    rmSync(join(empty, 'resources/js/editor/Demo.tsx'));
    expect(() => collectBlockQualityInventory(empty, facts())).toThrow('Empty dependency tree');
    const linked = fixture();
    symlinkSync(join(linked, 'resources/js/editor/sample.txt'), join(linked, 'resources/js/editor/link.txt'));
    expect(() => collectBlockQualityInventory(linked, facts())).toThrow('symlink');
    const linkedTree = fixture();
    rmSync(join(linkedTree, 'resources/js/editor'), { recursive: true });
    symlinkSync(join(linkedTree, 'resources/js/documents'), join(linkedTree, 'resources/js/editor'));
    expect(() => collectBlockQualityInventory(linkedTree, facts())).toThrow('symlink');
  });

  it('rejects unknown blocks, invalid versions and absent supply policy', () => {
    for (const patch of [{ block_version: 2 }, { block_id: 'unknown' }]) {
      const root = fixture();
      write(root, 'resources/block-packs/builtin-core/manifest.json', JSON.stringify({ pack_id: 'jiwonpapa/builtin-core', blocks: [block], presets: [{ ...preset, ...patch }] }));
      expect(() => collectBlockQualityInventory(root, facts())).toThrow();
    }
    const root = fixture();
    const path = 'docs/productization/inventory.json';
    const planning = JSON.parse(readFileSync(join(root, path), 'utf8'));
    delete planning.definitions[0].supply_kind;
    write(root, path, JSON.stringify(planning));
    expect(() => collectBlockQualityInventory(root, facts())).toThrow('supply kind');
  });

  it('requires every state source file and keeps fixture changes out of content/rights review', () => {
    const root = fixture(); const before = fingerprints(root);
    write(root, QUALITY_STATE_SOURCE_FILES[2], 'changed fixture provider');
    expect(compareEvidenceFingerprints(before, fingerprints(root)).changed.map(item => item.scopes)).toEqual([['render', 'editing'], ['render', 'editing']]);
    for (const path of QUALITY_STATE_SOURCE_FILES) {
      const missing = fixture(); rmSync(join(missing, path));
      expect(() => collectBlockQualityStates(missing)).toThrow();
    }
    const linked = fixture(); const outside = fixture();
    rmSync(join(linked, QUALITY_STATE_SOURCE_FILES[2]));
    symlinkSync(join(outside, QUALITY_STATE_SOURCE_FILES[2]), join(linked, QUALITY_STATE_SOURCE_FILES[2]));
    expect(() => collectBlockQualityStates(linked)).toThrow('Unsafe quality state input');
    const directory = fixture(); rmSync(join(directory, QUALITY_STATE_SOURCE_FILES[2])); mkdirSync(join(directory, QUALITY_STATE_SOURCE_FILES[2]));
    expect(() => collectBlockQualityStates(directory)).toThrow('Unsafe quality state input');
  });

  it('rejects changed/deleted state providers and required-state drift before evidence refresh', () => {
    const root = fixture();
    const path = 'docs/productization/inventory.json';
    const planning = JSON.parse(readFileSync(join(root, path), 'utf8'));
    planning.presets[0].required_states.pop(); write(root, path, JSON.stringify(planning));
    expect(() => collectBlockQualityStates(root)).toThrow('Required state/capability mismatch');
    const other = fixture(); const states = collectBlockQualityStates(other);
    expect(() => collectInventory(other, facts(), { ...states, sources: {} })).toThrow('Missing state fixture sources');
    expect(() => collectInventory(other, facts(), { ...states, sources: { ...states.sources, [QUALITY_STATE_SOURCE_FILES[0]]: HASH } })).toThrow('Changed state fixture source');
    expect(() => collectInventory(other, facts(), { ...states, items: states.items.slice(1) })).toThrow('State fixture inventory');
    expect(() => collectInventory(other, facts(), { ...states, items: [...states.items, states.items[0]!] })).toThrow('State fixture inventory');
    const deleted = structuredClone(stateFixtures); deleted.states.pop(); write(other, QUALITY_STATE_SOURCE_FILES[0], JSON.stringify(deleted));
    expect(() => collectBlockQualityStates(other)).toThrow('fixture schema');
  });
});
