import React, { useState } from 'react';
import type { Node } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { InputButton } from './TypedInput';

const kinds = { text: '한 줄', email: '이메일', tel: '전화번호', textarea: '여러 줄', checkbox: '동의 체크' };
export function FormInspector({ node, disabled, apply }: {
  node: Extract<Node, { type: 'form.control' | 'form.label' }>; disabled: boolean; apply: (command: DesignCommand) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(node.props)), [error, setError] = useState('');
  const reset = () => { setDraft(structuredClone(node.props)); setError(''); };
  const changed = JSON.stringify(draft) !== JSON.stringify(node.props);
  return <form aria-label="입력 요소 설정" onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try { apply({ kind: 'content', id: node.instance_id, props: draft }); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '입력 설정을 확인해 주세요.'); }
  }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); reset(); } }}>
    <fieldset disabled={disabled} style={{ border: 0, padding: '16px 0' }}>
      <legend>{node.type === 'form.label' ? '입력 라벨' : '입력 요소'}</legend>
      <label>라벨 문구<input aria-label="입력 라벨 문구" required maxLength={1000} value={draft.label}
        onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>
      {'kind' in draft && <>
        <label>입력 종류<select aria-label="입력 종류" value={draft.kind} onChange={event => {
          const kind = event.target.value;
          if (kind === 'text' || kind === 'email' || kind === 'tel' || kind === 'textarea' || kind === 'checkbox') setDraft({ ...draft, kind });
        }}>{Object.entries(kinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
        <label>입력 안내<input aria-label="입력 안내" maxLength={500} value={draft.placeholder}
          onChange={event => setDraft({ ...draft, placeholder: event.target.value })} /></label>
      </>}
      <p style={{ color: 'var(--g7pb-muted)' }}>입력값은 디자인 문서에 저장하지 않습니다. 제출 역할은 상위 영역에서 연결합니다.</p>
      <InputButton type="submit" disabled={!changed}>입력 설정 적용</InputButton>
      <InputButton disabled={!changed} onClick={reset}>입력 설정 취소</InputButton>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  </form>;
}
