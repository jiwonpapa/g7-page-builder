import React, { useEffect, useState } from 'react';
import type { DocumentV3 } from '../../documents/v3/types';
import { effectiveStyle, viewportAt, type Viewport } from '../../documents/v3/validate';
import { indexTree } from '../../documents/v3/tree';
import { InputButton } from './TypedInput';

export const viewportLabel = (viewport: Viewport) => ({ base: 'PC · 공통값', tablet: '태블릿', mobile: '모바일' })[viewport];
/** Width is a session-only canvas setting, not document content or history. */
export function ResponsiveControls({ width, change }: { width: number; change: (width: number) => void }) {
  const [draft, setDraft] = useState(String(width));
  useEffect(() => setDraft(String(width)), [width]);
  const viewport = viewportAt(width);
  return <div aria-label="반응형 작업면" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    {([1280, 768, 360] as const).map(value => <InputButton key={value} aria-pressed={viewport === viewportAt(value)}
      onClick={() => change(value)}>{viewportLabel(viewportAt(value))}</InputButton>)}
    <form onSubmit={event => { event.preventDefault(); const value = Number(draft);
      if (Number.isInteger(value) && value >= 320 && value <= 2560) change(value);
    }} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <label>폭 <input aria-label="캔버스 폭" type="number" min={320} max={2560} step={1} required value={draft}
        onChange={event => setDraft(event.target.value)} style={{ width: 72 }} /> px</label>
      <InputButton type="submit">폭 적용</InputButton>
    </form>
    <span aria-label="스타일 편집 대상">{viewportLabel(viewport)} · {width}px</span>
  </div>;
}

export function ReadingOrderNotice({ document, viewport }: { document: DocumentV3; viewport: Viewport }) {
  const reordered = [...indexTree(document).values()].some(({ node, ancestors }) => {
    if ([node, ...ancestors].some(item => effectiveStyle(item, viewport).hidden)) return false;
    const style = effectiveStyle(node, viewport);
    return style.position === 'absolute' || style.column_start !== undefined || style.row_start !== undefined;
  });
  return <p aria-label="읽기 순서 안내" style={{ color: 'var(--g7pb-muted)', margin: '6px 0' }}>
    {reordered ? '시각 배치와 읽기·Tab 순서가 다를 수 있습니다. 레이어의 공통 DOM 순서를 확인하세요.'
      : '구조·본문·읽기 순서는 모든 화면에서 공유합니다.'}
  </p>;
}
