import React, { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionBar, Puck, type Overrides, type ComponentConfig, type Field, type SlotComponent } from '@puckeditor/core';
import type { DocumentV3, Node } from '../../documents/v3/types';
import { effectiveStyle, validateDocumentV3, viewportAt } from '../../documents/v3/validate';
import { indexTree, type Location } from '../../documents/v3/tree';
import { createPrimitive, primitiveLabels } from '../../documents/v3/primitives';
import type { TreeClipboard } from '../../documents/v3/clipboard';
import type { TreeCommand } from '../../documents/v3/commands';
import type { DraftPort } from '../../editor-application/v3/session';
import { documentToPuck, type NodeProps } from './codec';
import { BridgeObserver, createPuckBridge, FrameHistoryBoundary, useV3Puck, type PuckBridge, type V3Config } from './PuckBridge';
import { LayerTree } from './LayerTree';
import { NodeRenderer } from './NodeRenderer';
import { BehaviorPreview } from './BehaviorPreview';
import { BehaviorInspector } from './BehaviorInspector';
import { DOCUMENT_SURFACE } from '../../documents/v3/presentation';
import { nodeAnchor } from '../../documents/v3/tree';
import { reactStyle } from './presentationReact';
import { Inspector } from './Inspector';
import { richTextField } from './richTextField';
import { GeometryAdapter } from '../../adapters/interaction/GeometryAdapter';
import { MultiInspector } from './MultiInspector';
import { WorkspaceControls, WorkspaceFrame, WorkspaceMode, type InputMode } from './Workspace';
import { ReadingOrderNotice, ResponsiveControls } from './ResponsiveControls';
import { CompositionPanel } from './CompositionPanel';
import { compositionClipboard } from '../../editor-application/v3/compositions';
import { behaviorPresentation } from '../../documents/v3/behaviorPresentation';
import { PublicationControls } from './PublicationControls';
import type { PublicationPort, PublishedPage } from '../../editor-application/v3/publication';

