import { afterEach, describe, expect, it } from 'vitest';
import { bootAccordions, bootTabs, disposeContentControls } from '../../resources/js/public/publicContentControls';
const documents = new Set<Document | HTMLElement>();
afterEach(() => { documents.forEach(disposeContentControls); if (documents.has(document)) document.body.replaceChildren(); documents.clear(); });
function fixture(markup: string, root = document.implementation.createHTMLDocument('content controls')) {
  documents.add(root); root.body.innerHTML = markup; return root;
}
const tabsMarkup = '<section data-g7pb-tabs data-block-id="synthetic-tabs"><button role="tab">First</button><button role="tab">Second</button><article role="tabpanel">One</article><article role="tabpanel">Two</article></section>';
function stableTabs(prefix = 'stable', vertical = false): string {
  return `<section data-g7pb-tabs data-g7pb-control-ids="stable"><div role="tablist" aria-label="선택" aria-orientation="${vertical ? 'vertical' : 'horizontal'}">
    <button id="${prefix}-a" role="tab" aria-controls="${prefix}-one">첫째</button>
    <button id="${prefix}-b" role="tab" aria-controls="${prefix}-two">둘째</button></div>
    <article id="${prefix}-two" role="tabpanel" aria-labelledby="${prefix}-b" style="display:grid">둘째 내용</article>
    <article id="${prefix}-one" role="tabpanel" aria-labelledby="${prefix}-a" style="display:flex">첫째 내용</article></section>`;
}
function stableAccordion(prefix = 'disclosure'): string {
  return `<section data-g7pb-accordion data-g7pb-control-ids="stable" data-g7pb-accordion-behavior="single">
    <div data-g7pb-accordion-item><button id="${prefix}-a" aria-controls="${prefix}-one" data-g7pb-accordion-trigger>첫째</button><article id="${prefix}-one" data-g7pb-accordion-panel style="display:flex">첫째 내용</article></div>
    <div data-g7pb-accordion-item><button id="${prefix}-b" aria-controls="${prefix}-two" data-g7pb-accordion-trigger>둘째</button><article id="${prefix}-two" data-g7pb-accordion-panel>둘째 내용</article></div></section>`;
}
describe('public content control ownership', () => {
  it('preserves native tab keys and IDs while replacing listeners only for changed targets', () => {
    const root = fixture(tabsMarkup, document); bootTabs(root); bootTabs(root);
    const host = root.querySelector<HTMLElement>('section')!;
    const [first, second] = Array.from(host.querySelectorAll('button'));
    const panels = Array.from(host.querySelectorAll<HTMLElement>('article'));
    expect(first.getAttribute('aria-controls')).toBe(panels[0].id);
    expect(panels[1].getAttribute('aria-labelledby')).toBe(second.id);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(panels.map(panel => panel.hidden)).toEqual([true, false]); expect(root.activeElement).toBe(second);
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(first.tabIndex).toBe(0); expect(second.tabIndex).toBe(-1);
    const replacement = root.createElement('button'); replacement.role = 'tab'; replacement.textContent = 'Replacement'; second.replaceWith(replacement);
    bootTabs(root); bootTabs(root);
    second.click(); expect(panels.map(panel => panel.hidden)).toEqual([false, true]);
    replacement.click(); expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
    disposeContentControls(root); first.click(); expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
    bootTabs(root); first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(root.activeElement).toBe(replacement); expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
  });

  it('retires removed markers and same-task reinsertions before a former tab callback can run', () => {
    const root = fixture(tabsMarkup); bootTabs(root);
    const host = root.querySelector<HTMLElement>('section')!; const tabs = Array.from(host.querySelectorAll('button'));
    const panels = Array.from(host.querySelectorAll<HTMLElement>('article'));
    host.removeAttribute('data-g7pb-tabs'); tabs[1].click();
    expect(panels.map(panel => panel.hidden)).toEqual([false, true]);
    host.dataset.g7pbTabs = ''; host.dataset.g7pbTabsInitial = '1'; bootTabs(root);
    expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
    host.remove(); root.body.append(host); tabs[0].click();
    expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
    bootTabs(root); tabs[0].click(); expect(panels.map(panel => panel.hidden)).toEqual([false, true]);
  });

  it('keeps typed and legacy accordion exclusivity and prevents removed listeners from toggling panels', () => {
    const root = fixture('<section data-g7pb-accordion data-g7pb-accordion-behavior="single"><div data-g7pb-accordion-item><button data-g7pb-accordion-trigger>First</button><p data-g7pb-accordion-panel>One</p></div><div data-g7pb-accordion-item><button data-g7pb-accordion-trigger>Second</button><p data-g7pb-accordion-panel>Two</p></div><details open><summary>Legacy first</summary></details><details><summary>Legacy second</summary></details></section>');
    bootAccordions(root); bootAccordions(root);
    const host = root.querySelector<HTMLElement>('section')!; const buttons = Array.from(host.querySelectorAll('button'));
    const panels = Array.from(host.querySelectorAll<HTMLElement>('[data-g7pb-accordion-panel]'));
    buttons[0].click(); buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
    const details = Array.from(host.querySelectorAll('details')); details[1].open = true;
    details[1].dispatchEvent(new Event('toggle'));
    expect(details.map(item => item.open)).toEqual([false, true]);
    host.removeAttribute('data-g7pb-accordion'); buttons[0].click();
    expect(panels.map(panel => panel.hidden)).toEqual([true, false]);
    host.dataset.g7pbAccordion = ''; bootAccordions(root); buttons[0].click();
    expect(panels.map(panel => panel.hidden)).toEqual([false, true]);
  });

  it('scopes to an element, preserves stable identities and authored display, and disposes without residue', () => {
    const root = fixture(stableTabs() + tabsMarkup, document);
    const host = root.querySelector<HTMLElement>('section')!; documents.add(host);
    const beforeIds = Array.from(host.querySelectorAll('[id]')).map(node => node.id);
    const [first, second] = Array.from(host.querySelectorAll('button'));
    const one = root.getElementById('stable-one')!, two = root.getElementById('stable-two')!;
    bootTabs(host); bootTabs(host);
    expect(root.querySelectorAll('[data-g7pb-tabs-ready]')).toHaveLength(1);
    expect(one.hidden).toBe(false); expect(one.style.display).toBe('flex');
    expect(two.hidden).toBe(true); expect(two.style.display).toBe('none');
    second.click(); expect(two.hidden).toBe(false); expect(two.style.display).toBe('grid');
    expect(one.hidden).toBe(true); expect(one.style.display).toBe('none');
    expect(Array.from(host.querySelectorAll('[id]')).map(node => node.id)).toEqual(beforeIds);
    disposeContentControls(host); first.click();
    expect(one.hidden).toBe(false); expect(one.style.display).toBe('flex');
    expect(two.hidden).toBe(false); expect(two.style.display).toBe('grid');
    expect(first.hasAttribute('aria-selected')).toBe(false); expect(second.hasAttribute('tabindex')).toBe(false);
    expect(host.hasAttribute('data-g7pb-tabs-ready')).toBe(false);
  });

  it.each([false, true])('routes only the tablist axis, with wrap and Home/End, vertical=%s', vertical => {
    const root = fixture(stableTabs('axis', vertical), document); bootTabs(root);
    const [first, second] = Array.from(root.querySelectorAll('button'));
    const press = (button: HTMLButtonElement, key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); button.dispatchEvent(event); return event.defaultPrevented;
    };
    first.focus();
    expect(press(first, vertical ? 'ArrowRight' : 'ArrowDown')).toBe(false); expect(root.activeElement).toBe(first);
    expect(press(first, vertical ? 'ArrowUp' : 'ArrowLeft')).toBe(true); expect(root.activeElement).toBe(second);
    expect(press(second, vertical ? 'ArrowDown' : 'ArrowRight')).toBe(true); expect(root.activeElement).toBe(first);
    expect(press(first, 'End')).toBe(true); expect(root.activeElement).toBe(second);
    expect(press(second, 'Home')).toBe(true); expect(root.activeElement).toBe(first);
    expect(press(first, 'Tab')).toBe(false);
  });

  it('keeps nested groups independent and never attaches twice through overlapping roots', () => {
    const root = fixture(stableAccordion('outer'), document);
    root.getElementById('outer-one')!.innerHTML = stableAccordion('inner') + stableTabs('nested');
    const host = root.querySelector<HTMLElement>('section')!; documents.add(host);
    bootAccordions(host); bootTabs(host); bootAccordions(root); bootTabs(root);
    const outerButton = root.getElementById('outer-a') as HTMLButtonElement;
    const innerButton = root.getElementById('inner-a') as HTMLButtonElement;
    const nestedButton = root.getElementById('nested-b') as HTMLButtonElement;
    outerButton.click(); expect(outerButton.getAttribute('aria-expanded')).toBe('true');
    innerButton.click(); expect(innerButton.getAttribute('aria-expanded')).toBe('true');
    nestedButton.click(); expect(root.getElementById('nested-two')!.hidden).toBe(false);
    expect(outerButton.getAttribute('aria-expanded')).toBe('true');
    (root.getElementById('outer-b') as HTMLButtonElement).click();
    expect(root.getElementById('outer-one')!.hidden).toBe(true);
    expect(innerButton.getAttribute('aria-expanded')).toBe('true');
    expect(root.getElementById('nested-two')!.hidden).toBe(false);
    disposeContentControls(root); outerButton.click();
    expect(outerButton.getAttribute('aria-expanded')).toBe('true');
    disposeContentControls(host); innerButton.click();
    expect(innerButton.hasAttribute('aria-expanded')).toBe(false);
    expect(root.getElementById('outer-one')!.style.display).toBe('flex');
    expect(root.getElementById('inner-two')!.style.display).toBe('');
  });

  it('rejects incomplete or cross-group stable tab references before mutating markup', () => {
    for (const change of [
      (host: HTMLElement) => host.querySelector('button')!.removeAttribute('id'),
      (host: HTMLElement) => host.querySelector('button')!.setAttribute('aria-controls', 'outside'),
      (host: HTMLElement) => host.querySelector('article')!.setAttribute('aria-labelledby', 'wrong'),
      (host: HTMLElement) => host.querySelector('[role="tablist"]')!.removeAttribute('role'),
      (host: HTMLElement) => host.querySelector('article')!.id = 'stable-a',
    ]) {
      const root = fixture(stableTabs()), host = root.querySelector<HTMLElement>('section')!;
      change(host); const before = host.outerHTML; bootTabs(root);
      host.querySelector('button')!.click(); expect(host.outerHTML).toBe(before);
    }
  });

  it('rejects incomplete disclosure references and keeps native Enter/Space to one toggle', () => {
    for (const change of [
      (host: HTMLElement) => host.querySelector('button')!.removeAttribute('id'),
      (host: HTMLElement) => host.querySelector('button')!.setAttribute('aria-controls', 'outside'),
      (host: HTMLElement) => host.querySelector('article')!.remove(),
    ]) {
      const root = fixture(stableAccordion()), host = root.querySelector<HTMLElement>('section')!;
      change(host); const before = host.outerHTML; bootAccordions(root);
      host.querySelector('button')!.click(); expect(host.outerHTML).toBe(before);
    }
    const root = fixture(stableAccordion(), document); bootAccordions(root);
    const button = root.querySelector('button')!, panel = root.getElementById('disclosure-one')!;
    for (const [key, expanded] of [['Enter', true], [' ', false]] as const) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true); expect(panel.hidden).toBe(!expanded);
      expect(button.getAttribute('aria-expanded')).toBe(String(expanded));
    }
    expect(button.id).toBe('disclosure-a'); expect(panel.id).toBe('disclosure-one');
  });

  it('retires stable callbacks on reference changes and permits an explicit clean remount', () => {
    const root = fixture(stableTabs(), document), host = root.querySelector<HTMLElement>('section')!;
    documents.add(host); bootTabs(host);
    const [first, second] = Array.from(host.querySelectorAll('button'));
    const one = root.getElementById('stable-one')!, two = root.getElementById('stable-two')!;
    second.setAttribute('aria-controls', 'missing'); second.click();
    expect(host.hasAttribute('data-g7pb-tabs-ready')).toBe(false);
    expect(one.style.display).toBe('flex'); expect(two.style.display).toBe('grid');
    second.setAttribute('aria-controls', two.id); bootTabs(host); second.click();
    expect(one.hidden).toBe(true); expect(two.hidden).toBe(false);
    const wrapper = root.createElement('main'); root.body.append(wrapper); documents.add(wrapper);
    wrapper.append(host); bootTabs(wrapper); first.click();
    // The old scope is the host itself, so moving it does not duplicate listeners.
    expect(first.getAttribute('aria-selected')).toBe('true');
    disposeContentControls(host); bootTabs(wrapper); second.click();
    expect(second.getAttribute('aria-selected')).toBe('true');
  });
});
