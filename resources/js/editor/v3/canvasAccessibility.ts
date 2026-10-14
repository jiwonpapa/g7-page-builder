/** View-only repair of vendor drag attributes on PB-owned canvas nodes. */
interface AttributeOwner { before: string | null; applied: string | null }
let descriptionSequence = 0;

export function createCanvasAccessibility(owner: Document) {
  const changed = new Map<Element, Map<string, AttributeOwner>>();
  const copies = new Map<string, HTMLParagraphElement>();
  const host = owner.defaultView?.frameElement?.ownerDocument;
  let active = true, pending = false;
  const write = (element: Element, name: string, value: string | null): void => {
    const current = element.getAttribute(name);
    if (current === value) return;
    let attributes = changed.get(element);
    if (!attributes) { attributes = new Map(); changed.set(element, attributes); }
    const previous = attributes.get(name);
    attributes.set(name, { before: previous && current === previous.applied ? previous.before : current, applied: value });
    if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
  };
  const restore = (element: Element, attributes: Map<string, AttributeOwner>): void => {
    for (const [name, value] of attributes) {
      if (element.getAttribute(name) !== value.applied) continue;
      if (value.before === null) element.removeAttribute(name); else element.setAttribute(name, value.before);
    }
  };
  const sync = (): void => {
    if (!active) return;
    const nodes = new Set(owner.querySelectorAll('[data-v3-surface] [data-v3-node]'));
    for (const [element, attributes] of changed) {
      if (!nodes.has(element)) { restore(element, attributes); changed.delete(element); }
    }
    for (const element of nodes) {
      // aria-grabbed is obsolete. Pressed is meaningful only on a button;
      // Puck's drag state must not turn a containing group into a toggle.
      write(element, 'aria-grabbed', null);
      if (element.getAttribute('role') !== 'button' && element.tagName !== 'BUTTON') write(element, 'aria-pressed', null);
      const reference = element.getAttribute('aria-describedby');
      if (!reference || !host || host === owner) continue;
      const ids = reference.split(/\s+/).filter(Boolean).map(id => {
        if (owner.getElementById(id)) return id;
        const original = host.getElementById(id);
        if (!original) return id; // Keep an unknown/broken author reference visible to the audit.
        let copy = copies.get(id);
        if (!copy) {
          copy = owner.createElement('p'); copy.id = 'g7pb-canvas-description-' + ++descriptionSequence;
          copy.className = 'g7pb-v3-sr-only'; copies.set(id, copy); owner.body.append(copy);
        }
        if (copy.textContent !== original.textContent) copy.textContent = original.textContent;
        return copy.id;
      });
      write(element, 'aria-describedby', ids.join(' '));
    }
  };
  const Observer = owner.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(() => {
    if (!active || pending) return;
    pending = true; queueMicrotask(() => { pending = false; sync(); });
  }) : null;
  observer?.observe(owner.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['role', 'aria-pressed', 'aria-grabbed', 'aria-describedby'] });
  sync();
  return { sync, dispose(): void {
    active = false; observer?.disconnect();
    for (const [element, attributes] of changed) restore(element, attributes);
    for (const copy of copies.values()) copy.remove();
    changed.clear(); copies.clear();
  } };
}
