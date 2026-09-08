import React, { useState } from 'react';
import type { NativeCollection, NativeStructureChange } from '../domain/tree';
import type { NativeField, NativeValue } from '../domain/fields';
import type { NativeHost } from '../ports/host';
import { Choice } from './Choice';
import { NativeMediaPanel } from './media';
import { InsertionPosition } from './InsertionPosition';

function ItemField({ host, field, collection, index }: {
  host: NativeHost; field: NativeField; collection: NativeCollection; index: number;
}): React.ReactElement {
  const [draft, setDraft] = useState(String(field.value ?? ''));
  const [message, setMessage] = useState('');
  const disabled = host.context.readonly || !collection.editable || !collection.items[index]?.editable || !field.editable;
  function apply(value: NativeValue): ReturnType<NativeHost['applyField']> {
    const result = host.changeStructure?.({ operation: 'field', collection: collection.id, index, field: field.id, value })
      ?? { kind: 'refused', reason: 'unavailable' };
    setMessage(result.kind === 'refused' ? '적용하지 못했습니다. 현재 항목과 값을 확인해 주세요.' : '적용했습니다.');
    return result;
  }
  return <div className="g7pb-native-field">
    {field.kind === 'choice' ? <Choice label={field.label} value={field.value} options={field.options} disabled={disabled} onChange={apply} />
      : <form onSubmit={event => { event.preventDefault(); apply(draft); }}>
        <label>{field.label}<input aria-label={field.label} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} /></label>
        <button type="submit" disabled={disabled || draft === String(field.value ?? '')}>{field.label} 적용</button>
      </form>}
    {!field.editable && <p className="g7pb-native-note">바인딩 / 기존 값 보존</p>}
    {field.kind === 'image' && !disabled && <NativeMediaPanel host={{ ...host, applyField: (_id, value) => apply(value) }} field={field} />}
    {message && <p role="status">{message}</p>}
  </div>;
}
function Collection({ host, collection }: { host: NativeHost; collection: NativeCollection }): React.ReactElement {
  const [choice, setChoice] = useState(collection.choices[0]?.id ?? '');
  const [destination, setDestination] = useState(collection.id);
  const [message, setMessage] = useState('');
  const disabled = host.context.readonly || !collection.editable;
  const [index, setIndex] = useState(collection.items.length);
  function apply(change: NativeStructureChange): void {
    const result = host.changeStructure?.(change);
    setMessage(result?.kind === 'applied' ? '구성을 변경했습니다.' : result?.kind === 'noop' ? '변경 사항이 없습니다.'
      : '변경하지 않았습니다. 출처·연결 대상·허용 위치를 확인해 주세요.');
  }
  const targets = (host.collections ?? []).filter(item => item.editable && item.kind !== 'array');
  return <details className="g7pb-native-collection" open data-collection={collection.id}>
    <summary>{collection.label} ({collection.items.length})</summary>
    {!collection.editable && <p className="g7pb-native-note">동적 데이터 / 기존 구조를 보존합니다.</p>}
    {collection.kind !== 'array' && targets.length > 1 && <label>이동 위치<select aria-label="이동 위치" value={destination} disabled={disabled}
      onChange={event => setDestination(event.target.value)}>{targets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    <ol>{collection.items.map((item, index) => <li key={item.id + ':' + index}>
      <span>{item.label}</span>
      <div className="g7pb-native-actions">
        <button type="button" aria-label={item.label + ' 위로'} disabled={disabled || !item.editable || index === 0}
          onClick={() => apply({ operation: 'move', collection: collection.id, index, destination: collection.id, toIndex: index - 1 })}>↑</button>
        <button type="button" aria-label={item.label + ' 아래로'} disabled={disabled || !item.editable || index === collection.items.length - 1}
          onClick={() => apply({ operation: 'move', collection: collection.id, index, destination: collection.id, toIndex: index + 2 })}>↓</button>
        <button type="button" disabled={disabled || !item.editable} aria-label={item.label + ' 복제'}
          onClick={() => apply({ operation: 'duplicate', collection: collection.id, index })}>복제</button>
        <button type="button" disabled={disabled || !item.editable} aria-label={item.label + ' 삭제'}
          onClick={() => apply({ operation: 'delete', collection: collection.id, index })}>삭제</button>
        {destination !== collection.id && <button type="button" disabled={disabled || !item.editable}
          onClick={() => apply({ operation: 'move', collection: collection.id, index, destination, toIndex: targets.find(target => target.id === destination)?.items.length ?? 0 })}>선택 위치로 이동</button>}
      </div>
      {item.fields.length > 0 && <details><summary>항목 편집</summary>{item.fields.map(field =>
        <ItemField key={field.id} host={host} field={field} collection={collection} index={index} />)}</details>}
    </li>)}</ol>
    {collection.choices.length > 0 && <div className="g7pb-native-field">
      <InsertionPosition collection={collection} index={index} onChange={setIndex} disabled={disabled} />
      {collection.choices.length > 1 && <Choice label="추가할 요소" value={choice} disabled={disabled}
        options={collection.choices.map(item => ({ value: item.id, label: item.label }))} onChange={value => { if (typeof value === 'string') setChoice(value); }} />}
      <button type="button" disabled={disabled || !choice} onClick={() => apply({ operation: 'insert', collection: collection.id, choice, index })}>항목 추가</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </details>;
}
export function NativeStructure({ host }: { host: NativeHost }): React.ReactElement | null {
  if (!host.collections?.length || !host.changeStructure) return <p role="status">이 항목은 삽입할 내부 위치를 제공하지 않습니다. G7 캔버스나 트리에서 상위 구역을 선택해 주세요.</p>;
  return <section aria-label="내부 구성" className="g7pb-native-structure">
    <h3>{host.context.editMode === 'iteration_item' ? '반복 템플릿 구성' : '내부 구성'}</h3>
    {host.collections.map(collection => <Collection key={collection.id + JSON.stringify(host.context)} host={host} collection={collection} />)}
  </section>;
}
