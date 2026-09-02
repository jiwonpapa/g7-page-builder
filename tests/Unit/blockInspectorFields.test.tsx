import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Fields } from '@puckeditor/core';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { markRequiredInspectorFields, StableSelectField, withBlockContainerFields } from '../../resources/js/editor/blockInspectorFields';
import { pageBuilderPuckConfig } from '../../resources/js/editor/PuckEditorAdapter';
import type { EditorComponents } from '../../resources/js/editor/puckEditorTypes';

vi.hoisted(() => Object.assign(globalThis, { ResizeObserver: class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let host: HTMLDivElement | undefined;

function render(element: React.ReactElement): HTMLDivElement {
  host ??= document.body.appendChild(document.createElement('div'));
  root ??= createRoot(host);
  act(() => root!.render(element));
  return host;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('typed inspector field decoration', () => {
  it('copies nested labels without changing callbacks, values or source definitions', () => {
    const callback = vi.fn();
    const customRender = ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
      <button onClick={() => onChange(value)}>custom</button>;
    const fields: Fields<{ imageAlt: string; items: { avatarAlt: string; children: { alt: string }[] }[] }> = {
      imageAlt: { type: 'custom', label: '대표 이미지', render: customRender },
      items: { type: 'array', arrayFields: {
        avatarAlt: { type: 'text', label: '사진 설명' },
        children: { type: 'array', arrayFields: { alt: { type: 'text', label: '하위 이미지' } } },
      } },
    };
    const next = markRequiredInspectorFields(fields);
    expectTypeOf(next).toEqualTypeOf<typeof fields>();
    expect(next.imageAlt.label).toBe('대표 이미지 (필수)');
    expect(fields.imageAlt.label).toBe('대표 이미지');
    if (next.imageAlt.type !== 'custom' || next.items.type !== 'array' || fields.items.type !== 'array') throw new Error('Unexpected field type');
    expect(next.imageAlt.render).toBe(customRender);
    expect(next.items.arrayFields.avatarAlt.label).toBe('사진 설명 (필수)');
    expect(fields.items.arrayFields.avatarAlt.label).toBe('사진 설명');
    const children = next.items.arrayFields.children;
    if (children.type !== 'array') throw new Error('Unexpected nested field type');
    expect(children.arrayFields.alt.label).toBe('하위 이미지 (필수)');
    expect(markRequiredInspectorFields(next)).toEqual(next);
    const view = render(next.imageAlt.render({ field: next.imageAlt, name: 'imageAlt', id: 'synthetic-alt', value: 'preserved', onChange: callback }));
    act(() => view.querySelector('button')!.click());
    expect(callback).toHaveBeenCalledExactlyOnceWith('preserved');
  });

  it('preserves component keys, renderer identity, layout fields and default props', () => {
    const resolveFields: NonNullable<typeof pageBuilderPuckConfig.components.Image.resolveFields> = (_data, { fields }) => fields;
    const original = { ...pageBuilderPuckConfig.components,
      Image: { ...pageBuilderPuckConfig.components.Image, resolveFields } };
    const originalImageFields = original.Image.fields;
    const next = withBlockContainerFields(original);
    expectTypeOf(next.Hero.defaultProps).toEqualTypeOf<EditorComponents['Hero'] | undefined>();
    expect(Object.keys(next)).toEqual(Object.keys(original));
    expect(next).not.toBe(original);
    expect(next.Image).not.toBe(original.Image);
    expect(next.Image.fields).not.toBe(originalImageFields);
    expect(original.Image.fields).toBe(originalImageFields);
    expect(next.Image.render).toBe(original.Image.render);
    expect(next.Image.defaultProps).toBe(original.Image.defaultProps);
    expect(next.Image.resolveFields).toBe(original.Image.resolveFields);
    expect(next.LayoutSection).toBe(original.LayoutSection);
    expect(next.LayoutColumns).toBe(original.LayoutColumns);
    expect(next.LayoutStack).toBe(original.LayoutStack);
    expect(next.Image.fields?.alt.label).toBe('대체 텍스트 (필수)');
    expect(next.Image.fields?.containerWidth?.type).toBe('custom');
  });

  it('delivers an allowed container choice and preserves read-only/default behavior', () => {
    const field = withBlockContainerFields(pageBuilderPuckConfig.components).Image.fields?.containerWidth;
    if (!field || field.type !== 'custom') throw new Error('Missing container field');
    const change = vi.fn();
    const view = render(field.render({ field, name: 'containerWidth', id: 'synthetic-width', value: undefined, onChange: change }));
    const select = view.querySelector('select')!;
    expect(select.value).toBe('inherit');
    expect(select.dataset.testid).toBe('page-builder-block-container-width');
    act(() => { select.value = 'full'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(change).toHaveBeenCalledExactlyOnceWith('full');
    render(field.render({ field, name: 'containerWidth', id: 'synthetic-width', value: 'wide', onChange: change, readOnly: true }));
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('wide');
  });

  it('does not turn an unknown DOM option into a typed application value', () => {
    const change = vi.fn();
    const view = render(<StableSelectField value="small" onChange={change} testId="synthetic-choice"
      options={[{ label: 'Small', value: 'small' }, { label: 'Large', value: 'large' }]} />);
    const select = view.querySelector('select')!;
    const injected = document.createElement('option');
    injected.value = 'unknown';
    select.appendChild(injected);
    act(() => { select.value = 'unknown'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(change).not.toHaveBeenCalled();
  });
});
