import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../../css/page-builder-site-part.css';
import { SitePartEditor } from './SitePartEditor';
import { SitePartWorkspace } from './SitePartWorkspace';

const roots = new WeakMap<Element, Root>();

export function discoverSitePartEditors(scope: ParentNode = document): Element[] {
  return Array.from(scope.querySelectorAll('[data-g7pb-site-part-editor]'));
}

export function discoverSitePartWorkspaces(scope: ParentNode = document): Element[] {
  return Array.from(scope.querySelectorAll('[data-g7pb-site-part-workspace]'));
}

export function mountSitePartWorkspace(element: Element): () => void {
  const htmlElement = element as HTMLElement;
  roots.get(element)?.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<SitePartWorkspace locale={htmlElement.dataset.locale ?? 'ko'} />);

  return () => {
    roots.get(element)?.unmount();
    roots.delete(element);
  };
}

export function mountSitePartEditor(element: Element): () => void {
  const htmlElement = element as HTMLElement;
  const kind = htmlElement.dataset.kind === 'footer' ? 'footer' : 'header';
  roots.get(element)?.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<SitePartEditor kind={kind} locale={htmlElement.dataset.locale ?? 'ko'} />);

  return () => {
    roots.get(element)?.unmount();
    roots.delete(element);
  };
}

function autoMountSitePartEditors(): void {
  for (const element of discoverSitePartWorkspaces()) {
    if (!roots.has(element)) mountSitePartWorkspace(element);
  }
  for (const element of discoverSitePartEditors()) {
    if (!roots.has(element)) mountSitePartEditor(element);
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountSitePartEditors, { once: true });
  } else {
    queueMicrotask(autoMountSitePartEditors);
  }
}
