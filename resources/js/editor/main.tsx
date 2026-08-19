import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface PageBuilderEditorOptions {
  documentId: string;
  locale: string;
}

const roots = new WeakMap<Element, Root>();

function EditorShell({ documentId, locale }: PageBuilderEditorOptions): React.ReactElement {
  return (
    <main className="g7pb-root" data-document-id={documentId} data-locale={locale}>
      <h1>G7 Page Builder</h1>
      <p>JsonUiDocumentEditor 공개 계약 연결 대기 중입니다.</p>
    </main>
  );
}

export function mountPageBuilderEditor(
  element: Element,
  options: PageBuilderEditorOptions,
): () => void {
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<EditorShell {...options} />);

  return () => {
    roots.get(element)?.unmount();
    roots.delete(element);
  };
}

declare global {
  interface Window {
    G7PageBuilder?: {
      mountEditor: typeof mountPageBuilderEditor;
    };
  }
}

if (typeof window !== 'undefined') {
  window.G7PageBuilder = {
    mountEditor: mountPageBuilderEditor,
  };
}

