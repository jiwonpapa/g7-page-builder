import { createUsePuck, type Config } from '@puckeditor/core';
import React, { useCallback, useMemo, useState } from 'react';
import { PageBuilderApiClient } from '../api/pageBuilderApi';
import { cloneLayoutSubtree } from '../documents/layoutTree';
import type { PageBuilderBlock, SectionPatternResource } from '../documents/types';
import { EditorPortal } from './EditorPortal';
import type { PageDesignProps } from './pageDesignTokens';
import { canonicalBlockToPuck, idToUuid } from './puckBlockCodec';
import { editorInsertionDestination, editorItemLocations } from './puckEditorSelection';
import type { EditorComponents, PuckEditorData } from './puckEditorTypes';

const usePageBuilderPuck = createUsePuck<Config<EditorComponents, PageDesignProps>>();

export function SectionPatternControls({
  disabled,
  resolveSection,
}: {
  disabled: boolean;
  resolveSection: (block: PuckEditorData['content'][number]) => PageBuilderBlock;
}): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const selectedSection = selectedZone === 'root:default-zone' && selectedIndex !== null
    && data.content[selectedIndex]?.type === 'LayoutSection'
    ? data.content[selectedIndex] : null;
  const [dialog, setDialog] = useState<'save' | 'library' | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('custom');
  const [patterns, setPatterns] = useState<SectionPatternResource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPatterns = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setPatterns((await api.listSectionPatterns()).items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '내 패턴을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [api]);

  const openLibrary = (): void => {
    setDialog('library');
    void loadPatterns();
  };
  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedSection) return;
    setBusy(true);
    setError(null);
    try {
      const pattern = await api.createSectionPattern({
        title: title.trim(),
        category,
        source_document_schema: 'g7-page-builder/v2',
        section: resolveSection(selectedSection),
      });
      setPatterns((current) => [pattern, ...current.filter((item) => item.pattern_id !== pattern.pattern_id)]);
      setTitle('');
      setDialog('library');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '선택한 구역을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const insertPattern = (pattern: SectionPatternResource): void => {
    if (!pattern.compatible) return;
    const freshSection = cloneLayoutSubtree(pattern.section, () => (
      globalThis.crypto?.randomUUID?.() ?? idToUuid(`pattern:${pattern.pattern_id.replaceAll('-', '')}:${Date.now()}:${Math.random()}`)
    ));
    const puckSection = canonicalBlockToPuck(freshSection);
    let destinationIndex: number;
    try {
      destinationIndex = editorInsertionDestination(data,
        selectedZone === 'root:default-zone' && selectedIndex !== null ? { index: selectedIndex, zone: selectedZone } : null,
        'LayoutSection', editorItemLocations({ content: [puckSection] }).length).index;
    } catch {
      setError('이 구역을 추가하면 문서의 블럭 수 제한을 초과합니다. 일부 블럭을 정리한 뒤 다시 시도해 주세요.');
      return;
    }
    const content = [...data.content];
    content.splice(destinationIndex, 0, puckSection);
    dispatch({
      type: 'setData',
      data: { content },
      recordHistory: true,
    });
    dispatch({
      type: 'setUi',
      ui: { itemSelector: { index: destinationIndex, zone: 'root:default-zone' } },
      recordHistory: false,
    });
    setDialog(null);
  };
  const deletePattern = async (patternId: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteSectionPattern(patternId);
      setPatterns((current) => current.filter((item) => item.pattern_id !== patternId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '내 패턴을 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" className="g7pb-button g7pb-button--quiet"
      data-testid="page-builder-save-section-pattern" disabled={disabled || !selectedSection}
      title={selectedSection ? '선택한 Section 전체를 저장합니다.' : '저장할 Section을 먼저 선택하세요.'}
      onClick={() => { setError(null); setDialog('save'); }}>선택 구역 저장</button>
    <button type="button" className="g7pb-button g7pb-button--quiet"
      data-testid="page-builder-section-patterns" disabled={disabled} onClick={openLibrary}>내 패턴</button>
    {dialog && <EditorPortal>
      <div className="g7pb-dialog-backdrop" data-testid="page-builder-section-pattern-dialog">
        <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-pattern-heading">
          <p className="g7pb-kicker">{dialog === 'save' ? '선택한 Section' : '재사용 구역'}</p>
          <h2 id="g7pb-pattern-heading">{dialog === 'save' ? '내 패턴으로 저장' : '내 패턴'}</h2>
          {error && <p role="alert">{error}</p>}
          {dialog === 'save' ? <form onSubmit={(event) => void save(event)}>
            <label>패턴 이름<input value={title} required maxLength={120} autoFocus
              data-testid="page-builder-pattern-title" onChange={(event) => setTitle(event.currentTarget.value)} /></label>
            <label>분류<select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
              <option value="custom">사용자 구역</option><option value="hero">첫 화면</option>
              <option value="content">본문</option><option value="conversion">전환</option>
            </select></label>
            <p>HTML이 아니라 현재 canonical Section subtree를 저장합니다. 이미 삽입한 구역과 이후 수정은 서로 동기화되지 않습니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setDialog(null)}>취소</button>
              <button type="submit" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-pattern-save-confirm" disabled={busy}>{busy ? '저장 중' : '저장'}</button>
            </div>
          </form> : <>
            {busy && patterns.length === 0 ? <p role="status">내 패턴을 불러오는 중입니다.</p> : null}
            {!busy && patterns.length === 0 ? <p>저장한 구역이 없습니다. Section을 선택한 뒤 `선택 구역 저장`을 사용하세요.</p> : null}
            {patterns.map((pattern) => <article key={pattern.pattern_id} data-testid="page-builder-pattern-item">
              <div><strong>{pattern.title}</strong><span>{pattern.category} · {pattern.preview.block_count}개 블록</span></div>
              {!pattern.compatible ? <p role="status">{pattern.compatibility_error}</p> : null}
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet" disabled={busy}
                  onClick={() => void deletePattern(pattern.pattern_id)}>삭제</button>
                <button type="button" className="g7pb-button g7pb-button--primary" disabled={busy || !pattern.compatible}
                  data-testid="page-builder-pattern-insert" onClick={() => insertPattern(pattern)}>독립 복사본 삽입</button>
              </div>
            </article>)}
            <div className="g7pb-dialog__actions"><button type="button" className="g7pb-button g7pb-button--quiet"
              onClick={() => setDialog(null)}>닫기</button></div>
          </>}
        </section>
      </div>
    </EditorPortal>}
  </>;
}
