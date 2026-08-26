import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  BUILTIN_CANVAS_EDITING_CONTRACT,
  type CanvasTextFieldCapability,
} from '../../resources/js/editor/canvasEditingContract';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;
const { pageBuilderPuckConfig } = await import('../../resources/js/editor/PuckEditorAdapter');

interface InspectableField {
  type?: string;
  contentEditable?: boolean;
  options?: Record<string, unknown>;
  arrayFields?: Record<string, InspectableField>;
}

interface InspectableComponent {
  defaultProps?: Record<string, unknown>;
  fields: Record<string, InspectableField>;
  render: (props: Record<string, unknown>) => React.ReactElement;
}

const components = pageBuilderPuckConfig.components as unknown as Record<string, InspectableComponent>;

function editorField(componentType: string, capability: CanvasTextFieldCapability): InspectableField {
  const path = capability.editorPath ?? capability.path;
  let cursor: InspectableField | Record<string, InspectableField> = components[componentType].fields;
  for (const segment of path.split('.')) {
    if (segment === '*') {
      const fields = (cursor as InspectableField).arrayFields;
      if (!fields) throw new Error(`${componentType}.${path}: arrayFields가 없습니다.`);
      cursor = fields;
      continue;
    }
    const next = (cursor as Record<string, InspectableField>)[segment];
    if (!next) throw new Error(`${componentType}.${path}: ${segment} field가 없습니다.`);
    cursor = next;
  }
  return cursor as InspectableField;
}

function pathPattern(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '\\d+');
  return new RegExp(`^${escaped}$`);
}

describe('builtin text field capability matrix', () => {
  it('classifies all 45 blocks and fixes the approved rich-text target at 53 inline plus 26 block paths', () => {
    expect(BUILTIN_CANVAS_EDITING_CONTRACT).toHaveLength(45);
    const fields = BUILTIN_CANVAS_EDITING_CONTRACT.flatMap((component) => component.textFields);
    expect(fields.filter((field) => field.kind === 'inline-rich')).toHaveLength(53);
    expect(fields.filter((field) => field.kind === 'block-rich')).toHaveLength(26);

    for (const component of BUILTIN_CANVAS_EDITING_CONTRACT) {
      expect(component.textFields.length, component.componentType).toBeGreaterThan(0);
      expect(new Set(component.textFields.map((field) => field.path)).size, component.componentType)
        .toBe(component.textFields.length);
      expect(component.directText, component.componentType)
        .toBe(component.textFields.some((field) => field.kind !== 'structural'));
    }
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.find((component) => component.componentType === 'ArticleList')?.textFields
      .find((field) => field.path === 'items.*.title')).toMatchObject({ kind: 'inline-rich', allowLink: false });
  });

  it('maps every declared field to a real Puck field and reserves richtext for approved prose paths', () => {
    for (const component of BUILTIN_CANVAS_EDITING_CONTRACT) {
      for (const capability of component.textFields) {
        const field = editorField(component.componentType, capability);
        const label = `${component.componentType}.${capability.path}`;
        if (capability.kind === 'inline-rich' || capability.kind === 'block-rich') {
          expect(field, label).toMatchObject({ type: 'richtext', contentEditable: true });
        } else {
          expect(field.type, `${label} must remain atomic`).not.toBe('richtext');
        }
      }
    }

    const articleTitle = editorField('ArticleList', {
      path: 'items.*.title',
      kind: 'inline-rich',
      allowLink: false,
    });
    expect(articleTitle.options?.link).toBe(false);
  });

  it('renders every root and collection rich path through RichTextCanvasField', () => {
    for (const component of BUILTIN_CANVAS_EDITING_CONTRACT) {
      const richPaths = component.textFields.filter((field) => field.kind === 'inline-rich' || field.kind === 'block-rich');
      if (richPaths.length === 0) continue;
      const config = components[component.componentType];
      const markup = renderToStaticMarkup(config.render({ ...config.defaultProps, id: `test-${component.componentType}` }));
      const renderedPaths = [...markup.matchAll(/data-g7pb-richtext-field="true"[^>]*data-g7pb-inline-field="([^"]+)"|data-g7pb-inline-field="([^"]+)"[^>]*data-g7pb-richtext-field="true"/g)]
        .map((match) => match[1] ?? match[2]);
      for (const capability of richPaths) {
        expect(renderedPaths.some((path) => pathPattern(capability.path).test(path)), `${component.componentType}.${capability.path}`)
          .toBe(true);
      }
    }
  });

  it('does not allow per-block directText booleans to bypass the field-path contract', () => {
    const source = readFileSync(resolve(process.cwd(), 'resources/js/editor/canvasEditingContract.ts'), 'utf8');
    expect(source).not.toMatch(/directText:\s*(?:true|false)/);
    expect(source.match(/directText:\s*definition\.textFields\.some/g)).toHaveLength(1);
  });
});
