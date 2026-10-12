import React from 'react';
import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import '../../../css/page-builder-core.css';
import { StructureEditor, type StructureEditorProps } from './StructureEditor';

/** Explicit host-owned mount. No G7 global discovery, automatic migration or storage implementation. */
export function mountStructureEditor(element: Element, options: StructureEditorProps): () => void {
  const root = createRoot(element);
  root.render(<StructureEditor {...options} />);
  return () => root.unmount();
}
