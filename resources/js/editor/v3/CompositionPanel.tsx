import React, { useState } from 'react';
import { basicCompositionOptions, isBasicCompositionKey, type BasicCompositionKey } from '../../blocks/v3/basicCompositions';
import { repeatedCompositionOptions } from '../../blocks/v3/repeatedTemplates';
import { staticCompositionOptions } from '../../blocks/v3/staticTemplates';

export function CompositionPanel({ disabled, insert, insertRepeated, insertStatic }: {
  disabled: boolean; insert: (key: BasicCompositionKey) => void; insertRepeated: (key: string) => void;
  insertStatic: (key: string) => void;
}) {
  const [key, setKey] = useState<BasicCompositionKey>('hero.poster');
  const [repeatedKey, setRepeatedKey] = useState(repeatedCompositionOptions[0].key);
  const [staticKey, setStaticKey] = useState(staticCompositionOptions[0].key);
  return <section aria-label="구성 템플릿" style={{ marginTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>구성 템플릿</h2>
    <label>기본 구성<select aria-label="기본 구성" value={key} disabled={disabled} style={{ width: '100%' }}
      onChange={event => { if (isBasicCompositionKey(event.target.value)) setKey(event.target.value); }}>
      {basicCompositionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <button type="button" className="g7pb-button g7pb-button--quiet" disabled={disabled} onClick={() => insert(key)}>구성 삽입</button>
    <label style={{ display: 'block', marginTop: 12 }}>반복 구성<select aria-label="반복 구성" value={repeatedKey} disabled={disabled} style={{ width: '100%' }}
      onChange={event => { if (repeatedCompositionOptions.some(option => option.key === event.target.value)) setRepeatedKey(event.target.value); }}>
      {repeatedCompositionOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
    </select></label>
    <button type="button" className="g7pb-button g7pb-button--quiet" disabled={disabled} onClick={() => insertRepeated(repeatedKey)}>반복 구성 삽입</button>
    <label style={{ display: 'block', marginTop: 12 }}>내용 구성<select aria-label="내용 구성" value={staticKey} disabled={disabled} style={{ width: '100%' }}
      onChange={event => { if (staticCompositionOptions.some(option => option.key === event.target.value)) setStaticKey(event.target.value); }}>
      {staticCompositionOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
    </select></label>
    <button type="button" className="g7pb-button g7pb-button--quiet" disabled={disabled} onClick={() => insertStatic(staticKey)}>내용 구성 삽입</button>
    <p style={{ color: 'var(--g7pb-muted)' }}>독립 사본으로 삽입합니다. 레이어에서 내부 요소를 선택하여 편집하세요.</p>
  </section>;
}
