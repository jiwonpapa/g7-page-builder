import React, { createContext, useContext, useEffect } from 'react';
import { Puck, usePuck, type Config, type Plugin } from '@puckeditor/core';
import { Check, Layers3, ListTree, Monitor, PanelLeft, PanelRight, Plus, Redo2, Smartphone, Tablet, Undo2 } from 'lucide-react';
import type { SitePartSetResource } from '../api/resources';
import type { SitePartComponents, SitePartPuckData, SitePartSetPresetKey } from './sitePartDocumentAdapter';
import { useSitePartHistory } from './useSitePartHistory';

interface SetLayoutContext {
  sets: SitePartSetResource[];
  selectedId: string;
  dirty: boolean;
  onSelectSet: (id: string) => void;
  onCreateSet: () => void;
  onPreset: (preset: SitePartSetPresetKey, apply: (data: SitePartPuckData) => void) => void;
  onViewport: (viewport: 'desktop' | 'tablet' | 'mobile') => void;
}

export const SitePartSetLayoutContext = createContext<SetLayoutContext | null>(null);
function useSetLayout(): SetLayoutContext {
  const context = useContext(SitePartSetLayoutContext);
  if (!context) throw new Error('Site Part workspace context is required.');
  return context;
}

function SitePartSets(): React.ReactElement {
  const { sets, selectedId, onSelectSet, onCreateSet, onPreset } = useSetLayout();
  const { dispatch } = usePuck<Config<SitePartComponents>>();
  const applyPreset = (preset: SitePartSetPresetKey): void => {
    onPreset(preset, (data) => dispatch({ type: 'setData', data, recordHistory: true }));
  };
  return <div className="g7pb-site-part-set-layout__panel" data-panel="sets">
    <header className="g7pb-site-part-set-panel-heading"><div><strong>헤더·푸터 세트</strong><span>세트마다 헤더와 푸터를 하나씩 사용합니다.</span></div><button type="button" onClick={onCreateSet}><Plus size={16} /> 새 세트</button></header>
    <div className="g7pb-site-part-set-list">
      {sets.map((set) => <button key={set.id} type="button" data-testid="page-builder-site-part-set" aria-current={set.id === selectedId ? 'true' : undefined} onClick={() => onSelectSet(set.id)}>
        <span><strong>{set.title}</strong>{set.is_active ? <em><Check size={12} /> 사용 중</em> : null}</span>
        <small>헤더·푸터 {set.is_ready ? '발행 가능' : '편집 중'}</small>
      </button>)}
    </div>
    <section className="g7pb-site-part-set-presets" data-testid="page-builder-site-part-set-presets">
      <header><strong>세트 프리셋</strong><span>헤더와 푸터를 함께 교체합니다.</span></header>
      <button type="button" onClick={() => applyPreset('business')}><strong>비즈니스</strong><span>공지·2단 메뉴·문의 CTA·다단 푸터</span></button>
      <button type="button" onClick={() => applyPreset('minimal')}><strong>미니멀</strong><span>투명 헤더·핵심 링크·짧은 푸터</span></button>
      <button type="button" onClick={() => applyPreset('community')}><strong>커뮤니티</strong><span>게시판 메뉴·회원 동선·정책 푸터</span></button>
    </section>
  </div>;
}

// Use the same Puck sidebar resizing, canvas, history and outline as the page editor.
export const SITE_PART_SET_PLUGINS: Plugin<Config<SitePartComponents>>[] = [
  { name: 'sets', label: '세트', icon: <Layers3 size={20} />, render: SitePartSets },
  { name: 'blocks', label: '블록', icon: <Plus size={20} />, render: Puck.Components },
  { name: 'outline', label: '구조', icon: <ListTree size={20} />, render: Puck.Outline },
];

export function SitePartSetTools(): React.ReactElement {
  const { dirty, onViewport } = useSetLayout();
  const { appState, dispatch } = usePuck<Config<SitePartComponents>>();
  const history = useSitePartHistory();
  const currentWidth = appState.ui.viewports.current.width;
  const width = typeof currentWidth === 'number' ? currentWidth : 1280;
  const viewport = width <= 360 ? 'mobile' : width <= 768 ? 'tablet' : 'desktop';
  useEffect(() => onViewport(viewport), [onViewport, viewport]);
  const selectViewport = (next: number): void => {
    dispatch({ type: 'setUi', ui: { viewports: { ...appState.ui.viewports, current: { width: next, height: 'auto' }, controlsVisible: false } }, recordHistory: false });
  };
  return <div ref={history.ref} className="g7pb-site-part-set-tools" data-testid="page-builder-site-part-set-layout">
    <div className="g7pb-site-part-set-history" aria-label="편집 도구">
      <button type="button" title="왼쪽 패널 열기·닫기" aria-label="왼쪽 패널 열기·닫기" aria-expanded={appState.ui.leftSideBarVisible} onClick={() => dispatch({ type: 'setUi', ui: { leftSideBarVisible: !appState.ui.leftSideBarVisible }, recordHistory: false })}><PanelLeft size={18} /></button>
      <button type="button" title="오른쪽 설정 열기·닫기" aria-label="오른쪽 설정 열기·닫기" aria-expanded={appState.ui.rightSideBarVisible} onClick={() => dispatch({ type: 'setUi', ui: { rightSideBarVisible: !appState.ui.rightSideBarVisible }, recordHistory: false })}><PanelRight size={18} /></button>
      <button type="button" title="실행 취소 (⌘/Ctrl+Z)" aria-label="실행 취소" disabled={!history.canUndo} onClick={history.undo}><Undo2 size={18} /></button>
      <button type="button" title="다시 실행 (⌘/Ctrl+Shift+Z)" aria-label="다시 실행" disabled={!history.canRedo} onClick={history.redo}><Redo2 size={18} /></button>
    </div>
    <div className="g7pb-site-part-viewports" aria-label="반응형 화면">
      <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => selectViewport(360)}><Smartphone size={16} /> 모바일</button>
      <button type="button" aria-pressed={viewport === 'tablet'} onClick={() => selectViewport(768)}><Tablet size={16} /> 태블릿</button>
      <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => selectViewport(1280)}><Monitor size={16} /> PC</button>
    </div>
    <span className="g7pb-site-part-set-tools__status">{viewport === 'desktop' ? (dirty ? '저장할 변경 있음' : 'PC 편집 모드') : '모바일·태블릿은 확인 전용 · 편집은 PC에서 지원'}</span>
  </div>;
}

export function SitePartSetFields({ children }: { children: React.ReactNode }): React.ReactElement {
  const { appState } = usePuck<Config<SitePartComponents>>();
  const width = appState.ui.viewports.current.width;
  return <div aria-label="선택한 블록 설정">
    {typeof width === 'number' && width <= 768 ? <div className="g7pb-site-part-set-layout__preview-only"><strong>확인 전용 화면입니다.</strong><span>PC로 돌아가 블록 내용을 편집하세요.</span></div> : children}
  </div>;
}
