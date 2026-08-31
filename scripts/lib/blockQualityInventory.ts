import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { EvidenceFingerprint, EvidenceInputs, EvidenceJson } from './blockQualityEvidence';
import type { QualityStateInventory } from './blockQualityStates';

export const QUALITY_DEPENDENCY_FILES = [
  'docs/productization/content-policy.md', 'schemas/page-builder-document.schema.json',
  'schemas/layout-policy-v1.json', 'tests/Fixtures/layout-policy-cases.json',
  'package-lock.json', 'scripts/render-block-thumbnail-fixtures.php', 'dist/css/page-builder-public.css',
] as const;
// Conservative dependency sets: narrowing these requires measured/proven renderer ownership.
export const QUALITY_DEPENDENCY_TREES = ['src', 'resources/js', 'resources/css', 'resources/layouts/user', 'tests/E2E', 'tests/Unit'] as const;
const PACK = 'resources/block-packs/builtin-core';
const MEDIA_PREFIX = '/modules/jiwonpapa-page_builder/store/previews/';
const SCOPES: Array<keyof EvidenceInputs> = ['content', 'rights', 'render', 'editing'];
type JsonRecord = { [key: string]: EvidenceJson };
interface AssetFact { url: string; status: 'local-unreviewed' | 'external-unverified' | 'runtime-unverified'; path: string | null; sha256: string | null }
interface CollectedItem { catalog_id: string; inputs: EvidenceInputs; assets: AssetFact[]; dependencies: Record<keyof EvidenceInputs, string[]> }

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
}
function jsonValue(value: unknown): EvidenceJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === 'object' && value !== null) return record(value, 'JSON');
  throw new Error('Dependency value must be JSON.');
}
function rows(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map(item => record(item, label));
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string.`);
  return value;
}
function hashString(value: unknown, label: string): string {
  const result = string(value, `${label} hash`);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${label} hash is invalid.`);
  return result;
}
function uniqueMap(items: JsonRecord[], key: string, label: string): Map<string, JsonRecord> {
  const result = new Map<string, JsonRecord>();
  for (const item of items) {
    const id = string(item[key], `${label} id`);
    if (result.has(id)) throw new Error(`duplicate ${label}: ${id}`);
    result.set(id, item);
  }
  return result;
}
function sameIds(left: Map<string, JsonRecord>, right: Map<string, JsonRecord>, label: string): void {
  if (JSON.stringify([...left.keys()].sort()) !== JSON.stringify([...right.keys()].sort())) throw new Error(`${label} does not match exact catalog IDs.`);
}

