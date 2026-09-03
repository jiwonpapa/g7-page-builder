import { afterEach, describe, expect, it } from 'vitest';
import { bootAccordions, bootTabs, disposeContentControls } from '../../resources/js/public/publicContentControls';
const documents = new Set<Document>();
afterEach(() => { documents.forEach(disposeContentControls); if (documents.has(document)) document.body.replaceChildren(); documents.clear(); });
function fixture(markup: string, root = document.implementation.createHTMLDocument('content controls')) {
  documents.add(root); root.body.innerHTML = markup; return root;
}
const tabsMarkup = '<section data-g7pb-tabs data-block-id="synthetic-tabs"><button role="tab">First</button><button role="tab">Second</button><article role="tabpanel">One</article><article role="tabpanel">Two</article></section>';
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
});
