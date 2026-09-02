import React, { useRef } from 'react';
import { CanvasEditingUiContext } from './puckEditorContexts';
import { clearVisibleClipContract, currentInteractionRects, exposeVisibleClipContract, inverseScaledTranslation, placeEditorOverlay, quantizeOverlayPixel, renderedElementScale, visibleOwnerViewport } from './editorOverlaySafeZone';
import { richTextRangeAnchorFromSelection } from './richTextEditing';

const SELECTED_ACTION_BAR_SAFE_INSET_PX = 8;

export function useSelectedActionBarSafeZone(enabled: boolean): React.RefObject<HTMLDivElement | null> {
  const actionBarRef = useRef<HTMLDivElement>(null);
  const canvasUi = React.useContext(CanvasEditingUiContext);
  const rangeEditingActive = canvasUi?.rangeEditingActive ?? false;
  const rangeAnchor = canvasUi?.rangeEditingActive ? canvasUi.rangeAnchor : null;

  React.useLayoutEffect(() => {
    const actionBar = actionBarRef.current;
    if (!actionBar) return undefined;

    const clearPosition = (): void => {
      actionBar.style.removeProperty('--g7pb-selected-actionbar-translate-x');
      actionBar.style.removeProperty('--g7pb-selected-actionbar-translate-y');
      actionBar.style.removeProperty('--g7pb-selected-actionbar-max-width');
      actionBar.removeAttribute('data-g7pb-safe-zone-ready');
      actionBar.removeAttribute('data-g7pb-safe-zone-placement');
      clearVisibleClipContract(actionBar);
    };
    if (!enabled) {
      clearPosition();
      return undefined;
    }

    const ownerDocument = actionBar.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const selectedOverlay = actionBar.closest<HTMLElement>('[data-puck-overlay]');
    if (!ownerWindow || !selectedOverlay) {
      clearPosition();
      return undefined;
    }

    let animationFrame = 0;
    const styleNumber = (name: string): number => {
      const value = Number.parseFloat(actionBar.style.getPropertyValue(name));
      return Number.isFinite(value) ? value : 0;
    };
    const writeStyle = (name: string, value: string): void => {
      if (actionBar.style.getPropertyValue(name) !== value) actionBar.style.setProperty(name, value);
    };
    const syncPosition = (): void => {
      animationFrame = 0;

      const visibleClip = visibleOwnerViewport(actionBar);
      if (!visibleClip) {
        actionBar.removeAttribute('data-g7pb-safe-zone-ready');
        clearVisibleClipContract(actionBar);
        return;
      }
      exposeVisibleClipContract(actionBar, visibleClip);
      const initialRect = actionBar.getBoundingClientRect();
      const initialScale = renderedElementScale(actionBar, initialRect);
      const renderedMaxWidth = quantizeOverlayPixel(
        Math.max(0, visibleClip.width - SELECTED_ACTION_BAR_SAFE_INSET_PX * 2),
        ownerWindow.devicePixelRatio,
      );
      writeStyle(
        '--g7pb-selected-actionbar-max-width',
        `${quantizeOverlayPixel(renderedMaxWidth / initialScale.x, ownerWindow.devicePixelRatio)}px`,
      );

      const actionBarRect = actionBar.getBoundingClientRect();
      const selectedRect = rangeEditingActive
        ? richTextRangeAnchorFromSelection(ownerDocument) ?? rangeAnchor ?? selectedOverlay.getBoundingClientRect()
        : selectedOverlay.getBoundingClientRect();
      const renderedScale = renderedElementScale(actionBar, actionBarRect);
      const placement = placeEditorOverlay({
        anchorRect: selectedRect,
        overlaySize: actionBarRect,
        visibleClip,
        avoidRects: currentInteractionRects(actionBar),
        gap: SELECTED_ACTION_BAR_SAFE_INSET_PX,
        inset: SELECTED_ACTION_BAR_SAFE_INSET_PX,
      });
      const translation = inverseScaledTranslation({
        currentRect: actionBarRect,
        target: placement,
        renderedScale,
      });
      const translatedX = quantizeOverlayPixel(
        styleNumber('--g7pb-selected-actionbar-translate-x') + translation.x,
        ownerWindow.devicePixelRatio,
      );
      const translatedY = quantizeOverlayPixel(
        styleNumber('--g7pb-selected-actionbar-translate-y') + translation.y,
        ownerWindow.devicePixelRatio,
      );
      writeStyle('--g7pb-selected-actionbar-translate-x', `${translatedX}px`);
      writeStyle('--g7pb-selected-actionbar-translate-y', `${translatedY}px`);
      if (actionBar.getAttribute('data-g7pb-safe-zone-placement') !== placement.placement) {
        actionBar.setAttribute('data-g7pb-safe-zone-placement', placement.placement);
      }
      if (actionBar.getAttribute('data-g7pb-safe-zone-ready') !== 'true') {
        actionBar.setAttribute('data-g7pb-safe-zone-ready', 'true');
      }
    };
    const schedulePosition = (): void => {
      if (animationFrame !== 0) return;
      animationFrame = ownerWindow.requestAnimationFrame(syncPosition);
    };

    const resizeObserver = new ownerWindow.ResizeObserver(schedulePosition);
    resizeObserver.observe(actionBar);
    resizeObserver.observe(selectedOverlay);
    const positionObserver = new ownerWindow.MutationObserver(schedulePosition);
    positionObserver.observe(selectedOverlay, { attributes: true, attributeFilter: ['style'] });
    positionObserver.observe(actionBar, { childList: true, characterData: true, subtree: true });
    if (actionBar.parentElement) {
      positionObserver.observe(actionBar.parentElement, { attributes: true, attributeFilter: ['style'] });
    }
    ownerDocument.addEventListener('scroll', schedulePosition, true);
    ownerDocument.addEventListener('selectionchange', schedulePosition);
    ownerWindow.addEventListener('resize', schedulePosition);
    const hostFrame = ownerWindow.frameElement as HTMLElement | null;
    const hostDocument = hostFrame?.ownerDocument ?? null;
    const hostWindow = hostDocument?.defaultView ?? null;
    const hostResizeObserver = hostWindow && hostFrame ? new hostWindow.ResizeObserver(schedulePosition) : null;
    if (hostResizeObserver && hostFrame) {
      hostResizeObserver.observe(hostFrame);
      for (let ancestor = hostFrame.parentElement; ancestor; ancestor = ancestor.parentElement) {
        hostResizeObserver.observe(ancestor);
      }
    }
    hostDocument?.addEventListener('scroll', schedulePosition, true);
    hostWindow?.addEventListener('resize', schedulePosition);
    syncPosition();

    return () => {
      if (animationFrame !== 0) ownerWindow.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      hostResizeObserver?.disconnect();
      positionObserver.disconnect();
      ownerDocument.removeEventListener('scroll', schedulePosition, true);
      ownerDocument.removeEventListener('selectionchange', schedulePosition);
      ownerWindow.removeEventListener('resize', schedulePosition);
      hostDocument?.removeEventListener('scroll', schedulePosition, true);
      hostWindow?.removeEventListener('resize', schedulePosition);
      clearPosition();
    };
  }, [enabled, rangeAnchor, rangeEditingActive]);

  return actionBarRef;
}
