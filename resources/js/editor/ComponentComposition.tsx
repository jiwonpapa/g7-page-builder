import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { EditorViewportPolicyContext, usePageBuilderPuck } from './puckEditorContexts';
import { assertEditorInsertion, editorItemLocations, editorPlacementReason } from './puckEditorSelection';
export const CARD_SLOT_COMPONENTS = { media: ['Image'], body: ['Heading', 'RichText', 'Icon', 'List', 'Badge', 'Divider'], actions: ['Buttons'] } as const;
import { deleteCanvasItem, moveCanvasItem } from './canvasItemCommands';
import { enableCompositionActions } from './compositionActions';

const LABELS = { Image: '이미지', Heading: '제목', RichText: '본문', Icon: '아이콘', Badge: '배지', List: '목록', Divider: '구분선', Buttons: '버튼' };
type ChildType = keyof typeof LABELS;

/** The same Puck tree/commands own canvas, outline and these explicit composition tools. */
export function ComponentComposition({ readOnly, structureEnabled = false }: { readOnly?: boolean; structureEnabled?: boolean }): React.ReactElement {
  const { selectedItem, appState, dispatch } = usePageBuilderPuck((state) => state);
  const [message, setMessage] = React.useState('');
  const { canEdit } = React.useContext(EditorViewportPolicyContext);
  const id = selectedItem && (selectedItem.type === 'Hero' || selectedItem.type === 'ImageText' || selectedItem.type === 'Card') ? selectedItem.props.id : null;
  if (!id || !selectedItem || (selectedItem.type !== 'Hero' && selectedItem.type !== 'ImageText' && selectedItem.type !== 'Card')) return <></>;
  const actionsEnabled = selectedItem.type === 'Card' || selectedItem.props.actionsEnabled === true;
  const disabled = readOnly || !canEdit || !structureEnabled;
  const slots = selectedItem.type === 'Card' ? CARD_SLOT_COMPONENTS
    : { extra: selectedItem.type === 'ImageText' ? ['Badge', 'List', 'Divider'] as const : ['Badge', 'List'] as const, ...(actionsEnabled ? { actions: ['Buttons'] as const } : {}) };
  return <details className="g7pb-design-advanced" data-testid={selectedItem.type === 'Card' ? 'card-composition' : selectedItem.type === 'Hero' ? 'hero-composition' : 'image-text-composition'}>
    <summary>내부 구성 · {editorItemLocations(appState.data).filter((entry) => Object.keys(slots).some((slot) => entry.selector.zone === `${id}:${slot}`)).length}/{Object.values(slots).reduce((sum, types) => sum + types.length, 0)}</summary>
    <p>{structureEnabled ? (selectedItem.type === 'Card' ? '구역별 요소를 각각 하나씩 배치합니다. 링크는 내부 버튼에서 설정합니다.' : (actionsEnabled ? '제목·본문은 유지하고 버튼 구역에서 연결을 편집합니다.' : '버튼 구역으로 전환하면 기존 문구와 연결을 옮겨 편집합니다.')) : '상단의 구조 편집 사용을 먼저 선택해 주세요.'}</p>
    {!actionsEnabled && <section className="g7pb-layout-inspector-control"><button type="button" disabled={Boolean(disabled)} onClick={() => {
      if (disabled) return;
      try { dispatch(enableCompositionActions(appState.data, id, structureEnabled, crypto.randomUUID())); setMessage(''); }
      catch (error) { setMessage(error instanceof Error ? error.message : '버튼 구역으로 전환할 수 없습니다.'); }
    }}>버튼 구역으로 편집</button></section>}
    {message && <output aria-live="polite">{message}</output>}
    {Object.entries(slots).map(([slot, types]) => <CompositionSlot key={`${id}:${slot}`} id={id} slot={slot} types={types} disabled={Boolean(disabled)} />)}
  </details>;
}

function CompositionSlot({ id, slot, types, disabled }: { id: string; slot: string; types: readonly ChildType[]; disabled: boolean }): React.ReactElement {
  const { appState, dispatch } = usePageBuilderPuck((state) => state);
  const [message, setMessage] = React.useState('');
  const zone = `${id}:${slot}`;
  const children = editorItemLocations(appState.data).filter((entry) => entry.selector.zone === zone);
  const labels = LABELS;
  const additions = types.map((type) => {
    let reason = '';
    try { assertEditorInsertion(appState.data, { zone, index: children.length }, type); }
    catch (error) { reason = editorPlacementReason(error); }
    return { type, label: labels[type], reason };
  });
  const add = (type: ChildType): void => {
    if (disabled) return;
    try {
      assertEditorInsertion(appState.data, { zone, index: children.length }, type);
      dispatch({ type: 'insert', componentType: type, destinationZone: zone, destinationIndex: children.length,
        id: crypto.randomUUID(), recordHistory: true });
      setMessage(`${labels[type]} 요소를 추가했습니다.`);
    } catch (error) { setMessage(editorPlacementReason(error)); }
  };
  const title = slot === 'media' ? '이미지' : slot === 'body' ? '본문' : slot === 'actions' ? '버튼' : '추가 요소';
  return <section className="g7pb-layout-inspector-control" aria-label={`${title} 구역`}>
      <strong>{title} · {children.length}/{types.length}</strong>
      <div role="group" aria-label={`${title} 내부 요소 추가`}>
        {additions.map(({ type, label, reason }) => <button type="button" key={type} disabled={disabled || Boolean(reason)}
          aria-label={`${label} 추가`} title={reason || `${label} 추가`} onClick={() => add(type)}>{label}</button>)}
      </div>
      {children.map((entry, index) => {
        const label = LABELS[entry.item.type as ChildType] ?? entry.item.type;
        return <div key={entry.item.props.id} role="group" aria-label={`${label} 내부 요소`}>
          <button type="button" aria-label={`${label} 편집`} disabled={disabled} onClick={() => dispatch({ type: 'setUi',
            ui: { itemSelector: entry.selector }, recordHistory: false })}>{label}</button>
          <button type="button" aria-label={`${label} 위로`} disabled={disabled || index === 0}
            onClick={() => moveCanvasItem(appState.data, entry, index - 1).forEach(dispatch)}><ArrowUp size={16} /></button>
          <button type="button" aria-label={`${label} 아래로`} disabled={disabled || index === children.length - 1}
            onClick={() => moveCanvasItem(appState.data, entry, index + 1).forEach(dispatch)}><ArrowDown size={16} /></button>
          <button type="button" aria-label={`${label} 삭제`} disabled={disabled}
            onClick={() => deleteCanvasItem(appState.data, entry).forEach(dispatch)}><Trash2 size={16} /></button>
        </div>;
      })}
      {message && <output aria-live="polite">{message}</output>}
    </section>;
}
