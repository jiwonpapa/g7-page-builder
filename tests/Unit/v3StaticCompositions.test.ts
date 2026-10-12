import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from '../../schemas/page-builder-document.schema.json';
import legacy from '../Contract/document-v1.fixture.json';
import fixture from '../Contract/document-v3.fixture.json';
import { BUILTIN_BLOCK_PRESETS } from '../../resources/js/blocks/builtinCatalog';
import { createStaticComposition, staticCompositionOptions, staticCompositionTypes } from '../../resources/js/blocks/v3/staticTemplates';
import { CompositionBuilder } from '../../resources/js/blocks/v3/compositionBuilder';
import * as compositions from '../../resources/js/blocks/v3/staticCompositions';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { documentFromPuck, documentToPuck } from '../../resources/js/editor/v3/codec';
import type { Node } from '../../resources/js/documents/v3/types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let count = 100; return () => id(count++); };
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
const validateLegacy = ajv.compile(schema);
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
function build(factory: (builder: CompositionBuilder) => Node) {
  const builder = new CompositionBuilder(validateDocumentV3(fixture), ids());
  return builder.finish(factory(builder)).source;
}

describe('bundled static compositions are editable canonical trees', () => {
  it('lists the exact subset and refuses other catalog types', () => {
    expect(staticCompositionTypes).toHaveLength(7); expect(staticCompositionOptions).toHaveLength(12);
    expect(new Set(staticCompositionOptions.map(item => item.key)).size).toBe(12);
    for (const key of ['unknown', 'hero.poster', 'rich-text.policy', 'anchor-menu.long-page', 'contact.office']) {
      expect(() => createStaticComposition(key, validateDocumentV3(fixture), ids())).toThrow('composition');
    }
  });
  for (const option of staticCompositionOptions) it(option.key + ': preserves authored copy, links, assets and independent edits', () => {
    const preset = BUILTIN_BLOCK_PRESETS.find(item => item.preset_id === option.key)!;
    const source = { ...structuredClone(legacy), blocks: [{ instance_id: id(99), type: preset.block_id,
      block_version: 1, props: structuredClone(preset.props), slots: {} }] };
    expect(validateLegacy(source), JSON.stringify(validateLegacy.errors)).toBe(true);
    const document = validateDocumentV3(structuredClone(fixture)), next = ids(), before = JSON.stringify(document);
    const clipboard = createStaticComposition(option.key, document, next);
    expect(JSON.stringify(document)).toBe(before);
    const templateBefore = JSON.stringify(clipboard);
    const inserted = executeTreeCommand(document, { kind: 'paste', clipboard, destination: { parentId: null, index: 0 } }, next).document;
    expect(JSON.stringify(clipboard)).toBe(templateBefore);
    expect(documentFromPuck(documentToPuck(inserted))).toEqual(inserted);
    const values = new Set(strings(clipboard.source));
    const design = new Set(['auto', '16:9', '4:3', '1:1', 'light', 'dark', 'split', 'centered', 'banner', 'panel',
      'blue', 'indigo', 'emerald', 'amber', 'solid', 'dashed', 'gradient', 'narrow', 'standard', 'full', 'line', 'mark',
      'left', 'center', 'info', 'success', 'warning', 'critical', 'soft', 'default', 'compact', 'normal']);
    for (const text of strings(preset.props).filter(value => value && !design.has(value))) expect(values.has(text), text).toBe(true);
    const tree = indexTree({ ...inserted, blocks: [inserted.blocks[0]] });
    expect([...tree.values()].every(item => !item.node.locked)).toBe(true);
    const leaf = [...tree.values()].find(item => item.node.type === 'content.text')?.node
      ?? [...tree.values()].find(item => item.node.type === 'content.heading')!.node;
    const props = leaf.type === 'content.text' ? { paragraphs: [[{ text: '세부 편집 <안전한 문자>' }]] }
      : { ...leaf.props, runs: [{ text: '세부 편집 <안전한 문자>' }] };
    const edited = executeDocumentCommand(inserted, { kind: 'content', id: leaf.instance_id, props }, next).document;
    const styled = executeDocumentCommand(edited, { kind: 'style', id: leaf.instance_id, viewport: 'mobile', set: { font_size: { value: 19, unit: 'px' } } }, next).document;
    const duplicated = executeTreeCommand(styled, { kind: 'duplicate', ids: [styled.blocks[0].instance_id] }, next).document;
    expect(duplicated.blocks[0].instance_id).not.toBe(duplicated.blocks[1].instance_id);
    expect(documentFromPuck(documentToPuck(duplicated))).toEqual(duplicated);
    expect(validateDocumentV3(JSON.parse(JSON.stringify(duplicated)))).toEqual(duplicated);
  });
  it('keeps heading levels, image ratios, captions and unsupported legacy targets explicit', () => {
    for (const level of [2, 3, 4] as const) {
      const source = build(b => compositions.heading({ eyebrow: '', heading: '제목', level, anchor: '' }, b));
      expect([...indexTree(source).values()].find(item => item.node.type === 'content.heading')?.node.props).toMatchObject({ level });
    }
    expect(() => build(b => compositions.heading({ eyebrow: '', heading: '제목', level: 2, anchor: 'legacy' }, b))).toThrow('composition_anchor');
    expect(() => build(b => compositions.image({ src: '/image.png', alt: '설명', caption: '', linkUrl: '/target', aspectRatio: 'auto' }, b))).toThrow('composition_image_link');
    for (const aspectRatio of ['auto', '16:9', '4:3', '1:1'] as const) {
      const source = build(b => compositions.image({ src: '/image.png', alt: '설명', caption: '', linkUrl: '', aspectRatio }, b));
      const image = [...indexTree(source).values()].find(item => item.node.type === 'media.image')!.node;
      expect(image.style.aspect_ratio).toBe(aspectRatio === 'auto' ? undefined : aspectRatio === '16:9' ? 1.78 : aspectRatio === '4:3' ? 1.33 : 1);
    }
  });
  it('keeps all CTA layouts and light/dark variants detached and typed', () => {
    for (const theme of ['light', 'dark'] as const) for (const layout of ['split', 'centered', 'banner', 'panel'] as const) {
      const root = build(b => compositions.cta({ eyebrow: '', heading: '제목', body: '본문', theme, layout }, b)).blocks[0];
      expect(root.style.color).toEqual({ kind: 'token', value: theme === 'dark' ? 'surface' : 'text' });
      expect(root.style.display).toBe(['split', 'banner'].includes(layout) ? 'grid' : 'flex');
    }
    expect(build(b => compositions.cta({ eyebrow: '', heading: '제목', body: '본문', theme: 'light' }, b)).blocks[0].style.display).toBe('grid');
  });
  it('keeps chart labels, numeric values, units and bounded typed bar widths separately editable', () => {
    const document = build(b => compositions.barChart({ eyebrow: '', heading: '통계', description: '설명', unit: '%', items: [
      { label: '없음', value: 0, tone: 'blue' }, { label: '일부', value: 50, tone: 'emerald' }, { label: '전체', value: 100, tone: 'amber' },
    ] }, b));
    const bars = [...indexTree(document).values()].filter(item => item.node.name === '막대').map(item => item.node.style.width);
    expect(bars).toEqual([0, 50, 100].map(value => ({ value, unit: '%' })));
    expect(strings(document)).toEqual(expect.arrayContaining(['0', '50', '100', '%', '없음', '일부', '전체']));
    expect(build(b => compositions.barChart({ eyebrow: '', heading: '', description: '', unit: '', items: [{ label: '0', value: 0, tone: 'indigo' }] }, b))).toBeTruthy();
  });
  it('keeps divider styles, quotation semantics and all notice tones without runtime behaviors', () => {
    for (const variant of ['solid', 'dashed', 'gradient'] as const) for (const width of ['narrow', 'standard', 'full'] as const) {
      const document = build(b => compositions.divider({ label: '', variant, width }, b));
      expect(document.blocks[0].style.max_width).toEqual({ value: width === 'narrow' ? 480 : width === 'standard' ? 960 : 1920, unit: 'px' });
    }
    for (const variant of ['line', 'mark'] as const) for (const alignment of ['left', 'center'] as const) {
      const root = build(b => compositions.blockquote({ quote: '인용', citation: '이름', role: '직함', variant, alignment }, b)).blocks[0];
      expect(root.props).toEqual({ tag: 'figure' });
      expect(root.slots.content![0].props).toEqual({ tag: 'blockquote' });
      expect(root.style.text_align).toBe(alignment === 'left' ? 'start' : 'center');
    }
    for (const tone of ['info', 'success', 'warning', 'critical'] as const) {
      expect(build(b => compositions.notice({ title: '안내', body: '본문', actionLabel: '', actionUrl: '', tone }, b)).blocks[0].props).toEqual({ tag: 'aside' });
    }
  });
});
