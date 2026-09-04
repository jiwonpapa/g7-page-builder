import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  initialEditorViewport,
  PC_EDITOR_MIN_HOST_WIDTH,
  resolveEditorViewportPolicy,
  viewportCanvasWidth,
  type EditorViewportMode,
} from './editorViewportPolicy';

export function useEditorViewport(disabled: boolean) {
  const initialHostWidth = useMemo(() => (
    typeof window === 'undefined' ? PC_EDITOR_MIN_HOST_WIDTH : window.innerWidth
  ), []);
  const [hostWidth, setHostWidth] = useState(initialHostWidth);
  const [selectedViewport, setSelectedViewport] = useState<EditorViewportMode>(() => initialEditorViewport(initialHostWidth));
  const canvasViewportWidth = viewportCanvasWidth(selectedViewport);
  const viewportPolicy = useMemo(() => resolveEditorViewportPolicy({
    canvasWidth: canvasViewportWidth,
    disabled,
    hostWidth,
    viewport: selectedViewport,
  }), [canvasViewportWidth, disabled, hostWidth, selectedViewport]);
  useEffect(() => {
    const updateHostWidth = (): void => setHostWidth(window.innerWidth);
    window.addEventListener('resize', updateHostWidth);
    return () => window.removeEventListener('resize', updateHostWidth);
  }, []);

  const handleViewportChange = useCallback((width: number | '100%'): void => {
    setSelectedViewport(width === 360 ? 'mobile' : width === 768 ? 'tablet' : 'desktop');
  }, []);

  return { viewportPolicy, canvasViewportWidth, handleViewportChange };
}
