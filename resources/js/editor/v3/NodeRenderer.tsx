import React from 'react';
import type { DocumentV3, Node, Run } from '../../documents/v3/types';
import { nodeAnchor } from '../../documents/v3/tree';
import { documentPresentation, runPresentation, DOCUMENT_SURFACE, PARAGRAPH_STYLE } from '../../documents/v3/presentation';
import { reactStyle } from './presentationReact';
import type { Viewport } from '../../documents/v3/validate';

function Runs({ runs, document, editing }: { runs: Run[]; document: DocumentV3; editing: boolean }) {
  return <>{runs.map((run, index) => {
    const text = <span style={reactStyle(runPresentation(run, document))}>{run.text}</span>;
    return run.link ? <a key={index} href={run.link.url} onClick={editing ? event => event.preventDefault() : undefined}
      onAuxClick={editing ? event => event.preventDefault() : undefined}
      target={run.link.new_tab ? '_blank' : undefined} rel={run.link.new_tab ? 'noopener noreferrer' : undefined}>{text}</a>
      : <React.Fragment key={index}>{text}</React.Fragment>;
  })}</>;
}
/** Canonical declarations are shared by canvas and preview; vendor styles are never persisted. */
export function NodeRenderer({ node, document, styles, children, body, editing = false, dragRef }: {
  node: Node; document: DocumentV3; styles: Map<string, Record<string, string>>;
  children?: React.ReactNode; body?: React.ReactNode; editing?: boolean;
  dragRef?: ((element: Element | null) => void) | null;
}) {
  const declarations = styles.get(node.instance_id) ?? {};
  if (declarations.display === 'none') return null;
  const identity = { ref: dragRef, id: nodeAnchor(node.instance_id), 'data-v3-node': node.instance_id, style: reactStyle(declarations) };
  switch (node.type) {
    case 'layout.section': case 'layout.container': return React.createElement(node.props.tag, identity, children);
    case 'content.heading': return body !== undefined
      ? <div {...identity} role="heading" aria-level={node.props.level} data-v3-rich>{body}</div>
      : React.createElement(`h${node.props.level}`, identity, <Runs runs={node.props.runs} document={document} editing={editing} />);
    case 'content.text': return <div {...identity} data-v3-rich>{body ?? node.props.paragraphs.map((runs, index) =>
      <p key={index} style={reactStyle(PARAGRAPH_STYLE)}><Runs runs={runs} document={document} editing={editing} /></p>)}</div>;
    case 'media.image': return <img {...identity} src={document.assets.find(asset => asset.asset_id === node.props.asset_id)?.url} alt={node.props.alt} />;
    case 'action.link': return <a {...identity} href={node.props.link.url} onClick={editing ? event => event.preventDefault() : undefined}
      onAuxClick={editing ? event => event.preventDefault() : undefined} target={node.props.link.new_tab ? '_blank' : undefined}
      rel={node.props.link.new_tab ? 'noopener noreferrer' : undefined}>{body ?? node.props.label}</a>;
  }
}
export function StructurePreview({ document, viewport = 'base' }: { document: DocumentV3; viewport?: Viewport }) {
  const styles = documentPresentation(document, viewport);
  function nodes(items: Node[]): React.ReactNode {
    return items.map(node => <NodeRenderer key={node.instance_id} node={node} document={document} styles={styles}>{nodes(node.slots.content ?? [])}</NodeRenderer>);
  }
  return <div data-testid="v3-preview" data-v3-surface style={{ color: 'initial', ...reactStyle(DOCUMENT_SURFACE) }}>{nodes(document.blocks)}</div>;
}
