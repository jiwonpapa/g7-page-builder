import React, { useEffect, useRef, useState } from 'react';
import type { PageBuilderApiClient, DocumentResource, MediaAssetResource } from '../api/pageBuilderApi';
import type { PageSeoMetadata, PageShellMode } from '../documents/types';

export function useManagerMetadata({ api, documents, onUpdated, onError, onMessage }: {
  api: PageBuilderApiClient; documents: DocumentResource[]; onUpdated: (resource: DocumentResource) => void;
  onError: (error: unknown) => void; onMessage: (message: string | null) => void;
}) {
  const [target, setTarget] = useState<DocumentResource | null>(null);
  const metadataDocument = documents.find(item => item.document.document_id === target?.document.document_id) ?? target;
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataSlug, setMetadataSlug] = useState('');
  const [metadataShellMode, setMetadataShellMode] = useState<PageShellMode>('template');
  const [metadataSeoTitle, setMetadataSeoTitle] = useState('');
  const [metadataSeoDescription, setMetadataSeoDescription] = useState('');
  const [metadataSeoImage, setMetadataSeoImage] = useState('');
  const [metadataSeoRobots, setMetadataSeoRobots] = useState<PageSeoMetadata['robots']>('index');
  const [metadataMediaOpen, setMetadataMediaOpen] = useState(false);
  const [metadataMedia, setMetadataMedia] = useState<MediaAssetResource[]>([]);
  const [metadataMediaLoading, setMetadataMediaLoading] = useState(false);
  const metadataMediaFileRef = useRef<HTMLInputElement>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [unpublishDocument, updateUnpublishDocument] = useState<DocumentResource | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const owner = useRef({ active: false, generation: 0 });
  const session = useRef(0); const mediaRequest = useRef(0); const saveRequest = useRef(0); const unpublishRequest = useRef(0);
  const saveBusy = useRef(false); const unpublishBusy = useRef(false);
  useEffect(() => {
    owner.current.active = true; owner.current.generation += 1;
    return () => { owner.current.active = false; owner.current.generation += 1; session.current += 1; };
  }, [api]);
  const capture = () => {
    const generation = owner.current.generation; const opened = session.current;
    const alive = () => owner.current.active && owner.current.generation === generation;
    return { alive, current: () => alive() && session.current === opened };
  };
  const closeMetadata = (): void => {
    session.current += 1; mediaRequest.current += 1; saveRequest.current += 1; unpublishRequest.current += 1;
    saveBusy.current = false; unpublishBusy.current = false;
    setTarget(null); updateUnpublishDocument(null); setSavingMetadata(false); setUnpublishing(false); setMetadataMediaLoading(false); setMetadataMediaOpen(false);
  };
  const openMetadataDialog = (resource: DocumentResource): void => {
    closeMetadata();
    const seo = resource.document.seo;
    setTarget(resource); setMetadataTitle(resource.title); setMetadataSlug(resource.document.slug);
    setMetadataShellMode(resource.document.shell_mode ?? 'template'); setMetadataSeoTitle(seo?.title ?? '');
    setMetadataSeoDescription(seo?.description ?? ''); setMetadataSeoImage(seo?.og_image_url ?? ''); setMetadataSeoRobots(seo?.robots ?? 'index'); onMessage(null);
  };
  const openMetadataMedia = async (): Promise<void> => {
    const nextOpen = !metadataMediaOpen; setMetadataMediaOpen(nextOpen);
    if (!nextOpen || metadataMedia.length > 0) return;
    const operation = capture(); const sequence = ++mediaRequest.current;
    const current = () => operation.current() && mediaRequest.current === sequence;
    setMetadataMediaLoading(true);
    try { const media = await api.listMedia(); if (current()) setMetadataMedia(media.items); }
    catch (error) { if (current()) onError(error); }
    finally { if (current()) setMetadataMediaLoading(false); }
  };
  const uploadMetadataMedia = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
    if (!file || !metadataDocument || !owner.current.active) return;
    const operation = capture(); const sequence = ++mediaRequest.current;
    const current = () => operation.current() && mediaRequest.current === sequence;
    setMetadataMediaLoading(true);
    try {
      const asset = await api.uploadMedia(file);
      if (current()) { setMetadataMedia(items => [asset, ...items.filter(item => item.id !== asset.id)]); setMetadataSeoImage(asset.url); setMetadataMediaOpen(false); }
    } catch (error) { if (current()) onError(error); }
    finally { if (current()) setMetadataMediaLoading(false); }
  };
  const updateMetadata = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); if (!metadataDocument || saveBusy.current || !owner.current.active) return;
    const title = metadataTitle.trim(); const slug = metadataSlug.trim();
    if (!title) { onMessage('페이지 제목을 입력해 주세요.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { onMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'); return; }
    const operation = capture(); const sequence = ++saveRequest.current; const documentId = metadataDocument.document.document_id;
    const current = () => operation.current() && saveRequest.current === sequence;
    saveBusy.current = true; setSavingMetadata(true); onMessage(null);
    try {
      const updated = await api.updateDocument(documentId, { title, slug, locale: metadataDocument.document.locale,
        shell_mode: metadataShellMode, seo: { title: metadataSeoTitle.trim(), description: metadataSeoDescription.trim(), og_image_url: metadataSeoImage.trim(), robots: metadataSeoRobots }, expected_lock_version: metadataDocument.lock_version });
      if (updated.document.document_id !== documentId) throw new Error('저장 응답의 문서가 요청한 문서와 다릅니다.');
      // A completed server mutation belongs to the list even after its dialog closes.
      if (operation.alive()) onUpdated(updated);
      if (current()) closeMetadata();
    } catch (error) { if (current()) onError(error); }
    finally { if (current()) { saveBusy.current = false; setSavingMetadata(false); } }
  };
  const setUnpublishDocument = (resource: DocumentResource | null): void => {
    unpublishRequest.current += 1; unpublishBusy.current = false; setUnpublishing(false); updateUnpublishDocument(resource);
  };
  const confirmUnpublish = async (): Promise<void> => {
    if (!unpublishDocument || unpublishBusy.current || !owner.current.active) return;
    const documentId = unpublishDocument.document.document_id; const operation = capture(); const sequence = ++unpublishRequest.current;
    const current = () => operation.current() && unpublishRequest.current === sequence;
    unpublishBusy.current = true; setUnpublishing(true); onMessage(null);
    try {
      const updated = await api.unpublishDocument(documentId, unpublishDocument.lock_version);
      if (updated.document.document_id !== documentId) throw new Error('공개 해제 응답의 문서가 요청한 문서와 다릅니다.');
      if (operation.alive()) onUpdated(updated);
      if (current()) { setTarget(updated); setUnpublishDocument(null); }
    } catch (error) { if (current()) onError(error); }
    finally { if (current()) { unpublishBusy.current = false; setUnpublishing(false); } }
  };
  return { metadataDocument, openMetadataDialog, closeMetadata, metadataTitle, setMetadataTitle, metadataSlug, setMetadataSlug,
    metadataShellMode, setMetadataShellMode, metadataSeoTitle, setMetadataSeoTitle, metadataSeoDescription, setMetadataSeoDescription,
    metadataSeoImage, setMetadataSeoImage, metadataSeoRobots, setMetadataSeoRobots, metadataMediaOpen, setMetadataMediaOpen,
    metadataMedia, metadataMediaLoading, metadataMediaFileRef, openMetadataMedia, uploadMetadataMedia, savingMetadata, updateMetadata,
    unpublishDocument, setUnpublishDocument, unpublishing, confirmUnpublish };
}
