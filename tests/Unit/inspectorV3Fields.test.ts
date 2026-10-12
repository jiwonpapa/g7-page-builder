import { expect, it } from 'vitest';
import schema from '../../schemas/page-builder-document-v3.schema.json';
import { groups, labelFor, seed, styleRules, matches } from '../../resources/js/editor/v3/inspectorFields';

it('exposes every existing v3 typed style exactly once with a readable label', () => {
  const keys = groups.flatMap(group => group.keys);
  expect(keys.slice().sort()).toEqual(Object.keys(schema.$defs.style.properties).sort());
  expect(new Set(keys).size).toBe(keys.length);
  for (const key of keys) {
    expect(labelFor(key)).not.toBe(key);
    expect(matches(seed(styleRules[key]!), styleRules[key]!)).toBe(true);
  }
});
