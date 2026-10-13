import React, { useState } from 'react';
import type { DocumentV3, InquiryField, Node, ServiceBinding } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { designPolicyV3 } from '../../documents/v3/validate';
import { indexTree } from '../../documents/v3/tree';
import { InputButton } from './TypedInput';

const labels: Record<InquiryField, string> = { name: '이름', email: '이메일', phone: '전화번호', subject: '문의 제목', message: '문의 내용', privacy: '개인정보 동의' };
const names = Object.keys(labels) as InquiryField[];
const kinds: Record<ServiceBinding['form_kind'], string> = { inquiry: '일반 문의', quote: '견적', reservation: '예약', application: '신청', newsletter: '소식 신청' };
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 4, marginBlock: 8 };
export function BindingInspector({ node, document, disabled, apply }: {
  node: Node; document: DocumentV3; disabled: boolean; apply: (command: DesignCommand) => void;
}) {
  const [draft, setDraft] = useState<ServiceBinding | null>(() => structuredClone(node.binding ?? null)), [error, setError] = useState('');
  const rules = designPolicyV3.bindings;
  const reset = () => { setDraft(structuredClone(node.binding ?? null)); setError(''); };
  if (!rules.host_types.includes(node.type) || !('tag' in node.props) || !rules.host_tags.includes(node.props.tag)) return null;
  const descendants = [...indexTree(document).values()].filter(item => item.ancestors.some(parent => parent.instance_id === node.instance_id));
  const pick = (title: string, value: string, type: Node['type'], change: (id: string) => void, field?: InquiryField) =>
    <label style={fieldStyle}>{title}<select aria-label={title} value={value} required onChange={event => change(event.target.value)}>
      <option value="">요소 선택</option>
      {descendants.filter(item => item.node.type === type && (!field || item.node.type === 'form.control' && item.node.props.kind === rules.fields[field].kind))
        .map(item => <option key={item.node.instance_id} value={item.node.instance_id}>{item.node.name || item.node.type} · {item.node.instance_id.slice(-6)}</option>)}
    </select></label>;
  const changed = JSON.stringify(draft) !== JSON.stringify(node.binding ?? null);
  return <form aria-label="제출 연결" onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try { apply({ kind: 'binding', id: node.instance_id, value: draft }); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '제출 역할을 확인해 주세요.'); }
  }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); reset(); } }}>
    <fieldset disabled={disabled} style={{ border: 0, borderTop: '1px solid var(--g7pb-border)', padding: '16px 0' }}>
      <legend>제출 연결</legend>
      <label style={fieldStyle}>제출 서비스<select aria-label="제출 서비스" value={draft?.kind ?? ''} onChange={event => {
        setDraft(event.target.value === 'inquiry' ? { kind: 'inquiry', form_kind: 'inquiry', success_message: '문의가 접수되었습니다.',
          submit_id: '', status_id: '', fields: names.filter(name => rules.fields[name].required).map(name => ({ name, input_id: '', label_id: '' })) } : null);
        setError('');
      }}><option value="">없음</option><option value="inquiry">페이지 문의함</option></select></label>
      {draft && <>
        <p style={{ color: 'var(--g7pb-muted)' }}>이 영역의 입력·라벨·버튼을 연결합니다. 실제 전송은 발행한 페이지에서만 가능합니다.</p>
        <label style={fieldStyle}>문의 분류<select aria-label="문의 분류" value={draft.form_kind} onChange={event => {
          const kind = event.target.value;
          if (kind === 'inquiry' || kind === 'quote' || kind === 'reservation' || kind === 'application' || kind === 'newsletter') setDraft({ ...draft, form_kind: kind });
        }}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {names.map(name => <div key={name} role="group" aria-label={labels[name] + ' 제출 역할'}>
          {!rules.fields[name].required && <label><input type="checkbox" aria-label={labels[name] + ' 포함'} checked={draft.fields.some(field => field.name === name)}
            onChange={event => setDraft({ ...draft, fields: event.target.checked ? [...draft.fields, { name, input_id: '', label_id: '' }] : draft.fields.filter(field => field.name !== name) })} />{labels[name]} 포함</label>}
          {draft.fields.filter(field => field.name === name).map(field => <React.Fragment key={name}>
            {pick(labels[name] + ' 입력', field.input_id, 'form.control', input_id => setDraft({ ...draft, fields: draft.fields.map(value => value.name === name ? { ...value, input_id } : value) }), name)}
            {pick(labels[name] + ' 라벨', field.label_id, 'form.label', label_id => setDraft({ ...draft, fields: draft.fields.map(value => value.name === name ? { ...value, label_id } : value) }))}
          </React.Fragment>)}
        </div>)}
        {pick('제출 버튼', draft.submit_id, 'action.button', submit_id => setDraft({ ...draft, submit_id }))}
        {pick('전송 상태 문구', draft.status_id, 'content.text', status_id => setDraft({ ...draft, status_id }))}
        <label style={fieldStyle}>접수 완료 문구<input aria-label="접수 완료 문구" required maxLength={1000} value={draft.success_message}
          onChange={event => setDraft({ ...draft, success_message: event.target.value })} /></label>
      </>}
      <InputButton type="submit" disabled={!changed}>제출 연결 적용</InputButton>
      <InputButton disabled={!changed} onClick={reset}>제출 연결 취소</InputButton>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  </form>;
}
