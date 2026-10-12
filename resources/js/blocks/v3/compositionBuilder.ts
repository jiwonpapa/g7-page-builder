import type { Color, DocumentV3, LayoutTag, Node, Style } from '../../documents/v3/types';
import { freshId, type NewId, type TreeClipboard } from '../../documents/v3/clipboard';
import { indexTree } from '../../documents/v3/tree';
import { validateDocumentV3 } from '../../documents/v3/validate';

export const px = (value: number) => ({ value, unit: 'px' as const });
export const fluidTrack = (fr = 1) => ({ min: px(0), max: { fr } });
export const token = (value: Extract<Color, { kind: 'token' }>['value']): Color => ({ kind: 'token', value });
export const padding = (value: number): Style => ({ padding_top: px(value), padding_right: px(value), padding_bottom: px(value), padding_left: px(value) });
export const radius = (value: number): Style => ({ radius_top_left: px(value), radius_top_right: px(value), radius_bottom_left: px(value), radius_bottom_right: px(value) });
export const outline = (color: Color = token('border')): Style => Object.fromEntries(
  ['top', 'right', 'bottom', 'left'].map(side => ['border_' + side, { width: 1, style: 'solid', color }]),
);
export const vertical = (gap = 16): Style => ({ display: 'flex', direction: 'column', row_gap: px(gap) });

/** Transient factory for owned templates, not a document store or an Undo engine.
 * Images become canonical asset references. finish() returns the existing clipboard
 * contract so one paste command imports assets, assigns fresh IDs, and owns history.
 */
export class CompositionBuilder {
  private readonly source: DocumentV3;
  private readonly used: Set<string>;
  constructor(document: DocumentV3, private readonly nextId: NewId) {
    this.source = structuredClone(validateDocumentV3(document));
    this.used = new Set([...indexTree(document).keys(), ...document.assets.map(asset => asset.asset_id)]);
    this.source.blocks = [];
  }
  private base(name: string) {
    return { instance_id: freshId(this.used, this.nextId), block_version: 1 as const, name,
      locked: false, slots: {}, style: {}, responsive: {} };
  }
  frame(name: string, children: Node[], style: Style = {}, tag: LayoutTag = 'div'): Node {
    return { ...this.base(name), type: tag === 'section' ? 'layout.section' : 'layout.container',
      props: { tag }, slots: { content: children }, style: { min_width: px(0), ...structuredClone(style) } };
  }
  text(name: string, value: string, style: Style = {}): Node {
    return { ...this.base(name), type: 'content.text', props: { paragraphs: [[{ text: value }]] }, style: structuredClone(style) };
  }
  heading(name: string, value: string, level = 2, size = 28): Node {
    return { ...this.base(name), type: 'content.heading', props: { level, runs: [{ text: value }] },
      style: { font_size: px(size), line_height: 1.25 }, responsive: { mobile: { font_size: px(Math.min(size, 24)) } } };
  }
  link(name: string, label: string, url: string, variant: 'primary' | 'secondary' | 'text' = 'text'): Node {
    if (!url) return this.text(name, label);
    const style: Style = variant === 'text' ? { color: token('primary'), text_decoration: 'underline' }
      : { ...padding(12), ...radius(8), width: 'hug', max_width: { value: 100, unit: '%' }, text_decoration: 'none',
        ...(variant === 'primary' ? { background: { kind: 'solid', color: token('primary') }, color: token('surface') } : outline()) };
    return { ...this.base(name), type: 'action.link', props: { label, link: { url, new_tab: false } }, style };
  }
  image(name: string, url: string, alt: string, style: Style = {}): Node {
    if (!url) return this.frame(name, [this.text('이미지 안내', '이미지를 추가해 주세요')],
      { ...padding(24), min_height: px(100), ...style });
    let asset = this.source.assets.find(value => value.url === url);
    if (!asset) {
      asset = { asset_id: freshId(this.used, this.nextId), url };
      this.source.assets.push(asset);
    }
    return { ...this.base(name), type: 'media.image', props: { asset_id: asset.asset_id, alt },
      style: { width: 'fill', max_width: { value: 100, unit: '%' }, aspect_ratio: 1.5, object_fit: 'cover', ...radius(8), ...style } };
  }
  section(name: string, eyebrow: string, heading: string, children: Node[]): Node {
    return this.frame(name, [...(eyebrow ? [this.text('보조 문구', eyebrow, { color: token('accent'), font_size: px(14) })] : []),
      ...(heading ? [this.heading('제목', heading)] : []), ...children], { ...vertical(24), ...padding(32), width: 'fill' }, 'section');
  }
  grid(name: string, children: Node[], columns: number, gap = 24): Node {
    const root = this.frame(name, children, { display: 'grid', columns: Array.from({ length: columns }, () => fluidTrack()),
      column_gap: px(gap), row_gap: px(gap), width: 'fill', align: 'start' });
    root.responsive.tablet = { columns: Array.from({ length: Math.min(2, columns) }, () => fluidTrack()) };
    root.responsive.mobile = { columns: [fluidTrack()] };
    return root;
  }
  finish(root: Node): TreeClipboard {
    const source = structuredClone(validateDocumentV3({ ...this.source, blocks: [root] }));
    return { source, ids: [root.instance_id] };
  }
}
