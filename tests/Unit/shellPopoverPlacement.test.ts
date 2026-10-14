import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShellPopoverPlacement } from '../../resources/js/public/shellPopoverPlacement';

const disposers: Array<() => void> = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); });
function fixture(width = 1280, height = 720) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(height);
  const host = document.createElement('div'), trigger = document.createElement('button'), panel = document.createElement('section');
  host.style.transform = 'rotate(15deg)'; host.style.overflow = 'hidden';
  host.append(trigger, panel); document.body.append(host);
  let anchor = { top: 569, bottom: 611, right: 66 }, size = { width: Math.min(320, width - 32), height: 109 };
  vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => ({ ...anchor, x: anchor.right - 42, y: anchor.top,
    left: anchor.right - 42, width: 42, height: anchor.bottom - anchor.top, toJSON() {} }));
  vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => ({ ...size, x: 0, y: 0, left: 0, top: 0,
    right: size.width, bottom: size.height, toJSON() {} }));
  const placement = createShellPopoverPlacement(document); disposers.push(() => placement.dispose());
  return { host, trigger, panel, placement, anchor: (value: typeof anchor) => { anchor = value; }, size: (value: typeof size) => { size = value; } };
}

describe('owned shell popover viewport placement', () => {
  it('clamps a left-side popup and flips above a bottom-edge trigger', () => {
    const { placement, trigger, panel } = fixture();
    placement.open(trigger, panel);
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.left).toBe('16px'); expect(panel.style.top).toBe('448px');
    expect(panel.style.maxHeight).toBe('688px');
  });
  it('bounds narrow and short screens while preserving the authored host', () => {
    const { host, placement, trigger, panel, size, anchor } = fixture(360, 320);
    size({ width: 328, height: 288 }); anchor({ top: 150, bottom: 192, right: 348 });
    const authored = host.style.cssText;
    placement.open(trigger, panel);
    expect(panel.style.maxWidth).toBe('328px'); expect(panel.style.maxHeight).toBe('288px');
    expect(panel.style.left).toBe('16px'); expect(panel.style.top).toBe('16px');
    expect(panel.style.overflowY).toBe('auto'); expect(host.style.cssText).toBe(authored);
    expect(panel.parentElement).toBe(host);
  });
  it('uses the native top layer without moving or copying the panel DOM', () => {
    const { host, placement, trigger, panel } = fixture();
    const show = vi.fn(), hide = vi.fn();
    Object.defineProperty(panel, 'showPopover', { configurable: true, value: show });
    Object.defineProperty(panel, 'hidePopover', { configurable: true, value: hide });
    // jsdom drops priority on position before mounting; left retains it and
    // exercises the identical ownership/restore path without a false premise.
    panel.style.position = 'absolute'; panel.style.setProperty('left', '3px', 'important'); panel.style.marginLeft = '3px';
    panel.setAttribute('popover', 'auto');
    placement.open(trigger, panel);
    expect(show).toHaveBeenCalledOnce(); expect(panel.getAttribute('popover')).toBe('manual');
    expect(panel.parentElement).toBe(host);
    placement.close(panel);
    expect(hide).toHaveBeenCalledOnce(); expect(panel.getAttribute('popover')).toBe('auto');
    expect(panel.style.position).toBe('absolute'); expect(panel.style.left).toBe('3px');
    expect(panel.style.getPropertyPriority('left')).toBe('important');
    expect(panel.style.marginLeft).toBe('3px');
  });
  it('updates on outer scroll, ignores inner scrolling, and removes its listeners', () => {
    const { placement, trigger, panel, anchor } = fixture();
    placement.open(trigger, panel); anchor({ top: 100, bottom: 142, right: 600 });
    panel.dispatchEvent(new Event('scroll')); expect(panel.style.left).toBe('16px');
    document.dispatchEvent(new Event('scroll')); expect(panel.style.left).toBe('280px');
    expect(panel.style.top).toBe('154px'); placement.dispose();
    expect(panel.style.left).toBe(''); document.dispatchEvent(new Event('scroll')); expect(panel.style.left).toBe('');
  });
  it('preserves a later property owner and releases detached panels', () => {
    const { placement, trigger, panel } = fixture();
    placement.open(trigger, panel); panel.style.setProperty('left', '25px', 'important');
    panel.remove(); document.dispatchEvent(new Event('scroll'));
    expect(panel.style.left).toBe('25px'); expect(panel.style.getPropertyPriority('left')).toBe('important');
    expect(panel.style.position).toBe('');
  });
});
