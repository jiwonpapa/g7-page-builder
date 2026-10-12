import type { Background, Color, DocumentV3, GridTrack, Length, Node, Run, Size, Style, Track } from './types';
import { effectiveStyle, validateDocumentV3, type Viewport } from './validate';

export type Declarations = Record<string, string>;
export const FONT_FAMILIES = { sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'monospace' } as const;
export const DOCUMENT_SURFACE: Declarations = { 'box-sizing': 'border-box', 'font-family': FONT_FAMILIES.sans,
  'font-size': '16px', 'line-height': '1.5', 'font-weight': '400', margin: '0', padding: '24px' };
export const PARAGRAPH_STYLE: Declarations = { margin: '0', 'min-height': '1em' };
const length = (value: Length): string => `${value.value}${value.unit}`;
export function resolvedColor(value: Color, document: DocumentV3): string {
  return value.kind === 'hex' ? value.value : document.tokens[value.value].value;
}
function track(value: Track): string { return typeof value === 'string' ? value : 'fr' in value ? `${value.fr}fr` : length(value); }
function grid(value: GridTrack): string { return typeof value === 'object' && 'min' in value ? `minmax(${track(value.min)},${track(value.max)})` : track(value); }
function background(value: Background, document: DocumentV3): Declarations {
  if (value.kind === 'solid') return { background: resolvedColor(value.color, document) };
  if (value.kind === 'linear') return { background: `linear-gradient(${value.angle}deg,${value.stops.map(stop => `${resolvedColor(stop.color, document)} ${stop.offset * 100}%`).join(',')})` };
  const url = document.assets.find(asset => asset.asset_id === value.asset_id)!.url;
  // CSS quoted string escaping is separate from the HTML attribute escaping performed by renderers.
  const quoted = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\f]/g, '');
  return { 'background-image': `url("${quoted}")`, 'background-size': value.fit,
    'background-position': `${value.x}% ${value.y}%`, 'background-repeat': 'no-repeat' };
}
function size(result: Declarations, key: 'width' | 'height' | 'basis', value: Size, parent: Style | undefined, own: Style): void {
  const property = key === 'basis' ? 'flex-basis' : key;
  if (typeof value !== 'string') { result[property] = length(value); return; }
  if (value === 'hug') { result[property] = 'fit-content'; return; }
  if (value !== 'fill') { result[property] = value; return; }
  if (key === 'basis') { result[property] = '0px'; result['flex-grow'] = String(own.grow ?? 1); return; }
  const mainAxis = (parent?.direction ?? 'row') === 'row' ? 'width' : 'height';
  if (parent?.display === 'flex' && key === mainAxis) {
    result[property] = 'auto'; result['flex-basis'] = '0px'; result['flex-grow'] = String(own.grow ?? 1);
    result[`min-${key}`] = '0px';
  } else if (parent?.display === 'flex') {
    result[property] = 'auto'; result['align-self'] = own.align_self ?? 'stretch';
  } else result[property] = '100%';
}
function nodeDeclarations(node: Node, document: DocumentV3, style: Style, parent?: Style): Declarations {
  const out: Declarations = { 'box-sizing': 'border-box', margin: '0', padding: '0', 'border-width': '0',
    display: style.hidden ? 'none' : style.display ?? 'block', position: style.position === 'flow' ? 'static' : style.position ?? 'static' };
  if (node.type === 'content.heading' || node.type === 'content.text' || node.type === 'action.link') out['white-space'] = 'pre-wrap';
  if (node.type === 'content.heading') { out['font-size'] = `${[2, 1.5, 1.17, 1, 0.83, 0.67][node.props.level - 1]}em`; out['font-weight'] = '700'; }
  for (const key of ['width', 'height', 'basis'] as const) if (style[key] !== undefined) size(out, key, style[key], parent, style);
  for (const key of ['min_width', 'max_width', 'min_height', 'max_height', 'row_gap', 'column_gap', 'font_size', 'letter_spacing'] as const) {
    if (style[key] !== undefined) out[key.replaceAll('_', '-')] = length(style[key]);
  }
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    for (const group of ['margin', 'padding', 'inset'] as const) {
      const value = style[`${group}_${side}`];
      if (value !== undefined) out[group === 'inset' ? side : `${group}-${side}`] = value === 'auto' ? value : length(value);
    }
    const border = style[`border_${side}`];
    if (border) out[`border-${side}`] = `${border.width}px ${border.style} ${resolvedColor(border.color, document)}`;
  }
  for (const corner of ['top_left', 'top_right', 'bottom_left', 'bottom_right'] as const) {
    const value = style[`radius_${corner}`]; if (value) out[`border-${corner.replace('_', '-')}-radius`] = length(value);
  }
  const direct = { aspect_ratio: 'aspect-ratio', direction: 'flex-direction', wrap: 'flex-wrap', justify: 'justify-content',
    align: 'align-items', align_self: 'align-self', grow: 'flex-grow', shrink: 'flex-shrink', z_index: 'z-index', opacity: 'opacity',
    font_weight: 'font-weight', text_align: 'text-align', text_decoration: 'text-decoration', object_fit: 'object-fit' } as const;
  for (const [key, property] of Object.entries(direct)) {
    const value = style[key as keyof typeof direct]; if (value !== undefined) out[property] = String(value);
  }
  if (style.columns) out['grid-template-columns'] = style.columns.map(grid).join(' ');
  if (style.rows) out['grid-template-rows'] = style.rows.map(grid).join(' ');
  for (const axis of ['column', 'row'] as const) {
    if (style[`${axis}_start`] !== undefined) out[`grid-${axis}-start`] = String(style[`${axis}_start`]);
    if (style[`${axis}_span`] !== undefined) out[`grid-${axis}-end`] = `span ${style[`${axis}_span`]}`;
  }
  if (style.background) Object.assign(out, background(style.background, document));
  if (style.color) out.color = resolvedColor(style.color, document);
  if (style.font_family) out['font-family'] = FONT_FAMILIES[style.font_family];
  if (style.line_height !== undefined) out['line-height'] = typeof style.line_height === 'number' ? String(style.line_height) : length(style.line_height);
  if (style.rotation !== undefined) out.transform = `rotate(${style.rotation}deg)`;
  if (style.object_x !== undefined || style.object_y !== undefined) out['object-position'] = `${style.object_x ?? 50}% ${style.object_y ?? 50}%`;
  if (style.shadows) out['box-shadow'] = style.shadows.length ? style.shadows.map(shadow =>
    `${shadow.inset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${resolvedColor(shadow.color, document)}`).join(',') : 'none';
  return out;
}
/** Validates once, then creates generated CSS; authored style and original units remain unchanged. */
export function documentPresentation(source: DocumentV3, viewport: Viewport = 'base'): Map<string, Declarations> {
  const document = validateDocumentV3(source), styles = new Map<string, Declarations>();
  function visit(nodes: Node[], parent?: Style): void {
    for (const node of nodes) {
      const style = effectiveStyle(node, viewport);
      styles.set(node.instance_id, nodeDeclarations(node, document, style, parent));
      visit(node.slots.content ?? [], style);
    }
  }
  visit(document.blocks);
  return styles;
}
/** Caller passes runs from the validated document; false marks retain their explicit reset meaning. */
export function runPresentation(run: Run, document: DocumentV3): Declarations {
  const out: Declarations = {};
  if (run.color) out.color = resolvedColor(run.color, document);
  if (run.font_size) out['font-size'] = length(run.font_size);
  if (run.bold !== undefined) out['font-weight'] = run.bold ? '700' : '400';
  if (run.italic !== undefined) out['font-style'] = run.italic ? 'italic' : 'normal';
  if (run.underline !== undefined || run.strike !== undefined) out['text-decoration'] = [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean).join(' ') || 'none';
  return out;
}
