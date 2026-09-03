import { G7_POST_DETAIL_BLOCK_TYPE, G7_PRODUCT_DETAIL_BLOCK_TYPE } from '../documents/builtinBlockContracts';
import type { BlockAppearance, PageBuilderBlock } from '../documents/types';
import { appearance, attachAppearance, type AppearanceEditorProps } from './catalogAppearance';
import { normalizeBlockMotion } from './blockMotionData';
import {
  type Phase4CatalogEditorComponents,
  type Phase4ComponentType,
  DEFAULT_POST_DETAIL,
  DEFAULT_PRODUCT_DETAIL,
  asRecord,
  asString,
  audience,
} from './phase4CatalogData';

function common(block: PageBuilderBlock, fallback: BlockAppearance): AppearanceEditorProps {
  return { ...appearance(asRecord(block.props.appearance), fallback), motion: normalizeBlockMotion(block.motion) };
}

export function canonicalPhase4BlockToPuck(block: PageBuilderBlock): { type: Phase4ComponentType; props: Phase4CatalogEditorComponents[Phase4ComponentType] } | null {
  const props = block.props;
  if (block.type === G7_POST_DETAIL_BLOCK_TYPE) return { type: 'G7PostDetail', props: {
    eyebrow: asString(props.eyebrow), heading: asString(props.heading), boardSlug: asString(props.boardSlug),
    postId: Number.isInteger(props.postId) ? Number(props.postId) : 1, detailUrl: asString(props.detailUrl),
    linkLabel: asString(props.linkLabel), audience: audience(props.audience), showContent: props.showContent !== false,
    emptyMessage: asString(props.emptyMessage, DEFAULT_POST_DETAIL.emptyMessage), ...common(block, { surface: 'default', spacing: 'normal' }),
  } };
  if (block.type === G7_PRODUCT_DETAIL_BLOCK_TYPE) return { type: 'G7ProductDetail', props: {
    eyebrow: asString(props.eyebrow), heading: asString(props.heading), productKey: asString(props.productKey),
    detailUrl: asString(props.detailUrl), buttonLabel: asString(props.buttonLabel), audience: audience(props.audience),
    showDescription: props.showDescription !== false, emptyMessage: asString(props.emptyMessage, DEFAULT_PRODUCT_DETAIL.emptyMessage),
    ...common(block, { surface: 'soft', spacing: 'normal' }),
  } };
  return null;
}

export function phase4PuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'G7PostDetail') return { type: G7_POST_DETAIL_BLOCK_TYPE, props: attachAppearance({
    eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), boardSlug: asString(raw.boardSlug),
    postId: Number(raw.postId) || 1, detailUrl: asString(raw.detailUrl), linkLabel: asString(raw.linkLabel),
    audience: audience(raw.audience), showContent: raw.showContent !== false,
    emptyMessage: asString(raw.emptyMessage, DEFAULT_POST_DETAIL.emptyMessage),
  }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7ProductDetail') return { type: G7_PRODUCT_DETAIL_BLOCK_TYPE, props: attachAppearance({
    eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), productKey: asString(raw.productKey),
    detailUrl: asString(raw.detailUrl), buttonLabel: asString(raw.buttonLabel), audience: audience(raw.audience),
    showDescription: raw.showDescription !== false,
    emptyMessage: asString(raw.emptyMessage, DEFAULT_PRODUCT_DETAIL.emptyMessage),
  }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  return null;
}
