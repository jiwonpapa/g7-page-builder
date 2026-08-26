import { describe, expect, it } from 'vitest';

import {
  intersectOverlayRects,
  inverseScaledTranslation,
  mapHostClipToFrameViewport,
  placeEditorOverlay,
} from '../../resources/js/editor/editorOverlaySafeZone';

describe('editor overlay safe zone geometry', () => {
  it('intersects the host viewport with every overflow clipping ancestor', () => {
    expect(intersectOverlayRects([
      { left: 0, top: 0, right: 1024, bottom: 768 },
      { left: 84, top: 120, right: 794, bottom: 720 },
      { left: 100, top: 153, right: 780, bottom: 690 },
    ])).toEqual({
      left: 100,
      top: 153,
      right: 780,
      bottom: 690,
      width: 680,
      height: 537,
    });
  });

  it('maps a scaled host clip back into logical iframe coordinates', () => {
    expect(mapHostClipToFrameViewport(
      { left: 150, top: 225, right: 550, bottom: 475 },
      { left: 100, top: 200, right: 600, bottom: 500 },
      { width: 1000, height: 600 },
    )).toEqual({
      left: 100,
      top: 50,
      right: 900,
      bottom: 550,
      width: 800,
      height: 500,
    });
  });

  it('places the action strip above the selected block when it fits', () => {
    expect(placeEditorOverlay({
      anchorRect: { left: 120, top: 180, right: 620, bottom: 420 },
      overlaySize: { width: 300, height: 36 },
      visibleClip: { left: 0, top: 0, right: 800, bottom: 600 },
      gap: 8,
      inset: 8,
    })).toEqual({
      left: 320,
      top: 136,
      placement: 'above',
      maxWidth: 784,
      maxHeight: 584,
    });
  });

  it('falls back below the selected block when the host clip leaves no room above', () => {
    expect(placeEditorOverlay({
      anchorRect: { left: 20, top: 6, right: 620, bottom: 220 },
      overlaySize: { width: 340, height: 36 },
      visibleClip: { left: 0, top: 0, right: 700, bottom: 500 },
      gap: 8,
      inset: 8,
    })).toEqual({
      left: 280,
      top: 228,
      placement: 'below',
      maxWidth: 684,
      maxHeight: 484,
    });
  });

  it('caps an oversized single-row strip to the visible width for horizontal scrolling', () => {
    expect(placeEditorOverlay({
      anchorRect: { left: 260, top: 120, right: 360, bottom: 180 },
      overlaySize: { width: 900, height: 36 },
      visibleClip: { left: 40, top: 80, right: 380, bottom: 260 },
      gap: 8,
      inset: 8,
    })).toEqual({
      left: 48,
      top: 188,
      placement: 'below',
      maxWidth: 324,
      maxHeight: 164,
    });
  });

  it('inverse-compensates ancestor scale before writing CSS translation', () => {
    expect(inverseScaledTranslation({
      currentRect: { left: 300, top: 140, right: 500, bottom: 158 },
      target: { left: 260, top: 100 },
      renderedScale: { x: 0.5, y: 0.5 },
    })).toEqual({ x: -80, y: -80 });
  });

  it('docks to the bottom edge when neither side fits and the selected range occupies the top edge', () => {
    expect(placeEditorOverlay({
      anchorRect: { left: 40, top: 60, right: 260, bottom: 140 },
      overlaySize: { width: 200, height: 80 },
      visibleClip: { left: 0, top: 0, right: 300, bottom: 200 },
      avoidRects: [{ left: 40, top: 10, right: 250, bottom: 70 }],
      gap: 8,
      inset: 8,
    })).toEqual({
      left: 60,
      top: 112,
      placement: 'dock-bottom',
      maxWidth: 284,
      maxHeight: 184,
    });
  });

  it('docks to the top edge when neither side fits and the active editor occupies the bottom edge', () => {
    expect(placeEditorOverlay({
      anchorRect: { left: 40, top: 60, right: 260, bottom: 140 },
      overlaySize: { width: 200, height: 80 },
      visibleClip: { left: 0, top: 0, right: 300, bottom: 200 },
      avoidRects: [{ left: 30, top: 125, right: 270, bottom: 190 }],
      gap: 8,
      inset: 8,
    })).toEqual({
      left: 60,
      top: 8,
      placement: 'dock-top',
      maxWidth: 284,
      maxHeight: 184,
    });
  });
});
