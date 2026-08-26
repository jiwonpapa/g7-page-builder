export interface OverlayRectEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface OverlayRect extends OverlayRectEdges {
  width: number;
  height: number;
}

export interface OverlaySize {
  width: number;
  height: number;
}

export interface EditorOverlayPlacement {
  left: number;
  top: number;
  placement: 'above' | 'below' | 'dock-top' | 'dock-bottom';
  maxWidth: number;
  maxHeight: number;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function quantizeOverlayPixel(value: number, devicePixelRatio = 1): number {
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(finite(value) * scale) / scale;
}

function rectFromEdges(rect: OverlayRectEdges): OverlayRect {
  const left = finite(rect.left);
  const top = finite(rect.top);
  const right = Math.max(left, finite(rect.right, left));
  const bottom = Math.max(top, finite(rect.bottom, top));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum <= minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function overlapArea(first: OverlayRectEdges, second: OverlayRectEdges): number {
  const overlap = intersectOverlayRects([first, second]);
  return overlap ? overlap.width * overlap.height : 0;
}

export function intersectOverlayRects(rects: readonly OverlayRectEdges[]): OverlayRect | null {
  if (rects.length === 0) return null;
  const normalized = rects.map(rectFromEdges);
  const left = Math.max(...normalized.map((rect) => rect.left));
  const top = Math.max(...normalized.map((rect) => rect.top));
  const right = Math.min(...normalized.map((rect) => rect.right));
  const bottom = Math.min(...normalized.map((rect) => rect.bottom));
  if (right <= left || bottom <= top) return null;
  return rectFromEdges({ left, top, right, bottom });
}

export function mapHostClipToFrameViewport(
  hostClip: OverlayRectEdges,
  frameContentRect: OverlayRectEdges,
  frameViewport: OverlaySize,
): OverlayRect | null {
  const host = rectFromEdges(hostClip);
  const frame = rectFromEdges(frameContentRect);
  const viewportWidth = finite(frameViewport.width);
  const viewportHeight = finite(frameViewport.height);
  if (frame.width <= 0 || frame.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;
  const scaleX = frame.width / viewportWidth;
  const scaleY = frame.height / viewportHeight;
  return rectFromEdges({
    left: (host.left - frame.left) / scaleX,
    top: (host.top - frame.top) / scaleY,
    right: (host.right - frame.left) / scaleX,
    bottom: (host.bottom - frame.top) / scaleY,
  });
}

export function placeEditorOverlay({
  anchorRect,
  overlaySize,
  visibleClip,
  avoidRects = [],
  gap = 8,
  inset = 8,
}: {
  anchorRect: OverlayRectEdges;
  overlaySize: OverlaySize;
  visibleClip: OverlayRectEdges;
  avoidRects?: readonly OverlayRectEdges[];
  gap?: number;
  inset?: number;
}): EditorOverlayPlacement {
  const anchor = rectFromEdges(anchorRect);
  const clip = rectFromEdges(visibleClip);
  const safeInset = Math.max(0, finite(inset));
  const safeGap = Math.max(0, finite(gap));
  const safeLeft = Math.min(clip.right, clip.left + safeInset);
  const safeTop = Math.min(clip.bottom, clip.top + safeInset);
  const safeRight = Math.max(safeLeft, clip.right - safeInset);
  const safeBottom = Math.max(safeTop, clip.bottom - safeInset);
  const maxWidth = safeRight - safeLeft;
  const maxHeight = safeBottom - safeTop;
  const width = Math.min(Math.max(0, finite(overlaySize.width)), maxWidth);
  const height = Math.min(Math.max(0, finite(overlaySize.height)), maxHeight);
  const left = clamp(anchor.right - width, safeLeft, safeRight - width);
  const roomAbove = Math.max(0, anchor.top - safeGap - safeTop);
  const roomBelow = Math.max(0, safeBottom - anchor.bottom - safeGap);
  const fitsAbove = height <= roomAbove;
  const fitsBelow = height <= roomBelow;
  const topDock = rectFromEdges({
    left,
    top: safeTop,
    right: left + width,
    bottom: safeTop + height,
  });
  const bottomDock = rectFromEdges({
    left,
    top: safeBottom - height,
    right: left + width,
    bottom: safeBottom,
  });
  const interactionRects = avoidRects.length > 0 ? avoidRects : [anchor];
  const topOverlap = interactionRects.reduce((total, rect) => total + overlapArea(topDock, rect), 0);
  const bottomOverlap = interactionRects.reduce((total, rect) => total + overlapArea(bottomDock, rect), 0);
  const dockPlacement: EditorOverlayPlacement['placement'] = topOverlap < bottomOverlap
    ? 'dock-top'
    : bottomOverlap < topOverlap
      ? 'dock-bottom'
      : roomAbove >= roomBelow ? 'dock-top' : 'dock-bottom';
  const placement: EditorOverlayPlacement['placement'] = fitsAbove
    ? 'above'
    : fitsBelow
      ? 'below'
      : dockPlacement;
  const preferredTop = placement === 'above'
    ? anchor.top - safeGap - height
    : placement === 'below'
      ? anchor.bottom + safeGap
      : placement === 'dock-top' ? safeTop : safeBottom - height;

  return {
    left,
    top: clamp(preferredTop, safeTop, safeBottom - height),
    placement,
    maxWidth,
    maxHeight,
  };
}

export function inverseScaledTranslation({
  currentRect,
  target,
  renderedScale,
}: {
  currentRect: OverlayRectEdges;
  target: { left: number; top: number };
  renderedScale: { x: number; y: number };
}): { x: number; y: number } {
  const scaleX = renderedScale.x > 0 && Number.isFinite(renderedScale.x) ? renderedScale.x : 1;
  const scaleY = renderedScale.y > 0 && Number.isFinite(renderedScale.y) ? renderedScale.y : 1;
  return {
    x: (finite(target.left) - finite(currentRect.left)) / scaleX,
    y: (finite(target.top) - finite(currentRect.top)) / scaleY,
  };
}

export function viewportRect(ownerDocument: Document): OverlayRect {
  const ownerWindow = ownerDocument.defaultView;
  const width = ownerDocument.documentElement.clientWidth || ownerWindow?.innerWidth || 0;
  const height = ownerDocument.documentElement.clientHeight || ownerWindow?.innerHeight || 0;
  return { left: 0, top: 0, right: width, bottom: height, width, height };
}

export function clientBoxRect(element: HTMLElement): OverlayRect {
  const rect = element.getBoundingClientRect();
  const layoutWidth = element.offsetWidth || element.clientWidth || rect.width;
  const layoutHeight = element.offsetHeight || element.clientHeight || rect.height;
  const scaleX = layoutWidth > 0 ? rect.width / layoutWidth : 1;
  const scaleY = layoutHeight > 0 ? rect.height / layoutHeight : 1;
  const left = rect.left + element.clientLeft * scaleX;
  const top = rect.top + element.clientTop * scaleY;
  const width = element.clientWidth > 0 ? element.clientWidth * scaleX : rect.width;
  const height = element.clientHeight > 0 ? element.clientHeight * scaleY : rect.height;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function clipsOverflow(value: string): boolean {
  return value === 'auto' || value === 'clip' || value === 'hidden' || value === 'scroll';
}

function clipByOverflowAncestor(
  current: OverlayRectEdges,
  ancestor: HTMLElement,
  hostWindow: Window,
): OverlayRect | null {
  const style = hostWindow.getComputedStyle(ancestor);
  const clipX = clipsOverflow(style.overflowX);
  const clipY = clipsOverflow(style.overflowY);
  if (!clipX && !clipY) return intersectOverlayRects([current]);
  const ancestorRect = clientBoxRect(ancestor);
  return intersectOverlayRects([current, {
    left: clipX ? ancestorRect.left : current.left,
    right: clipX ? ancestorRect.right : current.right,
    top: clipY ? ancestorRect.top : current.top,
    bottom: clipY ? ancestorRect.bottom : current.bottom,
  }]);
}

export function visibleOwnerViewport(actionBar: HTMLElement): OverlayRect | null {
  const ownerDocument = actionBar.ownerDocument;
  const ownerWindow = ownerDocument.defaultView;
  const localViewport = viewportRect(ownerDocument);
  if (!ownerWindow?.frameElement) return localViewport;

  try {
    const frameElement = ownerWindow.frameElement as HTMLElement;
    const hostDocument = frameElement.ownerDocument;
    const hostWindow = hostDocument.defaultView;
    if (!hostWindow) return localViewport;
    const frameContentRect = clientBoxRect(frameElement);
    let hostClip = intersectOverlayRects([viewportRect(hostDocument), frameContentRect]);
    if (!hostClip) return null;
    for (let ancestor = frameElement.parentElement; ancestor; ancestor = ancestor.parentElement) {
      hostClip = clipByOverflowAncestor(hostClip, ancestor, hostWindow);
      if (!hostClip) return null;
    }
    const mappedHostClip = mapHostClipToFrameViewport(hostClip, frameContentRect, {
      width: localViewport.width,
      height: localViewport.height,
    });
    return mappedHostClip ? intersectOverlayRects([localViewport, mappedHostClip]) : localViewport;
  } catch {
    return localViewport;
  }
}

export function renderedElementScale(element: HTMLElement, rect: DOMRect): { x: number; y: number } {
  const x = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
  const y = element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1;
  return {
    x: x > 0 && Number.isFinite(x) ? x : 1,
    y: y > 0 && Number.isFinite(y) ? y : 1,
  };
}

const SAFE_CLIP_FIELDS = ['left', 'top', 'right', 'bottom', 'width', 'height'] as const;

export function clearVisibleClipContract(actionBar: HTMLElement): void {
  for (const field of SAFE_CLIP_FIELDS) {
    actionBar.removeAttribute(`data-g7pb-safe-clip-${field}`);
    actionBar.style.removeProperty(`--g7pb-selected-actionbar-safe-${field}`);
  }
}

export function exposeVisibleClipContract(actionBar: HTMLElement, clip: OverlayRect): void {
  const devicePixelRatio = actionBar.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  for (const field of SAFE_CLIP_FIELDS) {
    const value = quantizeOverlayPixel(clip[field], devicePixelRatio);
    const attributeName = `data-g7pb-safe-clip-${field}`;
    const propertyName = `--g7pb-selected-actionbar-safe-${field}`;
    const attributeValue = String(value);
    const propertyValue = `${value}px`;
    if (actionBar.getAttribute(attributeName) !== attributeValue) {
      actionBar.setAttribute(attributeName, attributeValue);
    }
    if (actionBar.style.getPropertyValue(propertyName) !== propertyValue) {
      actionBar.style.setProperty(propertyName, propertyValue);
    }
  }
}

export function currentInteractionRects(actionBar: HTMLElement): OverlayRectEdges[] {
  const ownerDocument = actionBar.ownerDocument;
  const ownerWindow = ownerDocument.defaultView;
  const rects: OverlayRectEdges[] = [];
  const addRect = (rect: DOMRect | DOMRectReadOnly): void => {
    if (rect.width <= 0 || rect.height <= 0) return;
    rects.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  };

  try {
    const selection = ownerWindow?.getSelection();
    if (selection && !selection.isCollapsed) {
      for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
        const range = selection.getRangeAt(rangeIndex);
        const rangeRects = range.getClientRects();
        if (rangeRects.length === 0) addRect(range.getBoundingClientRect());
        else for (let rectIndex = 0; rectIndex < rangeRects.length; rectIndex += 1) addRect(rangeRects[rectIndex]);
      }
    }
  } catch {
    // Selection can detach while Puck replaces a block; the active element remains a safe fallback.
  }

  const activeElement = ownerDocument.activeElement;
  if (
    activeElement
    && activeElement !== ownerDocument.body
    && activeElement !== ownerDocument.documentElement
    && !actionBar.contains(activeElement)
    && !activeElement.closest('.g7pb-richtext-floating-layer')
    && 'getBoundingClientRect' in activeElement
  ) {
    addRect(activeElement.getBoundingClientRect());
  }
  return rects;
}
