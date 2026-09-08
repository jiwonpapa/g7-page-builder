import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { EditorViewportPolicyContext, usePageBuilderPuck } from './puckEditorContexts';
import { assertEditorInsertion, editorItemLocations, editorPlacementReason } from './puckEditorSelection';
import { deleteCanvasItem, moveCanvasItem } from './canvasItemCommands';

/** The same Puck tree/commands own canvas, outline and these explicit composition tools. */
export function HeroComposition({ readOnly, structureEnabled = false }: { readOnly?: boolean; structureEnabled?: boolean }): React.ReactElement {
  const { appState, selectedItem, dispatch } = usePageBuilderPuck((state) => state);
  const { canEdit } = React.useContext(EditorViewportPolicyContext);
  const [message, setMessage] = React.useState('');
  const id = selectedItem?.type === 'Hero' ? selectedItem.props.id : null;
  React.useEffect(() => setMessage(''), [id]);
  if (!id) return <></>;
  const disabled = readOnly || !canEdit || !structureEnabled;
  const zone = `${id}:extra`;
  const children = editorItemLocations(appState.data).filter((entry) => entry.selector.zone === zone);
  const additions = (['Badge', 'List'] as const).map((type) => {
    let reason = '';
    try { assertEditorInsertion(appState.data, { zone, index: children.length }, type); }
    catch (error) { reason = editorPlacementReason(error); }
    return { type, label: type === 'Badge' ? '배지' : '목록', reason };
  });
  const add = (type: 'Badge' | 'List'): void => {
    if (disabled) return;
    try {
      assertEditorInsertion(appState.data, { zone, index: children.length }, type);
      dispatch({ type: 'insert', componentType: type, destinationZone: zone, destinationIndex: children.length,
        id: crypto.randomUUID(), recordHistory: true });
      setMessage(type === 'Badge' ? '배지를 추가했습니다.' : '목록을 추가했습니다.');
    } catch (error) { setMessage(editorPlacementReason(error)); }
  };
  return <details className="g7pb-design-advanced" data-testid="hero-composition">
    <summary>내부 구성 · {children.length}/2</summary>
    <p>{structureEnabled ? '배지·목록을 각각 하나씩 배치합니다. 제목·본문·기존 버튼은 그대로 유지됩니다.' : '상단의 구조 편집 사용을 먼저 선택해 주세요.'}</p>
    <section className="g7pb-layout-inspector-control">
      <div role="group" aria-label="Hero 내부 요소 추가">
        {additions.map(({ type, label, reason }) => <button type="button" key={type} disabled={disabled || Boolean(reason)}
          aria-label={`${label} 추가`} title={reason || `${label} 추가`} onClick={() => add(type)}>+ {label}</button>)}
      </div>
      {children.map((entry, index) => {
        const label = entry.item.type === 'Badge' ? '배지' : '목록';
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
    </section>
  </details>;
}
