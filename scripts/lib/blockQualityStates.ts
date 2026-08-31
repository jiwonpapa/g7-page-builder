import Ajv2020 from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import schema from '../../schemas/block-quality-states.schema.json' with { type: 'json' };
import type { EvidenceJson } from './blockQualityEvidence';

type JsonObject = { [key: string]: EvidenceJson };
const PROVIDERS = {
  default: 'canonical', 'long-copy': 'long-copy', responsive: 'viewport', 'save-reload': 'roundtrip',
  'media-missing': 'media-response', 'collection-min-max': 'collection-boundaries',
  'data-empty': 'dynamic-response', 'data-error': 'dynamic-response', 'capability-missing': 'dynamic-response',
} as const;
export type QualityState = keyof typeof PROVIDERS;
export interface QualityStateFixture { id: QualityState; provider: string; input: JsonObject }
export const QUALITY_STATE_SOURCE_FILES = [
  'tests/Fixtures/block-quality-states.json', 'schemas/block-quality-states.schema.json',
  'scripts/lib/blockQualityStates.ts', 'tests/Unit/blockQualityStates.test.ts', 'tests/Unit/blockQualityStateRuntime.test.ts',
] as const;
const validate = new Ajv2020({ allErrors: true, strict: true }).compile<{ version: string; states: QualityStateFixture[] }>(schema);

export function parseQualityStateFixtures(value: unknown): QualityStateFixture[] {
  if (!validate(value)) throw new Error(`Invalid quality state fixture schema: ${JSON.stringify(validate.errors)}`);
  if (new Set(value.states.map(item => item.id)).size !== 9) throw new Error('Missing or duplicate quality state fixture.');
  for (const item of value.states) {
    if (PROVIDERS[item.id] !== item.provider) throw new Error(`Wrong provider for ${item.id}`);
    const statuses: Partial<Record<QualityState, number>> = { 'data-empty': 200, 'data-error': 503, 'capability-missing': 404 };
    const status = statuses[item.id];
    if (status !== undefined && (item.input.status !== status || (item.input.payload as JsonObject).success !== (status === 200))) throw new Error(`Wrong dynamic response for ${item.id}`);
  }
  return structuredClone(value.states);
}

interface Editing { fields: Array<{ path: string; kind: string }>; collections: Array<{ name: string; min: number; max: number }>; directMedia: boolean; dynamicData: boolean }
function editing(value: unknown): Editing {
  if (!value || typeof value !== 'object') throw new Error('Missing editing capability declaration.');
  const item = value as Partial<Editing>;
  if (!Array.isArray(item.fields) || item.fields.some(field => !field || typeof field.path !== 'string' || !['plain', 'inline-rich', 'block-rich', 'structural'].includes(field.kind))
    || !Array.isArray(item.collections) || item.collections.some(entry => !entry || typeof entry.name !== 'string' || !Number.isInteger(entry.min) || !Number.isInteger(entry.max) || entry.min < 1 || entry.max < entry.min || entry.max > 200)
    || typeof item.directMedia !== 'boolean' || typeof item.dynamicData !== 'boolean') throw new Error('Invalid editing capability declaration.');
  return item as Editing;
}

export function requiredQualityStates(capability: unknown): QualityState[] {
  const item = editing(capability);
  return ['default', 'long-copy', 'responsive', 'save-reload',
    ...(item.directMedia ? ['media-missing' as const] : []),
    ...(item.collections.length ? ['collection-min-max' as const] : []),
    ...(item.dynamicData ? ['data-empty', 'data-error', 'capability-missing'] as const : [])];
}

