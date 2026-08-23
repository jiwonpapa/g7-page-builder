import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Archive,
  Copy,
  Download,
  ExternalLink,
  History,
  Home,
  ImagePlus,
  LayoutTemplate,
  Inbox,
  MoreHorizontal,
  PackagePlus,
  PanelBottom,
  PanelTop,
  Pencil,
  Settings,
  ShoppingBag,
} from 'lucide-react';

import {
  ADMIN_AUTH_TOKEN_KEY,
  PAGE_BUILDER_EDITOR_PATH,
  PageBuilderApiClient,
  PageBuilderApiError,
  buildAdminLoginUrl,
} from '../api/pageBuilderApi';
import type {
  DocumentResource,
  FormSubmissionResource,
  MediaAssetResource,
  PageSeoMetadata,
  PageShellMode,
  RevisionSummary,
} from '../documents/types';
import type { BlockPackResource, GitHubBlockPackCheckResource } from '../blocks/types';
import type { OfficialStoreCatalogResource, OfficialStoreProduct } from '../store/types';

interface PageBuilderManagerOptions {
  locale?: string;
}

const roots = new WeakMap<Element, Root>();

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function hasAdminToken(): boolean {
  try {
    return Boolean(window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY));
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) {
    return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  }

  return error instanceof Error ? error.message : '문서 목록을 불러오지 못했습니다.';
}

function editorUrl(documentId: string): string {
  return `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(documentId)}`;
}

function formatRevisionDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function formatDocumentDate(value: string | null): string {
  return value ? formatRevisionDate(value) : '기록 없음';
}

function duplicateSlug(slug: string): string {
  const base = slug.slice(0, 115).replace(/-+$/, '');

  return `${base || 'page'}-copy`;
}

const DOCUMENT_STATUS_LABELS: Record<DocumentResource['status'], string> = {
  draft: '초안',
  published: '발행됨',
  published_with_changes: '발행 후 변경',
  archived: '보관됨',
};

