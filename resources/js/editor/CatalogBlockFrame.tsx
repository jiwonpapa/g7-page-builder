import React from 'react';
import type { BlockMotion, ElementAppearanceMap } from '../documents/blockPresentation';
import { motionPreviewAttributes } from './blockMotionData';
import {
  CanvasCurrentElementStylesContext,
  decorateCanvasElementStyles,
  notifyCanvasElementSelection,
  useCanvasBlockAppearanceClass,
  useCanvasElementStyles,
} from './canvasEditingContract';

interface CatalogBlockFrameProps {
  id: string;
  type: string;
  motion: BlockMotion;
  elementStyles?: ElementAppearanceMap;
  children: React.ReactNode;
}

export function CatalogBlockFrame({ id, type, motion, elementStyles, children }: CatalogBlockFrameProps): React.ReactElement {
  const resolvedElementStyles = useCanvasElementStyles(id, elementStyles);
  const containerClassName = useCanvasBlockAppearanceClass(id);
  return <section className={`g7pb-preview-block ${containerClassName}`.trim()} data-testid="page-builder-block" data-block-id={id} data-block-type={type}
    onPointerDownCapture={(event) => notifyCanvasElementSelection(event, id, type)}
    {...motionPreviewAttributes(motion)}><CanvasCurrentElementStylesContext.Provider value={resolvedElementStyles}>{decorateCanvasElementStyles(children, resolvedElementStyles)}</CanvasCurrentElementStylesContext.Provider></section>;
}
