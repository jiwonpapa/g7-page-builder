import type { PageBuilderBlock } from '../documents/types';
import { appearance, attachAppearance } from './catalogAppearance';
import { normalizeBlockMotion } from './blockMotionData';
import { asRecord, asString } from './foundationCatalogData';
import type { BasicElementEditorComponents, BasicElementType } from './basicElementCatalogData';

const fallback = { surface: 'default', spacing: 'compact' } as const;
function listItems(value: unknown): Array<{ text: string }> {
  return Array.isArray(value) ? value.map((item) => ({ text: asString(asRecord(item).text) })) : [];
}

export function canonicalBasicElementToPuck(block: PageBuilderBlock): { type: BasicElementType; props: BasicElementEditorComponents[BasicElementType] } | null {
  const p = block.props;
  const common = { ...appearance(asRecord(p.appearance), fallback), motion: normalizeBlockMotion(block.motion) };
  if (block.type === 'content.icon-01') return { type: 'Icon', props: { icon: asString(p.icon), size: asString(p.size), tone: asString(p.tone), decorative: p.decorative === true, label: asString(p.label), ...common } };
  if (block.type === 'content.list-01') return { type: 'List', props: { ordered: p.ordered === true, items: listItems(p.items), ...common } };
  if (block.type === 'content.badge-01') return { type: 'Badge', props: { label: asString(p.label), icon: asString(p.icon), size: asString(p.size), tone: asString(p.tone), ...common } };
  return null;
}

export function basicElementToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  let props: Record<string, unknown>;
  let blockType: string;
  if (type === 'Icon') {
    blockType = 'content.icon-01';
    props = { icon: raw.icon, size: raw.size, tone: raw.tone, decorative: raw.decorative, label: raw.label };
  } else if (type === 'List') {
    blockType = 'content.list-01';
    props = { ordered: raw.ordered, items: raw.items };
  } else if (type === 'Badge') {
    blockType = 'content.badge-01';
    props = { label: raw.label, icon: raw.icon, size: raw.size, tone: raw.tone };
  } else return null;
  // Keep invalid/empty edits intact: the canonical validator reports errors instead of replacing content.
  return { type: blockType, props: attachAppearance(props, raw, fallback, includeAppearance) };
}
