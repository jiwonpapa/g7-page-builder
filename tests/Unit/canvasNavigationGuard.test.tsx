import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { canvasNavigationGuard } from '../../resources/js/editor/canvasNavigationGuard';

describe('editor canvas navigation boundary', () => {
  it.each(['click', 'auxclick'])('cancels %s before native selection stops propagation, including iframe targets', async (type) => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Missing iframe document');
    const root = createRoot(doc.body);
    const selected = vi.fn((event: Event) => event.stopPropagation());
    const bubbled = vi.fn();
    try {
      await act(async () => root.render(<div {...canvasNavigationGuard}>
        <section ref={(node) => { node?.addEventListener(type, selected); }}>
          <a href="https://example.com/path" onClick={bubbled}><span>편집할 버튼</span></a>
        </section>
      </div>));
      const target = doc.querySelector('span');
      if (!target) throw new Error('Missing nested link label');
      const event = doc.createEvent('MouseEvents');
      event.initEvent(type, true, true);
      await act(async () => { target.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(true);
      expect(selected).toHaveBeenCalledOnce();
      expect(bubbled).not.toHaveBeenCalled();
      expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com/path');
    } finally {
      await act(async () => root.unmount());
      iframe.remove();
    }
  });

  it('preserves editor controls and links rendered in a portal outside the canvas', async () => {
    const host = document.createElement('div');
    const portal = document.createElement('div');
    const root = createRoot(host);
    const clicked = vi.fn();
    try {
      await act(async () => root.render(<div {...canvasNavigationGuard}>
        <button onClick={clicked}>슬라이드 다음</button>
        {createPortal(<a href="/preview">미리보기</a>, portal)}
      </div>));
      for (const target of [host.querySelector('button'), portal.querySelector('a')]) {
        if (!target) throw new Error('Missing control');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        await act(async () => { target.dispatchEvent(event); });
        expect(event.defaultPrevented).toBe(false);
      }
      expect(clicked).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
    }
  });
});