export function buildQualityStateBindings(catalogId: string, required: unknown, fixtures: QualityStateFixture[]): Array<{
  state: QualityState; applicable: boolean; reason: string; fixture_id: string; provider: string; fixture_path: string; runner_path: string;
}> {
  if (!Array.isArray(required) || !required.length || new Set(required).size !== required.length
    || required.some(id => typeof id !== 'string' || !Object.hasOwn(PROVIDERS, id))) throw new Error(`Unknown/duplicate required state: ${catalogId}`);
  if (fixtures.length !== 9 || new Set(fixtures.map(item => item.id)).size !== 9) throw new Error('Missing state fixture.');
  const ordered = [...required, ...Object.keys(PROVIDERS).filter(id => !required.includes(id))] as QualityState[];
  return ordered.map(state => {
    const fixture = fixtures.find(item => item.id === state);
    if (!fixture || fixture.provider !== PROVIDERS[state]) throw new Error(`Missing state provider: ${state}`);
    return { state, applicable: required.includes(state), reason: required.includes(state) ? 'declared-required-state' : 'not-required-by-declared-block-capabilities',
      fixture_id: `${catalogId}::${state}::v1`, provider: fixture.provider,
      fixture_path: QUALITY_STATE_SOURCE_FILES[0], runner_path: state.startsWith('data-') || state === 'capability-missing' ? QUALITY_STATE_SOURCE_FILES[4] : QUALITY_STATE_SOURCE_FILES[3] };
  });
}

export interface QualityStateInventory {
  sources: Record<string, string>;
  items: Array<{ catalog_id: string; bindings: ReturnType<typeof buildQualityStateBindings> }>;
}

export function collectBlockQualityStates(root: string): QualityStateInventory {
  const actualRoot = realpathSync(root);
  const file = (path: string): Buffer => {
    const absolute = realpathSync(join(actualRoot, path));
    if (!absolute.startsWith(actualRoot + sep) || !statSync(absolute).isFile()) throw new Error(`Unsafe quality state input: ${path}`);
    return readFileSync(absolute);
  };
  const sources = Object.fromEntries(QUALITY_STATE_SOURCE_FILES.map(path => [path, createHash('sha256').update(file(path)).digest('hex')]));
  const fixtures = parseQualityStateFixtures(JSON.parse(file(QUALITY_STATE_SOURCE_FILES[0]).toString()));
  const manifest = JSON.parse(file('resources/block-packs/builtin-core/manifest.json').toString()) as { pack_id: string; blocks: Array<{ block_id: string; block_version: number }>; presets: Array<{ preset_id: string; block_id: string }> };
  const planning = JSON.parse(file('docs/productization/inventory.json').toString()) as { definitions: Array<{ id: string; current_editing: unknown }>; presets: Array<{ id: string; required_states: unknown }> };
  const exactIds = (actual: string[], planned: string[]): void => {
    if ([...actual, ...planned].some(id => typeof id !== 'string' || !id.trim()) || new Set(actual).size !== actual.length || new Set(planned).size !== planned.length) throw new Error('Invalid or duplicate planning inventory ID.');
    if (JSON.stringify(actual.sort()) !== JSON.stringify(planned.sort())) throw new Error('State planning inventory does not match catalog.');
  };
  exactIds(manifest.blocks.map(item => item.block_id), planning.definitions.map(item => item.id));
  exactIds(manifest.presets.map(item => item.preset_id), planning.presets.map(item => item.id));
  const items = [
    ...manifest.blocks.map(block => {
      const catalog_id = `block:${block.block_id}@${block.block_version}`;
      const required = requiredQualityStates(planning.definitions.find(item => item.id === block.block_id)?.current_editing);
      return { catalog_id, bindings: buildQualityStateBindings(catalog_id, required, fixtures) };
    }),
    ...manifest.presets.map(preset => {
      const catalog_id = `preset:${manifest.pack_id}:${preset.preset_id}`;
      const bindings = buildQualityStateBindings(catalog_id, planning.presets.find(item => item.id === preset.preset_id)!.required_states, fixtures);
      const declared = requiredQualityStates(planning.definitions.find(item => item.id === preset.block_id)?.current_editing);
      if (JSON.stringify(bindings.filter(item => item.applicable).map(item => item.state).sort()) !== JSON.stringify(declared.sort())) throw new Error(`Required state/capability mismatch: ${catalog_id}`);
      return { catalog_id, bindings };
    }),
  ];
  return { sources, items };
}

