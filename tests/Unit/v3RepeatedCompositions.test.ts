import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/page-builder-document.schema.json';
import legacy from '../Contract/document-v1.fixture.json';
import fixture from '../Contract/document-v3.fixture.json';
import { BUILTIN_BLOCK_PRESETS } from '../../resources/js/blocks/builtinCatalog';
import { createRepeatedComposition, repeatedCompositionOptions, repeatedCompositionTypes } from '../../resources/js/blocks/v3/repeatedTemplates';
import { CompositionBuilder } from '../../resources/js/blocks/v3/compositionBuilder';
import { list, process } from '../../resources/js/blocks/v3/repeatedCompositions';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { documentToPuck, documentFromPuck } from '../../resources/js/editor/v3/codec';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let count = 100; return () => id(count++); };
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
const validateLegacy = ajv.compile(schema);
function values(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(values);
  if (value && typeof value === 'object') return Object.values(value).flatMap(values);
  return [];
}
describe('bundled repeated compositions become independent editable trees', () => {
  it('declares the exact implemented subset without calling it the complete catalog', () => {
    expect(repeatedCompositionTypes).toHaveLength(14); expect(repeatedCompositionOptions).toHaveLength(38);
    expect(new Set(repeatedCompositionOptions.map(item => item.key)).size).toBe(38);
    expect(() => createRepeatedComposition('unknown', validateDocumentV3(fixture), ids())).toThrow('composition');
    expect(() => createRepeatedComposition('hero.poster', validateDocumentV3(fixture), ids())).toThrow('composition');
  });
  for (const option of repeatedCompositionOptions) it(`${option.key}: preserves content, assets and editable inner nodes`, () => {
    const preset = BUILTIN_BLOCK_PRESETS.find(item => item.preset_id === option.key)!;
    const source = { ...structuredClone(legacy), blocks: [{ instance_id: id(99), type: preset.block_id,
      block_version: 1, props: structuredClone(preset.props), slots: {} }] };
    expect(validateLegacy(source), JSON.stringify(validateLegacy.errors)).toBe(true);
    const document = validateDocumentV3(structuredClone(fixture)), next = ids(), before = JSON.stringify(document);
    const template = createRepeatedComposition(option.key, document, next);
    const originalTemplate = JSON.stringify(template);
    const inserted = executeTreeCommand(document, { kind: 'paste', clipboard: template, destination: { parentId: null, index: 0 } }, next).document;
    expect(JSON.stringify(document)).toBe(before); expect(JSON.stringify(template)).toBe(originalTemplate);
    const tree = indexTree(template.source);
    expect([...tree.values()].every(item => !item.node.locked)).toBe(true);
    expect([...tree.values()].filter(item => ['content.text', 'content.heading', 'action.link'].includes(item.node.type)).length).toBeGreaterThan(0);
    expect(documentFromPuck(documentToPuck(inserted))).toEqual(inserted);
    const outputStrings = new Set(values(template.source));
    // Every authored content string, including all nested repeated rows, survives.
    const omittedDesign = new Set(['grid', 'list', 'strip', 'panel', 'cards', 'featured', 'compact', 'editorial', 'portraits', 'bento',
      'masonry', 'filmstrip', 'wall', 'spotlight', 'split', 'quote-hero', 'horizontal', 'vertical', 'magazine', 'agenda', 'timeline',
      'rail', 'numbered', 'plain', 'outlined', 'primary', 'secondary', 'text', 'left', 'center', 'right', 'soft', 'normal']);
    for (const content of values(preset.props).filter(value => value && !omittedDesign.has(value))) expect(outputStrings.has(content), content).toBe(true);
    const inner = [...indexTree({ ...inserted, blocks: [inserted.blocks[0]] }).values()]
      .find(item => ['content.text', 'content.heading', 'action.link'].includes(item.node.type))!.node;
    const props = inner.type === 'content.text' ? { paragraphs: [[{ text: '새로운 내부 내용' }]] }
      : inner.type === 'content.heading' ? { ...inner.props, runs: [{ text: '새로운 내부 내용' }] }
      : inner.type === 'action.link' ? { ...inner.props, label: '새로운 내부 내용' } : undefined;
    expect(props).toBeDefined();
    const edited = executeDocumentCommand(inserted, { kind: 'content', id: inner.instance_id, props }, next).document;
    const styled = executeDocumentCommand(edited, { kind: 'style', id: inner.instance_id, viewport: 'mobile', set: { font_size: { value: 23, unit: 'px' } } }, next).document;
    expect(documentFromPuck(documentToPuck(styled))).toEqual(styled);
    const duplicate = executeTreeCommand(styled, { kind: 'duplicate', ids: [styled.blocks[0].instance_id] }, next).document;
    expect(duplicate.blocks[0].instance_id).not.toBe(duplicate.blocks[1].instance_id);
    expect(validateDocumentV3(JSON.parse(JSON.stringify(duplicate)))).toEqual(duplicate);
  });
  it('expands the authored featured pricing plan, not the first plan', () => {
    const composition = createRepeatedComposition('pricing.three-tier', validateDocumentV3(fixture), ids());
    const plans = [...indexTree(composition.source).values()].filter(item => 'tag' in item.node.props && item.node.props.tag === 'article');
    expect(plans.map(item => item.node.style.column_span)).toEqual([undefined, undefined]);
    const grid = [...indexTree(composition.source).values()].find(item => item.node.name === '플랜 목록')!.node;
    expect(grid.style.columns).toEqual([{ min: { value: 0, unit: 'px' }, max: { fr: 1 } }, { min: { value: 0, unit: 'px' }, max: { fr: 2 } }]);
    expect(grid.responsive.mobile?.columns).toEqual([{ min: { value: 0, unit: 'px' }, max: { fr: 1 } }]);
    expect(plans[1].node.style.border_left?.color).toEqual({ kind: 'token', value: 'primary' });
  });
  it('keeps styles detached across calls and defines real list/table semantics', () => {
    const document = validateDocumentV3(structuredClone(fixture));
    const first = createRepeatedComposition('testimonials.spotlight', document, ids());
    const second = createRepeatedComposition('testimonials.grid', document, ids());
    const articles = [...indexTree(second.source).values()].filter(item => 'tag' in item.node.props && item.node.props.tag === 'article');
    expect(articles.every(item => item.node.style.column_span === undefined)).toBe(true);
    first.source.blocks[0].name = '독립 변경';
    expect(second.source.blocks[0].name).not.toBe('독립 변경');
    const table = createRepeatedComposition('comparison.plans', document, ids());
    const tags = [...indexTree(table.source).values()].map(item => 'tag' in item.node.props && item.node.props.tag);
    expect(tags).toEqual(expect.arrayContaining(['table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td']));
    const b = new CompositionBuilder(document, ids());
    expect(list({ ordered: true, items: [{ text: '첫 항목' }] }, b).props).toEqual({ tag: 'ol' });
    const flow = process({ eyebrow: '', heading: '절차', items: [{ title: '시작', body: '설명', linkLabel: '', linkUrl: '' }], layout: 'vertical' }, b);
    expect(validateDocumentV3(b.finish(flow).source)).toBeTruthy();
  });
});
