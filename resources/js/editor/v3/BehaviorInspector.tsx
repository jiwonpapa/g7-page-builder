import React, { useState } from 'react';
import type { Behavior, DocumentV3, Node } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { designPolicyV3 } from '../../documents/v3/validate';
import { indexTree } from '../../documents/v3/tree';
import { InputButton } from './TypedInput';
import { definitions } from './inspectorFields';

const behaviorRules = definitions.behavior.anyOf!;
const carouselFields = behaviorRules.find(rule => rule.properties?.kind?.const === 'carousel')!.properties!;
const intervalRule = carouselFields.interval_ms!;

function initial(kind: Behavior['kind'], label: string): Behavior {
  if (kind === 'tabs') return { kind, label, orientation: 'horizontal', tablist_id: '', active_panel_id: '', pairs: [] };
  if (kind === 'disclosure') return { kind, mode: 'single', pairs: [] };
  return { kind, label, viewport_id: '', track_id: '', active_slide_id: '', previous_id: '', next_id: '', autoplay: false, loop: false, interval_ms: 5000 };
}
const field: React.CSSProperties = { display: 'grid', gap: 4, marginBlock: 8 };
export function BehaviorInspector({ node, document, disabled, apply }: {
  node: Node; document: DocumentV3; disabled: boolean; apply: (command: DesignCommand) => void;
}) {
  const [draft, setDraft] = useState<Behavior | null>(() => structuredClone(node.behavior ?? null));
  const [label, setLabel] = useState(node.type === 'action.button' ? node.props.label : '');
  const [error, setError] = useState('');
  const submit = (command: DesignCommand) => {
    try { apply(command); setError(''); } catch (failure) { setError(failure instanceof Error ? failure.message : '연결할 요소를 확인해 주세요.'); }
  };
  const tree = indexTree(document), rules = designPolicyV3.behaviors;
  const descendants = [...tree.values()].filter(item => item.ancestors.some(parent => parent.instance_id === node.instance_id));
  const layouts = descendants.filter(item => rules.layout_types.includes(item.node.type) && 'tag' in item.node.props && rules.layout_tags.includes(item.node.props.tag));
  const buttons = descendants.filter(item => rules.trigger_types.includes(item.node.type));
  const pick = (title: string, value: string, options: typeof descendants, change: (value: string) => void, optional = false) =>
    <label style={field}>{title}<select aria-label={title} value={value} required={!optional} onChange={event => change(event.target.value)}>
      <option value="">{optional ? '사용 안 함' : '요소 선택'}</option>
      {value && !options.some(item => item.node.instance_id === value) && <option value={value}>연결 대상 없음</option>}
      {options.map(item => <option key={item.node.instance_id} value={item.node.instance_id}>
        {item.node.name || item.node.type} · {item.node.instance_id.slice(-6)}
      </option>)}
    </select></label>;
  if (node.type === 'action.button') return <form aria-label="버튼 내용" onSubmit={event => {
    event.preventDefault(); submit({ kind: 'content', id: node.instance_id, props: { label } });
  }}><fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
    <label style={field}>버튼 문구<input aria-label="버튼 문구" value={label} required onChange={event => setLabel(event.target.value)} /></label>
    <InputButton type="submit" disabled={label === node.props.label}>버튼 문구 적용</InputButton>
    {error && <p role="alert">{error}</p>}
  </fieldset></form>;
  if (!rules.layout_types.includes(node.type) || !('tag' in node.props) || !rules.layout_tags.includes(node.props.tag)) return null;
  const changed = JSON.stringify(draft) !== JSON.stringify(node.behavior ?? null);
  return <form aria-label="동작 연결" onSubmit={event => { event.preventDefault(); submit({ kind: 'behavior', id: node.instance_id, value: draft }); }}>
    <fieldset disabled={disabled} style={{ border: 0, borderTop: '1px solid var(--g7pb-border)', padding: '16px 0', marginTop: 16 }}>
      <legend>동작 연결</legend>
      <p style={{ color: 'var(--g7pb-muted)' }}>내부 요소를 연결합니다. 편집 중에는 전체 내용을 표시하고, 전환 동작은 미리보기에서 확인합니다.</p>
      <label style={field}>동작 유형<select aria-label="동작 유형" value={draft?.kind ?? ''} onChange={event => {
        const kind = event.target.value;
        setDraft(kind === 'tabs' || kind === 'disclosure' || kind === 'carousel' ? initial(kind, node.name || '구성') : null); setError('');
      }}><option value="">없음</option><option value="tabs">탭</option><option value="disclosure">접기</option><option value="carousel">슬라이드</option></select></label>
      {draft && 'label' in draft && <label style={field}>동작 이름<input aria-label="동작 이름" value={draft.label} required maxLength={carouselFields.label?.maxLength}
        onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>}
      {draft?.kind === 'tabs' && <>
        <label style={field}>탭 방향<select aria-label="탭 방향" value={draft.orientation}
          onChange={event => setDraft({ ...draft, orientation: event.target.value === 'vertical' ? 'vertical' : 'horizontal' })}>
          <option value="horizontal">가로</option><option value="vertical">세로</option></select></label>
        {pick('탭 버튼 영역', draft.tablist_id, layouts, tablist_id => setDraft({ ...draft, tablist_id }))}
      </>}
      {draft?.kind === 'disclosure' && <label style={field}>접기 방식<select aria-label="접기 방식" value={draft.mode}
        onChange={event => setDraft({ ...draft, mode: event.target.value === 'multiple' ? 'multiple' : 'single' })}>
        <option value="single">하나씩 열기</option><option value="multiple">여러 항목 열기</option></select></label>}
      {draft && 'pairs' in draft && <>
        {draft.pairs.map((pair, index) => <div key={index} role="group" aria-label={'연결 ' + (index + 1)}
          style={{ paddingBlock: 8, borderBottom: '1px solid var(--g7pb-border)' }}>
          {'item_id' in pair && pick((index + 1) + ' 항목 영역', pair.item_id, layouts, value => {
            if (draft.kind === 'disclosure') setDraft({ ...draft, pairs: draft.pairs.map((item, n) => n === index ? { ...item, item_id: value } : item) });
          })}
          {pick((index + 1) + ' 동작 버튼', pair.trigger_id, buttons, value => {
            if (draft.kind === 'tabs') setDraft({ ...draft, pairs: draft.pairs.map((item, n) => n === index ? { ...item, trigger_id: value } : item) });
            else setDraft({ ...draft, pairs: draft.pairs.map((item, n) => n === index ? { ...item, trigger_id: value } : item) });
          })}
          {pick((index + 1) + ' 내용 영역', pair.panel_id, layouts, value => {
            if (draft.kind === 'tabs') setDraft({ ...draft, pairs: draft.pairs.map((item, n) => n === index ? { ...item, panel_id: value } : item),
              active_panel_id: draft.active_panel_id === pair.panel_id ? value : draft.active_panel_id });
            else setDraft({ ...draft, pairs: draft.pairs.map((item, n) => n === index ? { ...item, panel_id: value } : item) });
          })}
          {'expanded' in pair && <label><input aria-label={(index + 1) + ' 처음에 펼침'} type="checkbox" checked={pair.expanded} onChange={event => {
            if (draft.kind === 'disclosure') setDraft({ ...draft, pairs: draft.pairs.map((item, n) => n === index ? { ...item, expanded: event.target.checked } : item) });
          }} />처음에 펼침</label>}
          <InputButton aria-label={(index + 1) + ' 연결 제거'} onClick={() => {
            if (draft.kind === 'tabs') setDraft({ ...draft, pairs: draft.pairs.filter((_, n) => n !== index),
              active_panel_id: draft.active_panel_id === pair.panel_id ? '' : draft.active_panel_id });
            else setDraft({ ...draft, pairs: draft.pairs.filter((_, n) => n !== index) });
          }}>연결 제거</InputButton>
        </div>)}
        <InputButton disabled={draft.pairs.length >= (behaviorRules.find(rule => rule.properties?.kind?.const === draft.kind)!.properties!.pairs!.maxItems!)} onClick={() => draft.kind === 'tabs'
          ? setDraft({ ...draft, pairs: [...draft.pairs, { trigger_id: '', panel_id: '' }] })
          : setDraft({ ...draft, pairs: [...draft.pairs, { item_id: '', trigger_id: '', panel_id: '', expanded: false }] })}>연결 추가</InputButton>
        {draft.kind === 'tabs' && pick('처음 표시할 내용', draft.active_panel_id, layouts.filter(item => draft.pairs.some(pair => pair.panel_id === item.node.instance_id)),
          value => setDraft({ ...draft, active_panel_id: value }))}
      </>}
      {draft?.kind === 'carousel' && <>
        {pick('슬라이드 표시 영역', draft.viewport_id, layouts, value => setDraft({ ...draft, viewport_id: value }))}
        {pick('슬라이드 트랙', draft.track_id, layouts, value => setDraft({ ...draft, track_id: value, active_slide_id: '' }))}
        {pick('처음 표시할 슬라이드', draft.active_slide_id, layouts.filter(item => item.parent?.instance_id === draft.track_id), value => setDraft({ ...draft, active_slide_id: value }))}
        {pick('이전 버튼', draft.previous_id, buttons, value => setDraft({ ...draft, previous_id: value }))}
        {pick('다음 버튼', draft.next_id, buttons, value => setDraft({ ...draft, next_id: value }))}
        {pick('자동 재생 버튼', draft.rotation_id ?? '', buttons, value => {
          const next = { ...draft }; if (value) next.rotation_id = value; else delete next.rotation_id; setDraft(next);
        }, true)}
        <label style={field}><span><input type="checkbox" aria-label="처음부터 자동 재생" checked={draft.autoplay}
          onChange={event => setDraft({ ...draft, autoplay: event.target.checked })} />처음부터 자동 재생</span></label>
        <label style={field}><span><input type="checkbox" aria-label="슬라이드 반복" checked={draft.loop}
          onChange={event => setDraft({ ...draft, loop: event.target.checked })} />반복</span></label>
        <label style={field}>전환 간격(ms)<input aria-label="전환 간격" type="number" required min={intervalRule.minimum} max={intervalRule.maximum} step={intervalRule.multipleOf}
          value={draft.interval_ms} onChange={event => setDraft({ ...draft, interval_ms: Number(event.target.value) })} /></label>
      </>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <InputButton type="submit" disabled={!changed}>동작 적용</InputButton>
        <InputButton disabled={!changed} onClick={() => { setDraft(structuredClone(node.behavior ?? null)); setError(''); }}>동작 입력 취소</InputButton>
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  </form>;
}
