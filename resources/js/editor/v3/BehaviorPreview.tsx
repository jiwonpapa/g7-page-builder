import React, { useLayoutEffect, useRef } from 'react';
import type { DocumentV3 } from '../../documents/v3/types';
import type { Viewport } from '../../documents/v3/validate';
import { bootAccordions, bootTabs, disposeContentControls } from '../../public/publicContentControls';
import { bootAuthoredSliders, disposePageSliders } from '../../public/publicSliders';
import { StructurePreview } from './NodeRenderer';

function MountedPreview({ document, viewport }: { document: DocumentV3; viewport: Viewport }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;
    const media = root.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const boot = () => { bootAccordions(root); bootTabs(root); bootAuthoredSliders(root, media?.matches ?? false); };
    boot(); media?.addEventListener('change', boot);
    return () => { media?.removeEventListener('change', boot); disposeContentControls(root); disposePageSliders(root); };
  }, []);
  return <div ref={host}><StructurePreview document={document} viewport={viewport} /></div>;
}
/** A changed authored document gets a fresh DOM: cleanup cannot restore old state into new nodes. */
export function BehaviorPreview({ document, viewport = 'base' }: { document: DocumentV3; viewport?: Viewport }) {
  return <MountedPreview key={viewport + ':' + JSON.stringify(document)} document={document} viewport={viewport} />;
}
