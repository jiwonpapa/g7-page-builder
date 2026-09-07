import React, { useState } from 'react';
import type { NativeField, NativeValue } from '../domain/fields';
import type { NativeHost } from '../ports/host';
import { Choice } from './Choice';
import { NativeMediaPanel } from './media';

function Field({ field, host }: { field: NativeField; host: NativeHost }): React.ReactElement {
  const [draft, setDraft] = useState(String(field.value ?? ''));
  const [message, setMessage] = useState('');
  const disabled = !field.editable || host.context.readonly || host.context.editMode !== 'route';
  function apply(value: NativeValue, reset = false): void {
    const result = host.applyField(field.id, value, reset);
    setMessage(result.kind === 'refused' ? '적용하지 못했습니다. 선택 항목과 값을 확인해 주세요.'
      : result.kind === 'noop' ? '변경 사항이 없습니다.' : '적용했습니다.');
  }
  return <div className="g7pb-native-field">
    {field.kind === 'choice' ? <Choice label={field.label} value={field.value} options={field.options} disabled={disabled} onChange={apply} />
      : <form onSubmit={event => { event.preventDefault(); apply(draft); }}>
        <label>{field.label}<input aria-label={field.label} value={draft} disabled={disabled}
          onChange={event => setDraft(event.target.value)} /></label>
        <button type="submit" disabled={disabled || draft === String(field.value ?? '')}>{field.label} 적용</button>
      </form>}
    <div className="g7pb-native-field-state">
      <span>{!field.editable ? '바인딩 / 기존 값 보존' : field.custom ? '기존 사용자 값' : field.value === null ? '기본값 상속' : '개별 값'}</span>
      <button type="button" disabled={disabled || field.value === null && !field.custom}
        aria-label={field.label + ' 초기화'} onClick={() => apply(null, true)}>초기화</button>
    </div>
    {field.kind === 'image' && !disabled && <NativeMediaPanel host={host} field={field} />}
    {message && <p role="status">{message}</p>}
  </div>;
}
export function NativeContent({ host }: { host: NativeHost }): React.ReactElement {
  return <div className="g7pb-native-content">
    {(['content', 'style'] as const).map(group => {
      const fields = host.fields.filter(field => field.group === group);
      if (!fields.length) return null;
      return <section key={group} aria-label={group === 'content' ? '내용 편집' : '스타일 편집'}>
        <h3>{group === 'content' ? '내용' : '공통 스타일'}</h3>
        {group === 'style' && <p className="g7pb-native-note">기기별 기존 설정은 유지됩니다.</p>}
        {fields.map(field => <Field key={field.id + JSON.stringify(host.context) + JSON.stringify(field.value)} field={field} host={host} />)}
      </section>;
    })}
  </div>;
}
