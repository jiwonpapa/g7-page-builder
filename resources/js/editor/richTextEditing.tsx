import React from 'react';
import { CanvasCurrentElementStylesContext, elementAppearanceClassName } from './canvasEditingContract';
import { G7TextStyleMark, G7SingleLineDocument, G7SingleLineRichText, selectRichTextEditorState } from './richTextModel';
import { G7RichTextInlineMenu } from './richTextInlineMenu';

export { G7TextStyleMark, G7SingleLineDocument, G7SingleLineRichText, isRichTextRangeActive, RICH_TEXT_ALLOWED_VALUES } from './richTextModel';
export { RICH_TEXT_RANGE_STATE_MESSAGE, richTextRangeAnchorFromSelection } from './richTextSelection';

type InlineRichTextOptions = { allowLink?: boolean };

const BASE_RICH_TEXT_OPTIONS = {
  code: false as const,
  codeBlock: false as const,
  horizontalRule: false as const,
  strike: false as const,
  textAlign: {},
  underline: {},
};

export function createRichTextField(label: string, initialHeight = 150, headings = false) {
  return {
    type: 'richtext' as const,
    label,
    contentEditable: true,
    // The canvas is the sole rich-text editing surface. Puck still supplies
    // the editor instance and inline menu, while its duplicate sidebar field
    // is hidden through the native field visibility contract.
    visible: false,
    initialHeight,
    options: {
      ...BASE_RICH_TEXT_OPTIONS,
      heading: headings ? { levels: [2, 3, 4] as [2, 3, 4] } : false as const,
    },
    tiptap: {
      extensions: [G7TextStyleMark],
      selector: selectRichTextEditorState,
    },
    renderInlineMenu: G7RichTextInlineMenu,
  };
}

export function createInlineRichTextField(label: string, options: InlineRichTextOptions = {}) {
  const allowLink = options.allowLink ?? true;
  const field = createRichTextField(label, 64, false);

  return {
    ...field,
    options: {
      ...field.options,
      blockquote: false as const,
      bulletList: false as const,
      document: false as const,
      hardBreak: false as const,
      heading: false as const,
      link: allowLink ? {} : false as const,
      listItem: false as const,
      listKeymap: false as const,
      orderedList: false as const,
      textAlign: false as const,
    },
    tiptap: {
      ...field.tiptap,
      extensions: [G7SingleLineDocument, G7TextStyleMark, G7SingleLineRichText],
    },
    renderInlineMenu: (props: React.ComponentProps<typeof G7RichTextInlineMenu>) => (
      <G7RichTextInlineMenu {...props} allowLink={allowLink} />
    ),
  };
}

export function RichTextCanvasField({
  fieldPath,
  children,
  className = 'g7pb-preview-richtext',
  as: requestedElement = 'div',
}: {
  fieldPath: string;
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'p' | 'span' | 'strong' | 'h1' | 'h2' | 'h3' | 'h4';
}): React.ReactElement {
  const elementStyles = React.useContext(CanvasCurrentElementStylesContext);
  const headingLevel = /^h([1-4])$/.exec(requestedElement)?.[1];
  const explicitWeight = elementStyles?.[fieldPath]?.weight;
  const semanticClassName = requestedElement === 'strong'
    ? 'g7pb-element-weight--bold'
    : headingLevel && explicitWeight === undefined ? 'g7pb-element-weight--heading-default' : '';
  const resolvedClassName = [
    className,
    elementAppearanceClassName(elementStyles, fieldPath),
    semanticClassName,
  ].filter(Boolean).join(' ');
  const semanticRole: React.AriaRole | undefined = headingLevel
    ? 'heading'
    : requestedElement === 'p' ? 'paragraph'
      : requestedElement === 'strong' ? 'strong' : undefined;
  return <div
    className={resolvedClassName}
    role={semanticRole}
    aria-level={headingLevel ? Number(headingLevel) : undefined}
    data-g7pb-heading-level={headingLevel}
    data-g7pb-richtext-display={requestedElement}
    data-g7pb-inline-field={fieldPath}
    data-g7pb-richtext-field="true"
  >{children}</div>;
}
