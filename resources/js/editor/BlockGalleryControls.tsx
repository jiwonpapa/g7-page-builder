import type { PuckAction } from '@puckeditor/core';
import { Blocks, Columns2, Plus, Star, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BLOCK_GALLERY_ITEMS, BlockCatalogContext } from './BlockCatalogContext';
import { BLOCK_CATEGORY_ORDER, BLOCK_GALLERY_WINDOW_SIZE, OPEN_BLOCK_GALLERY_EVENT, QUICK_ADD_COMPONENTS, blockPreviewDensity,
  LIBRARY_KINDS, LAYOUT_GALLERY_ITEM, libraryKindLabel, libraryEditingCapabilities, type LibraryKind, type BlockGalleryItem } from './blockGalleryModel';
import { externalEditorComponents } from '../blocks/runtimeRegistry';
import { pageBuilderPuckConfig } from './puckEditorConfig';
import { CatalogGalleryThumbnail } from './CatalogGalleryThumbnail';
import type { CatalogEditorComponents } from './catalogEditorTypes';
import { insertGalleryItem } from './canvasItemCommands';
import { idToUuid } from './puckBlockCodec';
import type { PuckEditorData } from './puckEditorTypes';

function BlockGalleryThumbnail({ item }: { item: BlockGalleryItem }): React.ReactElement {
  const [failed, setFailed] = useState(false);
  if (item.productionKind === 'layout') return <span className="g7pb-block-thumb g7pb-block-thumb--unavailable" data-block-preview={item.type} aria-hidden="true"><Columns2 size={54} /></span>;
  if (item.thumbnail && !failed) {
    return <span className="g7pb-block-thumb g7pb-block-thumb--image" data-block-preview={item.type} aria-hidden="true">
      <img src={item.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>;
  }

  return <CatalogGalleryThumbnail type={item.type as keyof CatalogEditorComponents} />;
}

function editingCapabilities(item: BlockGalleryItem) {
  const component = pageBuilderPuckConfig.components[item.type]
    ?? Object.entries(externalEditorComponents()).find(([type]) => type === item.type)?.[1];
  return libraryEditingCapabilities(item.type, component?.fields ?? {});
}

function EditingScope({ item }: { item: BlockGalleryItem }): React.ReactElement {
  return <details className="g7pb-library-scope" data-testid={`editing-scope-${item.type}`}>
    <summary>편집 범위</summary>
    <dl>{editingCapabilities(item).map((capability) => <div key={capability.key} data-capability={capability.key}>
      <dt>{capability.label}</dt><dd>{capability.description}</dd>
    </div>)}</dl>
  </details>;
}

function EditingSummary({ item }: { item: BlockGalleryItem }): React.ReactElement {
  const labels = editingCapabilities(item).filter((entry) => entry.available).map((entry) => entry.label);
  return <span className="g7pb-library-capabilities">{labels.length ? labels.join(' · ') : '설정 패널에서 수정'}</span>;
}

export function StableAddBlockControls({
  dispatch,
  data,
  selectedIndex,
  selectedZone,
  disabled,
}: {
  dispatch: (action: PuckAction) => void;
  data: PuckEditorData;
  selectedIndex: number | null;
  selectedZone: string;
  disabled: boolean;
}): React.ReactElement {
  const { items: catalogItems, toggleFavorite, layoutEnabled = false } = React.useContext(BlockCatalogContext);
  const items = useMemo(() => layoutEnabled ? [...catalogItems, LAYOUT_GALLERY_ITEM] : catalogItems, [catalogItems, layoutEnabled]);
  const [open, setOpen] = useState(false);
  const [insertionError, setInsertionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [packId, setPackId] = useState('');
  const [kind, setKind] = useState<'all' | 'definition' | 'preset'>('all');
  const [productionKind, setProductionKind] = useState<LibraryKind | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [renderLimit, setRenderLimit] = useState(BLOCK_GALLERY_WINDOW_SIZE);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort((left, right) => {
    const leftIndex = BLOCK_CATEGORY_ORDER.indexOf(left as typeof BLOCK_CATEGORY_ORDER[number]);
    const rightIndex = BLOCK_CATEGORY_ORDER.indexOf(right as typeof BLOCK_CATEGORY_ORDER[number]);
    if (leftIndex === -1 || rightIndex === -1) return left.localeCompare(right, 'ko');
    return leftIndex - rightIndex;
  }), [items]);
  const packs = useMemo(() => Array.from(new Map(items.map((item) => [item.packId, item.packLabel])).entries()), [items]);
  const quickItems = useMemo(() => QUICK_ADD_COMPONENTS.map((component) => items.find((item) => item.kind === 'definition' && item.type === component)).filter((item): item is BlockGalleryItem => Boolean(item)), [items]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko');
    return items.filter((item) => {
      if (favoritesOnly && !item.favorite) return false;
      if (category && item.category !== category) return false;
      if (packId && item.packId !== packId) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (productionKind !== 'all' && item.productionKind !== productionKind) return false;
      if (!normalizedQuery) return true;
      return item.searchText.toLocaleLowerCase('ko').includes(normalizedQuery);
    });
  }, [category, favoritesOnly, items, kind, packId, productionKind, query]);
  const renderedItems = visibleItems.slice(0, renderLimit);

  useEffect(() => {
    setRenderLimit(BLOCK_GALLERY_WINDOW_SIZE);
  }, [category, favoritesOnly, kind, open, packId, productionKind, query]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!open || !target || renderLimit >= visibleItems.length || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setRenderLimit((current) => Math.min(current + BLOCK_GALLERY_WINDOW_SIZE, visibleItems.length));
      }
    }, { root: target.closest('.g7pb-block-gallery'), rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, renderLimit, visibleItems.length]);

  useEffect(() => {
    const openGallery = (): void => setOpen(true);
    window.addEventListener(OPEN_BLOCK_GALLERY_EVENT, openGallery);
    return () => window.removeEventListener(OPEN_BLOCK_GALLERY_EVENT, openGallery);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = globalThis.document?.body.style.overflow ?? '';
    if (globalThis.document) {
      globalThis.document.body.style.overflow = 'hidden';
    }
    firstItemRef.current?.focus({ preventScroll: true });

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    globalThis.document?.addEventListener('keydown', closeOnEscape);

    return () => {
      globalThis.document?.removeEventListener('keydown', closeOnEscape);
      if (globalThis.document) {
        globalThis.document.body.style.overflow = previousOverflow;
      }
    };
  }, [open]);

  const insert = (item: BlockGalleryItem): void => {
    if (disabled) return;
    let actions: PuckAction[];
    try {
      actions = insertGalleryItem(data, selectedIndex === null ? null : { index: selectedIndex, zone: selectedZone }, item,
        idToUuid(`${item.catalogId}:${Date.now()}:${Math.random()}`));
    } catch {
      setInsertionError('선택한 위치에는 이 블럭을 추가할 수 없습니다. 다른 구역을 선택해 주세요.');
      return;
    }
    setInsertionError(null);
    actions.forEach(dispatch);
    setOpen(false);
  };

  return (
    <div className="g7pb-add-block">
      <button
        type="button"
        data-testid="page-builder-add-block"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Blocks size={16} aria-hidden="true" /><span>블록 추가</span>
      </button>
      {open && globalThis.document && createPortal(
        <div className="g7pb-block-gallery-backdrop" data-testid="page-builder-block-gallery"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}>
          <section className="g7pb-block-gallery" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-block-gallery-title">
            <header className="g7pb-block-gallery__header">
              <div>
                <p>블록 라이브러리</p>
                <h2 id="g7pb-block-gallery-title">화면을 보고 블록을 선택하세요</h2>
                <span>선택하면 현재 블록 바로 뒤에 추가됩니다.</span>
              </div>
              <button type="button" className="g7pb-block-gallery__close" aria-label="블록 갤러리 닫기"
                onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
            </header>
            {insertionError && <p role="alert">{insertionError}</p>}
            <div className="g7pb-block-gallery__tabs" role="tablist" aria-label="제작 단위">
              {([['all', '전체'], ...LIBRARY_KINDS] as const).map(([value, label], index, tabs) => (
                <button type="button" role="tab" key={value} id={`g7pb-library-tab-${value}`}
                  aria-controls="g7pb-library-results" tabIndex={productionKind === value ? 0 : -1} aria-selected={productionKind === value}
                  onKeyDown={(event) => {
                    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
                    if (next === null) return;
                    event.preventDefault(); setProductionKind(tabs[next][0]);
                    event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus();
                  }}
                  onClick={() => setProductionKind(value)}>{label}<span>{value === 'all' ? items.length : items.filter((item) => item.productionKind === value).length}</span></button>
              ))}
            </div>
            <div className="g7pb-block-gallery__tools" aria-label="블록 찾기">
              <input
                type="search"
                value={query}
                placeholder="이름, 용도 또는 분류 검색"
                aria-label="블록 검색"
                onChange={(event) => setQuery(event.target.value)}
              />
              <select value={category} aria-label="블록 분류" onChange={(event) => setCategory(event.target.value)}>
                <option value="">모든 용도</option>
                {categories.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}
              </select>
              <select value={kind} aria-label="블록 예제" onChange={(event) => {
                const value = event.currentTarget.value;
                if (value === 'all' || value === 'definition' || value === 'preset') setKind(value);
              }}>
                <option value="all">기본형과 변형</option><option value="definition">기본형</option><option value="preset">변형·예제</option>
              </select>
              <select value={packId} aria-label="블록 팩" onChange={(event) => setPackId(event.target.value)}>
                <option value="">모든 출처</option>
                {packs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
                <Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" /> 즐겨찾기
              </button>
            </div>
            {!query.trim() && !category && !packId && kind === 'all' && productionKind === 'all' && !favoritesOnly ? <section className="g7pb-block-gallery__quick" aria-labelledby="g7pb-quick-add-title">
              <div><small>QUICK ADD</small><h3 id="g7pb-quick-add-title">자주 쓰는 항목</h3></div>
              <div>{quickItems.map((item) => <button key={item.catalogId} type="button" data-testid={`page-builder-quick-add-${String(item.type).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`} onClick={() => insert(item)}><Plus size={15} aria-hidden="true" />{item.title}</button>)}</div>
            </section> : null}
            {productionKind === 'layout' && <p className="g7pb-block-gallery__empty">{layoutEnabled
              ? '구역을 추가한 뒤 구역 설정에서 열과 세로 묶음을 구성합니다.'
              : '편집 화면의 ‘구조 편집 사용’에서 전환한 뒤 구역을 추가할 수 있습니다.'}</p>}
            <div className="g7pb-block-gallery__grid" id="g7pb-library-results" role="tabpanel" aria-labelledby={`g7pb-library-tab-${productionKind}`}
              data-total-items={visibleItems.length}
              data-rendered-items={renderedItems.length}>
              {renderedItems.map((item, index) => (
                <article key={item.catalogId} className="g7pb-block-gallery__item"
                  data-production-kind={item.productionKind} data-component={item.type}
                  data-preview-density={blockPreviewDensity(item.type)}>
                  <button type="button" className="g7pb-block-gallery__add"
                    ref={index === 0 ? firstItemRef : undefined}
                    data-testid={item.testId} onClick={() => insert(item)}>
                    <BlockGalleryThumbnail item={item} />
                    <span className="g7pb-block-gallery__copy">
                      <small>{libraryKindLabel(item.productionKind)} · {item.category} · {item.packLabel} · {item.kind === 'preset' ? '변형·예제' : '기본형'}</small>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <EditingSummary item={item} />
                      <em>이 블록 추가 →</em>
                    </span>
                  </button>
                  <EditingScope item={item} />
                  {item.productionKind !== 'layout' && <button
                    type="button"
                    className="g7pb-block-gallery__favorite"
                    aria-label={`${item.title} ${item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}`}
                    aria-pressed={item.favorite}
                    onClick={() => void toggleFavorite(item.catalogId, !item.favorite)}
                  >
                    <Star size={18} fill={item.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>}
                </article>
              ))}
              {visibleItems.length === 0 && <p className="g7pb-block-gallery__empty">조건에 맞는 블록이 없습니다.</p>}
              {renderedItems.length < visibleItems.length && (
                <button
                  ref={loadMoreRef}
                  type="button"
                  className="g7pb-block-gallery__load-more"
                  data-testid="page-builder-gallery-load-more"
                  onClick={() => setRenderLimit((current) => Math.min(current + BLOCK_GALLERY_WINDOW_SIZE, visibleItems.length))}
                >
                  더 보기 <span>{renderedItems.length} / {visibleItems.length}</span>
                </button>
              )}
            </div>
          </section>
        </div>,
        globalThis.document.body,
      )}
    </div>
  );
}

