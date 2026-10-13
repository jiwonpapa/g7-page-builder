import React, { useState } from 'react';
import type { Node, SystemControlKind } from '../../documents/v3/types';
import type { DocumentCommand } from '../../documents/v3/designCommands';
import { InputButton } from './TypedInput';

const labels: Record<SystemControlKind, string> = { search: '검색', account: '로그인·회원가입·계정', cart: '장바구니', notifications: '알림', theme: '화면 모드', locale: '언어', currency: '통화' };
export function SystemInspector({ node, disabled, apply }: { node: Node; disabled: boolean; apply: (command: DocumentCommand) => void }) {
  const [kind, setKind] = useState<SystemControlKind | ''>(node.system?.kind ?? ''), [error, setError] = useState('');
  if (node.type !== 'layout.container' || !['div', 'nav'].includes(node.props.tag)) return null;
  const occupied = Boolean((node.slots.content ?? []).length || node.binding || node.behavior);
  return <section aria-label="G7 실행 컨트롤" style={{ borderTop: '1px solid var(--g7pb-border)', marginTop: 16, paddingTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>G7 실행 컨트롤</h2>
    <p>배치·크기·스타일은 편집합니다. 로그인과 검색 등의 실행 동작과 내부 값은 G7 서비스가 제공합니다.</p>
    <label>연결할 컨트롤<select value={kind} disabled={disabled || occupied} onChange={event => {
      const value = event.target.value;
      if (value === '') setKind(''); else if (Object.hasOwn(labels, value)) setKind(value as SystemControlKind);
    }}><option value="">일반 컨테이너</option>{(Object.keys(labels) as SystemControlKind[]).map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
    <InputButton disabled={disabled || occupied} onClick={() => {
      try {
        const set = !node.system && kind ? {
          ...(node.style.width === undefined ? { width: { value: 42, unit: 'px' as const } } : {}),
          ...(node.style.height === undefined ? { height: { value: 42, unit: 'px' as const } } : {}),
          ...(node.style.display === undefined ? { display: 'flex' as const } : {}),
        } : {};
        apply({ kind: 'transaction', commands: [{ kind: 'system', id: node.instance_id, value: kind ? { kind } : null },
          { kind: 'style', id: node.instance_id, set }] });
        setError('');
      } catch (error) { setError(error instanceof Error ? error.message : '컨트롤을 연결하지 못했습니다.'); }
    }}>컨트롤 연결 적용</InputButton>
    {occupied && <p role="status">내부 요소나 다른 동작이 없는 컨테이너를 선택해 주세요.</p>}
    <p>구조 미리보기는 실행을 막은 표시용 컨트롤입니다. 실제 동작은 공개 미리보기에서 확인합니다.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
