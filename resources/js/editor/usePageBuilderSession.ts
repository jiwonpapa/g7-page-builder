import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LAYOUT_SECTION_BLOCK_TYPE, type PageBuilderBlock } from '../documents/types';
import { activateStructureEditing, canonicalToPuck, puckBlockToCanonical } from './puckBlockCodec';
import { usePuckDocumentBoundary } from './PuckDocumentBoundary';
import type { PuckEditorAdapterProps, PuckEditorData } from './puckEditorTypes';

type SessionOptions = Pick<PuckEditorAdapterProps, 'document' | 'onDirty' | 'onChange'> & { canEdit: boolean };

/** The keyed session owner is the only lifetime in which this initial context is valid. */
export function usePageBuilderSession({ document, canEdit, onDirty, onChange }: SessionOptions) {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const initialSession = useMemo(() => canonicalToPuck(document), []);
  const contextRef = useRef(initialSession.context);
  const { boundary, data, message: documentError, recovering } = usePuckDocumentBoundary(initialSession, {
    context: contextRef, canEdit, onDirty, onChange,
  });
  const editingDisabled = !canEdit || recovering;
  const [structureEditingEnabled, setStructureEditingEnabled] = useState(
    document.schema_version === 'g7-page-builder/v2',
  );
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structureActivationError, setStructureActivationError] = useState<string | null>(null);
  const heroFamilyCount = data.content.filter((block) =>
    block.type === 'Hero' || block.type === 'HeroSplit' || block.type === 'HeroSlider').length;
  const heroWarningKey = `g7pb:warning:${document.document_id}:hero-family:${heroFamilyCount}`;
  const [warningStateVersion, setWarningStateVersion] = useState(0);
  const heroWarningDismissed = useMemo(() => {
    if (heroFamilyCount <= 1 || typeof window === 'undefined') return false;
    try {
      return window.localStorage?.getItem(heroWarningKey) === 'dismissed';
    } catch {
      return false;
    }
  }, [heroFamilyCount, heroWarningKey, warningStateVersion]);

  const dismissHeroWarning = (): void => {
    try {
      window.localStorage?.setItem(heroWarningKey, 'dismissed');
    } catch {
      // Storage can be unavailable in hardened browsers; dismissal still lasts for this render.
    }
    setWarningStateVersion((version) => version + 1);
  };

  const enableStructureEditing = useCallback((): void => {
    if (!live.current || editingDisabled) return;
    try {
      const activated = activateStructureEditing(boundary.currentData(), contextRef.current);
      contextRef.current = activated.context;
      setStructureEditingEnabled(true);
      setStructureDialogOpen(false);
      setStructureActivationError(null);
      onDirty?.();
      onChange(activated.document);
    } catch (error) {
      setStructureActivationError(error instanceof Error
        ? `현재 문서는 구조 편집으로 전환할 수 없습니다. ${error.message}`
        : '현재 문서는 구조 편집으로 전환할 수 없습니다.');
    }
  }, [boundary, editingDisabled, onChange, onDirty]);
  const resolvePatternSection = useCallback((block: PuckEditorData['content'][number]): PageBuilderBlock => {
    const section = puckBlockToCanonical(block, contextRef.current);
    if (section.type !== LAYOUT_SECTION_BLOCK_TYPE) {
      throw new Error('Section 전체만 내 패턴으로 저장할 수 있습니다.');
    }

    return section;
  }, []);

  return { boundary, data, documentError, recovering, editingDisabled, structureEditingEnabled,
    structureDialogOpen, setStructureDialogOpen, structureActivationError, setStructureActivationError,
    enableStructureEditing, resolvePatternSection, heroFamilyCount, heroWarningDismissed, dismissHeroWarning };
}