export function PuckDrawerLibrary({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="g7pb-puck-drawer-library" data-testid="page-builder-block-library">
      <header className="g7pb-puck-drawer-library__header">
        <strong>블록 라이브러리</strong>
        <p>실제 화면을 확인하고 블록을 선택하세요.</p>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_BLOCK_GALLERY_EVENT))}>모든 제작 단위와 변형 보기</button>
      </header>
      {children}
    </div>
  );
}

export function PuckDrawerItem({ children, name }: { children: React.ReactNode; name: string }): React.ReactElement {
  const { items } = React.useContext(BlockCatalogContext);
  const item = items.find((candidate) => candidate.kind === 'definition' && candidate.type === name)
    ?? BLOCK_GALLERY_ITEMS.find((candidate) => candidate.type === name)
    ?? (name === 'LayoutSection' ? LAYOUT_GALLERY_ITEM : undefined);

  if (!item) {
    return <>{children}</>;
  }

  return (
    <div className="g7pb-puck-drawer-card" data-library-block={item.type} data-production-kind={item.productionKind}
      data-preview-density={blockPreviewDensity(item.type)}>
      <div className="g7pb-puck-drawer-card__preview">
        <BlockGalleryThumbnail item={item} />
      </div>
      <div className="g7pb-puck-drawer-card__copy">
        <small>{libraryKindLabel(item.productionKind)} · {item.category}</small>
        <strong>{item.title}</strong>
        <span>{item.description}</span>
        <EditingSummary item={item} />
        {item.favorite ? <em>★ 즐겨찾기</em> : null}
      </div>
    </div>
  );
}
