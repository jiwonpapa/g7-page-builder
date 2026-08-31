import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import manifest from '../../resources/block-packs/builtin-core/manifest.json';
import planning from '../../docs/productization/inventory.json';
import { BUILTIN_CANVAS_EDITING_CONTRACT, collectionLimit } from '../../resources/js/editor/canvasEditingContract';
import { buildQualityStateBindings, createQualityStateCases, parseQualityStateFixtures, requiredQualityStates } from '../../scripts/lib/blockQualityStates';

const fixtures = () => parseQualityStateFixtures(JSON.parse(readFileSync('tests/Fixtures/block-quality-states.json', 'utf8')));
const byId = new Map(planning.definitions.map(item => [item.id, item]));

describe('versioned quality state suppliers', () => {
  it('binds exact required state IDs and records why other states do not apply', () => {
    const source = fixtures();
    for (const item of planning.presets) {
      const bindings = buildQualityStateBindings(`preset:${item.id}`, item.required_states, source);
      expect(bindings).toHaveLength(9);
      expect(bindings.filter(binding => binding.applicable).map(binding => binding.state)).toEqual(item.required_states);
      expect(bindings.filter(binding => !binding.applicable).every(binding => binding.reason.length > 0)).toBe(true);
    }
  });

  it('derives definition states from existing declared editing capabilities', () => {
    for (const item of planning.definitions) {
      const current = BUILTIN_CANVAS_EDITING_CONTRACT.find(contract => contract.componentType === item.component)!;
      expect(current).toBeDefined();
      expect(item.current_editing.fields).toEqual(current.textFields);
      expect(item.current_editing.collections.map(entry => entry.name)).toEqual(current.collections);
      expect(item.current_editing).toMatchObject({ directMedia: current.directMedia, dynamicData: current.dynamicData });
      const required = requiredQualityStates(item.current_editing);
      expect(required).toContain('default');
      expect(required.includes('media-missing')).toBe(item.current_editing.directMedia);
      expect(required.includes('collection-min-max')).toBe(item.current_editing.collections.length > 0);
      expect(required.includes('data-empty')).toBe(item.current_editing.dynamicData);
    }
  });

  it('materializes deterministic independent default, long-copy and viewport cases for every preset', () => {
    const states = fixtures();
    for (const preset of manifest.presets) {
      const definition = byId.get(preset.block_id)!;
      for (const id of ['default', 'long-copy', 'responsive', 'save-reload']) {
        const before = JSON.stringify(preset.props);
        const cases = createQualityStateCases(preset.props, definition.current_editing, states.find(item => item.id === id)!);
        expect(cases.length).toBeGreaterThan(0);
        expect(createQualityStateCases(preset.props, definition.current_editing, states.find(item => item.id === id)!)).toEqual(cases);
        expect(JSON.stringify(preset.props)).toBe(before);
        expect(cases[0]!.props).not.toBe(preset.props);
        if (id === 'long-copy') expect(JSON.stringify(cases[0]!.props)).not.toBe(before);
        if (id === 'responsive') {
          expect(cases.map(item => item.viewport)).toEqual([1440, 768, 390]);
          expect(cases.map(item => item.canvas_width)).toEqual([1280, 768, 360]);
        }
      }
    }
  });

  it('uses current declared collection limits for minimum, maximum and rejected boundary cases', () => {
    const state = fixtures().find(item => item.id === 'collection-min-max')!;
    for (const preset of manifest.presets) {
      const definition = byId.get(preset.block_id)!;
      if (!definition.current_editing.collections.length) continue;
      for (const entry of definition.current_editing.collections) expect(collectionLimit(definition.component, entry.name)).toEqual({ min: entry.min, max: entry.max });
      const cases = createQualityStateCases(preset.props, definition.current_editing, state);
      expect(cases).toHaveLength(definition.current_editing.collections.length * 4);
      expect(cases.filter(item => item.expected === 'reject')).toHaveLength(definition.current_editing.collections.length * 2);
    }
  });

  it('rejects deleted/duplicate states, unknown providers and malformed fixed inputs', () => {
    const raw = JSON.parse(readFileSync('tests/Fixtures/block-quality-states.json', 'utf8'));
    for (const mutate of [
      (value: typeof raw) => { value.states.pop(); },
      (value: typeof raw) => { value.states[1] = value.states[0]; },
      (value: typeof raw) => { value.states[0].provider = 'unknown'; },
      (value: typeof raw) => { value.states[0].provider = 'long-copy'; },
      (value: typeof raw) => { value.states.find((item: {id: string}) => item.id === 'responsive').input.canvas_widths = []; },
    ]) { const broken = structuredClone(raw); mutate(broken); expect(() => parseQualityStateFixtures(broken)).toThrow(); }
    expect(() => buildQualityStateBindings('preset:test', ['missing'], fixtures())).toThrow();
    expect(() => buildQualityStateBindings('preset:test', ['default', 'default'], fixtures())).toThrow();
  });

  it('rejects valid-schema but semantically wrong providers/responses and incomplete bindings', () => {
    const raw = JSON.parse(readFileSync('tests/Fixtures/block-quality-states.json', 'utf8'));
    const wrongProvider = structuredClone(raw); wrongProvider.states[0].provider = 'roundtrip';
    expect(() => parseQualityStateFixtures(wrongProvider)).toThrow('Wrong provider');
    for (const input of [{ status: 503, payload: { success: false, data: [] } }, { status: 200, payload: { success: false, data: [] } }]) {
      const wrongResponse = structuredClone(raw); wrongResponse.states[6].input = input;
      expect(() => parseQualityStateFixtures(wrongResponse)).toThrow('Wrong dynamic');
    }
    for (const required of [null, [], [1], ['toString']]) expect(() => buildQualityStateBindings('test', required, fixtures())).toThrow('required state');
    expect(() => buildQualityStateBindings('test', ['default'], fixtures().slice(1))).toThrow('Missing state fixture');
    const duplicate = fixtures(); duplicate[1] = duplicate[0]!;
    expect(() => buildQualityStateBindings('test', ['default'], duplicate)).toThrow('Missing state fixture');
    const mismatch = fixtures(); mismatch[0]!.provider = 'unknown';
    expect(() => buildQualityStateBindings('test', ['default'], mismatch)).toThrow('Missing state provider');
  });

  it('fails closed on undeclared or invalid capability metadata', () => {
    const valid = { fields: [], collections: [], directMedia: false, dynamicData: false };
    for (const input of [null, false, {}, { ...valid, fields: null }, { ...valid, fields: [{ path: 1, kind: 'plain' }] },
      { ...valid, fields: [{ path: 'text', kind: 'unknown' }] }, { ...valid, collections: null }, { ...valid, directMedia: 'yes' }, { ...valid, dynamicData: null },
      ...[null, { name: 1, min: 1, max: 3 }, { name: 'items', min: 0, max: 3 }, { name: 'items', min: 1.5, max: 3 }, { name: 'items', min: 2, max: 1 }, { name: 'items', min: 1, max: 201 }].map(entry => ({ ...valid, collections: [entry] })),
    ]) expect(() => requiredQualityStates(input)).toThrow('capability declaration');
  });

  it('carries media/data failures separately without destroying canonical props', () => {
    const capability = { fields: [], collections: [], directMedia: true, dynamicData: true };
    const props = { image: '/modules/example.webp', text: null, count: 2, enabled: true, nested: { caption: 'caption' } };
    for (const id of ['media-missing', 'data-empty', 'data-error', 'capability-missing']) {
      const result = createQualityStateCases(props, capability, fixtures().find(item => item.id === id)!)[0]!;
      expect(result.props).toEqual(props);
      expect(result.network?.status).toBe(id === 'data-empty' ? 200 : id === 'data-error' ? 503 : 404);
      result.props.image = 'changed fixture';
      expect(props.image).toBe('/modules/example.webp');
    }
  });

  it('replaces declared text only and refuses missing canonical text or collection seeds', () => {
    const source = fixtures(); const longCopy = source.find(item => item.id === 'long-copy')!;
    const capability = { fields: [{ path: 'label', kind: 'plain' }, { path: 'href', kind: 'plain' }], collections: [], directMedia: false, dynamicData: false };
    const props = { label: 'visible', href: '/real-target', empty: null, rows: [{ text: 'row' }] };
    expect(createQualityStateCases(props, capability, longCopy)[0]!.props).toEqual({ ...props, label: longCopy.input.text });
    const fields = ['missing.text', 'empty.text', 'rows.text', 'rows.*', '*', '.text', 'label.text', 'rows.*.text'].map(path => ({ path, kind: 'inline-rich' }));
    expect(createQualityStateCases(props, { ...capability, fields }, longCopy)[0]!.props.rows).toEqual([{ text: longCopy.input.text }]);
    expect(createQualityStateCases({ plans: [{ features: ['first', 'second', 1] }] }, { ...capability, fields: [{ path: 'plans.*.features.*', kind: 'inline-rich' }] }, longCopy)[0]!.props.plans).toEqual([{ features: [longCopy.input.text, longCopy.input.text, 1] }]);
    expect(() => createQualityStateCases({}, capability, longCopy)).toThrow('no declared canonical text');
    const collection = source.find(item => item.id === 'collection-min-max')!;
    expect(() => createQualityStateCases({}, capability, collection)).toThrow('declared collection');
    for (const props of [{}, { items: [] }, { items: 'not-array' }]) expect(() => createQualityStateCases(props, { ...capability, collections: [{ name: 'items', min: 1, max: 3 }] }, collection)).toThrow('Missing collection seed');
    expect(() => createQualityStateCases({}, capability, { ...longCopy, provider: 'unknown' })).toThrow('Unknown state provider');
  });

  it('rejects non-JSON props rather than using casts to silently strip values', () => {
    const capability = { fields: [], collections: [], directMedia: false, dynamicData: false };
    for (const value of [null, [], { bad: undefined }, { bad: NaN }, { bad: Infinity }, { bad: () => 1 }, { bad: new Date() }]) {
      expect(() => createQualityStateCases(value, capability, fixtures()[0]!)).toThrow('JSON object');
    }
  });
});
