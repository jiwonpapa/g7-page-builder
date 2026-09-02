import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PageBuilderApiClient, DocumentResource } from '../api/pageBuilderApi';
import type { OfficialStoreCatalogResource, OfficialStoreProduct } from '../store/types';

export function useManagerStore({ api, onError, onMessage, onCreated, onPackInstalled }: {
  api: PageBuilderApiClient;
  onError: (error: unknown) => void;
  onMessage: (message: string | null) => void;
  onCreated: (documentId: string) => void;
  onPackInstalled: () => Promise<boolean>;
}) {
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeCatalog, setStoreCatalog] = useState<OfficialStoreCatalogResource | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeBusy, setStoreBusy] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [storeType, setStoreType] = useState<'all' | OfficialStoreProduct['product_type']>('all');
  const [pageKitProduct, setPageKitProduct] = useState<OfficialStoreProduct | null>(null);
  const [pageKitTitle, setPageKitTitle] = useState('');
  const [pageKitSlug, setPageKitSlug] = useState('');
  const [exportDocument, setExportDocument] = useState<DocumentResource | null>(null);
  const [exportKitId, setExportKitId] = useState('jiwonpapa/');
  const [exportKitVersion, setExportKitVersion] = useState('1.0.0');
  const [exportTitle, setExportTitle] = useState('');
  const [exportDescription, setExportDescription] = useState('');
  const [exporting, setExporting] = useState(false);
  const owner = useRef({ active: false, generation: 0 });
  const catalogRequest = useRef(0);
  const storeOperation = useRef(0);
  const exportOperation = useRef(0);
  const busy = useRef(false);
  const exportBusy = useRef(false);

  const loadOfficialStore = async (): Promise<boolean> => {
    const generation = owner.current.generation;
    const request = ++catalogRequest.current;
    const current = () => owner.current.active && owner.current.generation === generation && catalogRequest.current === request;
    setStoreLoading(true);
    onMessage(null);
    try {
      const catalog = await api.getOfficialStoreCatalog();
      if (!current()) return false;
      setStoreCatalog(catalog);
      return true;
    } catch (error) {
      if (current()) onError(error);
      return false;
    } finally {
      if (current()) setStoreLoading(false);
    }
  };

  const closeStore = (): void => {
    catalogRequest.current += 1;
    setStoreOpen(false);
    setStoreLoading(false);
  };
  const openPageKits = (): void => {
    setStoreOpen(true);
    setStoreQuery('');
    setStoreType('page_kit');
    void loadOfficialStore();
  };

  useEffect(() => {
    owner.current.active = true;
    owner.current.generation += 1;
    if (new URLSearchParams(window.location.search).get('view') === 'page-kits') openPageKits();
    return () => {
      owner.current.active = false;
      owner.current.generation += 1;
      catalogRequest.current += 1;
      storeOperation.current += 1;
      exportOperation.current += 1;
      busy.current = false;
      exportBusy.current = false;
    };
  }, [api]);

  const visibleStoreProducts = useMemo(() => {
    const query = storeQuery.trim().toLocaleLowerCase('ko');
    return (storeCatalog?.products ?? []).filter((product) => {
      if (storeType !== 'all' && product.product_type !== storeType) return false;
      return !query || [product.title.ko, product.description.ko, product.category, ...product.tags]
        .some(value => value.toLocaleLowerCase('ko').includes(query));
    });
  }, [storeCatalog, storeQuery, storeType]);

  const beginOperation = (identity: string) => {
    if (!owner.current.active || busy.current) return null;
    busy.current = true;
    const generation = owner.current.generation;
    const operation = ++storeOperation.current;
    const current = () => owner.current.active && owner.current.generation === generation && storeOperation.current === operation;
    setStoreBusy(identity);
    onMessage(null);
    return { current, finish: () => { if (current()) { busy.current = false; setStoreBusy(null); } } };
  };

  const installStoreBlockPack = async (product: OfficialStoreProduct): Promise<void> => {
    const operation = beginOperation(`${product.product_id}@${product.product_version}`);
    if (!operation) return;
    try {
      await api.installOfficialStoreBlockPack(product.product_id, product.product_version);
      if (!operation.current()) return;
      const catalogReady = await loadOfficialStore();
      if (!operation.current()) return;
      const packsReady = await onPackInstalled();
      if (operation.current() && catalogReady && packsReady) {
        onMessage(`${product.title.ko} 설치 완료 · 편집기 상단 ‘블록 추가’의 출처 필터에서 확인할 수 있습니다.`);
      }
    } catch (error) {
      if (operation.current()) onError(error);
    } finally { operation.finish(); }
  };

  const choosePageKit = (product: OfficialStoreProduct): void => {
    const fallback = product.product_id.split('/').at(-1) ?? 'page-kit';
    setPageKitProduct(product);
    setPageKitTitle(product.title.ko);
    setPageKitSlug(fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page-kit');
    closeStore();
  };
  const backToCatalog = (): void => { setPageKitProduct(null); setStoreOpen(true); };
  const applyPageKit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!pageKitProduct) return;
    const title = pageKitTitle.trim();
    const slug = pageKitSlug.trim();
    if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      onMessage('페이지 제목과 영문 소문자·숫자·하이픈 주소를 확인해 주세요.');
      return;
    }
    const operation = beginOperation(`${pageKitProduct.product_id}@${pageKitProduct.product_version}`);
    if (!operation) return;
    try {
      const resource = await api.applyOfficialStorePageKit({ product_id: pageKitProduct.product_id, product_version: pageKitProduct.product_version, title, slug });
      if (operation.current()) onCreated(resource.document.document_id);
    } catch (error) {
      if (operation.current()) onError(error);
      operation.finish();
    }
  };

  const openPageKitExport = (resource: DocumentResource): void => {
    setExportDocument(resource);
    setExportKitId(`jiwonpapa/${resource.document.slug}`);
    setExportKitVersion('1.0.0');
    setExportTitle(resource.title);
    setExportDescription(`${resource.title} Page Kit`);
    onMessage(null);
  };
  const closeExport = (): void => { if (!exportBusy.current) setExportDocument(null); };
  const exportPageKit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!exportDocument || exportBusy.current || !owner.current.active) return;
    const generation = owner.current.generation;
    const operation = ++exportOperation.current;
    const current = () => owner.current.active && owner.current.generation === generation && exportOperation.current === operation;
    exportBusy.current = true;
    setExporting(true);
    onMessage(null);
    try {
      const result = await api.downloadPageKit(exportDocument.document.document_id, {
        kit_id: exportKitId.trim(), kit_version: exportKitVersion.trim(), title: exportTitle.trim(), description: exportDescription.trim(),
      });
      if (!current()) return;
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      try {
        anchor.href = url;
        anchor.download = result.filename;
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(url);
      }
      setExportDocument(null);
      onMessage(result.sha256 ? `Page Kit 배포 ZIP을 만들었습니다. SHA-256 ${result.sha256.slice(0, 12)}…` : 'Page Kit 배포 ZIP을 만들었습니다.');
    } catch (error) {
      if (current()) onError(error);
    } finally {
      if (current()) { exportBusy.current = false; setExporting(false); }
    }
  };

  return { storeOpen, closeStore, openPageKits, storeLoading, storeBusy, storeQuery, setStoreQuery, storeType, setStoreType,
    visibleStoreProducts, installStoreBlockPack, choosePageKit, pageKitProduct, pageKitTitle, setPageKitTitle,
    pageKitSlug, setPageKitSlug, applyPageKit, backToCatalog, exportDocument, openPageKitExport, closeExport,
    exportKitId, setExportKitId, exportKitVersion, setExportKitVersion, exportTitle, setExportTitle,
    exportDescription, setExportDescription, exporting, exportPageKit };
}
