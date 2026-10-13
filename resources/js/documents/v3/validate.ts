import schema from '../../../../schemas/page-builder-document-v3.schema.json';
import policy from '../../../../schemas/design-policy-v3.json';
import { jsonBytes, reject, validateRule } from './schema';
import type { DocumentV3, Node, Style } from './types';
import { validateNodeSemantics } from './semantics';
import { validateBehaviors } from './behaviors';
import { validateBindings } from './bindings';

export { V3Error } from './schema';
export const designPolicyV3 = policy;
export type Viewport = 'base' | 'tablet' | 'mobile';
/** Overrides are atomic per style property; tablet and mobile independently inherit base. */
export function effectiveStyle(node: Pick<Node, 'style' | 'responsive'>, viewport: Viewport): Style {
  return { ...node.style, ...(viewport === 'base' ? {} : node.responsive[viewport]) };
}
export function viewportAt(width: number): Viewport {
  if (!Number.isFinite(width) || width < 0) reject('viewport', '$');
  return width < policy.breakpoints.tablet ? 'mobile' : width < policy.breakpoints.desktop ? 'tablet' : 'base';
}
function styleSemantics(style: Style, parent: Style | undefined, assets: Set<string>): void {
  if (style.position === 'absolute' && (!parent || !['relative', 'absolute'].includes(parent.position ?? 'flow'))) reject('position_parent', '$');
  if ((style.rotation !== undefined || ['top', 'right', 'bottom', 'left'].some(side => Object.hasOwn(style, 'inset_' + side))) && style.position !== 'absolute') reject('position', '$');
  for (const axis of ['width', 'height'] as const) {
    const min = style[`min_${axis}`], max = style[`max_${axis}`];
    if (min && max && min.unit === max.unit && min.value > max.value) reject('size_order', '$');
  }
  const background = style.background;
  if (background?.kind === 'image' && !assets.has(background.asset_id)) reject('asset_reference', '$');
  if (background?.kind === 'linear' && background.stops.some((stop, i) => i > 0 && stop.offset < background.stops[i - 1].offset)) reject('gradient_order', '$');
}
export function validateDocumentV3(value: unknown): DocumentV3 {
  if (jsonBytes(value, policy.limits.json_depth) > policy.limits.utf8_bytes) reject('byte_limit', '$');
  validateRule(value, schema, schema.$defs);
  // Schema proves the wire shape; semantic checks below prove cross-node constraints.
  const document = value as DocumentV3;
  const assets = new Set<string>();
  for (const asset of document.assets) {
    if (assets.has(asset.asset_id)) reject('duplicate_asset', '$');
    assets.add(asset.asset_id);
  }
  if (Object.values(document.tokens).some(color => color.kind !== 'hex')) reject('token_cycle', '$');
  const ids = new Set<string>();
  const visit = (nodes: Node[], parent: Node | undefined, depth: number): void => {
    if (depth > policy.limits.depth && nodes.length) reject('depth_limit', '$');
    for (const node of nodes) {
      if (ids.has(node.instance_id)) reject('duplicate_id', '$');
      ids.add(node.instance_id);
      if (ids.size > policy.limits.nodes) reject('node_limit', '$');
      const required = policy.node_props[node.type];
      if (Object.keys(node.props).length !== required.length || required.some(key => !Object.hasOwn(node.props, key))) reject('props_type', '$');
      if (!policy.containers.includes(node.type) && Object.keys(node.slots).length) reject('leaf_slots', '$');
      validateNodeSemantics(node, parent);
      if (node.type === 'media.image' && !assets.has(node.props.asset_id)) reject('asset_reference', '$');
      if (node.type === 'media.icon' && !node.props.decorative && !/[^\p{Z}\p{C}]/u.test(node.props.label)) reject('icon_label', '$');
      for (const viewport of ['base', 'tablet', 'mobile'] as const) styleSemantics(effectiveStyle(node, viewport), parent && effectiveStyle(parent, viewport), assets);
      visit(node.slots.content ?? [], node, depth + 1);
    }
  };
  visit(document.blocks, undefined, 1);
  validateBehaviors(document);
  validateBindings(document);
  return document;
}
