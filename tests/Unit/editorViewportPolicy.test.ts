import { describe, expect, it } from 'vitest';

import {
  applyEditorContentPolicy,
  initialEditorCanvasWidth,
  MOBILE_PREVIEW_VIEWPORT_WIDTH,
  PC_EDITOR_MIN_HOST_WIDTH,
  PC_EDITOR_VIEWPORT_WIDTH,
  resolveEditorViewportPolicy,
  TABLET_PREVIEW_VIEWPORT_WIDTH,
} from '../../resources/js/editor/editorViewportPolicy';

describe('editor viewport policy', () => {
  it.each([
    [390, MOBILE_PREVIEW_VIEWPORT_WIDTH],
    [639, MOBILE_PREVIEW_VIEWPORT_WIDTH],
    [640, TABLET_PREVIEW_VIEWPORT_WIDTH],
    [PC_EDITOR_MIN_HOST_WIDTH - 1, TABLET_PREVIEW_VIEWPORT_WIDTH],
    [PC_EDITOR_MIN_HOST_WIDTH, PC_EDITOR_VIEWPORT_WIDTH],
    [1440, PC_EDITOR_VIEWPORT_WIDTH],
  ])('chooses the initial canvas for host width %i', (hostWidth, expected) => {
    expect(initialEditorCanvasWidth(hostWidth)).toBe(expected);
  });

  it('allows mutation only on a supported PC host with the PC canvas selected', () => {
    expect(resolveEditorViewportPolicy({
      canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
      disabled: false,
      hostWidth: 1440,
      viewport: 'desktop',
    })).toMatchObject({ canEdit: true, hostSupported: true, mode: 'edit' });

    for (const [canvasWidth, viewport] of [[MOBILE_PREVIEW_VIEWPORT_WIDTH, 'mobile'], [TABLET_PREVIEW_VIEWPORT_WIDTH, 'tablet']] as const) {
      expect(resolveEditorViewportPolicy({ canvasWidth, viewport, disabled: false, hostWidth: 1440 }))
        .toMatchObject({ canEdit: false, hostSupported: true, mode: 'preview' });
    }

    expect(resolveEditorViewportPolicy({
      canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
      disabled: false,
      hostWidth: PC_EDITOR_MIN_HOST_WIDTH - 1,
      viewport: 'desktop',
    })).toMatchObject({ canEdit: false, hostSupported: false, mode: 'preview' });

    expect(resolveEditorViewportPolicy({
      canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
      disabled: true,
      hostWidth: 1440,
      viewport: 'desktop',
    })).toMatchObject({ canEdit: false, hostSupported: true, mode: 'preview' });

    expect(resolveEditorViewportPolicy({
      canvasWidth: 1440,
      disabled: false,
      hostWidth: 1600,
      viewport: 'desktop',
    })).toMatchObject({ canEdit: true, mode: 'edit' });
  });

  it('turns every inline-editable root and nested field read-only in preview mode', () => {
    const fields = {
      title: { type: 'richtext', contentEditable: true },
      items: {
        type: 'array',
        arrayFields: {
          label: { type: 'text', contentEditable: true },
          metadata: {
            type: 'object',
            objectFields: { summary: { type: 'textarea', contentEditable: true } },
          },
        },
      },
      fixed: { type: 'text', contentEditable: false },
    };

    expect(applyEditorContentPolicy(fields, true)).toBe(fields);
    const previewFields = applyEditorContentPolicy(fields, false);
    expect(previewFields).not.toBe(fields);
    expect(previewFields.title.contentEditable).toBe(false);
    expect(previewFields.items.arrayFields.label.contentEditable).toBe(false);
    expect(previewFields.items.arrayFields.metadata.objectFields.summary.contentEditable).toBe(false);
    expect(previewFields.fixed.contentEditable).toBe(false);
    expect(fields.title.contentEditable).toBe(true);
  });
});
