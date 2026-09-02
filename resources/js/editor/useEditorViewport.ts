import { useCallback, useEffect, useMemo, useState } from 'react';
import { initialEditorCanvasWidth, PC_EDITOR_MIN_HOST_WIDTH, resolveEditorViewportPolicy } from './editorViewportPolicy';

export function useEditorViewport(disabled: boolean) {
  const initialHostWidth = useMemo(() => (
    typeof window === 'undefined' ? PC_EDITOR_MIN_HOST_WIDTH : window.innerWidth
  ), []);
  const [hostWidth, setHostWidth] = useState(initialHostWidth);
  const [canvasViewportWidth, setCanvasViewportWidth] = useState<number | '100%'>(() => (
    initialEditorCanvasWidth(initialHostWidth)
  ));
  const viewportPolicy = useMemo(() => resolveEditorViewportPolicy({
    canvasWidth: canvasViewportWidth,
    disabled,
    hostWidth,
  }), [canvasViewportWidth, disabled, hostWidth]);
  useEffect(() => {
    const updateHostWidth = (): void => setHostWidth(window.innerWidth);
    window.addEventListener('resize', updateHostWidth);
    return () => window.removeEventListener('resize', updateHostWidth);
  }, []);

  const handleViewportChange = useCallback((width: number | '100%'): void => {
    setCanvasViewportWidth(width);
  }, []);

  return { viewportPolicy, canvasViewportWidth, handleViewportChange };
}
