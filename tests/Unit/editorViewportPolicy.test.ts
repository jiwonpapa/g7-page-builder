import { describe, expect, it } from 'vitest';

import {
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
    })).toMatchObject({ canEdit: true, hostSupported: true, mode: 'edit' });

    for (const canvasWidth of [MOBILE_PREVIEW_VIEWPORT_WIDTH, TABLET_PREVIEW_VIEWPORT_WIDTH]) {
      expect(resolveEditorViewportPolicy({ canvasWidth, disabled: false, hostWidth: 1440 }))
        .toMatchObject({ canEdit: false, hostSupported: true, mode: 'preview' });
    }

    expect(resolveEditorViewportPolicy({
      canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
      disabled: false,
      hostWidth: PC_EDITOR_MIN_HOST_WIDTH - 1,
    })).toMatchObject({ canEdit: false, hostSupported: false, mode: 'preview' });

    expect(resolveEditorViewportPolicy({
      canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
      disabled: true,
      hostWidth: 1440,
    })).toMatchObject({ canEdit: false, hostSupported: true, mode: 'preview' });
  });
});
