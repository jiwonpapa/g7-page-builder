import React from 'react';
import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import '../../../css/page-builder-core.css';
import '../../../css/page-builder-structure.css';
import { StructureEditor, type StructureEditorProps } from './StructureEditor';
import builtinCompositions from '../../../compositions/builtin-v3.json';

/** Explicit host-owned mount. No G7 global discovery, automatic migration or storage implementation. */
export function mountStructureEditor(element: Element, options: StructureEditorProps): () => void {
  const root = createRoot(element);
  root.render(<StructureEditor {...options} compositions={options.compositions ?? builtinCompositions} />);
  return () => root.unmount();
}