export interface QualityStateCase { name: string; props: JsonObject; expected: 'accept' | 'reject'; viewport?: number; canvas_width?: number; network?: JsonObject }
function jsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('State props must be a JSON object.');
  const jsonValue = (item: unknown): EvidenceJson => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map(jsonValue);
    return jsonObject(item);
  };
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
}
export function createQualityStateCases(value: unknown, capability: unknown, fixture: QualityStateFixture): QualityStateCase[] {
  const props = jsonObject(value);
  const contract = editing(capability);
  const base = (name: string): QualityStateCase => ({ name, props: structuredClone(props), expected: 'accept' });
  switch (fixture.provider) {
    case 'canonical': return [base('default')];
    case 'roundtrip': return [{ ...base('save-reload'), props: JSON.parse(JSON.stringify(props)) as JsonObject }];
    case 'viewport': return (fixture.input.window_widths as number[]).map((viewport, index) => ({ ...base(`width-${viewport}`), viewport, canvas_width: (fixture.input.canvas_widths as number[])[index]! }));
    case 'media-response': return [{ ...base('media-missing'), network: { kind: 'media', status: fixture.input.status! } }];
    case 'dynamic-response': return [{ ...base(fixture.id), network: structuredClone(fixture.input) }];
    case 'long-copy': {
      const result = base('long-copy'); let changes = 0;
      const replace = (target: EvidenceJson, segments: string[]): void => {
        const [head, ...tail] = segments; if (!head || !target || typeof target !== 'object') return;
        if (head === '*') {
          if (Array.isArray(target)) target.forEach((item, index) => {
            if (tail.length) replace(item, tail);
            else if (typeof item === 'string') { target[index] = fixture.input.text!; changes += 1; }
          });
          return;
        }
        if (Array.isArray(target)) return;
        if (tail.length) replace(target[head] ?? null, tail);
        else if (typeof target[head] === 'string') { target[head] = fixture.input.text!; changes += 1; }
      };
      const rich = contract.fields.filter(field => field.kind === 'inline-rich' || field.kind === 'block-rich');
      const fields = rich.length ? rich : contract.fields.filter(field => field.kind === 'plain' && /(?:^|\.)(?:label|caption|name)$/.test(field.path));
      for (const field of fields) replace(result.props, field.path.split('.'));
      if (!changes) throw new Error('Long-copy fixture has no declared canonical text field.');
      return [result];
    }
    case 'collection-boundaries': {
      if (!contract.collections.length) throw new Error('Collection fixture requires a declared collection.');
      return contract.collections.flatMap(entry => {
        const original = props[entry.name];
        if (!Array.isArray(original) || original.length === 0) throw new Error(`Missing collection seed: ${entry.name}`);
        return [entry.min, entry.max, entry.min - 1, entry.max + 1].map((count, index) => {
          const result = base(`${entry.name}:${(fixture.input.cases as string[])[index]}`);
          result.props[entry.name] = Array.from({ length: count }, (_, i) => structuredClone(original[i % original.length]!));
          result.expected = index < 2 ? 'accept' : 'reject'; return result;
        });
      });
    }
    default: throw new Error(`Unknown state provider: ${fixture.provider}`);
  }
}

/** Test-only injection. Unexpected endpoints/methods fail; there is no live network fallback. */
export function createQualityFixtureFetch(endpoint: string, fixture: QualityStateFixture): typeof fetch {
  if (!/^\/api\/modules\/sirsoft-(?:board|ecommerce)\/(?:boards|products)(?:[/?]|$)/.test(endpoint)
    || endpoint.includes('\\') || decodeURIComponent(endpoint).split('/').includes('..') || fixture.provider !== 'dynamic-response') throw new Error('Unsafe fixture endpoint/provider.');
  return async (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    if (target !== endpoint || method.toUpperCase() !== 'GET' || init?.body != null) throw new Error('Fixture request cannot escape its read-only endpoint.');
    return new Response(JSON.stringify(fixture.input.payload), { status: Number(fixture.input.status), headers: { 'Content-Type': 'application/json' } });
  };
}
