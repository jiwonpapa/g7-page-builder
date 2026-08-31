import React, { createContext, useContext, useEffect } from 'react';
import { usePuck, type Config } from '@puckeditor/core';
import { PanelLeft, PanelRight, Redo2, Undo2 } from 'lucide-react';
import type { SitePartComponents, SitePartPuckData } from './sitePartDocumentAdapter';
import { useSitePartHistory } from './useSitePartHistory';

type PresetCommand = (data: SitePartPuckData) => void;
export const SitePartEditorCommands = createContext<React.RefObject<PresetCommand | null> | null>(null);

/** Bridge the external preset bar to Puck's public data/history API, without remounting it. */
export function SitePartEditorTools(): React.ReactElement {
  const command = useContext(SitePartEditorCommands);
  const { appState, dispatch } = usePuck<Config<SitePartComponents>>();
  const history = useSitePartHistory();
  useEffect(() => {
    if (!command) return;
    command.current = (data) => dispatch({ type: 'setData', data, recordHistory: true });
    return () => { command.current = null; };
  }, [command, dispatch]);
  return <div ref={history.ref} className="g7pb-site-part-set-tools" data-testid="page-builder-site-part-tools">
    <div className="g7pb-site-part-set-history" aria-label="편집 도구">
      <button type="button" title="왼쪽 패널 열기·닫기" aria-label="왼쪽 패널 열기·닫기" aria-expanded={appState.ui.leftSideBarVisible} onClick={() => dispatch({ type: 'setUi', ui: { leftSideBarVisible: !appState.ui.leftSideBarVisible }, recordHistory: false })}><PanelLeft size={18} /></button>
      <button type="button" title="오른쪽 설정 열기·닫기" aria-label="오른쪽 설정 열기·닫기" aria-expanded={appState.ui.rightSideBarVisible} onClick={() => dispatch({ type: 'setUi', ui: { rightSideBarVisible: !appState.ui.rightSideBarVisible }, recordHistory: false })}><PanelRight size={18} /></button>
      <button type="button" title="실행 취소 (⌘/Ctrl+Z)" aria-label="실행 취소" disabled={!history.canUndo} onClick={history.undo}><Undo2 size={18} /></button>
      <button type="button" title="다시 실행 (⌘/Ctrl+Shift+Z)" aria-label="다시 실행" disabled={!history.canRedo} onClick={history.redo}><Redo2 size={18} /></button>
    </div>
    <span className="g7pb-site-part-set-tools__status">PC 기본 편집 · 태블릿/모바일은 기기별 표시</span>
  </div>;
}
