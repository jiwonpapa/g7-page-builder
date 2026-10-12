import type { DocumentV3 } from '../../documents/v3/types';
import type { GeometryBox } from '../../documents/v3/geometry';
import { indexTree, selectionRoots, nodeAnchor } from '../../documents/v3/tree';
import { reject } from '../../documents/v3/schema';

/** Native input ownership works across iframe realms; host instanceof is insufficient. */
export function ownsTextInput(target: EventTarget | null): boolean {
  return Boolean(target && 'closest' in target && typeof target.closest === 'function'
    && target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]'));
}
export function canvasTargets(owner: Document, source: DocumentV3, ids: readonly string[]): HTMLElement[] {
  if (!ids.length) return [];
  return selectionRoots(indexTree(source), ids).flatMap(({ node }) => {
    const element = owner.getElementById(nodeAnchor(node.instance_id));
    return element?.dataset.v3Node === node.instance_id ? [element] : [];
  });
}
export function measureTargets(elements: readonly HTMLElement[]): GeometryBox[] {
  return elements.map(element => {
    const view = element.ownerDocument.defaultView;
    if (!view || !element.isConnected) reject('detached_target', '$');
    const css = view.getComputedStyle(element);
    // Border-box dimensions and layout offsets are unscaled, unlike host screen rectangles.
    // offsetLeft includes margin; CSS left positions the margin box, so subtract it.
    return { id: element.dataset.v3Node ?? '', width: parseFloat(css.width), height: parseFloat(css.height),
      left: element.offsetLeft - (parseFloat(css.marginLeft) || 0), top: element.offsetTop - (parseFloat(css.marginTop) || 0) };
  });
}
