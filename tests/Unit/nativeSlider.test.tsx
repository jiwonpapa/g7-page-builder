import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PageBuilderSlider } from '../../resources/js/native-components/entry';
import type { SliderProps } from '../../resources/js/native-components/Slider';
import { nativeEditorSpec, nativeComponentManifest } from '../../resources/js/native-components/spec';
const slides = [{ id: 'a', src: '/a.png', alt: '첫 이미지', caption: 'First' }, { id: 'b', src: '/b.png', alt: '', caption: 'Second' }];
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let reduced: boolean;
let motion: (() => void) | undefined;
const removeMotion = vi.fn();
beforeEach(() => {
  vi.useFakeTimers(); reduced = false; motion = undefined; removeMotion.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_name: string, fn: () => void) => { motion = fn; }, removeEventListener: removeMotion }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function render(props: SliderProps = {}): void { act(() => root.render(<PageBuilderSlider slides={slides} {...props} />)); }
function advance(ms = 1000): void { act(() => vi.advanceTimersByTime(ms)); }
function button(text: string): HTMLButtonElement { return Array.from(container.querySelectorAll('button')).find(item => item.textContent === text)!; }
function click(text: string): void { act(() => button(text).click()); }
const active = () => container.querySelector('figure:not([hidden])')?.textContent;
it('renders every editable item without autoplay or public controls', () => {
  render({ id: 'public-slider', autoplay: true, interval: 1000, editorAttrs: { 'data-editor-id': 'slider' } }); advance(3000);
  expect(container.querySelectorAll('figure:not([hidden])')).toHaveLength(2);
  expect(container.querySelector('section')?.id).toBe('public-slider'); expect(container.querySelector('button')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
it('runs public autoplay and stops for keyboard or focus until explicitly restarted', () => {
  render({ autoplay: true, interval: 1000 }); expect(active()).toBe('First'); advance(); expect(active()).toBe('Second');
  act(() => container.querySelector('section')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
  expect(active()).toBe('First'); advance(4000); expect(active()).toBe('First');
  click('자동 재생 시작'); advance(); expect(active()).toBe('Second');
  act(() => button('이전 슬라이드').dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
  advance(); expect(active()).toBe('Second'); expect(button('자동 재생 시작').getAttribute('aria-pressed')).toBe('false');
});
it('uses reduced motion changes and removes timers and listeners on unmount', () => {
  render({ autoplay: true, interval: 1000 }); expect(vi.getTimerCount()).toBe(1);
  reduced = true; act(() => motion?.()); advance(3000); expect(active()).toBe('First');
  expect(button('자동 재생 시작').disabled).toBe(true); expect(vi.getTimerCount()).toBe(0);
  const remove = vi.spyOn(document, 'removeEventListener');
  act(() => root.unmount()); root = createRoot(container);
  expect(removeMotion).toHaveBeenCalledWith('change', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function)); remove.mockRestore();
});
it('pauses a hidden document and resumes only a running slider on return', () => {
  render({ autoplay: true, interval: 1000 });
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange'))); advance(3000); expect(active()).toBe('First');
  hidden.mockReturnValue(false); act(() => document.dispatchEvent(new Event('visibilitychange'))); advance(); expect(active()).toBe('Second'); hidden.mockRestore();
});
it('clamps selection and clears autoplay when items are removed', () => {
  render({ autoplay: true, interval: 1000 }); advance(); expect(active()).toBe('Second');
  render({ slides: [slides[0]], autoplay: true, interval: 1000 }); expect(active()).toBe('First'); expect(vi.getTimerCount()).toBe(0);
  render({ slides: [] }); expect(container.textContent).toContain('슬라이드가 없습니다.');
});
it('rejects malformed records and unsafe sources without treating captions as markup', () => {
  render({ slides: [null, { ...slides[0], src: 'javascript:alert(1)', caption: '<b>literal</b>' }, slides[0], { id: 3 }, slides[1]] });
  expect(container.querySelectorAll('figure')).toHaveLength(2); expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(container.querySelector('b')).toBeNull(); expect(container.textContent).toContain('<b>literal</b>');
});
it('ships the renderer manifest and declared array image field with complete defaults', () => {
  expect(nativeComponentManifest.components.composite.map(item => item.name)).toEqual(['PageBuilderSlider']);
  const editor = nativeEditorSpec.componentCapabilities.PageBuilderSlider.nodeEditor;
  expect(editor.params.fields.find(field => field.key === 'src')?.widget).toBe('image');
  expect(editor.params.newItem).toEqual({ id: '', src: '', alt: '', caption: '새 슬라이드' });
  expect(nativeEditorSpec.componentPalette.entries.PageBuilderSlider.defaultNode.props.autoplay).toBe(false);
});
