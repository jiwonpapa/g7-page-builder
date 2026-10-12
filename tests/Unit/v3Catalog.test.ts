import { describe, expect, it } from 'vitest';
import { BUILTIN_BLOCK_DEFINITIONS, BUILTIN_BLOCK_PRESETS } from '../../resources/js/blocks/builtinCatalog';
import { compositionContract, compositionCoverage, inspectCompositionSource } from '../../resources/js/blocks/v3/catalog';
import { compositionContracts, sitePartContracts, structuralContracts } from '../../resources/js/blocks/v3/catalogEntries';
import type { PageBuilderBlock } from '../../resources/js/documents/types';
import layout from '../../schemas/layout-policy-v1.json';
import sourceSchema from '../../schemas/page-builder-document.schema.json';

const block = (type = 'content.card-01', props = {}, slots = {}): PageBuilderBlock => ({
  instance_id: '00000000-0000-4000-8000-000000000001', type, block_version: 1, props, slots,
});
describe('v3 composition source coverage (not completed conversion)', () => {
  it('enumerates all 49 built-ins and 99 presets with no orphan or missing runtime', () => {
    expect(BUILTIN_BLOCK_DEFINITIONS).toHaveLength(49);
    expect(BUILTIN_BLOCK_PRESETS).toHaveLength(99);
    expect(compositionContracts).toHaveLength(49);
    expect(compositionCoverage()).toEqual({ missingBlocks: [], orphanMappings: [], invalidPresets: [], runtimeMismatches: [] });
    const all = [...compositionContracts, ...structuralContracts, ...sitePartContracts];
    expect(new Set(all.map(row => row.blockId)).size).toBe(all.length);
    expect(all.every(row => Object.isFrozen(row) && Object.isFrozen(row.fields) && Object.isFrozen(row.runtime))).toBe(true);
  });
  for (const preset of BUILTIN_BLOCK_PRESETS) it(`classifies every preset field without rewriting ${preset.preset_id}`, () => {
    const source = block(preset.block_id, preset.props);
    const before = JSON.stringify(source);
    expect(inspectCompositionSource([source], 'page')).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('matches declared component slots and every schema-backed top-level field', () => {
    for (const [type, slots] of Object.entries(layout.component_slots)) {
      expect(compositionContract(type, 1)?.slots).toEqual(Object.keys(slots));
    }
    for (const definition of BUILTIN_BLOCK_DEFINITIONS) {
      const schema = Object.entries(sourceSchema.$defs).find(([key]) => key === definition.schema_ref.slice('builtin:'.length))?.[1];
      if (schema && 'properties' in schema) {
        expect(Object.keys(compositionContract(definition.block_id, 1)?.fields ?? {}).sort(), definition.block_id)
          .toEqual(Object.keys(schema.properties).sort());
      }
    }
  });
  it('retains repeated content separately from protected settings and data selectors', () => {
    const slider = compositionContract('content.hero-slider-01', 1)!;
    expect(slider.collections).toEqual(['slides']);
    expect(slider.fields).toMatchObject({ slides: 'content', autoplay: 'behavior', interval: 'behavior' });
    const data = compositionContract('g7.board-recent-posts-01', 1)!;
    expect(data.collections).toEqual([]);
    expect(data.fields).toMatchObject({ heading: 'content', emptyMessage: 'content', source: 'binding', audience: 'binding' });
    expect(Object.hasOwn(data.fields, 'endpoint')).toBe(false);
    expect(Object.hasOwn(data.fields, 'response')).toBe(false);
    expect(compositionContract('content.heading-01', 1)?.fields.level).toBe('content');
    for (const type of Object.values(layout.layouts)) {
      expect(Object.hasOwn(compositionContract(type, 1)!.fields, 'appearance')).toBe(false);
      expect(inspectCompositionSource([block(type, { appearance: {} })], 'page'))
        .toEqual([{ path: 'blocks.0.props.appearance', code: 'unknown_field' }]);
    }
  });
  it('preserves unknown blocks and fields and reports exact paths', () => {
    const source = [block('external.custom', { untouched: true }), block('content.card-01', { unknown: 'preserve me' }, { future: [] }),
      { ...block(), block_version: 2 }, { ...block(), futureMetadata: { a: 1 } }];
    const before = JSON.stringify(source);
    expect(inspectCompositionSource(source, 'page')).toEqual([
      { path: 'blocks.0', code: 'unknown_block' }, { path: 'blocks.1.props.unknown', code: 'unknown_field' },
      { path: 'blocks.1.slots.future', code: 'unknown_slot' }, { path: 'blocks.2', code: 'unknown_block' },
      { path: 'blocks.3.futureMetadata', code: 'unknown_field' },
    ]);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('traverses internal slots and keeps header/footer/system control ownership distinct', () => {
    const card = block('content.card-01', {}, { body: [block('content.heading-01', { heading: 'Nested' })] });
    expect(inspectCompositionSource([card], 'page')).toEqual([]);
    const header = block('site.header.navigation-01', { brand_name: 'PB', navigation: [] }, {
      systemControls: [block('site.header.system-controls-01', { account: true, theme: true })],
    });
    expect(inspectCompositionSource([header], 'header')).toEqual([]);
    expect(inspectCompositionSource([header], 'footer')).toContainEqual({ path: 'blocks.0', code: 'source_scope' });
    expect(inspectCompositionSource([block('site.header.system-controls-01')], 'header')).toContainEqual({ path: 'blocks.0', code: 'source_scope' });
    expect(sitePartContracts).toHaveLength(5);
  });
  it('bounds malformed/cyclic sources without partial rewriting or traversal overflow', () => {
    const cyclic = block(); cyclic.slots = { body: [cyclic] };
    expect(inspectCompositionSource([cyclic], 'page')).toEqual([{ path: 'blocks.0.slots.body.0', code: 'source_limit' }]);
    const excessive = Array.from({ length: 501 }, () => block());
    expect(inspectCompositionSource(excessive, 'page')).toEqual([{ path: 'blocks.500', code: 'source_limit' }]);
    expect(inspectCompositionSource([block('content.card-01', {}, { body: 'invalid' })], 'page'))
      .toEqual([{ path: 'blocks.0.slots.body', code: 'source_shape' }]);
  });
});
