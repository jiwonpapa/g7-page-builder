import React from 'react';
import type { DocumentV3, Node, Run } from '../../documents/v3/types';
import { nodeAnchor } from '../../documents/v3/tree';
import { runPresentation, DOCUMENT_SURFACE, PARAGRAPH_STYLE } from '../../documents/v3/presentation';
import type { BehaviorAttributes } from '../../documents/v3/behaviorPresentation';
import { formPresentation } from '../../documents/v3/formPresentation';
import { reactStyle } from './presentationReact';
import type { Viewport } from '../../documents/v3/validate';
import { CatalogIcon } from '../catalogIcon';
import { embedTarget } from '../../documents/v3/embeds';
import { shellControlsMarkup } from '../../public/siteShellControls';
import { decorateSystemMarkup, systemControlOptions } from '../../public/systemElementProjection';

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
export function NodeRenderer({ node, document, styles, attributes, children, body, editing = false, dragRef }: {
  node: Node; document: DocumentV3; styles: Map<string, Record<string, string>>;
  attributes?: Map<string, BehaviorAttributes>;
  children?: React.ReactNode; body?: React.ReactNode; editing?: boolean;
  dragRef?: ((element: Element | null) => void) | null;
}) {
  const inputRef = React.useCallback((element: Element | null) => {
    dragRef?.(element);
    if (!element || !editing) return;
    // Puck's native selection listener stops bubbling before React receives a
    // synthetic click. Guard the owned control itself without stopping selection.
    const prevent = (event: Event) => event.preventDefault();
    element.addEventListener('mousedown', prevent, true);
    element.addEventListener('click', prevent, true);
    return () => {
      element.removeEventListener('mousedown', prevent, true);
      element.removeEventListener('click', prevent, true);
      dragRef?.(null);
    };
  }, [dragRef, editing]);
  const declarations = styles.get(node.instance_id) ?? {};
  if (declarations.display === 'none') return null;
  const { tabindex, for: htmlFor, required, maxlength, autocomplete, value, ...generated } = attributes?.get(node.instance_id) ?? {};
  const identity = { ...generated, ...(tabindex === undefined ? {} : { tabIndex: Number(tabindex) }), ref: dragRef,
    id: nodeAnchor(node.instance_id), 'data-v3-node': node.instance_id, style: reactStyle(declarations) };
  if (node.system && 'tag' in node.props) {
    const options = systemControlOptions(node.system.kind);
    return React.createElement(node.props.tag, { ...identity, 'data-v3-system': node.system.kind,
      'data-g7pb-system-controls': '', 'data-g7pb-shell-options': JSON.stringify(options), 'data-g7pb-shell-locale': document.locale },
    <span inert style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: decorateSystemMarkup(shellControlsMarkup(options, document.locale.startsWith('en')), true) }} />);
  }
  switch (node.type) {
    case 'layout.section': case 'layout.container': return React.createElement(node.props.tag, identity, node.binding
      ? <form style={{ display: 'contents' }} onSubmit={event => event.preventDefault()}>{children}</form> : children);
    case 'form.label': return <label {...identity} htmlFor={editing ? undefined : htmlFor}>{body ?? node.props.label}</label>;
    case 'form.control': {
      const props = { ...identity, 'aria-label': generated['aria-labelledby'] ? undefined : node.props.label,
        placeholder: node.props.placeholder, required: required !== undefined, maxLength: maxlength === undefined ? undefined : Number(maxlength),
        autoComplete: autocomplete, defaultValue: value, readOnly: editing, tabIndex: editing ? -1 : undefined,
        ref: inputRef };
      return node.props.kind === 'textarea' ? <textarea {...props} rows={6} /> : <input {...props} type={node.props.kind} />;
    }
    case 'content.heading': return body !== undefined
      ? <div {...identity} role="heading" aria-level={node.props.level} data-v3-rich>{body}</div>
      : React.createElement(`h${node.props.level}`, identity, <Runs runs={node.props.runs} document={document} editing={editing} />);
    case 'content.text': return <div {...identity} data-v3-rich>{body ?? node.props.paragraphs.map((runs, index) =>
      <p key={index} style={reactStyle(PARAGRAPH_STYLE)}><Runs runs={runs} document={document} editing={editing} /></p>)}</div>;
    case 'media.image': return <img {...identity} src={document.assets.find(asset => asset.asset_id === node.props.asset_id)?.url} alt={node.props.alt} />;
    case 'media.embed': {
      const target = embedTarget(node.props.source);
      return <div {...identity}>{target ? <iframe src={target.src} title={node.props.title} loading="lazy"
        referrerPolicy={target.kind === 'video-youtube' ? 'strict-origin-when-cross-origin' : 'no-referrer'}
        allowFullScreen={target.video} tabIndex={editing ? -1 : undefined} aria-hidden={editing || undefined}
        style={{ display: 'block', width: '100%', height: '100%', border: 0, minWidth: 0, minHeight: 0, pointerEvents: editing ? 'none' : undefined }} />
        : <span>{node.props.title} · 제공자를 설정해 주세요.</span>}</div>;
    }
    case 'media.icon': return <span {...identity} role={node.props.decorative ? undefined : 'img'}
      aria-hidden={node.props.decorative && !editing ? true : undefined}
      aria-label={node.props.decorative ? editing ? node.name : undefined : node.props.label}>
      <CatalogIcon name={node.props.icon} fillParent />
    </span>;
    case 'action.link': return <a {...identity} href={node.props.link.url} onClick={editing ? event => event.preventDefault() : undefined}
      onAuxClick={editing ? event => event.preventDefault() : undefined} target={node.props.link.new_tab ? '_blank' : undefined}
      rel={node.props.link.new_tab ? 'noopener noreferrer' : undefined}>{body ?? node.props.label}</a>;
    case 'action.button': return <button {...identity} type="button">{body ?? node.props.label}</button>;
  }
}
export function StructurePreview({ document, viewport = 'base' }: { document: DocumentV3; viewport?: Viewport }) {
  const { styles, attributes } = formPresentation(document, viewport);
  function nodes(items: Node[]): React.ReactNode {
    return items.map(node => <NodeRenderer key={node.instance_id} node={node} document={document} styles={styles} attributes={attributes}>{nodes(node.slots.content ?? [])}</NodeRenderer>);
  }
  return <div data-testid="v3-preview" data-v3-surface style={{ color: 'initial', ...reactStyle(DOCUMENT_SURFACE) }}>{nodes(document.blocks)}</div>;
}
