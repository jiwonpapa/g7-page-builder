import React from 'react';
import type { DocumentV3, Node, Run } from '../../documents/v3/types';
import { nodeAnchor } from '../../documents/v3/tree';

function Runs({ runs, editing = false }: { runs: Run[]; editing?: boolean }) {
  return <>{runs.map((run, index) => {
    let text: React.ReactNode = run.text;
    if (run.bold) text = <strong>{text}</strong>;
    if (run.italic) text = <em>{text}</em>;
    if (run.underline) text = <u>{text}</u>;
    if (run.strike) text = <s>{text}</s>;
    if (run.link) text = <a href={run.link.url} onClick={editing ? event => event.preventDefault() : undefined}
      onAuxClick={editing ? event => event.preventDefault() : undefined}
      target={run.link.new_tab ? '_blank' : undefined} rel={run.link.new_tab ? 'noopener noreferrer' : undefined}>{text}</a>;
    return <React.Fragment key={index}>{text}</React.Fragment>;
  })}</>;
}
/** IP3 structural renderer. Precision style generation belongs to IP4, not silently to this view. */
export function NodeRenderer({ node, document, children, editing = false }: { node: Node; document: DocumentV3; children?: React.ReactNode; editing?: boolean }) {
  if (node.style.hidden) return null;
  const identity = { id: nodeAnchor(node.instance_id), 'data-v3-node': node.instance_id };
  switch (node.type) {
    case 'layout.section': case 'layout.container': return React.createElement(node.props.tag, identity, children);
    case 'content.heading': return React.createElement(`h${node.props.level}`, identity, <Runs runs={node.props.runs} editing={editing} />);
    case 'content.text': return <div {...identity}>{node.props.paragraphs.map((runs, index) => <p key={index}><Runs runs={runs} editing={editing} /></p>)}</div>;
    case 'media.image': return <img {...identity} src={document.assets.find(asset => asset.asset_id === node.props.asset_id)?.url} alt={node.props.alt} />;
    case 'action.link': return <a {...identity} href={node.props.link.url} onClick={editing ? event => event.preventDefault() : undefined}
      onAuxClick={editing ? event => event.preventDefault() : undefined} target={node.props.link.new_tab ? '_blank' : undefined}
      rel={node.props.link.new_tab ? 'noopener noreferrer' : undefined}>{node.props.label}</a>;
  }
}
export function StructurePreview({ document }: { document: DocumentV3 }) {
  function nodes(items: Node[]): React.ReactNode {
    return items.map(node => <NodeRenderer key={node.instance_id} node={node} document={document}>{nodes(node.slots.content ?? [])}</NodeRenderer>);
  }
  return <div data-testid="v3-preview">{nodes(document.blocks)}</div>;
}