/** Read-only collector. The renderer facts must be produced by the current PHP compiler. */
export function collectBlockQualityInventory(root: string, rendererFacts: unknown, states: QualityStateInventory): {
  items: CollectedItem[]; warnings: string[]; elapsed_ms: number;
  counts: { definitions: number; presets: number; items: number; uniqueAssets: number; filesRead: number };
} {
  const started = performance.now();
  const actualRoot = realpathSync(root);
  const cache = new Map<string, string>();
  const safeFile = (path: string): string => {
    if (path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) throw new Error(`Unsafe dependency path: ${path}`);
    const absolute = realpathSync(join(actualRoot, path));
    if (!absolute.startsWith(actualRoot + sep)) throw new Error(`Dependency outside repository: ${path}`);
    if (!lstatSync(absolute).isFile()) throw new Error(`Dependency is not a file: ${path}`);
    return absolute;
  };
  const fileHash = (path: string): string => {
    let value = cache.get(path);
    if (value === undefined) {
      value = createHash('sha256').update(readFileSync(safeFile(path))).digest('hex'); cache.set(path, value);
    }
    return value;
  };
  const json = (path: string): JsonRecord => record(JSON.parse(readFileSync(safeFile(path), 'utf8')), path);
  const tree = (path: string): Record<string, string> => {
    const result: Record<string, string> = {};
    const walk = (directory: string): void => {
      for (const entry of readdirSync(join(actualRoot, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const child = `${directory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`Dependency tree symlink is unsupported: ${child}`);
        if (entry.isDirectory()) walk(child);
        else result[child] = fileHash(child);
      }
    };
    if (lstatSync(join(actualRoot, path)).isSymbolicLink()) throw new Error(`Dependency tree symlink is unsupported: ${path}`);
    walk(path);
    if (Object.keys(result).length === 0) throw new Error(`Empty dependency tree: ${path}`);
    return result;
  };
  const common = Object.fromEntries(QUALITY_DEPENDENCY_FILES.map(path => [path, fileHash(path)]));
  const trees = Object.fromEntries(QUALITY_DEPENDENCY_TREES.map(path => [path, tree(path)]));
  const manifest = json(`${PACK}/manifest.json`);
  const planning = json('docs/productization/inventory.json');
  const blocks = uniqueMap(rows(manifest.blocks, 'blocks'), 'block_id', 'block');
  const presets = uniqueMap(rows(manifest.presets, 'presets'), 'preset_id', 'preset');
  const plannedBlocks = uniqueMap(rows(planning.definitions, 'definitions'), 'id', 'planned block');
  const plannedPresets = uniqueMap(rows(planning.presets, 'presets'), 'id', 'planned preset');
  sameIds(blocks, plannedBlocks, 'planning inventory'); sameIds(presets, plannedPresets, 'planning inventory');
  const packId = string(manifest.pack_id, 'pack id');
  const facts = uniqueMap(rows(rendererFacts, 'renderer facts'), 'catalog_id', 'renderer fact');
  const stateItems = new Map(states.items.map(item => [item.catalog_id, item]));
  if (stateItems.size !== states.items.length || JSON.stringify([...stateItems.keys()].sort()) !== JSON.stringify([...facts.keys()].sort())) throw new Error('State fixture inventory does not match renderer inventory.');
  if (!Object.keys(states.sources).length) throw new Error('Missing state fixture sources.');
  for (const [path, hash] of Object.entries(states.sources)) {
    if (fileHash(path) !== hash) throw new Error(`Changed state fixture source: ${path}`);
  }
  const warnings: string[] = [];
  const assetsSeen = new Set<string>();
  const asset = (value: EvidenceJson): AssetFact => {
    const url = string(value, 'asset URL'); assetsSeen.add(url);
    if (/^https?:\/\//.test(url)) {
      new URL(url); // Reject malformed origins; no network request is made.
      warnings.push(`external-asset:${url}`);
      return { url, status: 'external-unverified', path: null, sha256: null };
    }
    if (!url.startsWith(MEDIA_PREFIX)) {
      if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') && !decodeURIComponent(url).split('/').includes('..')) {
        warnings.push(`runtime-asset:${url}`);
        return { url, status: 'runtime-unverified', path: null, sha256: null };
      }
      throw new Error(`Unsupported asset URL: ${url}`);
    }
    const filename = decodeURIComponent(url.slice(MEDIA_PREFIX.length).split(/[?#]/)[0]!);
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(filename) || filename.includes('..')) throw new Error(`Unsafe asset URL: ${url}`);
    const path = `resources/store/dist/previews/${filename}`;
    return { url, status: 'local-unreviewed', path, sha256: fileHash(path) };
  };
  const catalog = [
    ...[...blocks.values()].map(definition => ({ definition, preset: null, planned: plannedBlocks.get(String(definition.block_id))!, catalog_id: `block:${definition.block_id}@${definition.block_version}` })),
    ...[...presets.values()].map(preset => {
      const definition = blocks.get(string(preset.block_id, 'preset block id'));
      if (!definition) throw new Error(`Unknown preset block: ${preset.block_id}`);
      return { definition, preset, planned: plannedPresets.get(String(preset.preset_id))!, catalog_id: `preset:${packId}:${preset.preset_id}` };
    }),
  ];
  if (JSON.stringify(catalog.map(item => item.catalog_id).sort()) !== JSON.stringify([...facts.keys()].sort())) throw new Error('renderer inventory does not match catalog.');
  const layoutContractSources = { 'schemas/layout-policy-v1.json': common['schemas/layout-policy-v1.json']!, 'tests/Fixtures/layout-policy-cases.json': common['tests/Fixtures/layout-policy-cases.json']! };
  const compilerSources = { ...trees.src, ...layoutContractSources, 'schemas/page-builder-document.schema.json': common['schemas/page-builder-document.schema.json']!, 'package-lock.json': common['package-lock.json']!, 'scripts/render-block-thumbnail-fixtures.php': common['scripts/render-block-thumbnail-fixtures.php']! };
  const renderSources = { ...compilerSources, ...trees['resources/css'], ...trees['resources/layouts/user'], ...states.sources, 'dist/css/page-builder-public.css': common['dist/css/page-builder-public.css']! };
  const editingSources = { ...trees['resources/js'], ...trees['tests/E2E'], ...trees['tests/Unit'], ...states.sources, ...layoutContractSources, 'schemas/page-builder-document.schema.json': common['schemas/page-builder-document.schema.json']!, 'package-lock.json': common['package-lock.json']! };
  const items = catalog.map(({ definition, preset, planned, catalog_id }): CollectedItem => {
    if (!Number.isInteger(definition.block_version) || Number(definition.block_version) < 1 || planned.block_version !== definition.block_version
      || (preset && (preset.block_version !== definition.block_version || planned.block_id !== definition.block_id))) throw new Error(`planning inventory version/block mismatch: ${catalog_id}`);
    const fact = facts.get(catalog_id)!;
    if (fact.evidence_version !== 'g7pb-render-fixture-evidence/v1') throw new Error(`Unsupported renderer evidence version: ${catalog_id}`);
    if (!Array.isArray(fact.asset_urls)) throw new Error(`Missing renderer asset array: ${catalog_id}`);
    const assets = [...new Set(fact.asset_urls.map(url => string(url, 'asset URL')))].sort().map(asset);
    const thumbnailPath = `${PACK}/${string((preset ?? definition).thumbnail, 'thumbnail path')}`;
    const withoutThumbnail = (value: JsonRecord): JsonRecord => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'thumbnail'));
    const content = { definition: withoutThumbnail(definition), preset: preset ? withoutThumbnail(preset) : null,
      supply_kind: string(planned.supply_kind, 'supply kind'), semantic_hash: hashString(fact.semantic_hash, 'semantic'),
      policy_hash: common['docs/productization/content-policy.md']! };
    const inputs: EvidenceInputs = {
      content,
      rights: { assets: assets.map(item => ({ ...item })), review_policy: 'explicit-maintainer-review-required' },
      render: { source_hash: hashString(fact.source_hash, 'renderer'), public_css_hash: hashString(fact.public_css_hash, 'CSS'),
        thumbnail: { path: thumbnailPath, sha256: fileHash(thumbnailPath) }, sources: renderSources },
      editing: { sources: editingSources, required_states: planned.required_states ?? planned.current_editing ?? 'definition-defaults', state_bindings: stateItems.get(catalog_id)!.bindings.map(binding => ({ ...binding })) },
    };
    return { catalog_id, inputs, assets, dependencies: {
      content: [`${PACK}/manifest.json`, 'docs/productization/inventory.json', 'docs/productization/content-policy.md'],
      rights: assets.flatMap(item => item.path ? [item.path] : []),
      render: [...Object.keys(renderSources), thumbnailPath].sort(), editing: Object.keys(editingSources).sort(),
    } };
  });
  return { items, warnings: [...new Set(warnings)].sort(), elapsed_ms: Math.round((performance.now() - started) * 100) / 100,
    counts: { definitions: blocks.size, presets: presets.size, items: items.length, uniqueAssets: assetsSeen.size, filesRead: cache.size } };
}

export function compareEvidenceFingerprints(before: EvidenceFingerprint[], after: EvidenceFingerprint[]): {
  added: string[]; removed: string[]; changed: Array<{ catalog_id: string; scopes: Array<keyof EvidenceInputs> }>;
} {
  const prior = new Map(before.map(item => [item.catalog_id, item]));
  const next = new Map(after.map(item => [item.catalog_id, item]));
  if (prior.size !== before.length || next.size !== after.length) throw new Error('duplicate evidence fingerprint');
  return {
    added: [...next.keys()].filter(id => !prior.has(id)).sort(), removed: [...prior.keys()].filter(id => !next.has(id)).sort(),
    changed: [...next.values()].flatMap(item => {
      const previous = prior.get(item.catalog_id); if (!previous) return [];
      const scopes = SCOPES.filter(scope => previous.source_digests[scope] !== item.source_digests[scope]);
      return scopes.length ? [{ catalog_id: item.catalog_id, scopes }] : [];
    }).sort((a, b) => a.catalog_id.localeCompare(b.catalog_id)),
  };
}
