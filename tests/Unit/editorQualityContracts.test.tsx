import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { blockAppearanceClassName, normalizeBlockAppearance } from '../../resources/js/editor/blockAppearance';
import {
  CANVAS_ELEMENT_MESSAGE,
  normalizeCanvasElementSelectionIntent,
  notifyCanvasElementSelection,
  shouldAutoOpenCanvasTextTools,
  type CanvasElementSelection,
} from '../../resources/js/editor/canvasEditingContract';
import {
  DEFAULT_PAGE_DESIGN,
  pageDesignCustomCss,
  pageDesignToTokens,
  tokensToPageDesign,
} from '../../resources/js/editor/pageDesignTokens';
import { clearDraftJournal, readDraftJournal, writeDraftJournal } from '../../resources/js/editor/draftJournal';
import type { PageBuilderDocument } from '../../resources/js/documents/types';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

const {
  createInlineRichTextField,
  RICH_TEXT_ALLOWED_VALUES,
  RichTextCanvasField,
} = await import('../../resources/js/editor/richTextEditing');

const storageValues = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    clear: () => storageValues.clear(),
    getItem: (key: string) => storageValues.get(key) ?? null,
    key: (index: number) => Array.from(storageValues.keys())[index] ?? null,
    get length() { return storageValues.size; },
    removeItem: (key: string) => storageValues.delete(key),
    setItem: (key: string, value: string) => storageValues.set(key, value),
  },
});

const documentFixture: PageBuilderDocument = {
  schema_version: 'g7-page-builder/v1',
  document_id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'editor-quality-contract',
  mode: 'canvas',
  locale: 'ko',
  tokens: {},
  blocks: [],
};

describe('editor quality contracts', () => {
  it('identifies current canvas pointer targets without implicitly opening element tools', () => {
    const block = document.createElement('section');
    block.dataset.blockId = '223e4567-e89b-42d3-a456-426614174001';
    const richText = document.createElement('div');
    richText.dataset.g7pbRichtextField = 'true';
    richText.dataset.g7pbInlineField = 'heading';
    const copy = document.createElement('span');
    richText.append(copy);
    block.append(richText);
    document.body.append(block);
    const received: { selection: CanvasElementSelection | null } = { selection: null };
    const receive = (event: Event): void => {
      if (event instanceof CustomEvent) received.selection = event.detail as CanvasElementSelection;
    };
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, receive);
    try {
      notifyCanvasElementSelection(
        { target: copy } as unknown as React.PointerEvent<HTMLElement>,
        block.dataset.blockId,
        'heading',
      );
    } finally {
      window.removeEventListener(CANVAS_ELEMENT_MESSAGE, receive);
      block.remove();
    }

    expect(received.selection).toMatchObject({ fieldPath: 'heading', intent: 'identify', role: 'text' });
    expect(normalizeCanvasElementSelectionIntent(received.selection?.intent)).toBe('identify');
    expect(shouldAutoOpenCanvasTextTools(received.selection, 'selection')).toBe(false);
    expect(shouldAutoOpenCanvasTextTools(received.selection, 'range-active')).toBe(false);
    expect(shouldAutoOpenCanvasTextTools(received.selection, 'range-inactive')).toBe(false);
  });

  it('keeps only missing-intent legacy canvas messages on the previous automatic-open behavior', () => {
    const legacyTextSelection = { role: 'text' } as const;
    const invalidCurrentSelection = { role: 'text', intent: 'open-without-user-intent' } as const;

    expect(normalizeCanvasElementSelectionIntent(undefined)).toBe('legacy-open');
    expect(shouldAutoOpenCanvasTextTools(legacyTextSelection, 'selection')).toBe(true);
    expect(shouldAutoOpenCanvasTextTools(legacyTextSelection, 'range-inactive')).toBe(true);
    expect(shouldAutoOpenCanvasTextTools(legacyTextSelection, 'range-active')).toBe(false);
    expect(normalizeCanvasElementSelectionIntent(invalidCurrentSelection.intent)).toBe('identify');
  });

  it('uses the same selected-range editor for headings and long copy', () => {
    expect(createInlineRichTextField('제목')).toMatchObject({
      type: 'richtext',
      contentEditable: true,
      options: { heading: false },
    });
    expect(RICH_TEXT_ALLOWED_VALUES.weights).toEqual(['regular', 'medium', 'semibold', 'bold']);
    expect(RICH_TEXT_ALLOWED_VALUES.tones).toEqual([
      'default', 'muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4',
    ]);
    expect(renderToStaticMarkup(
      <RichTextCanvasField as="h2" fieldPath="heading"><div>부분 선택 제목</div></RichTextCanvasField>,
    )).toContain('role="heading" aria-level="2"');
    expect(renderToStaticMarkup(
      <RichTextCanvasField as="h2" fieldPath="heading"><div>부분 선택 제목</div></RichTextCanvasField>,
    )).not.toContain('<h2><div');
  });

  it('round-trips four user colors for light and dark themes without accepting arbitrary CSS', () => {
    const design = tokensToPageDesign({
      'design.custom_color_1_light': '#123456',
      'design.custom_color_1_dark': '#ABCDEF',
      'design.custom_color_2_light': 'expression(alert(1))',
    });

    expect(design.customColor1Light).toBe('#123456');
    expect(design.customColor1Dark).toBe('#abcdef');
    expect(design.customColor2Light).toBe(DEFAULT_PAGE_DESIGN.customColor2Light);
    expect(pageDesignCustomCss(design)).toContain('--g7pb-custom-tone-1-light:#123456');
    expect(pageDesignCustomCss(design)).not.toContain('expression');
    expect(pageDesignToTokens(design, {})).toMatchObject({
      'design.custom_color_1_light': '#123456',
      'design.custom_color_1_dark': '#abcdef',
    });
  });

  it('normalizes block container width, alignment, height, and vertical alignment as typed presets', () => {
    const appearance = normalizeBlockAppearance({
      surface: 'soft', spacing: 'spacious', containerWidth: 'full', containerAlign: 'right',
      minHeight: 'viewport', verticalAlign: 'center', arbitraryWidth: '9999px',
    }, { surface: 'default', spacing: 'normal' });

    expect(appearance).toEqual({
      surface: 'soft', spacing: 'spacious', containerWidth: 'full', containerAlign: 'right',
      minHeight: 'viewport', verticalAlign: 'center',
    });
    expect(blockAppearanceClassName(appearance)).toContain('g7pb-container-width--full');
    expect(blockAppearanceClassName(appearance)).toContain('g7pb-container-align--right');
    expect(blockAppearanceClassName(appearance)).toContain('g7pb-container-height--viewport');
    expect(blockAppearanceClassName(appearance)).toContain('g7pb-container-vertical--center');
  });

  it('journals every changed document against its exact server lock and clears after save', () => {
    writeDraftJournal(documentFixture, 7);
    expect(readDraftJournal(documentFixture.document_id, 7)?.document).toEqual(documentFixture);
    expect(readDraftJournal(documentFixture.document_id, 8)).toBeNull();
    clearDraftJournal(documentFixture.document_id);
    expect(readDraftJournal(documentFixture.document_id, 7)).toBeNull();
  });
});
