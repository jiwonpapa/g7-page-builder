import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { blockAppearanceClassName, normalizeBlockAppearance } from '../../resources/js/editor/blockAppearance';
import {
  createInlineRichTextField,
  RICH_TEXT_ALLOWED_VALUES,
  RichTextCanvasField,
} from '../../resources/js/editor/richTextEditing';
import {
  DEFAULT_PAGE_DESIGN,
  pageDesignCustomCss,
  pageDesignToTokens,
  tokensToPageDesign,
} from '../../resources/js/editor/pageDesignTokens';
import { clearDraftJournal, readDraftJournal, writeDraftJournal } from '../../resources/js/editor/draftJournal';
import type { PageBuilderDocument } from '../../resources/js/documents/types';

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
