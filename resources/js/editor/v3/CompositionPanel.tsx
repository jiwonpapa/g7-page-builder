import React, { useMemo, useState } from 'react';
import { compositionChoices, type CompositionChoice } from '../../editor-application/v3/compositions';

const empty: readonly unknown[] = [];
export function CompositionPanel({ disabled, sources = empty, insert }: {
  disabled: boolean; sources?: readonly unknown[]; insert: (choice: CompositionChoice) => void;
}) {
  const catalog = useMemo(() => {
    try { return { choices: compositionChoices(sources), error: '' }; }
    catch { return { choices: [], error: '구성 데이터를 읽을 수 없습니다. 현재 문서는 변경되지 않았습니다.' }; }
  }, [sources]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const choices = catalog.choices.filter(choice => choice.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const choice = choices.find(item => item.id === selected) ?? choices[0];
  return <section aria-label="구성 템플릿" style={{ marginTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>구성 템플릿</h2>
    {catalog.error ? <p role="alert">{catalog.error}</p> : <>
      <label>구성 검색<input aria-label="구성 검색" type="search" value={query}
        onChange={event => setQuery(event.target.value)} style={{ width: '100%' }} /></label>
      <label>구성 선택<select aria-label="구성 선택" value={choice?.id ?? ''} disabled={disabled || !choices.length}
        onChange={event => setSelected(event.target.value)} style={{ width: '100%' }}>
        {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <button type="button" className="g7pb-button g7pb-button--quiet" disabled={disabled || !choice}
        onClick={() => { if (!disabled && choice) insert(choice); }}>구성 삽입</button>
      {!choices.length && <p role="status">{query ? '검색 결과가 없습니다.' : '등록된 구성이 없습니다. 기본 요소로 직접 구성할 수 있습니다.'}</p>}
    </>}
    <p style={{ color: 'var(--g7pb-muted)' }}>독립 사본으로 삽입합니다. 레이어에서 내부 요소를 선택하여 편집하세요.</p>
  </section>;
}
