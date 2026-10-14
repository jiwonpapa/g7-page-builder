import { afterEach, describe, expect, it } from 'vitest';
import { CANVAS_INPUT_HELP, createCanvasAccessibility } from '../../resources/js/editor/v3/canvasAccessibility';

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(run => run()); document.body.replaceChildren(); });
function fixture(inputHelp?: string) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const owner = frame.contentDocument;
  if (!owner) throw new Error('Missing test iframe');
  owner.body.innerHTML = '<div data-v3-surface><section data-v3-node="parent" role="group" aria-label="Parent" aria-pressed="false" aria-grabbed="false"><h2 data-v3-node="child" role="button" tabindex="0" aria-pressed="false" aria-grabbed="false">Child</h2></section></div>';
  const runtime = createCanvasAccessibility(owner, inputHelp); cleanup.push(() => runtime.dispose());
  return { owner, runtime, parent: owner.querySelector('[data-v3-node="parent"]')!, child: owner.querySelector('[data-v3-node="child"]')! };
}
describe('PB canvas accessibility ownership', () => {
  it('preserves nested named groups, child button focus, disabled state and authored layout', () => {
    const { parent, child, runtime } = fixture(); parent.setAttribute('style', 'display:grid'); parent.setAttribute('aria-disabled', 'true'); runtime.sync();
    expect(parent.getAttribute('role')).toBe('group'); expect(parent.getAttribute('aria-label')).toBe('Parent');
    expect(parent.hasAttribute('aria-pressed')).toBe(false); expect(parent.hasAttribute('aria-grabbed')).toBe(false);
    expect(child.getAttribute('aria-pressed')).toBe('false'); expect(child.getAttribute('tabindex')).toBe('0');
    expect(child.hasAttribute('aria-grabbed')).toBe(false); expect(parent.getAttribute('aria-disabled')).toBe('true');
    expect(parent.getAttribute('style')).toBe('display:grid');
  });
  it('copies only a provided cross-document description as text, sharing one local ID', () => {
    const description = document.createElement('p'); description.id = 'host-drag-help'; description.textContent = 'Space starts movement; Escape cancels.'; document.body.append(description);
    const { owner, parent, child, runtime } = fixture(); parent.setAttribute('aria-describedby', description.id); child.setAttribute('aria-describedby', description.id); runtime.sync();
    const id = parent.getAttribute('aria-describedby')!;
    expect(id).not.toBe(description.id); expect(child.getAttribute('aria-describedby')).toBe(id);
    expect(owner.getElementById(id)?.textContent).toBe(description.textContent);
    expect(owner.querySelectorAll('.g7pb-v3-sr-only')).toHaveLength(1); expect(description.isConnected).toBe(true);
  });
  it('keeps same-document and genuinely unknown description references visible', () => {
    const { owner, parent, runtime } = fixture(); const existing = owner.createElement('p'); existing.id = 'local-help'; owner.body.append(existing);
    parent.setAttribute('aria-describedby', 'local-help missing-author-help'); runtime.sync();
    expect(parent.getAttribute('aria-describedby')).toBe('local-help missing-author-help');
    expect(owner.querySelector('.g7pb-v3-sr-only')).toBeNull();
  });
  it('describes the PB keyboard path without advertising an uninstalled vendor sensor', () => {
    const description = document.createElement('p'); description.id = 'vendor-help';
    description.textContent = 'Press space to pick up; use the arrow keys to drag.'; document.body.append(description);
    const { owner, parent, runtime } = fixture(CANVAS_INPUT_HELP);
    parent.setAttribute('aria-describedby', description.id); runtime.sync();
    const local = owner.getElementById(parent.getAttribute('aria-describedby')!);
    expect(local?.textContent).toBe(CANVAS_INPUT_HELP);
    expect(local?.textContent).not.toContain('Press space');
    expect(local?.textContent).toContain('레이어'); expect(local?.textContent).toContain('정밀 조작');
    expect(description.textContent).toBe('Press space to pick up; use the arrow keys to drag.');
    runtime.dispose(); expect(parent.getAttribute('aria-describedby')).toBe(description.id);
  });
  it('preserves authored local and unknown references with PB instructions enabled', () => {
    const { owner, parent, runtime } = fixture(CANVAS_INPUT_HELP);
    const local = owner.createElement('p'); local.id = 'authored-help'; local.textContent = 'Keep this hint'; owner.body.append(local);
    parent.setAttribute('aria-describedby', 'authored-help absent-help'); runtime.sync();
    expect(parent.getAttribute('aria-describedby')).toBe('authored-help absent-help');
    expect(local.textContent).toBe('Keep this hint'); expect(owner.querySelector('.g7pb-v3-sr-only')).toBeNull();
  });
  it('handles later vendor mutations and new canvas nodes but ignores outside nodes', async () => {
    const { owner, parent } = fixture(); parent.setAttribute('aria-pressed', 'true');
    const next = owner.createElement('div'); next.dataset.v3Node = 'new'; next.setAttribute('role', 'group'); next.setAttribute('aria-grabbed', 'true'); parent.append(next);
    const foreign = owner.createElement('div'); foreign.setAttribute('aria-grabbed', 'true'); owner.body.append(foreign);
    await new Promise<void>(resolve => queueMicrotask(() => queueMicrotask(resolve)));
    expect(parent.hasAttribute('aria-pressed')).toBe(false); expect(next.hasAttribute('aria-grabbed')).toBe(false);
    expect(foreign.getAttribute('aria-grabbed')).toBe('true');
  });
  it('restores only attributes it still owns and removes only its own description copy', () => {
    const description = document.createElement('p'); description.id = 'original-help'; description.textContent = 'Drag help'; document.body.append(description);
    const { owner, parent, child, runtime } = fixture(); parent.setAttribute('aria-describedby', description.id); runtime.sync();
    child.setAttribute('aria-grabbed', 'later-owner'); runtime.dispose();
    expect(parent.getAttribute('aria-pressed')).toBe('false'); expect(parent.getAttribute('aria-grabbed')).toBe('false');
    expect(parent.getAttribute('aria-describedby')).toBe(description.id); expect(child.getAttribute('aria-grabbed')).toBe('later-owner');
    expect(owner.querySelector('.g7pb-v3-sr-only')).toBeNull(); expect(description.isConnected).toBe(true);
  });
});
