import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTemplateViewportWidth } from '../../resources/js/public/templateViewportWidth';

const property = '--g7pb-template-viewport-width';
const sessions: ReturnType<typeof createTemplateViewportWidth>[] = [];
const fixture = () => {
  document.body.innerHTML = '<header style="width:80%">Host</header><main style="padding:32px"><div class="g7pb-template-body"><div data-g7pb-v3-public></div></div></main><div class="g7pb-template-body">Legacy</div>';
  const panel = document.querySelector<HTMLElement>('.g7pb-template-body')!;
  const runtime = createTemplateViewportWidth(document); sessions.push(runtime);
  return { panel, runtime };
};
afterEach(() => { sessions.splice(0).forEach(runtime => runtime.dispose()); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('PB v3 template viewport width ownership', () => {
  it('uses the owner document client width excluding a classic scrollbar, without changing host or legacy styles', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1265);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
    const { panel, runtime } = fixture(), header = document.querySelector('header')!, main = document.querySelector('main')!;
    const headerStyle = header.getAttribute('style'), mainStyle = main.getAttribute('style');
    runtime.update();
    expect(panel.style.getPropertyValue(property)).toBe('1265px');
    expect(header.getAttribute('style')).toBe(headerStyle); expect(main.getAttribute('style')).toBe(mainStyle);
    expect(document.querySelectorAll<HTMLElement>('.g7pb-template-body')[1].style.getPropertyValue(property)).toBe('');
  });
  it('updates on resize and restores original value and priority once disposed', () => {
    let width = 1265; vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => width);
    const { panel, runtime } = fixture(); panel.style.setProperty(property, '900px', 'important');
    runtime.update(); width = 753; window.dispatchEvent(new Event('resize'));
    expect(panel.style.getPropertyValue(property)).toBe('753px');
    runtime.dispose(); expect(panel.style.getPropertyValue(property)).toBe('900px');
    expect(panel.style.getPropertyPriority(property)).toBe('important');
    width = 345; window.dispatchEvent(new Event('resize')); expect(panel.style.getPropertyValue(property)).toBe('900px');
  });
  it('leaves a later style owner intact on update and disposal', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1265);
    const { panel, runtime } = fixture(); runtime.update(); panel.style.setProperty(property, '777px', 'important');
    runtime.update(); runtime.dispose(); expect(panel.style.getPropertyValue(property)).toBe('777px');
    expect(panel.style.getPropertyPriority(property)).toBe('important');
  });
  it('covers late mounted v3 surfaces and retires only its own removed surface value', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(345);
    const { panel, runtime } = fixture(); runtime.update();
    const second = document.createElement('div'); second.className = 'g7pb-template-body';
    second.innerHTML = '<div data-g7pb-v3-public></div>'; document.body.append(second); runtime.update();
    expect(second.style.getPropertyValue(property)).toBe('345px');
    panel.replaceChildren(); runtime.update(); expect(panel.style.getPropertyValue(property)).toBe('');
    expect(second.style.getPropertyValue(property)).toBe('345px');
  });
  it('uses the owner window width only when no client width is available', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(0);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(360);
    const { panel, runtime } = fixture(); runtime.update(); expect(panel.style.getPropertyValue(property)).toBe('360px');
  });
});
