import React, { useState } from 'react';
import type { DocumentV3, Style } from '../../documents/v3/types';
import type { StyleBatch } from '../../documents/v3/geometry';
import { selectedStyle } from '../../documents/v3/geometry';
import { groups, labelFor, seed, styleRules } from './inspectorFields';
import { TypedInput, InputButton } from './TypedInput';
import type { Viewport } from '../../documents/v3/validate';
import { viewportLabel } from './ResponsiveControls';

/** Only explicitly edited keys are broadcast. Mixed values are never copied from the first node. */
export function MultiInspector({ document, ids, disabled, apply, viewport = 'base' }: {
  document: DocumentV3; ids: string[]; disabled: boolean; apply: (command: StyleBatch) => void; viewport?: Viewport;
}) {
  const [key, setKey] = useState<keyof Style>('width');
  const [draft, setDraft] = useState<unknown>('auto');
  const [error, setError] = useState('');
  const current = selectedStyle(document, ids, key, viewport);
  const commit = (reset: boolean) => {
    try {
      const updates = ids.map(id => reset ? { id, set: {}, reset: [key] } : { id, set: { [key]: draft } });
      apply({ kind: 'styles', updates, ...(viewport === 'base' ? {} : { viewport }) }); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : '일괄 변경 실패'); }
  };
  return <section aria-label="다중 디자인" style={{ borderTop: '1px solid var(--g7pb-border)', marginTop: 24, paddingTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>함께 변경 · {viewportLabel(viewport)}</h2>
    <p>{viewport === 'base' ? '기기별 재정의가 없는 속성에도 반영합니다.' : '이 화면만 변경하며 초기화하면 공통값을 상속합니다.'}</p>
    <p>선택한 속성만 적용합니다. 부모·자식 중복은 부모에만 적용됩니다.</p>
    <fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
      <label>속성<select aria-label="일괄 속성" value={key} onChange={event => {
        const next = event.target.value as keyof Style;
        setKey(next); const value = selectedStyle(document, ids, next, viewport);
        setDraft(value.mixed || value.value === undefined ? seed(styleRules[next]!) : value.value);
      }}>{groups.flatMap(group => group.keys).map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>
      <p role="status" aria-label="선택 속성 상태">{current.mixed ? '혼합값' : current.value === undefined ? '미지정' : JSON.stringify(current.value)}</p>
      <TypedInput label="일괄 값" value={draft} rule={styleRules[key]!} change={setDraft} assets={document.assets} />
      <InputButton onClick={() => commit(false)}>선택 모두 적용</InputButton>
      <InputButton onClick={() => commit(true)}>선택 속성 초기화</InputButton>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </section>;
}
