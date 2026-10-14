import React, { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionBar, Puck, type Overrides, type ComponentConfig, type Field, type SlotComponent } from '@puckeditor/core';
import { ArrowDown, ArrowRightToLine, ArrowUp, Copy, CopyPlus, Eye, EyeOff, Group, Layers3, LockKeyhole, MousePointer2, Plus, Redo2, SlidersHorizontal, Trash2, Undo2, Ungroup, UnlockKeyhole, ClipboardPaste, type LucideIcon } from 'lucide-react';
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
import { BindingInspector } from './BindingInspector';
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
import { formPresentation } from '../../documents/v3/formPresentation';
import { PublicationControls } from './PublicationControls';
import type { PublicationPort, PublishedPage } from '../../editor-application/v3/publication';
import type { MediaPort } from '../../editor-application/v3/media';
import { ImageInspector } from './ImageInspector';
import type { CompositionLibraryPort } from '../../editor-application/v3/compositionLibrary';
import { UserCompositionPanel } from './UserCompositionPanel';
import { MediaInsertion } from './MediaInsertion';
import { SystemInspector } from './SystemInspector';
import { DataInspector } from './DataInspector';
import { CANVAS_INPUT_HELP, createCanvasAccessibility } from './canvasAccessibility';

export interface StructureEditorProps {
  document: DocumentV3;
  compositions?: readonly unknown[];
  sessionId: string;
  readonly?: boolean;
  iframeEnabled?: boolean;
  serverRevision: number;
  drafts: DraftPort;
  publication?: PublicationPort;
  media?: MediaPort;
  library?: CompositionLibraryPort;
  onPublished?: (page: PublishedPage) => void;
  nextId: () => string;
  onChange?: (document: DocumentV3) => void;
  onSaved?: (revision: number, status: 'saved' | 'edited') => void;
}
const CanvasContext = createContext<{ document: DocumentV3; tree: Map<string, Location>; styles: Map<string, Record<string, string>>; attributes: Map<string, Record<string, string>>; textEditing: boolean } | null>(null);
const InteractionContext = createContext<(Omit<React.ComponentProps<typeof GeometryAdapter>, 'owner'> & { extent: (height: number) => void }) | null>(null);
function FrameContents({ children, document: frameDocument }: React.ComponentProps<NonNullable<Overrides<V3Config>['iframe']>>) {
  const context = useContext(InteractionContext);
  useEffect(() => {
    if (!frameDocument) return;
    const accessibility = createCanvasAccessibility(frameDocument, CANVAS_INPUT_HELP);
    return () => accessibility.dispose();
  }, [frameDocument]);
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
  return React.createElement(node.props.tag, { ...props, ref, role: 'group', 'aria-label': node.name,
    id: nodeAnchor(node.instance_id), 'data-v3-node': node.instance_id });
});
function CanvasNode({ id, body, Content, dragRef }: { id: string; body: React.ReactNode; Content: SlotComponent; dragRef: ((element: Element | null) => void) | null }) {
  const context = useContext(CanvasContext);
  const node = context?.tree.get(id)?.node;
  if (!context || !node) return null;
  if (context.styles.get(id)?.display === 'none') return null;
  if (node.system) return <NodeRenderer node={node} document={context.document} styles={context.styles} dragRef={dragRef} editing />;
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
  return <NodeRenderer node={node} document={context.document} styles={context.styles} attributes={context.attributes} dragRef={dragRef}
    body={context.textEditing && (node.type.startsWith('content.') || node.type === 'action.link' || node.type === 'action.button' || node.type === 'form.label') ? body : undefined} editing />;
}
function CommandButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="g7pb-button g7pb-button--quiet" {...props}>{children}</button>;
}
function LayerAction({ icon: Icon, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; children: string }) {
  return <CommandButton title={children} {...props}><Icon size={15} aria-hidden /><span className="g7pb-v3-sr-only">{children}</span></CommandButton>;
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
  return <div className="g7pb-v3-history" role="group" aria-label="편집 이력">
    <CommandButton title="실행 취소 (⌘/Ctrl+Z)" disabled={disabled || !api.history.hasPast} onClick={() => run(() => bridge.history('back'))}><Undo2 size={16} aria-hidden /><span className="g7pb-v3-sr-only">실행 취소</span></CommandButton>
    <CommandButton title="다시 실행 (⌘/Ctrl+Shift+Z)" disabled={disabled || !api.history.hasFuture} onClick={() => run(() => bridge.history('forward'))}><Redo2 size={16} aria-hidden /><span className="g7pb-v3-sr-only">다시 실행</span></CommandButton>
  </div>;
}
function EditorSession(props: StructureEditorProps) {
  const live = useRef(props); live.current = props;
  const [document, setDocument] = useState(() => validateDocumentV3(props.document));
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('구조 편집 · 선택한 화면의 디자인과 공통 본문을 편집합니다.');
  const [clipboard, setClipboard] = useState<TreeClipboard | null>(null);
  const [target, setTarget] = useState('root');
  const [insertImage, setInsertImage] = useState(false);
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
  // Initial fit is workspace state only; authored width, breakpoints and Undo stay unchanged.
  useEffect(() => {
    const available = scrollHost.current?.clientWidth ?? 0;
    if (available > 64) setZoom(Math.max(.1, Math.min(1, (available - 64) / 1280)));
  }, []);
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
  const presentation = useMemo(() => {
    const projection = formPresentation(document, viewport);
    for (const [id, attributes] of projection.attributes) {
      if ('data-g7pb-slider-viewport' in attributes) projection.styles.get(id)!.overflow = 'visible';
    }
    return projection;
  }, [document, viewport]);
  const styles = presentation.styles;
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
      Label: component({ type: 'text', contentEditable: true, visible: false }),
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
  return <main className="g7pb-root g7pb-structure-editor" aria-label="독립 구조 편집기" onKeyDownCapture={inputBoundary}>
    <CanvasContext.Provider value={{ document, tree, styles, attributes: presentation.formAttributes, textEditing: textEditing && !props.readonly }}>
      <InteractionContext.Provider value={{ source: document, bridge, selected, mode, readonly: Boolean(props.readonly || preview),
        zoom, viewport, canvasWidth, controls: geometryTools, report: setMessage, pan: (x, y) => scrollHost.current?.scrollBy(x, y), extent: setCanvasHeight }}>
      <Puck config={config} data={initial} onAction={bridge.onAction} onChange={bridge.onChange}
        overrides={overrides}
        permissions={{ insert: false, duplicate: false, delete: false, edit: textEditing && !props.readonly, drag: (mode === 'structure' || mode === 'text') && !props.readonly }}
        ui={{ viewports: { current: { width: '100%', height: 'auto' }, options: [], controlsVisible: false } }}
        iframe={{ enabled: props.iframeEnabled !== false }}>
        <BridgeObserver bridge={bridge} />
        <WorkspaceMode mode={mode} bridge={bridge} />
        <div className="g7pb-v3-shell">
        <header className="g7pb-v3-commandbar">
          <strong><Layers3 size={17} aria-hidden />페이지 편집</strong>
          <div className="g7pb-v3-document-actions">
            <CommandButton disabled={props.readonly || saving || publishing} onClick={() => void save().catch(() => {})}>{saving ? '저장 중' : '저장'}</CommandButton>
            <CommandButton aria-pressed={preview} onClick={() => setPreview(!preview)}>구조 미리보기</CommandButton>
            {props.publication && <PublicationControls port={props.publication} context={bridge.context} save={save}
              disabled={Boolean(props.readonly || saving)} editRevision={bridge.context().revision} busy={setPublishing} published={props.onPublished} />}
          </div>
        </header>
        <div className="g7pb-v3-toolbar">
          <Toolbar bridge={bridge} disabled={Boolean(props.readonly)} run={run} />
          <WorkspaceControls mode={mode} change={setMode} zoom={zoom} setZoom={setZoom} disabled={Boolean(props.readonly || preview)}
            fit={() => { setZoom(Math.max(.1, Math.min(2, ((scrollHost.current?.clientWidth ?? canvasWidth) - 64) / canvasWidth))); scrollHost.current?.scrollTo(0, 0); }} />
          <ResponsiveControls width={canvasWidth} change={value => { setCanvasWidth(value); scrollHost.current?.scrollTo(0, 0); }} />
        </div>
        <div className="g7pb-v3-workbench">
          <aside aria-label="레이어" className="g7pb-v3-panel g7pb-v3-navigation">
            <div className="g7pb-v3-panel-heading"><h2><Layers3 size={16} aria-hidden />레이어</h2><span>{tree.size}</span></div>
            <div className="g7pb-v3-layer-list">
            <LayerTree nodes={document.blocks} selected={selected} viewport={viewport} select={(id, extend) => bridge.select(id, extend)} />
            {!document.blocks.length && <p className="g7pb-v3-hint">아직 요소가 없습니다.<br />아래에서 요소나 구성을 삽입하세요.</p>}
            </div>
            <p className="g7pb-v3-hint">Shift 클릭으로 여러 요소 선택</p>
            <section aria-label="요소 삽입" className="g7pb-v3-insert">
            <h2><Plus size={16} aria-hidden />요소 삽입</h2>
            <label className="g7pb-v3-field">삽입 위치<select aria-label="삽입 위치" value={target} onChange={event => setTarget(event.target.value)}>
              <option value="root">페이지</option>
              {[...tree.values()].filter(item => item.node.type.startsWith('layout.') && !item.node.system).map(item => <option key={item.node.instance_id} value={item.node.instance_id}>{item.node.name}</option>)}
            </select></label>
            <div className="g7pb-v3-primitives">{(Object.keys(primitiveLabels) as Node['type'][]).map(type =>
              <CommandButton key={type} disabled={props.readonly || preview} onClick={() => {
                if (type === 'media.image' && !bridge.read().assets.length) { setInsertImage(true); return; }
                run(() => bridge.execute({ kind: 'insert', destination: destination(), nodes: [createPrimitive(type, props.nextId(), bridge.read())] }));
              }}>{primitiveLabels[type]} 삽입</CommandButton>)}
              <CommandButton disabled={props.readonly || preview} onClick={() => run(() => {
                const node = createPrimitive('layout.container', props.nextId(), bridge.read());
                Object.assign(node, { name: 'G7 계정 컨트롤', system: { kind: 'account' },
                  style: { display: 'flex', width: { value: 42, unit: 'px' }, height: { value: 42, unit: 'px' } } });
                bridge.execute({ kind: 'insert', destination: destination(), nodes: [node] });
              })}>G7 컨트롤 삽입</CommandButton>
            </div>
            {insertImage && <MediaInsertion port={props.media} nextId={props.nextId} close={() => setInsertImage(false)}
              read={() => {
                const where = destination();
                const parent = where.parentId ? indexTree(bridge.read()).get(where.parentId) : undefined;
                const context = bridge.context();
                return { context: { ...context, readonly: Boolean(context.readonly || preview || parent?.node.locked || parent?.ancestors.some(node => node.locked)) },
                  destination: where, selection: bridge.selection() };
              }} apply={(value, expected) => { bridge.execute(value, expected); }} />}
            </section>
            <CompositionPanel sources={props.compositions} disabled={Boolean(props.readonly || preview)}
              insert={choice => run(() => bridge.execute({ kind: 'paste', destination: destination(),
                clipboard: compositionClipboard(choice) }))} />
            <UserCompositionPanel port={props.library} disabled={Boolean(props.readonly || preview)} nextId={props.nextId}
              read={() => ({ context: { ...bridge.context(), readonly: Boolean(props.readonly || preview || bridge.context().readonly) },
                document: bridge.read(), ids: bridge.selection() })}
              insert={choice => run(() => bridge.execute({ kind: 'paste', destination: destination(), clipboard: compositionClipboard(choice) }))} />
          </aside>
          <section ref={scrollHost} className="g7pb-v3-canvas" aria-label="작업면" onClickCapture={event => {
            if (!preview && event.target instanceof Element && event.target.closest('a')) event.preventDefault();
          }}>
            <nav aria-label="조상 탐색" className="g7pb-v3-breadcrumb">
              <span>페이지</span>
              {focus?.ancestors.map(parent => <CommandButton key={parent.instance_id} onClick={() => bridge.select(parent.instance_id)}>{parent.name}</CommandButton>)}
              {focus && <span aria-current="true">{focus.node.name}</span>}
            </nav>
            <div className="g7pb-v3-artboard" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
            <div data-v3-workspace data-v3-viewport={viewport} style={{ position: 'absolute', background: 'var(--g7pb-surface-strong)', width: canvasWidth, minHeight: 800, transform: 'scale(' + zoom + ')', transformOrigin: 'top left' }}>
              {preview ? <BehaviorPreview document={document} viewport={viewport} /> : <Puck.Preview />}
            </div>
            {!document.blocks.length && <div className="g7pb-v3-empty-canvas"><Plus size={24} aria-hidden /><strong>빈 페이지에서 시작하세요</strong><span>왼쪽에서 요소 또는 구성 템플릿을 삽입하세요.</span></div>}
            </div>
          </section>
          <aside aria-label="구조 속성" className="g7pb-v3-panel g7pb-v3-properties">
            <div className="g7pb-v3-panel-heading"><h2><SlidersHorizontal size={16} aria-hidden />속성</h2><span>선택 {selected.length}개</span></div>
            <div ref={setActionTarget} role="group" aria-label="문맥 도구" />
            <div ref={setGeometryTools} />
            {!selected.length && <div className="g7pb-v3-empty-selection"><MousePointer2 size={24} aria-hidden /><strong>편집할 요소를 선택하세요</strong><p>캔버스나 레이어에서 선택하면<br />디자인과 내용을 수정할 수 있습니다.</p></div>}
            <div hidden={!selected.length}>
            {focus && <RenameControl key={`${focus.node.instance_id}:${focus.node.name}`} node={focus.node} disabled={props.readonly}
              rename={name => command({ kind: 'rename', id: focus.node.instance_id, name })} />}
            <div className="g7pb-v3-selection-actions">
              <LayerAction icon={ArrowUp} disabled={!focus || props.readonly || focus.index === 0} onClick={() => step(-1)}>위로</LayerAction>
              <LayerAction icon={ArrowDown} disabled={!focus || props.readonly || focus.index === focus.siblings.length - 1} onClick={() => step(1)}>아래로</LayerAction>
              <LayerAction icon={ArrowRightToLine} disabled={!selected.length || props.readonly} onClick={() => command({ kind: 'move', ids: selected, destination: destination() })}>선택 위치로 이동</LayerAction>
              {(['duplicate', 'delete', 'group', 'ungroup'] as const).map((kind, index) => <LayerAction key={kind} icon={[CopyPlus, Trash2, Group, Ungroup][index]}
                disabled={!selected.length || props.readonly} onClick={() => command({ kind, ids: selected })}>{['복제', '삭제', '그룹', '그룹 해제'][index]}</LayerAction>)}
              <LayerAction icon={Copy} disabled={!selected.length} onClick={() => run(() => { setClipboard(bridge.copy()); setMessage('선택 구조를 복사했습니다.'); })}>복사</LayerAction>
              <LayerAction icon={ClipboardPaste} disabled={!clipboard || props.readonly} onClick={() => clipboard && command({ kind: 'paste', clipboard, destination: destination() })}>붙여넣기</LayerAction>
              <LayerAction icon={focus?.node.locked ? UnlockKeyhole : LockKeyhole} disabled={!selected.length || props.readonly} onClick={() => command({ kind: 'lock', ids: selected, locked: !focus?.node.locked })}>{focus?.node.locked ? '잠금 해제' : '잠금'}</LayerAction>
              <LayerAction icon={focus && effectiveStyle(focus.node, viewport).hidden ? Eye : EyeOff} disabled={!selected.length || props.readonly} onClick={() => run(() => bridge.execute({ kind: 'styles', viewport,
                updates: selected.map(id => ({ id, set: { hidden: !(focus && effectiveStyle(focus.node, viewport).hidden) } })) }))}>
                {focus && effectiveStyle(focus.node, viewport).hidden ? '표시' : '숨김'}</LayerAction>
            </div>
            {focus && <Inspector key={viewport + ':' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node} document={document} viewport={viewport}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {focus?.node.type === 'media.image' && <ImageInspector key={'image:' + viewport + ':' + focus.node.instance_id + ':' + JSON.stringify(focus.node)}
              node={focus.node} document={document} viewport={viewport} port={props.media}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))}
              read={() => {
                const ids = bridge.selection();
                const item = ids.length === 1 ? indexTree(bridge.read()).get(ids[0]) : undefined;
                const context = bridge.context();
                return { context: { ...context, readonly: Boolean(context.readonly || preview || item?.node.locked || item?.ancestors.some(node => node.locked)) },
                  nodeId: item?.node.type === 'media.image' ? item.node.instance_id : null };
              }} apply={(value, expected) => { bridge.execute(value, expected); }} />}
            {focus && <BehaviorInspector key={'behavior:' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node} document={document}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {focus && <SystemInspector key={'system:' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {focus && <DataInspector key={'data:' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node} document={document}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {focus && <BindingInspector key={'binding:' + focus.node.instance_id + ':' + JSON.stringify(focus.node)} node={focus.node} document={document}
              disabled={Boolean(preview || props.readonly || focus.node.locked || focus.ancestors.some(node => node.locked))} apply={value => { bridge.execute(value); }} />}
            {selected.length > 1 && <MultiInspector key={viewport + ':' + selected.join(':')} document={document} ids={selected} viewport={viewport}
              disabled={Boolean(props.readonly)} apply={value => { bridge.execute(value); }} />}
            </div>
            <ReadingOrderNotice document={document} viewport={viewport} />
          </aside>
        </div>
        <footer className="g7pb-v3-statusbar"><span role="status" aria-label="편집 상태">{props.readonly ? '읽기 전용' : message}</span></footer>
        </div>
      </Puck>
      </InteractionContext.Provider>
    </CanvasContext.Provider>
  </main>;
}
export function StructureEditor(props: StructureEditorProps) {
  return <EditorSession key={`${props.document.document_id}:${props.sessionId}`} {...props} />;
}
