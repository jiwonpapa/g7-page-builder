import React, { useState } from 'react';
import type { DocumentV3, Node, Style } from '../../documents/v3/types';
import type { DesignCommand } from '../../documents/v3/designCommands';
import { groups, labelFor, seed, styleRules } from './inspectorFields';
import { InputButton, TypedInput } from './TypedInput';
import { effectiveStyle, type Viewport } from '../../documents/v3/validate';
import { viewportLabel } from './ResponsiveControls';
import { IconInspector } from './IconInspector';

export function Inspector({ node, document, disabled, apply, viewport = 'base' }: {
  node: Node; document: DocumentV3; disabled: boolean; apply: (command: DesignCommand) => void; viewport?: Viewport;
}) {
  const layer = viewport === 'base' ? node.style : node.responsive[viewport] ?? {};
  const effective = effectiveStyle(node, viewport);
  const [draft, setDraft] = useState<Style>(() => structuredClone(layer));
  const [props, setProps] = useState(() => structuredClone(node.props));
  const [error, setError] = useState('');
  const changed = JSON.stringify(draft) !== JSON.stringify(layer);
  const change = (key: keyof Style, value: unknown) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const reset = (key: keyof Style) => setDraft(current => { const next = { ...current }; delete next[key]; return next; });
  const submit = () => {
    try {
      apply({ kind: 'style', id: node.instance_id, ...(viewport === 'base' ? {} : { viewport }), set: draft,
        reset: (Object.keys(layer) as (keyof Style)[]).filter(key => !Object.hasOwn(draft, key)) });
      setError('');
    } catch (error) { setError(error instanceof Error ? error.message : '값을 확인해 주세요.'); }
  };
  return <section aria-label="정밀 Inspector" style={{ borderTop: '1px solid var(--g7pb-border)', marginTop: 24, paddingTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>디자인 · {viewportLabel(viewport)}</h2>
    <p style={{ color: 'var(--g7pb-muted)' }}>{viewport === 'base' ? '기기별 재정의가 없는 속성에 함께 적용됩니다.'
      : '이 화면에만 적용합니다. 미지정 속성은 공통값에서 상속합니다. 다른 화면 값은 유지됩니다.'}</p>
    <form onSubmit={event => { event.preventDefault(); submit(); }} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setDraft(structuredClone(layer)); setError(''); }
    }}>
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        {groups.map((group, index) => <details key={group.title} open={index < 2} style={{ borderBottom: '1px solid var(--g7pb-border)', padding: '10px 0' }}>
          <summary>{group.title}</summary>
          {group.keys.map(key => <div key={key} style={{ padding: '8px 0' }}>
            <label><input type="checkbox" aria-label={labelFor(key) + ' 지정'} checked={Object.hasOwn(draft, key)}
              onChange={event => event.target.checked ? change(key, structuredClone(effective[key] ?? (['width', 'height', 'basis'].includes(key) ? 'auto' : seed(styleRules[key]!)))) : reset(key)} />{labelFor(key)}</label>
            {Object.hasOwn(draft, key) ? <><TypedInput rule={styleRules[key]!} value={draft[key]} label={labelFor(key)} change={value => change(key, value)} assets={document.assets} />
              <small>{viewport === 'base' ? ' 공통값 지정' : ' 이 화면 재정의'}</small>
              <InputButton onClick={() => reset(key)} aria-label={labelFor(key) + ' 초기화'}>초기화</InputButton></>
              : <small style={{ color: 'var(--g7pb-muted)', overflowWrap: 'anywhere' }} aria-label={labelFor(key) + ' 상속'}>
                {viewport !== 'base' && node.style[key] !== undefined ? ' 공통값에서 상속: ' + JSON.stringify(node.style[key]) : ' 미지정 · 기본값 사용'}</small>}
            {viewport === 'base' && <small aria-label={labelFor(key) + ' 영향'} style={{ display: 'block', color: 'var(--g7pb-muted)' }}>
              {(['tablet', 'mobile'] as const).map(target => viewportLabel(target) + (Object.hasOwn(node.responsive[target] ?? {}, key) ? ': 별도값 유지' : ': 공통값 반영')).join(' · ')}
            </small>}
          </div>)}
          {group.title === '여백' && (['padding', 'margin'] as const).map(prefix => <InputButton key={prefix}
            disabled={draft[prefix + '_top' as keyof Style] === undefined} onClick={() => {
              const value = draft[prefix + '_top' as keyof Style];
              setDraft(current => ({ ...current, ...Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [prefix + '_' + side, structuredClone(value)])) }));
            }}>{prefix === 'padding' ? '안쪽' : '바깥'} 위 값을 네 변에</InputButton>)}
        </details>)}
        <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}><InputButton type="submit" disabled={!changed}>디자인 적용</InputButton>
          <InputButton disabled={!changed} onClick={() => { setDraft(structuredClone(layer)); setError(''); }}>입력 취소</InputButton></div>
        <InputButton disabled={!Object.keys(draft).length} onClick={() => { setDraft({}); setError(''); }}>현재 화면 스타일 초기화</InputButton>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
    {(node.type === 'content.heading' || node.type === 'action.link') && <form aria-label="텍스트 의미" onSubmit={event => {
      event.preventDefault(); try { apply({ kind: 'content', id: node.instance_id, props }); setError(''); }
      catch (error) { setError(error instanceof Error ? error.message : '내용을 확인해 주세요.'); }
    }}><fieldset disabled={disabled} style={{ border: 0, padding: '12px 0', margin: 0 }}>
      <p>본문과 의미는 모든 화면에 공통으로 적용합니다.</p>
      {node.type === 'content.heading' && 'level' in props && <label>제목 단계<select aria-label="제목 단계" value={props.level}
        onChange={event => setProps({ ...props, level: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>H{level}</option>)}</select></label>}
      {node.type === 'action.link' && 'link' in props && <>
        <label>링크 문구<input aria-label="링크 문구" value={props.label} onChange={event => setProps({ ...props, label: event.target.value })} /></label>
        <label>링크 주소<input aria-label="링크 주소" value={props.link.url} onChange={event => setProps({ ...props, link: { ...props.link, url: event.target.value } })} /></label>
        <label><input type="checkbox" checked={props.link.new_tab} onChange={event => setProps({ ...props, link: { ...props.link, new_tab: event.target.checked } })} />새 탭</label>
      </>}
      <InputButton type="submit">의미 적용</InputButton>
    </fieldset></form>}
    {node.type === 'media.icon' && <IconInspector node={node} disabled={disabled} apply={apply} />}
  </section>;
}
