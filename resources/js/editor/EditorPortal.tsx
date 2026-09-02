import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Product-owned overlays use one explicit token scope. Third-party overlays
 * keep their own host contract and are not silently wrapped here.
 */
export function EditorPortal({ children }: { children: React.ReactNode }): React.ReactPortal | null {
  if (!globalThis.document?.body) return null;
  return createPortal(<div className="g7pb-portal-surface" data-g7pb-portal-surface="true">{children}</div>, globalThis.document.body);
}
