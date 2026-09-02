import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorPortal } from '../../resources/js/editor/EditorPortal';

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.replaceChildren();
});

describe('EditorPortal', () => {
  it('places product dialogs in the shared portal token scope', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    root.render(<EditorPortal><section role="dialog">설정</section></EditorPortal>);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const scope = document.body.querySelector('[data-g7pb-portal-surface="true"]');
    expect(scope?.querySelector('[role="dialog"]')?.textContent).toBe('설정');
  });
});
