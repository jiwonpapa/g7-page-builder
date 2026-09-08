import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { InspectorChoiceField } from '../../resources/js/editor/InspectorChoiceField';
import { ResponsiveAppearanceField } from '../../resources/js/editor/responsiveBlockStyle';

vi.mock('@puckeditor/core', () => ({ usePuck: () => ({ selectedItem: { props: { surface: 'soft' } } }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let host: HTMLDivElement | undefined;
function render(element: React.ReactElement): HTMLDivElement {
  host ??= document.body.appendChild(document.createElement('div'));
  root ??= createRoot(host);
  act(() => root!.render(element));
  return host;
}
afterEach(() => { if (root) act(() => root!.unmount()); host?.remove(); root = undefined; host = undefined; });

it('keeps same-label groups independent and emits the original numeric value', () => {
  const change = vi.fn();
  const choice = <InspectorChoiceField label="제목 단계" testId="heading" value={2} onChange={change}
    options={[{ label: 'H2', value: 2 }, { label: 'H3', value: 3 }]} />;
  const view = render(<>{choice}{choice}</>);
  const inputs = view.querySelectorAll('input');
  expect(inputs[0].name).not.toBe(inputs[2].name);
  expect(inputs[0].checked).toBe(true);
  expect(inputs[2].checked).toBe(true);
  act(() => inputs[1].click());
  expect(change).toHaveBeenCalledExactlyOnceWith(3);
});

it('reflects external undo values, accessible color names and readonly without changes', () => {
  const change = vi.fn();
  const options = [{ label: '인디고', value: 'indigo', swatch: '#4f46e5' }, { label: '로즈', value: 'rose', swatch: '#e11d48' }];
  const view = render(<InspectorChoiceField label="브랜드 색상" testId="palette" value="rose" onChange={change} options={options} swatches />);
  expect(view.querySelector('[aria-label="로즈"]')).toHaveProperty('checked', true);
  render(<InspectorChoiceField label="브랜드 색상" testId="palette" value="indigo" onChange={change} options={options} swatches readOnly />);
  expect(view.querySelector('[aria-label="인디고"]')).toHaveProperty('checked', true);
  act(() => view.querySelector<HTMLInputElement>('[aria-label="로즈"]')!.click());
  expect(change).not.toHaveBeenCalled();
  expect(view.querySelector('.g7pb-inspector-choice__current')?.textContent).toBe('인디고');
});

it('summarizes closed device settings without mutating overrides and resets only that device', () => {
  const change = vi.fn();
  const value = { tablet: { appearance: { spacing: 'compact' as const } }, mobile: { appearance: { surface: 'contrast' as const } } };
  const view = render(<ResponsiveAppearanceField value={value} onChange={change} />);
  const sections = view.querySelectorAll('details');
  expect([...sections].every((section) => !section.open)).toBe(true);
  expect(sections[1].querySelector('summary')?.textContent).toContain('1개 별도 지정');
  act(() => sections[1].querySelector('summary')!.click());
  expect(change).not.toHaveBeenCalled();
  act(() => view.querySelector<HTMLButtonElement>('[data-testid="page-builder-responsive-mobile-reset"]')!.click());
  expect(change).toHaveBeenCalledExactlyOnceWith({ tablet: value.tablet });
  expect(value.mobile.appearance.surface).toBe('contrast');
});
