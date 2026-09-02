import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_AUTH_TOKEN_KEY, buildAdminLoginUrl, type PageBuilderApiClient, type DocumentResource } from '../api/pageBuilderApi';
import type { PageShellMode } from '../documents/types';
import { duplicateSlug } from './managerDocumentPresentation';

export function useManagerDocuments({ api, locale, onError, onMessage, onCreated }: {
  api: PageBuilderApiClient; locale: string; onError: (error: unknown) => void;
  onMessage: (message: string | null) => void; onCreated: (id: string) => void;
}) {
  const [collection, setCollection] = useState<{ items: DocumentResource[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [documentFilter, updateFilter] = useState<'active' | 'archived'>('active');
  const filter = useRef(documentFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, updateCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createShellMode, setCreateShellMode] = useState<PageShellMode>('template');
  const [duplicateDocument, updateDuplicate] = useState<DocumentResource | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState('');
  const [duplicateSlugValue, setDuplicateSlugValue] = useState('');
  const [archiveDocument, updateArchive] = useState<DocumentResource | null>(null);
  const [purgeDocument, updatePurge] = useState<DocumentResource | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [settingHomeId, setSettingHomeId] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef(new Map<string, symbol>());
  const owner = useRef({ active: false, generation: 0 });
  const request = useRef(0);
  const confirmed = useRef(new Map<string, DocumentResource>());
  const dialog = useRef({ create: 0, duplicate: 0, archive: 0, purge: 0 });

  useEffect(() => {
    owner.current.active = true; owner.current.generation += 1;
    setPendingKeys(new Set()); setSettingHomeId(null);
    return () => { owner.current.active = false; owner.current.generation += 1; request.current += 1; pending.current.clear(); confirmed.current.clear(); };
  }, [api]);

  const retainConfirmed = useCallback((resource: DocumentResource): DocumentResource => {
    const previous = confirmed.current.get(resource.document.document_id);
    if (previous && previous.lock_version > resource.lock_version) return previous;
    confirmed.current.set(resource.document.document_id, resource);
    return resource;
  }, []);
  const belongsTo = (resource: DocumentResource, status: 'active' | 'archived') => (resource.status === 'archived') === (status === 'archived');
  const reloadCurrent = useCallback(async (): Promise<void> => {
    const generation = owner.current.generation; const sequence = ++request.current; const status = filter.current;
    const current = () => owner.current.active && owner.current.generation === generation && request.current === sequence && filter.current === status;
    setLoading(true);
    try {
      const result = await api.listDocuments(1, 100, status);
      if (current()) {
        const items = result.items.map(retainConfirmed).filter(resource => belongsTo(resource, status));
        setCollection({ items, total: Math.max(0, result.pagination.total - (result.items.length - items.length)) }); onMessage(null);
      }
    } catch (error) { if (current()) onError(error); }
    finally { if (current()) setLoading(false); }
  }, [api, onError, onMessage, retainConfirmed]);
  useEffect(() => {
    let token: string | null = null;
    try { token = window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY); } catch { /* Login handles unavailable storage. */ }
    if (!token) {
      window.location.assign(buildAdminLoginUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`));
      return;
    }
    void reloadCurrent();
    return () => { request.current += 1; };
  }, [api, documentFilter, reloadCurrent]);
  const setDocumentFilter = (next: 'active' | 'archived'): void => {
    if (filter.current === next) return;
    filter.current = next; request.current += 1; updateFilter(next);
  };
  const replaceResource = useCallback((resource: DocumentResource): void => {
    if (!owner.current.active) return;
    const latest = retainConfirmed(resource);
    setCollection(current => {
      const items = current.items.map(item => item.document.document_id === latest.document.document_id ? latest : item)
        .filter(item => belongsTo(item, filter.current));
      return { items, total: Math.max(0, current.total - (current.items.length - items.length)) };
    });
  }, [retainConfirmed]);
  const visibleDocuments = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko');
    return query ? collection.items.filter(resource => resource.title.toLocaleLowerCase('ko').includes(query)
      || resource.document.slug.toLocaleLowerCase('ko').includes(query)) : collection.items;
  }, [collection.items, searchQuery]);
  const begin = (key: string) => {
    if (!owner.current.active || pending.current.has(key)) return null;
    const generation = owner.current.generation; const token = Symbol(key);
    pending.current.set(key, token); setPendingKeys(new Set(pending.current.keys())); onMessage(null);
    const current = () => owner.current.active && owner.current.generation === generation && pending.current.get(key) === token;
    return { current, finish: () => { if (current()) { pending.current.delete(key); setPendingKeys(new Set(pending.current.keys())); } } };
  };
  const setCreateDialogOpen = (open: boolean): void => { dialog.current.create += 1; updateCreateOpen(open); };
  const setDuplicateDocument = (value: DocumentResource | null): void => { dialog.current.duplicate += 1; updateDuplicate(value); };
  const setArchiveDocument = (value: DocumentResource | null): void => { dialog.current.archive += 1; updateArchive(value); };
  const setPurgeDocument = (value: DocumentResource | null): void => { dialog.current.purge += 1; updatePurge(value); };
  const validInput = (title: string, slug: string, duplicate = false): boolean => {
    if (!title) { onMessage(duplicate ? '복제본 제목을 입력해 주세요.' : '페이지 제목을 입력해 주세요.'); return false; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { onMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'); return false; }
    return true;
  };
  const createDocument = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); const title = createTitle.trim(); const slug = createSlug.trim();
    if (!validInput(title, slug)) return;
    const operation = begin('create'); if (!operation) return;
    const session = dialog.current.create;
    try {
      const created = await api.createDocument({ title, slug, locale, shell_mode: createShellMode });
      if (!operation.current()) return;
      if (dialog.current.create === session) onCreated(created.document.document_id); else await reloadCurrent();
    } catch (error) { if (operation.current() && dialog.current.create === session) onError(error); }
    finally { operation.finish(); }
  };
  const openDuplicateDialog = (resource: DocumentResource): void => {
    setDuplicateDocument(resource); setDuplicateTitle(`${resource.title} 복사본`);
    setDuplicateSlugValue(duplicateSlug(resource.document.slug)); onMessage(null);
  };
  const submitDuplicate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); if (!duplicateDocument) return;
    const title = duplicateTitle.trim(); const slug = duplicateSlugValue.trim();
    if (!validInput(title, slug, true)) return;
    const operation = begin('duplicate'); if (!operation) return;
    const session = dialog.current.duplicate;
    try {
      const copy = await api.duplicateDocument(duplicateDocument.document.document_id, { title, slug, expected_lock_version: duplicateDocument.lock_version });
      if (!operation.current()) return;
      if (dialog.current.duplicate === session) onCreated(copy.document.document_id); else await reloadCurrent();
    } catch (error) { if (operation.current() && dialog.current.duplicate === session) onError(error); }
    finally { operation.finish(); }
  };
  const toggleHome = async (resource: DocumentResource): Promise<void> => {
    const operation = begin('home'); if (!operation) return;
    setSettingHomeId(resource.document.document_id);
    try {
      const updated = await api.setHomeDocument(resource.document.document_id, !resource.is_home, resource.lock_version);
      if (operation.current()) { replaceResource(updated); await reloadCurrent(); }
    } catch (error) { if (operation.current()) onError(error); }
    finally { if (operation.current()) setSettingHomeId(null); operation.finish(); }
  };
  const confirmArchive = async (): Promise<void> => {
    if (!archiveDocument) return;
    const operation = begin('lifecycle'); if (!operation) return;
    const session = dialog.current.archive;
    try {
      const archived = await api.archiveDocument(archiveDocument.document.document_id, archiveDocument.lock_version);
      if (!operation.current()) return;
      replaceResource(archived);
      if (dialog.current.archive === session) setArchiveDocument(null);
      await reloadCurrent();
    } catch (error) { if (operation.current() && dialog.current.archive === session) onError(error); }
    finally { operation.finish(); }
  };
  const restoreArchived = async (resource: DocumentResource): Promise<void> => {
    const operation = begin('lifecycle'); if (!operation) return;
    try {
      const restored = await api.restoreArchivedDocument(resource.document.document_id, resource.lock_version);
      if (operation.current()) { replaceResource(restored); await reloadCurrent(); }
    } catch (error) { if (operation.current()) onError(error); }
    finally { operation.finish(); }
  };
  const confirmPurge = async (): Promise<void> => {
    if (!purgeDocument || purgeConfirmation !== purgeDocument.document.slug) return;
    const operation = begin('lifecycle'); if (!operation) return;
    const session = dialog.current.purge;
    try {
      await api.purgeDocument(purgeDocument.document.document_id, purgeDocument.lock_version, purgeConfirmation);
      if (!operation.current()) return;
      if (dialog.current.purge === session) { setPurgeDocument(null); setPurgeConfirmation(''); }
      await reloadCurrent();
    } catch (error) { if (operation.current() && dialog.current.purge === session) onError(error); }
    finally { operation.finish(); }
  };
  return { documents: collection.items, totalDocuments: collection.total, loading, documentFilter, setDocumentFilter, searchQuery, setSearchQuery,
    visibleDocuments, replaceResource, createDialogOpen, setCreateDialogOpen, createTitle, setCreateTitle, createSlug, setCreateSlug,
    createShellMode, setCreateShellMode, creating: pendingKeys.has('create'), createDocument, duplicateDocument, setDuplicateDocument,
    duplicateTitle, setDuplicateTitle, duplicateSlugValue, setDuplicateSlugValue, duplicating: pendingKeys.has('duplicate'), openDuplicateDialog, submitDuplicate,
    archiveDocument, setArchiveDocument, purgeDocument, setPurgeDocument, purgeConfirmation, setPurgeConfirmation,
    lifecycleBusy: pendingKeys.has('lifecycle'), confirmArchive, restoreArchived, confirmPurge, settingHomeId, toggleHome };
}