export interface StructureEditorProps {
  document: DocumentV3;
  compositions?: readonly unknown[];
  sessionId: string;
  readonly?: boolean;
  iframeEnabled?: boolean;
  serverRevision: number;
  drafts: DraftPort;
  publication?: PublicationPort;
  onPublished?: (page: PublishedPage) => void;
  nextId: () => string;
  onChange?: (document: DocumentV3) => void;
  onSaved?: (revision: number, status: 'saved' | 'edited') => void;
}
const CanvasContext = createContext<{ document: DocumentV3; tree: Map<string, Location>; styles: Map<string, Record<string, string>>; textEditing: boolean } | null>(null);
const InteractionContext = createContext<(Omit<React.ComponentProps<typeof GeometryAdapter>, 'owner'> & { extent: (height: number) => void }) | null>(null);
function FrameContents({ children, document: frameDocument }: React.ComponentProps<NonNullable<Overrides<V3Config>['iframe']>>) {
  const context = useContext(InteractionContext);
  return <>{children}{frameDocument && context && <>
    <WorkspaceFrame owner={frameDocument} extent={context.extent} />
    <FrameHistoryBoundary frameDocument={frameDocument} bridge={context.bridge} />
    <GeometryAdapter owner={frameDocument} {...context} />
  </>}</>;
}
const SlotContext = createContext<Node | null>(null);
const SlotElement = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function SlotElement(props, ref) {
  const node = useContext(SlotContext);
  if (!node || !('tag' in node.props)) return null;
  return React.createElement(node.props.tag, { ...props, ref, id: nodeAnchor(node.instance_id), 'data-v3-node': node.instance_id });
});
function CanvasNode({ id, body, Content, dragRef }: { id: string; body: React.ReactNode; Content: SlotComponent; dragRef: ((element: Element | null) => void) | null }) {
  const context = useContext(CanvasContext);
  const node = context?.tree.get(id)?.node;
  if (!context || !node) return null;
  if (context.styles.get(id)?.display === 'none') return null;
  if (node.type === 'layout.section' || node.type === 'layout.container') {
    // SlotComponent is Puck's public render function. Its closure changes when
    // descendants change; using that closure as a React type remounts the tree
    // and destroys active Tiptap input, focus and composition state.
    return <SlotContext.Provider value={node}>{Content({ as: SlotElement, ref: dragRef, minEmptyHeight: 0,
      // Puck's slot stylesheet supplies width/height:100%. An unspecified
      // authored dimension is CSS auto, including centered flex/grid children.
      // Explicit canonical dimensions still take precedence over this reset.
      style: { width: 'auto', height: 'auto', ...reactStyle(context.styles.get(id) ?? {}) } })}</SlotContext.Provider>;
  }
  return <NodeRenderer node={node} document={context.document} styles={context.styles} dragRef={dragRef}
    body={context.textEditing && (node.type.startsWith('content.') || node.type === 'action.link' || node.type === 'action.button') ? body : undefined} editing />;
}
const control: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' };
function CommandButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="g7pb-button g7pb-button--quiet" {...props}>{children}</button>;
}
/** Preserve Puck's public click boundary when the action bar is portaled into the Inspector. */
export function ContextActionBar({ target, children }: { target: HTMLElement | null; children: React.ReactNode }) {
  const actions = React.Children.toArray(children);
  return target && actions.length ? createPortal(<ActionBar>{actions}</ActionBar>, target) : null;
}
function RenameControl({ node, disabled, rename }: { node: Node; disabled?: boolean; rename: (name: string) => void }) {
  const [name, setName] = useState(node.name);
  return <form onSubmit={event => { event.preventDefault(); rename(name); }}>
    <label>레이어 이름<input aria-label="레이어 이름" value={name} onChange={event => setName(event.target.value)} disabled={disabled} style={{ width: '100%' }} /></label>
    <CommandButton type="submit" disabled={disabled}>이름 적용</CommandButton>
  </form>;
}
function Toolbar({ bridge, disabled, run }: { bridge: PuckBridge; disabled: boolean; run: (action: () => void) => void }) {
  const api = useV3Puck(state => state);
  return <div style={control} aria-label="편집 이력">
    <CommandButton disabled={disabled || !api.history.hasPast} onClick={() => run(() => bridge.history('back'))}>실행 취소</CommandButton>
    <CommandButton disabled={disabled || !api.history.hasFuture} onClick={() => run(() => bridge.history('forward'))}>다시 실행</CommandButton>
  </div>;
}
function EditorSession(props: StructureEditorProps) {
  const live = useRef(props); live.current = props;
  const [document, setDocument] = useState(() => validateDocumentV3(props.document));
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('구조 편집 · 선택한 화면의 디자인과 공통 본문을 편집합니다.');
  const [clipboard, setClipboard] = useState<TreeClipboard | null>(null);
  const [target, setTarget] = useState('root');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [mode, setMode] = useState<InputMode>('structure');
  const textEditing = mode === 'text';
  const [zoom, setZoom] = useState(1);
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const viewport = viewportAt(canvasWidth);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const scrollHost = useRef<HTMLElement>(null);
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null);
  const [geometryTools, setGeometryTools] = useState<HTMLDivElement | null>(null);
  const serverRevision = useRef(props.serverRevision);
  // A pair publication can advance the same document's CAS token without
  // replacing its canonical input or remounting its existing Puck history.
  useEffect(() => { serverRevision.current = Math.max(serverRevision.current, props.serverRevision); }, [props.serverRevision]);
  const bridge = useMemo(() => createPuckBridge(validateDocumentV3(props.document), {
    context: () => ({ sessionId: live.current.sessionId, readonly: Boolean(live.current.readonly) }),
    nextId: () => live.current.nextId(),
    changed: value => { setDocument(value); setMessage('저장할 변경 있음'); live.current.onChange?.(value); },
    selected: setSelected,
    error: setMessage,
  }), []);
  const initial = useMemo(() => documentToPuck(props.document), []);
  const tree = useMemo(() => indexTree(document), [document]);
  const styles = useMemo(() => {
    const projection = behaviorPresentation(document, viewport);
    for (const [id, attributes] of projection.attributes) {
      if ('data-g7pb-slider-viewport' in attributes) projection.styles.get(id)!.overflow = 'visible';
    }
    return projection.styles;
  }, [document, viewport]);
  const focus = selected.length === 1 ? tree.get(selected[0]) : undefined;
  const config = useMemo<V3Config>(() => {
    // Canvas transforms consume static component fields, not selected-panel resolveFields.
    const component = (body: Field): ComponentConfig<NodeProps> => ({
      label: '요소', inline: true, fields: { content: { type: 'slot' }, body,
        node: { type: 'custom', render: () => <></> }, slotPresent: { type: 'custom', render: () => <></> } },
      permissions: { duplicate: false, delete: false, insert: false },
      resolvePermissions: data => {
        const item = indexTree(bridge.read()).get(data.props.id);
        const editable = !live.current.readonly && Boolean(item) && !item?.node.locked && !item?.ancestors.some(node => node.locked);
        return { drag: editable && (mode === 'structure' || mode === 'text'), edit: editable && textEditing };
      },
      render: ({ id, body, content: Content, puck }) => <CanvasNode id={id} body={body} Content={Content} dragRef={puck.dragRef} />,
    });
    return { components: {
      Node: component({ type: 'custom', render: () => <></> }),
      Heading: component(richTextField(props.document, true)), Text: component(richTextField(props.document, false)),
      Link: component({ type: 'text', contentEditable: true, visible: false }),
      Button: component({ type: 'text', contentEditable: true, visible: false }),
    },
    root: { fields: { metadata: { type: 'custom', render: () => <></> } }, render: ({ children }) => <div data-v3-surface style={reactStyle(DOCUMENT_SURFACE)}>
      <style>{'[data-v3-rich] p{margin:0;min-height:1em}'}</style>{children}</div> },
    };
  }, [bridge, textEditing, mode]);
  const overrides = useMemo<Partial<Overrides<V3Config>>>(() => ({
    // Public action-bar override: keep the rich-text focus contract without covering authored content.
    actionBar: ({ children }) => <ContextActionBar target={actionTarget}>{children}</ContextActionBar>,
    iframe: FrameContents,
  }), [bridge, actionTarget]);
  const run = (action: () => void): void => {
    try { action(); } catch (error) { setMessage(error instanceof Error ? error.message : '변경을 적용하지 못했습니다.'); }
  };
  const command = (value: TreeCommand) => run(() => { bridge.execute(value); });
  const destination = () => {
    const parentId = target === 'root' ? null : target;
    const children = parentId === null ? bridge.read().blocks : indexTree(bridge.read()).get(parentId)?.node.slots.content ?? [];
    return { parentId, index: children.length };
  };
  const save = async () => {
    setSaving(true);
    try {
      const result = await bridge.save(live.current.drafts, serverRevision.current);
      if (result.status === 'stale') return result;
      serverRevision.current = result.revision;
      live.current.onSaved?.(result.revision, result.status);
      setMessage(result.status === 'saved' ? '저장됨' : '이전 입력 저장됨 · 추가 변경 있음');
      return result;
    } catch (error) { setMessage(error instanceof Error ? error.message : '저장 실패'); throw error; }
    finally { setSaving(false); }
  };
  const step = (direction: -1 | 1) => {
    if (!focus) return;
    command({ kind: 'move', ids: selected, destination: { parentId: focus.parent?.instance_id ?? null,
      index: focus.index + (direction < 0 ? -1 : 2) } });
  };
  const inputBoundary = (event: React.KeyboardEvent<HTMLElement>) => {
    const input = event.target instanceof HTMLElement && event.target.matches('input,textarea,select');
    if (input || event.nativeEvent.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); event.stopPropagation(); bridge.history(event.shiftKey ? 'forward' : 'back');
    }
  };
  return <main className="g7pb-root" aria-label="독립 구조 편집기" onKeyDownCapture={inputBoundary}>
    <CanvasContext.Provider value={{ document, tree, styles, textEditing: textEditing && !props.readonly }}>
      <InteractionContext.Provider value={{ source: document, bridge, selected, mode, readonly: Boolean(props.readonly || preview),
        zoom, viewport, canvasWidth, controls: geometryTools, report: setMessage, pan: (x, y) => scrollHost.current?.scrollBy(x, y), extent: setCanvasHeight }}>
      <Puck config={config} data={initial} onAction={bridge.onAction} onChange={bridge.onChange}
        overrides={overrides}
        permissions={{ insert: false, duplicate: false, delete: false, edit: textEditing && !props.readonly, drag: (mode === 'structure' || mode === 'text') && !props.readonly }}
        ui={{ viewports: { current: { width: '100%', height: 'auto' }, options: [], controlsVisible: false } }}
        iframe={{ enabled: props.iframeEnabled !== false }}>
        <BridgeObserver bridge={bridge} />
        <WorkspaceMode mode={mode} bridge={bridge} />
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <header style={{ ...control, padding: 12, borderBottom: '1px solid var(--g7pb-border)', background: 'var(--g7pb-surface-strong)' }}>
          <strong>페이지 구조</strong><Toolbar bridge={bridge} disabled={Boolean(props.readonly)} run={run} />
          <WorkspaceControls mode={mode} change={setMode} zoom={zoom} setZoom={setZoom} disabled={Boolean(props.readonly || preview)}
            fit={() => { setZoom(Math.max(.1, Math.min(2, ((scrollHost.current?.clientWidth ?? canvasWidth) - 40) / canvasWidth))); scrollHost.current?.scrollTo(0, 0); }} />
          <CommandButton disabled={props.readonly || saving || publishing} onClick={() => void save().catch(() => {})}>{saving ? '저장 중' : '저장'}</CommandButton>
          <CommandButton aria-pressed={preview} onClick={() => setPreview(!preview)}>구조 미리보기</CommandButton>
          {props.publication && <PublicationControls port={props.publication} context={bridge.context} save={save}
            disabled={Boolean(props.readonly || saving)} editRevision={bridge.context().revision} busy={setPublishing} published={props.onPublished} />}
          <ResponsiveControls width={canvasWidth} change={value => { setCanvasWidth(value); scrollHost.current?.scrollTo(0, 0); }} />
          <span role="status" aria-label="편집 상태" style={{ marginLeft: 'auto', color: 'var(--g7pb-muted)' }}>{props.readonly ? '읽기 전용' : message}</span>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(320px, 1fr) 320px', flex: 1, minHeight: 0, overflow: 'auto' }}>
          <aside aria-label="레이어" style={{ padding: 16, overflow: 'auto', background: 'var(--g7pb-surface-strong)' }}>
            <h2 style={{ fontSize: 15 }}>레이어</h2>
            <LayerTree nodes={document.blocks} selected={selected} viewport={viewport} select={(id, extend) => bridge.select(id, extend)} />
            {!document.blocks.length && <p>삽입할 요소를 선택하세요.</p>}
            <p style={{ color: 'var(--g7pb-muted)' }}>Shift 클릭으로 구조를 함께 선택합니다.</p>
          </aside>
          <section ref={scrollHost} aria-label="작업면" onClickCapture={event => {
            if (!preview && event.target instanceof Element && event.target.closest('a')) event.preventDefault();
          }} style={{ overflow: 'auto', padding: 20 }}>
            <nav aria-label="조상 탐색" style={{ ...control, minHeight: 40, marginBottom: 12, flexWrap: 'nowrap', overflowX: 'auto' }}>
              {focus?.ancestors.map(parent => <CommandButton key={parent.instance_id} onClick={() => bridge.select(parent.instance_id)}>{parent.name}</CommandButton>)}
              {focus && <span aria-current="true">{focus.node.name}</span>}
            </nav>
            <div style={{ width: canvasWidth * zoom, height: canvasHeight * zoom, position: 'relative' }}>
            <div data-v3-workspace data-v3-viewport={viewport} style={{ position: 'absolute', background: 'var(--g7pb-surface-strong)', width: canvasWidth, minHeight: 800, transform: 'scale(' + zoom + ')', transformOrigin: 'top left' }}>
              {preview ? <BehaviorPreview document={document} viewport={viewport} /> : <Puck.Preview />}
            </div>
            </div>
          </section>
          <aside aria-label="구조 속성" style={{ padding: 16, overflow: 'auto', background: 'var(--g7pb-surface-strong)' }}>
            <div ref={setActionTarget} role="group" aria-label="문맥 도구" />
            <div ref={setGeometryTools} />
            <ReadingOrderNotice document={document} viewport={viewport} />
            <h2 style={{ fontSize: 15 }}>삽입 위치</h2>
            <select aria-label="삽입 위치" value={target} onChange={event => setTarget(event.target.value)} style={{ maxWidth: '100%' }}>
              <option value="root">페이지</option>
              {[...tree.values()].filter(item => item.node.type.startsWith('layout.')).map(item => <option key={item.node.instance_id} value={item.node.instance_id}>{item.node.name}</option>)}
            </select>
            <div style={{ ...control, marginTop: 10 }}>{(Object.keys(primitiveLabels) as Node['type'][]).map(type =>
              <CommandButton key={type} disabled={props.readonly} onClick={() => run(() => bridge.execute({ kind: 'insert', destination: destination(),
                nodes: [createPrimitive(type, props.nextId(), bridge.read())] }))}>{primitiveLabels[type]} 삽입</CommandButton>)}</div>
            <CompositionPanel sources={props.compositions} disabled={Boolean(props.readonly || preview)}
              insert={choice => run(() => bridge.execute({ kind: 'paste', destination: destination(),
                clipboard: compositionClipboard(choice) }))} />
            <h2 style={{ fontSize: 15, marginTop: 24 }}>선택 {selected.length}개</h2>
            {focus && <RenameControl key={`${focus.node.instance_id}:${focus.node.name}`} node={focus.node} disabled={props.readonly}
              rename={name => command({ kind: 'rename', id: focus.node.instance_id, name })} />}
            <div style={{ ...control, marginTop: 12 }}>
              <CommandButton disabled={!focus || props.readonly || focus.index === 0} onClick={() => step(-1)}>위로</CommandButton>
              <CommandButton disabled={!focus || props.readonly || focus.index === focus.siblings.length - 1} onClick={() => step(1)}>아래로</CommandButton>
              <CommandButton disabled={!selected.length || props.readonly} onClick={() => command({ kind: 'move', ids: selected, destination: destination() })}>선택 위치로 이동</CommandButton>
              {(['duplicate', 'delete', 'group', 'ungroup'] as const).map((kind, index) => <CommandButton key={kind}
                disabled={!selected.length || props.readonly} onClick={() => command({ kind, ids: selected })}>{['복제', '삭제', '그룹', '그룹 해제'][index]}</CommandButton>)}
              <CommandButton disabled={!selected.length} onClick={() => run(() => { setClipboard(bridge.copy()); setMessage('선택 구조를 복사했습니다.'); })}>복사</CommandButton>
              <CommandButton disabled={!clipboard || props.readonly} onClick={() => clipboard && command({ kind: 'paste', clipboard, destination: destination() })}>붙여넣기</CommandButton>
              <CommandButton disabled={!selected.length || props.readonly} onClick={() => command({ kind: 'lock', ids: selected, locked: !focus?.node.locked })}>{focus?.node.locked ? '잠금 해제' : '잠금'}</CommandButton>
              <CommandButton disabled={!selected.length || props.readonly} onClick={() => run(() => bridge.execute({ kind: 'styles', viewport,
                updates: selected.map(id => ({ id, set: { hidden: !(focus && effectiveStyle(focus.node, viewport).hidden) } })) }))}>
                {focus && effectiveStyle(focus.node, viewport).hidden ? '표시' : '숨김'}</CommandButton>
            </div>
            {focus && <Inspector key={viewport + ':' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node} document={document} viewport={viewport}
              disabled={Boolean(props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {focus && <BehaviorInspector key={'behavior:' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node} document={document}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {selected.length > 1 && <MultiInspector key={viewport + ':' + selected.join(':')} document={document} ids={selected} viewport={viewport}
              disabled={Boolean(props.readonly)} apply={value => { bridge.execute(value); }} />}
          </aside>
        </div>
        </div>
      </Puck>
      </InteractionContext.Provider>
    </CanvasContext.Provider>
  </main>;
}
export function StructureEditor(props: StructureEditorProps) {
  return <EditorSession key={`${props.document.document_id}:${props.sessionId}`} {...props} />;
}