export function PageBuilderManager({ locale = 'ko' }: PageBuilderManagerOptions): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [documents, setDocuments] = useState<DocumentResource[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createShellMode, setCreateShellMode] = useState<PageShellMode>('template');
  const [creating, setCreating] = useState(false);
  const [metadataDocument, setMetadataDocument] = useState<DocumentResource | null>(null);
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
  const [duplicateDocument, setDuplicateDocument] = useState<DocumentResource | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState('');
  const [duplicateSlugValue, setDuplicateSlugValue] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [actionMenuDocumentId, setActionMenuDocumentId] = useState<string | null>(null);
  const [revisionDocument, setRevisionDocument] = useState<DocumentResource | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [currentRevision, setCurrentRevision] = useState(0);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [previewingRevision, setPreviewingRevision] = useState<number | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<RevisionSummary | null>(null);
  const [restoringRevision, setRestoringRevision] = useState(false);
  const [unpublishDocument, setUnpublishDocument] = useState<DocumentResource | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const [settingHomeId, setSettingHomeId] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveDocument, setArchiveDocument] = useState<DocumentResource | null>(null);
  const [purgeDocument, setPurgeDocument] = useState<DocumentResource | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [blockPacksOpen, setBlockPacksOpen] = useState(false);
  const [blockPacks, setBlockPacks] = useState<BlockPackResource[]>([]);
  const [blockPacksLoading, setBlockPacksLoading] = useState(false);
  const [blockPackBusy, setBlockPackBusy] = useState<string | null>(null);
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepository, setGithubRepository] = useState('');
  const [githubAssetName, setGithubAssetName] = useState('g7pb-block-pack.zip');
  const [githubCheck, setGithubCheck] = useState<GitHubBlockPackCheckResource | null>(null);
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
  const [inboxOpen, setInboxOpen] = useState(false);
  const [submissions, setSubmissions] = useState<FormSubmissionResource[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxBusy, setInboxBusy] = useState<string | null>(null);

  const openInbox = async (): Promise<void> => {
    setInboxOpen(true);
    setInboxLoading(true);
    try {
      setSubmissions((await api.listFormSubmissions()).items);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setInboxLoading(false);
    }
  };

  const setSubmissionStatus = async (submission: FormSubmissionResource, status: FormSubmissionResource['status']): Promise<void> => {
    setInboxBusy(submission.id);
    try {
      const updated = await api.updateFormSubmission(submission.id, status);
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setInboxBusy(null);
    }
  };

  const retrySubmission = async (submission: FormSubmissionResource): Promise<void> => {
    setInboxBusy(submission.id);
    try {
      const updated = await api.retryFormSubmission(submission.id);
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setInboxBusy(null);
    }
  };

  const loadDocuments = React.useCallback(async (status: 'active' | 'archived'): Promise<void> => {
    const resource = await api.listDocuments(1, 100, status);
    setDocuments(resource.items);
    setTotalDocuments(resource.pagination.total);
  }, [api]);

  useEffect(() => {
    if (!hasAdminToken()) {
      window.location.assign(buildAdminLoginUrl(currentPath()));
      return;
    }

    let active = true;
    setLoading(true);
    void api.listDocuments(1, 100, documentFilter)
      .then((resource) => {
        if (active) {
          setDocuments(resource.items);
          setTotalDocuments(resource.pagination.total);
          setMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(errorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, documentFilter]);

  useEffect(() => {
    if (actionMenuDocumentId === null) {
      return undefined;
    }

    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || !event.target.closest('.g7pb-document-actions-menu')) {
        setActionMenuDocumentId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setActionMenuDocumentId(null);
      }
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [actionMenuDocumentId]);

  const visibleDocuments = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko');
    if (!query) {
      return documents;
    }

    return documents.filter((resource) =>
      resource.title.toLocaleLowerCase('ko').includes(query)
      || resource.document.slug.toLocaleLowerCase('ko').includes(query));
  }, [documents, searchQuery]);

  const visibleStoreProducts = useMemo(() => {
    const query = storeQuery.trim().toLocaleLowerCase('ko');
    return (storeCatalog?.products ?? []).filter((product) => {
      if (storeType !== 'all' && product.product_type !== storeType) return false;
      if (!query) return true;
      return [product.title.ko, product.description.ko, product.category, ...product.tags]
        .some((value) => value.toLocaleLowerCase('ko').includes(query));
    });
  }, [storeCatalog, storeQuery, storeType]);

  const createDocument = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const title = createTitle.trim();
    const slug = createSlug.trim();

    if (!title) {
      setMessage('페이지 제목을 입력해 주세요.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      const resource = await api.createDocument({ title, slug, locale, shell_mode: createShellMode });
      window.location.assign(editorUrl(resource.document.document_id));
    } catch (error) {
      setMessage(errorMessage(error));
      setCreating(false);
    }
  };

  const openMetadataDialog = (resource: DocumentResource): void => {
    const seo = resource.document.seo;
    setMetadataDocument(resource);
    setMetadataTitle(resource.title);
    setMetadataSlug(resource.document.slug);
    setMetadataShellMode(resource.document.shell_mode ?? 'template');
    setMetadataSeoTitle(seo?.title ?? '');
    setMetadataSeoDescription(seo?.description ?? '');
    setMetadataSeoImage(seo?.og_image_url ?? '');
    setMetadataSeoRobots(seo?.robots ?? 'index');
    setMetadataMediaOpen(false);
    setMessage(null);
  };

  const openMetadataMedia = async (): Promise<void> => {
    const nextOpen = !metadataMediaOpen;
    setMetadataMediaOpen(nextOpen);
    if (!nextOpen || metadataMedia.length > 0) return;

    setMetadataMediaLoading(true);
    try {
      setMetadataMedia((await api.listMedia()).items);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setMetadataMediaLoading(false);
    }
  };

  const uploadMetadataMedia = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setMetadataMediaLoading(true);
    try {
      const asset = await api.uploadMedia(file);
      setMetadataMedia((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setMetadataSeoImage(asset.url);
      setMetadataMediaOpen(false);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setMetadataMediaLoading(false);
    }
  };

  const openDuplicateDialog = (resource: DocumentResource): void => {
    setActionMenuDocumentId(null);
    setDuplicateDocument(resource);
    setDuplicateTitle(`${resource.title} 복사본`);
    setDuplicateSlugValue(duplicateSlug(resource.document.slug));
    setMessage(null);
  };

  const submitDuplicate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!duplicateDocument) {
      return;
    }

    const title = duplicateTitle.trim();
    const slug = duplicateSlugValue.trim();
    if (!title) {
      setMessage('복제본 제목을 입력해 주세요.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }

    setDuplicating(true);
    setMessage(null);
    try {
      const copy = await api.duplicateDocument(duplicateDocument.document.document_id, {
        title,
        slug,
        expected_lock_version: duplicateDocument.lock_version,
      });
      window.location.assign(editorUrl(copy.document.document_id));
    } catch (error) {
      setMessage(errorMessage(error));
      setDuplicating(false);
    }
  };

  const updateMetadata = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!metadataDocument) {
      return;
    }

    const title = metadataTitle.trim();
    const slug = metadataSlug.trim();
    if (!title) {
      setMessage('페이지 제목을 입력해 주세요.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }

    setSavingMetadata(true);
    setMessage(null);
    try {
      const updated = await api.updateDocument(metadataDocument.document.document_id, {
        title,
        slug,
        locale: metadataDocument.document.locale,
        shell_mode: metadataShellMode,
        seo: {
          title: metadataSeoTitle.trim(),
          description: metadataSeoDescription.trim(),
          og_image_url: metadataSeoImage.trim(),
          robots: metadataSeoRobots,
        },
        expected_lock_version: metadataDocument.lock_version,
      });
      setDocuments((current) => current.map((resource) =>
        resource.document.document_id === updated.document.document_id ? updated : resource));
      setMetadataDocument(null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSavingMetadata(false);
    }
  };

  const loadBlockPacks = async (): Promise<void> => {
    setBlockPacksLoading(true);
    try {
      setBlockPacks((await api.listBlockPacks()).items);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBlockPacksLoading(false);
    }
  };

  const openBlockPacks = (): void => {
    setBlockPacksOpen(true);
    setMessage(null);
    void loadBlockPacks();
  };

  const loadOfficialStore = async (): Promise<void> => {
    setStoreLoading(true);
    setMessage(null);
    try {
      setStoreCatalog(await api.getOfficialStoreCatalog());
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setStoreLoading(false);
    }
  };

  const openOfficialStore = (): void => {
    setStoreOpen(true);
    setStoreQuery('');
    setStoreType('all');
    void loadOfficialStore();
  };

  const installStoreBlockPack = async (product: OfficialStoreProduct): Promise<void> => {
    const identity = `${product.product_id}@${product.product_version}`;
    setStoreBusy(identity);
    setMessage(null);
    try {
      await api.installOfficialStoreBlockPack(product.product_id, product.product_version);
      await loadOfficialStore();
      await loadBlockPacks();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setStoreBusy(null);
    }
  };

  const choosePageKit = (product: OfficialStoreProduct): void => {
    const fallback = product.product_id.split('/').at(-1) ?? 'page-kit';
    setPageKitProduct(product);
    setPageKitTitle(product.title.ko);
    setPageKitSlug(fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page-kit');
    setStoreOpen(false);
  };

  const applyPageKit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!pageKitProduct) return;
    const title = pageKitTitle.trim();
    const slug = pageKitSlug.trim();
    if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('페이지 제목과 영문 소문자·숫자·하이픈 주소를 확인해 주세요.');
      return;
    }
    const identity = `${pageKitProduct.product_id}@${pageKitProduct.product_version}`;
    setStoreBusy(identity);
    setMessage(null);
    try {
      const resource = await api.applyOfficialStorePageKit({
        product_id: pageKitProduct.product_id,
        product_version: pageKitProduct.product_version,
        title,
        slug,
      });
      window.location.assign(editorUrl(resource.document.document_id));
    } catch (error) {
      setMessage(errorMessage(error));
      setStoreBusy(null);
    }
  };

  const openPageKitExport = (resource: DocumentResource): void => {
    setActionMenuDocumentId(null);
    setExportDocument(resource);
    setExportKitId(`jiwonpapa/${resource.document.slug}`);
    setExportKitVersion('1.0.0');
    setExportTitle(resource.title);
    setExportDescription(`${resource.title} Page Kit`);
    setMessage(null);
  };

  const exportPageKit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!exportDocument) return;
    setExporting(true);
    setMessage(null);
    try {
      const result = await api.downloadPageKit(exportDocument.document.document_id, {
        kit_id: exportKitId.trim(),
        kit_version: exportKitVersion.trim(),
        title: exportTitle.trim(),
        description: exportDescription.trim(),
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportDocument(null);
      setMessage(result.sha256 ? `Page Kit 배포 ZIP을 만들었습니다. SHA-256 ${result.sha256.slice(0, 12)}…` : 'Page Kit 배포 ZIP을 만들었습니다.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const installBlockPack = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const archive = event.target.files?.[0];
    event.target.value = '';
    if (!archive) return;
    setBlockPackBusy('install');
    setMessage(null);
    try {
      await api.installBlockPack(archive, true);
      await loadBlockPacks();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBlockPackBusy(null);
    }
  };

  const changeBlockPackState = async (pack: BlockPackResource): Promise<void> => {
    const key = `${pack.pack_id}@${pack.pack_version}`;
    setBlockPackBusy(key);
    setMessage(null);
    try {
      await api.setBlockPackState(
        pack.pack_id,
        pack.pack_version,
        pack.state === 'enabled' ? 'disabled' : 'enabled',
      );
      await loadBlockPacks();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBlockPackBusy(null);
    }
  };

  const removeBlockPack = async (pack: BlockPackResource): Promise<void> => {
    const usage = pack.usage;
    if (usage && (usage.documents > 0 || usage.revisions > 0)) {
      setMessage(`사용 중인 블록 팩입니다. 문서 ${usage.documents}개, 리비전 ${usage.revisions}개에서 참조합니다.`);
      return;
    }
    if (!window.confirm(`${pack.pack_id} ${pack.pack_version} 파일을 제거할까요?`)) return;
    const key = `${pack.pack_id}@${pack.pack_version}`;
    setBlockPackBusy(key);
    setMessage(null);
    try {
      await api.removeBlockPack(pack.pack_id, pack.pack_version);
      await loadBlockPacks();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBlockPackBusy(null);
    }
  };

  const checkGitHubBlockPack = async (): Promise<void> => {
    if (!githubOwner.trim() || !githubRepository.trim() || !githubAssetName.trim()) {
      setMessage('GitHub 소유자, 저장소, Release ZIP asset 이름을 입력해 주세요.');
      return;
    }
    setBlockPackBusy('github-check');
    setMessage(null);
    setGithubCheck(null);
    try {
      setGithubCheck(await api.checkGitHubBlockPack(
        githubOwner.trim(),
        githubRepository.trim(),
        githubAssetName.trim(),
      ));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBlockPackBusy(null);
    }
  };

  const installGitHubBlockPack = async (): Promise<void> => {
    setBlockPackBusy('github-install');
    setMessage(null);
    try {
      await api.installGitHubBlockPack(
        githubOwner.trim(),
        githubRepository.trim(),
        githubAssetName.trim(),
      );
      await loadBlockPacks();
      setGithubCheck(await api.checkGitHubBlockPack(
        githubOwner.trim(),
        githubRepository.trim(),
        githubAssetName.trim(),
      ));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBlockPackBusy(null);
    }
  };

  const loadRevisions = async (resource: DocumentResource): Promise<void> => {
    setLoadingRevisions(true);
    setMessage(null);
    try {
      const history = await api.listRevisions(resource.document.document_id);
      setRevisions(history.items);
      setCurrentRevision(history.current_revision);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoadingRevisions(false);
    }
  };

  const openRevisions = (resource: DocumentResource): void => {
    setRevisionDocument(resource);
    setRevisions([]);
    setCurrentRevision(resource.revision);
    void loadRevisions(resource);
  };

  const previewRevision = async (revision: number): Promise<void> => {
    if (!revisionDocument) {
      return;
    }

    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = '미리보기 준비 중';
      previewWindow.document.body.textContent = '리비전 미리보기를 준비하고 있습니다.';
    }

    setPreviewingRevision(revision);
    setMessage(null);
    try {
      const ticket = await api.createRevisionPreview(
        revisionDocument.document.document_id,
        revision,
      );
      if (previewWindow) {
        previewWindow.location.replace(ticket.preview_url);
      } else {
        window.location.assign(ticket.preview_url);
      }
    } catch (error) {
      previewWindow?.close();
      setMessage(errorMessage(error));
    } finally {
      setPreviewingRevision(null);
    }
  };

  const restoreRevision = async (): Promise<void> => {
    if (!revisionDocument || !restoreCandidate) {
      return;
    }

    setRestoringRevision(true);
    setMessage(null);
    try {
      const restored = await api.restoreRevision(
        revisionDocument.document.document_id,
        restoreCandidate.revision,
        revisionDocument.lock_version,
      );
      setDocuments((current) => current.map((resource) =>
        resource.document.document_id === restored.document.document_id ? restored : resource));
      setRevisionDocument(restored);
      setRestoreCandidate(null);
      await loadRevisions(restored);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setRestoringRevision(false);
    }
  };

  const confirmUnpublish = async (): Promise<void> => {
    if (!unpublishDocument) {
      return;
    }

    setUnpublishing(true);
    setMessage(null);
    try {
      const updated = await api.unpublishDocument(
        unpublishDocument.document.document_id,
        unpublishDocument.lock_version,
      );
      setDocuments((current) => current.map((resource) =>
        resource.document.document_id === updated.document.document_id ? updated : resource));
      if (metadataDocument?.document.document_id === updated.document.document_id) {
        setMetadataDocument(updated);
      }
      setUnpublishDocument(null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setUnpublishing(false);
    }
  };

  const toggleHome = async (resource: DocumentResource): Promise<void> => {
    setSettingHomeId(resource.document.document_id);
    setMessage(null);
    try {
      await api.setHomeDocument(
        resource.document.document_id,
        !resource.is_home,
        resource.lock_version,
      );
      const refreshed = await api.listDocuments(1, 100, documentFilter);
      setDocuments(refreshed.items);
      setTotalDocuments(refreshed.pagination.total);
      setMetadataDocument((current) => current
        ? refreshed.items.find((item) => item.document.document_id === current.document.document_id) ?? null
        : null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSettingHomeId(null);
    }
  };

  const confirmArchive = async (): Promise<void> => {
    if (!archiveDocument) {
      return;
    }

    setLifecycleBusy(true);
    setMessage(null);
    try {
      await api.archiveDocument(archiveDocument.document.document_id, archiveDocument.lock_version);
      const archivedId = archiveDocument.document.document_id;
      setArchiveDocument(null);
      setDocuments((current) => current.filter((resource) => resource.document.document_id !== archivedId));
      setTotalDocuments((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const restoreArchived = async (resource: DocumentResource): Promise<void> => {
    setLifecycleBusy(true);
    setMessage(null);
    try {
      await api.restoreArchivedDocument(resource.document.document_id, resource.lock_version);
      setDocuments((current) => current.filter((item) => item.document.document_id !== resource.document.document_id));
      setTotalDocuments((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const confirmPurge = async (): Promise<void> => {
    if (!purgeDocument || purgeConfirmation !== purgeDocument.document.slug) {
      return;
    }

    setLifecycleBusy(true);
    setMessage(null);
    try {
      await api.purgeDocument(
        purgeDocument.document.document_id,
        purgeDocument.lock_version,
        purgeConfirmation,
      );
      const purgedId = purgeDocument.document.document_id;
      setPurgeDocument(null);
      setPurgeConfirmation('');
      setDocuments((current) => current.filter((resource) => resource.document.document_id !== purgedId));
      setTotalDocuments((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

  return (
    <main className="g7pb-root g7pb-manager-root" data-testid="page-builder-manager-app" aria-busy={loading || creating}>
      <header className="g7pb-manager-header">
        <div className="g7pb-manager-header__identity">
          <span className="g7pb-product-mark" aria-hidden="true">G7</span>
          <div>
            <p>Page Builder</p>
            <h1>페이지 빌더 문서</h1>
          </div>
        </div>
        <div className="g7pb-manager-header__actions">
          <a className="g7pb-button g7pb-button--quiet" href="/admin">G7 관리자</a>
          <button className="g7pb-button g7pb-button--quiet" type="button"
            data-testid="page-builder-manager-store" onClick={openOfficialStore}>
            <ShoppingBag size={17} aria-hidden="true" /> 무료 마켓
          </button>
          <button className="g7pb-button g7pb-button--quiet" type="button" data-testid="page-builder-manager-inbox" onClick={() => void openInbox()}>
            <Inbox size={17} aria-hidden="true" /> 문의함
          </button>
          <button className="g7pb-button g7pb-button--quiet" type="button"
            data-testid="page-builder-manager-block-packs" onClick={openBlockPacks}>
            블록 팩
          </button>
          <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-manager-site-header"
            href="/modules/jiwonpapa-page_builder/admin/site-parts/header"><PanelTop size={17} /> Header 편집</a>
          <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-manager-site-footer"
            href="/modules/jiwonpapa-page_builder/admin/site-parts/footer"><PanelBottom size={17} /> Footer 편집</a>
          <button className="g7pb-button g7pb-button--primary" type="button"
            data-testid="page-builder-manager-create" onClick={() => setCreateDialogOpen(true)}>
            새 페이지
          </button>
        </div>
      </header>

      <section className="g7pb-manager-workspace" aria-labelledby="g7pb-manager-heading">
        <div className="g7pb-manager-summary">
          <div>
            <p className="g7pb-kicker">독립 문서함</p>
            <h2 id="g7pb-manager-heading">페이지 빌더에서 만든 문서만 관리합니다.</h2>
            <p>G7 기본 페이지 관리는 변경하지 않습니다.</p>
          </div>
          <strong data-testid="page-builder-manager-count">{totalDocuments}<span>개 문서</span></strong>
        </div>

        <div className="g7pb-manager-tools" aria-label="문서 목록 도구">
          <div className="g7pb-manager-tabs" role="tablist" aria-label="문서 상태">
            <button type="button" role="tab" aria-selected={documentFilter === 'active'}
              data-testid="page-builder-manager-filter-active"
              onClick={() => setDocumentFilter('active')}>사용 중</button>
            <button type="button" role="tab" aria-selected={documentFilter === 'archived'}
              data-testid="page-builder-manager-filter-archived"
              onClick={() => setDocumentFilter('archived')}>보관함</button>
          </div>
          <label className="g7pb-manager-search">
            <span className="sr-only">문서 검색</span>
            <input type="search" value={searchQuery} placeholder="제목 또는 주소 검색"
              data-testid="page-builder-manager-search"
              onChange={(event) => setSearchQuery(event.target.value)} />
          </label>
        </div>

        {message && <div className="g7pb-manager-notice" role="alert">{message}</div>}

        {loading ? (
          <div className="g7pb-manager-loading" role="status">문서를 불러오는 중입니다.</div>
        ) : visibleDocuments.length === 0 ? (
          <div className="g7pb-manager-empty">
            <h3>{searchQuery ? '검색 결과가 없습니다.' : documentFilter === 'archived' ? '보관된 문서가 없습니다.' : '아직 만든 페이지가 없습니다.'}</h3>
            <p>{searchQuery ? '다른 제목이나 주소로 검색해 보세요.' : documentFilter === 'archived' ? '보관한 문서는 여기서 복원하거나 영구 삭제할 수 있습니다.' : '완성 블록을 조합할 첫 페이지를 시작하세요.'}</p>
            {!searchQuery && documentFilter === 'active' && (
              <button className="g7pb-button g7pb-button--primary" type="button"
                data-testid="page-builder-manager-empty-create" onClick={() => setCreateDialogOpen(true)}>
                첫 페이지 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="g7pb-document-list" data-testid="page-builder-document-list">
            <div className="g7pb-document-list__head" aria-hidden="true">
              <span>문서</span><span>상태</span><span>작업</span>
            </div>
            {visibleDocuments.map((resource) => (
              <article className={`g7pb-document-row${actionMenuDocumentId === resource.document.document_id ? ' is-actions-open' : ''}`}
                data-testid="page-builder-document-row"
                data-document-id={resource.document.document_id} key={resource.document.document_id}>
                <div className="g7pb-document-row__identity">
                  <h3>{resource.title}</h3>
                  <p>/{resource.document.slug}</p>
                  <small>생성 {formatDocumentDate(resource.created_at)} · 수정 {formatDocumentDate(resource.updated_at)}</small>
                </div>
                <div>
                  <span className={`g7pb-document-state is-${resource.status}`}>
                    {resource.is_home ? '홈' : DOCUMENT_STATUS_LABELS[resource.status]}
                  </span>
                  {resource.published_at && <small className="g7pb-document-published-at">발행 {formatDocumentDate(resource.published_at)}</small>}
                </div>
                <div className="g7pb-document-row__actions">
                  {resource.status === 'archived' ? (
                    <>
                      <button className="g7pb-button g7pb-button--quiet" type="button"
                        data-testid="page-builder-manager-restore-archived" disabled={lifecycleBusy}
                        onClick={() => void restoreArchived(resource)}>복원</button>
                      <button className="g7pb-button g7pb-button--danger" type="button"
                        data-testid="page-builder-manager-purge"
                        onClick={() => { setPurgeDocument(resource); setPurgeConfirmation(''); }}>영구 삭제</button>
                    </>
                  ) : (
                    <>
                      <a className="g7pb-button g7pb-button--primary" href={editorUrl(resource.document.document_id)}
                        data-testid="page-builder-manager-edit-link">
                        <Pencil size={15} aria-hidden="true" />
                        <span>편집</span>
                      </a>
                      {resource.public_url && (
                        <a className="g7pb-button g7pb-button--quiet" href={resource.public_url}
                          target="_blank" rel="noopener noreferrer"
                          data-testid="page-builder-manager-public-link">
                          <ExternalLink size={15} aria-hidden="true" />
                          <span>공개 보기</span>
                        </a>
                      )}
                      <div className="g7pb-document-actions-menu">
                        <button className="g7pb-button g7pb-button--quiet g7pb-icon-button" type="button"
                          aria-label={`${resource.title} 더보기`}
                          aria-expanded={actionMenuDocumentId === resource.document.document_id}
                          aria-controls={`g7pb-document-actions-${resource.document.document_id}`}
                          data-testid="page-builder-manager-more"
                          onClick={() => setActionMenuDocumentId((current) =>
                            current === resource.document.document_id ? null : resource.document.document_id)}>
                          <MoreHorizontal size={18} aria-hidden="true" />
                        </button>
                        {actionMenuDocumentId === resource.document.document_id && (
                          <div className="g7pb-document-actions-popover" role="menu"
                            id={`g7pb-document-actions-${resource.document.document_id}`}>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-duplicate"
                              onClick={() => openDuplicateDialog(resource)}>
                              <Copy size={15} aria-hidden="true" /><span>복제해서 새로 작성</span>
                            </button>
                            {resource.public_url && (
                              <button type="button" role="menuitem" data-testid="page-builder-manager-home"
                                disabled={settingHomeId !== null}
                                onClick={() => { setActionMenuDocumentId(null); void toggleHome(resource); }}>
                                <Home size={15} aria-hidden="true" />
                                <span>{resource.is_home ? '홈 해제' : '홈 지정'}</span>
                              </button>
                            )}
                            <button type="button" role="menuitem" data-testid="page-builder-manager-settings"
                              onClick={() => { setActionMenuDocumentId(null); openMetadataDialog(resource); }}>
                              <Settings size={15} aria-hidden="true" /><span>설정</span>
                            </button>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-revisions"
                              onClick={() => { setActionMenuDocumentId(null); openRevisions(resource); }}>
                              <History size={15} aria-hidden="true" /><span>변경 기록</span>
                            </button>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-export-page-kit"
                              onClick={() => openPageKitExport(resource)}>
                              <Download size={15} aria-hidden="true" /><span>Page Kit 배포 ZIP</span>
                            </button>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-archive"
                              onClick={() => { setActionMenuDocumentId(null); setArchiveDocument(resource); }}>
                              <Archive size={15} aria-hidden="true" /><span>보관함으로 이동</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {inboxOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-inbox-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide g7pb-inbox" role="dialog" aria-modal="true" aria-labelledby="g7pb-inbox-heading">
            <div className="g7pb-dialog__heading-row"><div><p className="g7pb-kicker">폼 접수 관리</p><h2 id="g7pb-inbox-heading">문의함</h2><p>문의는 메일 발송 여부와 관계없이 이곳에 먼저 보존됩니다.</p></div><button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setInboxOpen(false)}>닫기</button></div>
            {inboxLoading ? <div className="g7pb-manager-loading">문의를 불러오는 중입니다.</div> : submissions.length === 0 ? <div className="g7pb-manager-empty"><h3>접수된 문의가 없습니다.</h3></div> : <div className="g7pb-inbox-list">
              {submissions.map((submission) => <article key={submission.id} data-state={submission.status}>
                <header><div><span>{submission.form_kind} · /{submission.page_slug}</span><h3>{submission.subject || '제목 없는 문의'}</h3><small>{formatRevisionDate(submission.created_at)} · {submission.email}</small></div><strong data-mail={submission.mail_status}>{submission.mail_status === 'sent' ? '메일 발송됨' : submission.mail_status === 'failed' ? '메일 실패' : '메일 대기'}</strong></header>
                <dl><div><dt>이름</dt><dd>{submission.payload.name || '-'}</dd></div><div><dt>전화</dt><dd>{submission.payload.phone || '-'}</dd></div></dl>
                <p>{submission.payload.message || ''}</p>
                {submission.mail_error ? <small className="g7pb-inbox-error">{submission.mail_error}</small> : null}
                <footer><button type="button" className="g7pb-button g7pb-button--quiet" disabled={inboxBusy === submission.id} onClick={() => void setSubmissionStatus(submission, submission.status === 'read' ? 'unread' : 'read')}>{submission.status === 'read' ? '읽지 않음' : '읽음 처리'}</button>{submission.mail_status === 'failed' ? <button type="button" className="g7pb-button g7pb-button--quiet" disabled={inboxBusy === submission.id} onClick={() => void retrySubmission(submission)}>메일 재시도</button> : null}<button type="button" className="g7pb-button g7pb-button--danger" disabled={inboxBusy === submission.id} onClick={() => void setSubmissionStatus(submission, 'archived')}>보관</button></footer>
              </article>)}
            </div>}
          </section>
        </div>
      )}

      {createDialogOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-create-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-manager-create-heading">
            <p className="g7pb-kicker">새 문서</p>
            <h2 id="g7pb-manager-create-heading">페이지 기본 정보</h2>
            <form onSubmit={(event) => void createDocument(event)}>
              <label>
                페이지 제목
                <input data-testid="page-builder-manager-title-input" value={createTitle} required autoFocus
                  onChange={(event) => setCreateTitle(event.target.value)} />
              </label>
              <label>
                주소 슬러그
                <span>영문 소문자, 숫자, 하이픈</span>
                <input data-testid="page-builder-manager-slug-input" value={createSlug} required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => setCreateSlug(event.target.value.toLowerCase())} />
              </label>
              <label>
                페이지 출력 방식
                <span>사이트 템플릿을 기본으로 사용하며 기존 템플릿은 수정하지 않습니다.</span>
                <select value={createShellMode === 'global' ? 'builder' : createShellMode}
                  data-testid="page-builder-manager-shell-mode"
                  onChange={(event) => setCreateShellMode(event.currentTarget.value as PageShellMode)}>
                  <option value="template">활성 사이트 템플릿 · 권장</option>
                  <option value="builder">페이지 빌더 Header·Footer</option>
                  <option value="none">공통영역 없음 · 인트로/캠페인</option>
                </select>
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  onClick={() => setCreateDialogOpen(false)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-create-confirm" disabled={creating}>
                  {creating ? '만드는 중' : '편집 시작'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {duplicateDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-duplicate-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-manager-duplicate-heading">
            <p className="g7pb-kicker">문서 복제</p>
            <h2 id="g7pb-manager-duplicate-heading">{duplicateDocument.title}을 새 초안으로 복제</h2>
            <p className="g7pb-dialog__body">현재 초안의 블록·스타일·공통영역 표시 방식을 복사합니다. 발행 상태, 공개 주소, 홈 지정, 기존 리비전은 복사하지 않습니다.</p>
            <form onSubmit={(event) => void submitDuplicate(event)}>
              <label>
                복제본 제목
                <input data-testid="page-builder-manager-duplicate-title" value={duplicateTitle}
                  required autoFocus onChange={(event) => setDuplicateTitle(event.target.value)} />
              </label>
              <label>
                새 주소 슬러그
                <span>기존 공개 주소와 연결되지 않는 새 주소입니다.</span>
                <input data-testid="page-builder-manager-duplicate-slug" value={duplicateSlugValue}
                  required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => setDuplicateSlugValue(event.target.value.toLowerCase())} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={duplicating} onClick={() => setDuplicateDocument(null)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-duplicate-confirm" disabled={duplicating}>
                  <Copy size={15} aria-hidden="true" />
                  <span>{duplicating ? '복제 중' : '복제하고 편집'}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {metadataDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-metadata-dialog">
          <section className="g7pb-dialog g7pb-dialog--metadata" role="dialog" aria-modal="true" aria-labelledby="g7pb-manager-metadata-heading">
            <p className="g7pb-kicker">문서 설정</p>
            <h2 id="g7pb-manager-metadata-heading">페이지 정보와 검색 노출</h2>
            <form onSubmit={(event) => void updateMetadata(event)}>
              <fieldset className="g7pb-metadata-section">
                <legend>기본 정보</legend>
                <p>관리 목록과 공개 주소, 사이트 공통영역 사용 방식을 정합니다.</p>
                <label>
                  페이지 제목
                  <input data-testid="page-builder-manager-metadata-title" value={metadataTitle} required autoFocus
                    onChange={(event) => setMetadataTitle(event.target.value)} />
                </label>
                <label>
                  주소 슬러그
                  <span>재발행 전에는 기존 공개 주소와 발행본이 유지됩니다.</span>
                  <input data-testid="page-builder-manager-metadata-slug" value={metadataSlug} required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    onChange={(event) => setMetadataSlug(event.target.value.toLowerCase())} />
                </label>
                <label>
                  페이지 출력 방식
                  <span>변경 사항은 다음 발행부터 공개 페이지에 적용됩니다.</span>
                  <select value={metadataShellMode === 'global' ? 'builder' : metadataShellMode}
                    data-testid="page-builder-manager-metadata-shell-mode"
                    onChange={(event) => setMetadataShellMode(event.currentTarget.value as PageShellMode)}>
                    <option value="template">활성 사이트 템플릿 · 권장</option>
                    <option value="builder">페이지 빌더 Header·Footer</option>
                    <option value="none">공통영역 없음 · 인트로/캠페인</option>
                  </select>
                </label>
              </fieldset>
              <fieldset className="g7pb-metadata-section">
                <legend>검색·공유 미리보기</legend>
                <p>검색 결과와 메신저·SNS 링크 공유에 사용할 정보를 발행본에 고정합니다.</p>
                <label>
                  검색 제목 <span>{metadataSeoTitle.length}/70 · 비우면 페이지 제목 사용</span>
                  <input data-testid="page-builder-manager-seo-title" value={metadataSeoTitle} maxLength={70}
                    placeholder={metadataTitle || '페이지 제목'} onChange={(event) => setMetadataSeoTitle(event.target.value)} />
                </label>
                <label>
                  검색 설명 <span>{metadataSeoDescription.length}/200</span>
                  <textarea data-testid="page-builder-manager-seo-description" value={metadataSeoDescription}
                    maxLength={200} rows={3} onChange={(event) => setMetadataSeoDescription(event.target.value)} />
                </label>
                <div className="g7pb-metadata-media">
                  <label>
                    공유 대표 이미지
                    <span>직접 업로드하거나 기존 미디어를 선택할 수 있습니다.</span>
                    <input data-testid="page-builder-manager-seo-image" value={metadataSeoImage}
                      placeholder="/storage/... 또는 https://..." onChange={(event) => setMetadataSeoImage(event.target.value)} />
                  </label>
                  {metadataSeoImage ? <img src={metadataSeoImage} alt="공유 대표 이미지 미리보기" /> : null}
                  <div className="g7pb-metadata-media__actions">
                    <button type="button" className="g7pb-button g7pb-button--quiet"
                      onClick={() => void openMetadataMedia()} disabled={metadataMediaLoading}>
                      <ImagePlus size={15} aria-hidden="true" />
                      <span>{metadataMediaOpen ? '미디어 닫기' : '미디어 선택'}</span>
                    </button>
                    {metadataSeoImage ? <button type="button" className="g7pb-button g7pb-button--quiet"
                      onClick={() => setMetadataSeoImage('')}>이미지 비우기</button> : null}
                    <input ref={metadataMediaFileRef} className="g7pb-visually-hidden" type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      onChange={(event) => void uploadMetadataMedia(event)} />
                    <button type="button" className="g7pb-button g7pb-button--quiet"
                      disabled={metadataMediaLoading} onClick={() => metadataMediaFileRef.current?.click()}>
                      {metadataMediaLoading ? '처리 중' : '파일 업로드'}
                    </button>
                  </div>
                  {metadataMediaOpen ? <div className="g7pb-metadata-media__grid" data-testid="page-builder-manager-seo-media-library">
                    {metadataMediaLoading && metadataMedia.length === 0 ? <p>미디어를 불러오는 중입니다.</p> : null}
                    {!metadataMediaLoading && metadataMedia.length === 0 ? <p>업로드된 이미지가 없습니다.</p> : null}
                    {metadataMedia.map((asset) => <button type="button" key={asset.id}
                      aria-pressed={metadataSeoImage === asset.url}
                      onClick={() => { setMetadataSeoImage(asset.url); setMetadataMediaOpen(false); }}>
                      <img src={asset.url} alt="" loading="lazy" /><span>{asset.original_name}</span>
                    </button>)}
                  </div> : null}
                </div>
                <label>
                  검색 엔진 공개
                  <span>캠페인·인트로처럼 검색 제외가 필요할 때만 차단합니다.</span>
                  <select data-testid="page-builder-manager-seo-robots" value={metadataSeoRobots}
                    onChange={(event) => setMetadataSeoRobots(event.currentTarget.value as PageSeoMetadata['robots'])}>
                    <option value="index">검색 허용</option>
                    <option value="noindex">검색 제외</option>
                  </select>
                </label>
              </fieldset>
              <div className="g7pb-dialog__actions">
                {metadataDocument.public_url && (
                  <button type="button" className="g7pb-button g7pb-button--danger"
                    data-testid="page-builder-manager-unpublish"
                    onClick={() => setUnpublishDocument(metadataDocument)}>공개 해제</button>
                )}
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  onClick={() => setMetadataDocument(null)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-metadata-save" disabled={savingMetadata}>
                  {savingMetadata ? '저장 중' : '초안 정보 저장'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {blockPacksOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-block-packs-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-block-packs-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">독립 블록 자산</p>
                <h2 id="g7pb-block-packs-heading">블록 팩 설치·사용·제거</h2>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setBlockPacksOpen(false)}>닫기</button>
            </div>
            <div className="g7pb-block-pack-toolbar">
              <div>
                <strong>로컬 ZIP 설치</strong>
                <span>Data Preset Pack은 검증 후 활성화됩니다. Code Pack은 신뢰 서명 검증을 통과해야 설치됩니다.</span>
              </div>
              <label className="g7pb-button g7pb-button--primary">
                <input type="file" accept=".zip,application/zip" className="sr-only"
                  data-testid="page-builder-block-pack-upload" disabled={blockPackBusy !== null}
                  onChange={(event) => void installBlockPack(event)} />
                {blockPackBusy === 'install' ? '검증·설치 중' : 'ZIP 추가'}
              </label>
            </div>
            <section className="g7pb-block-pack-github" aria-labelledby="g7pb-block-pack-github-heading">
              <div className="g7pb-block-pack-github__heading">
                <div>
                  <strong id="g7pb-block-pack-github-heading">GitHub Release에서 확인</strong>
                  <span>생성일 기준 latest가 아니라 가장 높은 안정 SemVer를 찾고, asset SHA-256 확인 뒤에만 설치합니다.</span>
                </div>
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={blockPackBusy !== null} onClick={() => void checkGitHubBlockPack()}>
                  {blockPackBusy === 'github-check' ? '확인 중' : '최신 버전 확인'}
                </button>
              </div>
              <div className="g7pb-block-pack-github__fields">
                <label>소유자
                  <input value={githubOwner} placeholder="예: jiwonpapa"
                    onChange={(event) => { setGithubOwner(event.target.value); setGithubCheck(null); }} />
                </label>
                <label>저장소
                  <input value={githubRepository} placeholder="예: g7-block-packs"
                    onChange={(event) => { setGithubRepository(event.target.value); setGithubCheck(null); }} />
                </label>
                <label>Release ZIP asset
                  <input value={githubAssetName}
                    onChange={(event) => { setGithubAssetName(event.target.value); setGithubCheck(null); }} />
                </label>
              </div>
              {githubCheck && (
                <div className="g7pb-block-pack-github__result" data-testid="page-builder-github-pack-result">
                  <div>
                    <strong>{githubCheck.release.repository} · v{githubCheck.release.version}</strong>
                    <span>설치됨 {githubCheck.installed_version ?? '없음'} · SHA-256 {githubCheck.release.sha256.slice(0, 12)}…</span>
                  </div>
                  {githubCheck.update_available ? (
                    <button type="button" className="g7pb-button g7pb-button--primary"
                      disabled={blockPackBusy !== null} onClick={() => void installGitHubBlockPack()}>
                      {blockPackBusy === 'github-install' ? '검증·설치 중' : '이 버전 설치'}
                    </button>
                  ) : <strong className="g7pb-block-pack-github__current">최신 상태</strong>}
                </div>
              )}
            </section>
            {blockPacksLoading ? (
              <div className="g7pb-manager-loading" role="status">블록 팩을 불러오는 중입니다.</div>
            ) : (
              <div className="g7pb-block-pack-list">
                {blockPacks.map((pack) => {
                  const key = `${pack.pack_id}@${pack.pack_version}`;
                  const inUse = Boolean(pack.usage && (pack.usage.documents > 0 || pack.usage.revisions > 0));
                  return (
                    <article className="g7pb-block-pack-row" key={key} data-testid="page-builder-block-pack-row">
                      <div className="g7pb-block-pack-row__identity">
                        <span>{pack.kind === 'data' ? 'Data Preset' : 'Code'} Pack</span>
                        <strong>{pack.pack_id}</strong>
                        <small>v{pack.pack_version} · {pack.publisher.name} · 블록 {pack.blocks} / 프리셋 {pack.presets}</small>
                      </div>
                      <div className="g7pb-block-pack-row__state">
                        <strong data-state={pack.state}>{pack.state}</strong>
                        {pack.source === 'builtin' ? <span>제품 내장</span> : inUse
                          ? <span>문서 {pack.usage?.documents} · 리비전 {pack.usage?.revisions} 사용 중</span>
                          : <span>안전하게 제거 가능</span>}
                      </div>
                      <div className="g7pb-block-pack-row__actions">
                        {pack.source !== 'builtin' && !['quarantined', 'retired'].includes(pack.state) && (
                          <button type="button" className="g7pb-button g7pb-button--quiet"
                            disabled={blockPackBusy !== null}
                            onClick={() => void changeBlockPackState(pack)}>
                            {pack.state === 'enabled' ? '비활성화' : '활성화'}
                          </button>
                        )}
                        {pack.source !== 'builtin' && (
                          <button type="button" className="g7pb-button g7pb-button--danger"
                            disabled={blockPackBusy !== null || pack.state === 'enabled' || inUse}
                            title={pack.state === 'enabled' ? '먼저 비활성화해 주세요.' : inUse ? '문서와 리비전에서 사용 중입니다.' : undefined}
                            onClick={() => void removeBlockPack(pack)}>
                            {blockPackBusy === key ? '처리 중' : '제거'}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {storeOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-store-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide g7pb-store-dialog" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-store-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">지원소프트 공식 배포</p>
                <h2 id="g7pb-store-heading">무료 Block Pack · Page Kit</h2>
                <p>검증된 공식 자산과 실제 PC·태블릿·모바일 적용 화면만 표시합니다. 제3자 업로드와 판매자 기능은 없습니다.</p>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setStoreOpen(false)}>닫기</button>
            </div>
            <div className="g7pb-store-tools">
              <label className="g7pb-manager-search">
                <span className="sr-only">마켓 검색</span>
                <input type="search" value={storeQuery} placeholder="이름·설명·태그 검색"
                  data-testid="page-builder-store-search"
                  onChange={(event) => setStoreQuery(event.target.value)} />
              </label>
              <div className="g7pb-manager-tabs" role="tablist" aria-label="마켓 상품 종류">
                {([['all', '전체'], ['block_pack', '블록 팩'], ['page_kit', '완성 페이지']] as const).map(([value, label]) => (
                  <button type="button" role="tab" key={value} aria-selected={storeType === value}
                    data-testid={`page-builder-store-filter-${value}`}
                    onClick={() => setStoreType(value)}>{label}</button>
                ))}
              </div>
            </div>
            {storeLoading ? (
              <div className="g7pb-manager-loading" role="status">공식 마켓을 불러오는 중입니다.</div>
            ) : visibleStoreProducts.length === 0 ? (
              <div className="g7pb-manager-empty"><h3>표시할 무료 상품이 없습니다.</h3><p>검색 조건을 바꾸거나 잠시 뒤 다시 확인해 주세요.</p></div>
            ) : (
              <div className="g7pb-store-grid" data-testid="page-builder-store-products">
                {visibleStoreProducts.map((product) => {
                  const identity = `${product.product_id}@${product.product_version}`;
                  return (
                    <article className="g7pb-store-card" key={identity} data-testid="page-builder-store-product"
                      data-product-type={product.product_type}>
                      <a className="g7pb-store-card__preview" href={product.preview.demo_url ?? product.preview.thumbnail_url}
                        target="_blank" rel="noopener noreferrer" aria-label={`${product.title.ko} 미리보기`}>
                        <img src={product.preview.thumbnail_url} alt="" loading="lazy" />
                        <span>{product.preview.demo_url ? '실제 데모 보기' : '크게 미리보기'} <ExternalLink size={14} aria-hidden="true" /></span>
                      </a>
                      <div className="g7pb-store-card__body">
                        <span className="g7pb-store-card__kind">
                          {product.product_type === 'block_pack' ? <PackagePlus size={15} /> : <LayoutTemplate size={15} />}
                          {product.product_type === 'block_pack' ? 'Block Pack' : 'Page Kit'} · 무료
                        </span>
                        <h3>{product.title.ko}</h3>
                        <p>{product.description.ko}</p>
                        <small>v{product.product_version} · {product.tags.join(' · ')}</small>
                        {product.preview.screenshots.length > 0 && (
                          <small className="g7pb-store-card__screenshots">
                            PC·태블릿·모바일 실제 화면 {product.preview.screenshots.length}장
                          </small>
                        )}
                        {!product.compatible && <strong className="g7pb-store-card__error">{product.compatibility_error}</strong>}
                      </div>
                      <div className="g7pb-store-card__actions">
                        {product.product_type === 'block_pack' ? (
                          <button type="button" className="g7pb-button g7pb-button--primary"
                            data-testid="page-builder-store-install-block-pack"
                            disabled={!product.compatible || product.installed || storeBusy !== null}
                            onClick={() => void installStoreBlockPack(product)}>
                            {product.installed ? '설치됨' : storeBusy === identity ? '검증·설치 중' : '무료 설치'}
                          </button>
                        ) : (
                          <button type="button" className="g7pb-button g7pb-button--primary"
                            data-testid="page-builder-store-apply-page-kit"
                            disabled={!product.compatible || storeBusy !== null}
                            onClick={() => choosePageKit(product)}>새 페이지로 적용</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {pageKitProduct && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-store-page-kit-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-page-kit-apply-heading">
            <p className="g7pb-kicker">완성 페이지 적용</p>
            <h2 id="g7pb-page-kit-apply-heading">{pageKitProduct.title.ko}</h2>
            <p className="g7pb-dialog__body">기존 페이지는 바꾸지 않습니다. 새 UUID와 새 주소를 가진 미발행 초안으로 만들고, 활성 사이트 템플릿을 사용합니다.</p>
            <div className="g7pb-page-kit-readiness" data-testid="page-builder-store-page-kit-readiness">
              <strong>발행 전에 교체할 항목</strong>
              <ul>
                <li>버튼·기사·자료의 샘플 링크를 실제 경로로 연결합니다.</li>
                <li>팀·연사·기사의 보조 이미지 자리에는 운영 이미지를 넣거나 의도적인 텍스트형으로 유지합니다.</li>
                <li>문의 폼·위치·일정 등 실제 운영 정보를 최종 확인합니다.</li>
              </ul>
              <p>전용 Hero 이미지는 Page Kit에 포함됩니다.</p>
            </div>
            <form onSubmit={(event) => void applyPageKit(event)}>
              <label>새 페이지 제목
                <input value={pageKitTitle} required autoFocus data-testid="page-builder-store-page-kit-title"
                  onChange={(event) => setPageKitTitle(event.target.value)} />
              </label>
              <label>새 페이지 주소
                <span>영문 소문자, 숫자, 하이픈</span>
                <input value={pageKitSlug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  data-testid="page-builder-store-page-kit-slug"
                  onChange={(event) => setPageKitSlug(event.target.value.toLowerCase())} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={storeBusy !== null} onClick={() => { setPageKitProduct(null); setStoreOpen(true); }}>이전</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-store-page-kit-confirm" disabled={storeBusy !== null}>
                  {storeBusy ? '검증·적용 중' : '새 초안 만들기'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {exportDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-export-page-kit-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-page-kit-export-heading">
            <p className="g7pb-kicker">지원소프트 배포용</p>
            <h2 id="g7pb-page-kit-export-heading">{exportDocument.title} Page Kit 만들기</h2>
            <p className="g7pb-dialog__body">현재 초안과 Page Builder 미디어를 휴대 가능한 ZIP으로 만듭니다. 발행 상태·홈 지정·리비전·Header·Footer는 포함하지 않습니다.</p>
            <form onSubmit={(event) => void exportPageKit(event)}>
              <label>상품 id
                <input value={exportKitId} required pattern="jiwonpapa/[a-z0-9][a-z0-9._-]{1,63}"
                  data-testid="page-builder-export-page-kit-id"
                  onChange={(event) => setExportKitId(event.target.value.toLowerCase())} />
              </label>
              <label>버전
                <input value={exportKitVersion} required data-testid="page-builder-export-page-kit-version"
                  onChange={(event) => setExportKitVersion(event.target.value)} />
              </label>
              <label>마켓 제목
                <input value={exportTitle} required onChange={(event) => setExportTitle(event.target.value)} />
              </label>
              <label>마켓 설명
                <textarea value={exportDescription} required rows={3}
                  onChange={(event) => setExportDescription(event.target.value)} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={exporting} onClick={() => setExportDocument(null)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-export-page-kit-confirm" disabled={exporting}>
                  <Download size={15} aria-hidden="true" /> {exporting ? '만드는 중' : '배포 ZIP 다운로드'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {revisionDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-revisions-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-manager-revisions-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">리비전 기록</p>
                <h2 id="g7pb-manager-revisions-heading">{revisionDocument.title}</h2>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setRevisionDocument(null)}>닫기</button>
            </div>
            <p className="g7pb-revision-help">복원은 과거 상태를 새 초안 리비전으로 복사합니다. 현재 공개본은 재발행 전까지 유지됩니다.</p>
            {loadingRevisions ? (
              <div className="g7pb-revision-loading" role="status">리비전을 불러오는 중입니다.</div>
            ) : (
              <div className="g7pb-revision-list" data-testid="page-builder-revision-list">
                {revisions.map((revision) => (
                  <article className="g7pb-revision-row" data-testid="page-builder-revision-row"
                    data-revision={revision.revision} key={revision.revision}>
                    <div className="g7pb-revision-row__number">
                      <strong>v{revision.revision}</strong>
                      {revision.revision === currentRevision && <span>현재 초안</span>}
                    </div>
                    <div className="g7pb-revision-row__meta">
                      <strong>{revision.title}</strong>
                      <span>/{revision.slug} · {revision.block_count}개 블록 · {formatRevisionDate(revision.created_at)}</span>
                    </div>
                    <div className="g7pb-revision-row__actions">
                      <button type="button" className="g7pb-button g7pb-button--quiet"
                        data-testid="page-builder-revision-preview"
                        disabled={previewingRevision !== null}
                        onClick={() => void previewRevision(revision.revision)}>
                        {previewingRevision === revision.revision ? '준비 중' : '미리보기'}
                      </button>
                      {revision.revision !== currentRevision && (
                        <button type="button" className="g7pb-button g7pb-button--quiet"
                          data-testid="page-builder-revision-restore"
                          onClick={() => setRestoreCandidate(revision)}>복원</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {revisionDocument && restoreCandidate && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-revision-restore-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-revision-restore-heading">
            <p className="g7pb-kicker">안전 복원</p>
            <h2 id="g7pb-revision-restore-heading">v{restoreCandidate.revision}을 새 초안으로 복원할까요?</h2>
            <p className="g7pb-dialog__body">기존 리비전과 공개본은 삭제되지 않습니다. 복원 뒤 내용을 확인하고 별도로 발행해야 공개됩니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setRestoreCandidate(null)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-revision-restore-confirm" disabled={restoringRevision}
                onClick={() => void restoreRevision()}>
                {restoringRevision ? '복원 중' : '새 초안으로 복원'}
              </button>
            </div>
          </section>
        </div>
      )}

      {unpublishDocument && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-unpublish-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-unpublish-heading">
            <p className="g7pb-kicker">공개 해제</p>
            <h2 id="g7pb-unpublish-heading">이 페이지를 비공개로 전환할까요?</h2>
            <p className="g7pb-dialog__body">공개 URL은 즉시 404가 됩니다. 문서와 모든 리비전은 남아 있어 다시 편집하고 발행할 수 있습니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setUnpublishDocument(null)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-unpublish-confirm" disabled={unpublishing}
                onClick={() => void confirmUnpublish()}>
                {unpublishing ? '해제 중' : '공개 해제'}
              </button>
            </div>
          </section>
        </div>
      )}

      {archiveDocument && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-archive-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-archive-heading">
            <p className="g7pb-kicker">문서 보관</p>
            <h2 id="g7pb-archive-heading">{archiveDocument.title} 문서를 보관할까요?</h2>
            <p className="g7pb-dialog__body">발행 중이면 즉시 공개 해제되고 홈 지정도 해제됩니다. 문서와 리비전은 보관함에서 다시 복원할 수 있습니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setArchiveDocument(null)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-archive-confirm" disabled={lifecycleBusy}
                onClick={() => void confirmArchive()}>{lifecycleBusy ? '보관 중' : '보관함으로 이동'}</button>
            </div>
          </section>
        </div>
      )}

      {purgeDocument && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-purge-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-purge-heading">
            <p className="g7pb-kicker">영구 삭제</p>
            <h2 id="g7pb-purge-heading">이 문서와 모든 기록을 삭제할까요?</h2>
            <p className="g7pb-dialog__body">복구할 수 없습니다. 확인하려면 <strong>{purgeDocument.document.slug}</strong>를 입력해 주세요.</p>
            <label>
              확인 주소
              <input value={purgeConfirmation} autoFocus data-testid="page-builder-purge-confirmation"
                onChange={(event) => setPurgeConfirmation(event.target.value)} />
            </label>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => { setPurgeDocument(null); setPurgeConfirmation(''); }}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-purge-confirm" disabled={lifecycleBusy || purgeConfirmation !== purgeDocument.document.slug}
                onClick={() => void confirmPurge()}>{lifecycleBusy ? '삭제 중' : '영구 삭제'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function mountPageBuilderManager(
  element: Element,
  options: PageBuilderManagerOptions = {},
): () => void {
  roots.get(element)?.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<PageBuilderManager {...options} />);

  return () => {
    roots.get(element)?.unmount();
    roots.delete(element);
  };
}

export function discoverPageBuilderManagers(scope: ParentNode = document): Element[] {
  return Array.from(scope.querySelectorAll('[data-g7pb-manager], #g7pb-manager'));
}
