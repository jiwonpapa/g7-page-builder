import React, { useEffect, useMemo, useState } from 'react';
import type { Field } from '@puckeditor/core';
import {
  ArrowRight,
  Link2,
  LockKeyhole,
  Search,
  UserRoundCheck,
  X,
} from 'lucide-react';

import { PageBuilderApiClient } from '../api/pageBuilderApi';
import type {
  DocumentResource,
  RouteCatalogEntry,
  RouteCatalogResource,
} from '../documents/types';

const api = new PageBuilderApiClient();
export const OPEN_ROUTE_PICKER_EVENT = 'g7pb:open-selected-route-picker';

type CatalogTargetSource = 'board' | 'category' | 'product';

export interface RouteTargetOption {
  value: string;
  label: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function collectCategoryOptions(items: unknown[], depth = 0): RouteTargetOption[] {
  return items.flatMap((value) => {
    const item = asRecord(value);
    if (!item || typeof item.slug !== 'string') return [];
    const label = typeof item.name_localized === 'string'
      ? item.name_localized
      : typeof item.name === 'string' ? item.name : item.slug;
    const children = Array.isArray(item.children) ? collectCategoryOptions(item.children, depth + 1) : [];
    return [{ value: item.slug, label: `${'— '.repeat(depth)}${label}` }, ...children];
  });
}

export function parseRouteTargetOptions(source: CatalogTargetSource, payload: unknown): RouteTargetOption[] {
  const envelope = asRecord(payload);
  const data = envelope?.data;
  const nested = asRecord(data);
  const items = Array.isArray(data) ? data : nested && Array.isArray(nested.data) ? nested.data : [];

  if (source === 'category') return collectCategoryOptions(items);

  return items.flatMap((value) => {
    const item = asRecord(value);
    if (!item) return [];
    const key = source === 'board' ? item.slug : item.product_code;
    const label = source === 'board'
      ? item.name
      : typeof item.name_localized === 'string' ? item.name_localized : item.name;
    return typeof key === 'string' && key !== '' && typeof label === 'string' && label !== ''
      ? [{ value: key, label }]
      : [];
  });
}

export async function loadRouteTargetOptions(
  source: CatalogTargetSource,
  fetcher: typeof fetch = fetch,
): Promise<RouteTargetOption[]> {
  const endpoint = {
    board: '/api/modules/sirsoft-board/boards?limit=0',
    category: '/api/modules/sirsoft-ecommerce/categories',
    product: '/api/modules/sirsoft-ecommerce/products?per_page=100',
  }[source];
  let token: string | null = null;
  try {
    token = window.localStorage.getItem('auth_token');
  } catch {
    token = null;
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetcher(endpoint, { credentials: 'same-origin', headers });
  if (!response.ok) throw new Error('G7 service targets are unavailable.');

  return parseRouteTargetOptions(source, await response.json());
}

export function filterRouteCatalog(routes: RouteCatalogEntry[], query: string): RouteCatalogEntry[] {
  const normalized = query.trim().toLocaleLowerCase('ko');
  if (!normalized) return routes;

  return routes.filter((route) => [route.label, route.path, route.category]
    .some((value) => value.toLocaleLowerCase('ko').includes(normalized)));
}

export function resolveRoutePath(
  route: RouteCatalogEntry,
  values: Record<string, string>,
): string | null {
  let resolved = route.path;
  for (const parameter of route.parameters) {
    const value = values[parameter]?.trim();
    if (!value) return null;
    resolved = resolved.replace(`:${parameter}`, encodeURIComponent(value));
  }

  return resolved;
}

function parameterLabel(parameter: string): string {
  return ({
    slug: '주소 식별자',
    id: '번호',
    product_code: '상품',
    order_number: '주문번호',
  } as Record<string, string>)[parameter] ?? parameter;
}

function routeBadge(route: RouteCatalogEntry): React.ReactElement | null {
  if (route.guest_only) return <span><UserRoundCheck size={12} /> 로그아웃 전용</span>;
  if (route.auth_required) return <span><LockKeyhole size={12} /> 로그인 필요</span>;
  return null;
}

function RouteUrlPicker({
  value,
  onChange,
  readOnly,
  label,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  label: string;
  testId?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<RouteCatalogResource | null>(null);
  const [catalogAttempted, setCatalogAttempted] = useState(false);
  const [documents, setDocuments] = useState<DocumentResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Partial<Record<CatalogTargetSource, RouteTargetOption[]>>>({});
  const [targetsLoading, setTargetsLoading] = useState<Partial<Record<CatalogTargetSource, boolean>>>({});

  useEffect(() => {
    if (!open || catalog !== null || loading || catalogAttempted) return;
    setCatalogAttempted(true);
    setLoading(true);
    setError(null);
    void api.getRouteCatalog()
      .then(setCatalog)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '서비스 경로를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [catalog, catalogAttempted, loading, open]);

  useEffect(() => {
    if (readOnly || !testId) return undefined;
    const openFromCanvas = (event: Event): void => {
      if (!(event instanceof CustomEvent) || event.detail?.testId !== testId) return;
      setOpen(true);
    };
    window.addEventListener(OPEN_ROUTE_PICKER_EVENT, openFromCanvas);
    return () => window.removeEventListener(OPEN_ROUTE_PICKER_EVENT, openFromCanvas);
  }, [readOnly, testId]);

  const selected = catalog?.routes.find((route) => route.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected || !Object.values(selected.parameter_sources).includes('page') || documents.length > 0) return;
    void api.listDocuments(1, 100, 'active')
      .then((resource) => setDocuments(resource.items))
      .catch(() => undefined);
  }, [documents.length, selected]);

  useEffect(() => {
    if (!selected) return;
    const sources = [...new Set(Object.values(selected.parameter_sources))]
      .filter((source): source is CatalogTargetSource => ['board', 'category', 'product'].includes(source));
    for (const source of sources) {
      if (targets[source] !== undefined || targetsLoading[source]) continue;
      setTargetsLoading((current) => ({ ...current, [source]: true }));
      void loadRouteTargetOptions(source)
        .then((options) => setTargets((current) => ({ ...current, [source]: options })))
        .catch(() => setTargets((current) => ({ ...current, [source]: [] })))
        .finally(() => setTargetsLoading((current) => ({ ...current, [source]: false })));
    }
  }, [selected, targets, targetsLoading]);

  const categories = useMemo(() => ['전체', ...new Set(catalog?.routes.map((route) => route.category) ?? [])], [catalog]);
  const visibleRoutes = useMemo(() => filterRouteCatalog(catalog?.routes ?? [], query)
    .filter((route) => category === '전체' || route.category === category), [catalog, category, query]);
  const resolved = selected ? resolveRoutePath(selected, parameters) : null;

  const choose = (route: RouteCatalogEntry): void => {
    setSelectedId(route.id);
    setParameters({});
  };
  const apply = (): void => {
    if (!resolved) return;
    onChange(resolved);
    setOpen(false);
  };

  return (
    <div className="g7pb-route-field">
      <label>{label}</label>
      <div className="g7pb-route-field__input-row">
        <input
          type="text"
          value={value ?? ''}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="/login 또는 https://…"
          disabled={readOnly}
          data-testid={testId}
          aria-label={label}
        />
        <button type="button" disabled={readOnly} onClick={() => setOpen(true)} data-testid="page-builder-route-picker-open">
          <Link2 size={15} /> 연결 선택
        </button>
      </div>
      {open ? (
        <div className="g7pb-route-picker-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="g7pb-route-picker" role="dialog" aria-modal="true" aria-labelledby="g7pb-route-picker-title"
            data-testid="page-builder-route-picker">
            <header>
              <div><span>G7 서비스 연결</span><h2 id="g7pb-route-picker-title">버튼이 이동할 화면을 고르세요.</h2></div>
              <button type="button" aria-label="닫기" onClick={() => setOpen(false)}><X size={19} /></button>
            </header>
            <div className="g7pb-route-picker__body">
              <aside>
                <label className="g7pb-route-picker__search"><Search size={16} /><input type="search" value={query}
                  placeholder="로그인, 게시판, 상품…" autoFocus onChange={(event) => setQuery(event.currentTarget.value)} /></label>
                <nav aria-label="경로 분류">{categories.map((item) => <button type="button" key={item}
                  aria-current={category === item ? 'true' : undefined} onClick={() => setCategory(item)}>{item}</button>)}</nav>
                <div className="g7pb-route-picker__routes">
                  {loading ? <p>현재 템플릿 경로를 불러오는 중입니다.</p> : null}
                  {error ? <p role="alert">{error}</p> : null}
                  {!loading && !error && visibleRoutes.length === 0 ? <p>검색 결과가 없습니다.</p> : null}
                  {visibleRoutes.map((route) => <button type="button" key={route.id}
                    className={selectedId === route.id ? 'is-selected' : ''} onClick={() => choose(route)}>
                    <strong>{route.label}</strong><code>{route.path}</code>{routeBadge(route)}
                  </button>)}
                </div>
              </aside>
              <div className="g7pb-route-picker__detail">
                {selected ? <>
                  <p className="g7pb-kicker">{selected.category}</p>
                  <h3>{selected.label}</h3>
                  <p>{selected.parameters.length > 0 ? '필요한 대상을 선택하거나 식별자를 입력해 주세요.' : '추가 입력 없이 바로 연결할 수 있습니다.'}</p>
                  {selected.parameters.map((parameter) => {
                    const source = selected.parameter_sources[parameter];
                    const canChoosePage = source === 'page' && documents.length > 0;
                    const targetOptions = source === 'board' || source === 'category' || source === 'product'
                      ? targets[source]
                      : undefined;
                    const canChooseTarget = targetOptions !== undefined && targetOptions.length > 0;
                    return <label key={parameter}>{parameterLabel(parameter)}
                      {canChoosePage ? <select value={parameters[parameter] ?? ''}
                        onChange={(event) => setParameters((current) => ({ ...current, [parameter]: event.currentTarget.value }))}>
                        <option value="">페이지를 선택하세요</option>
                        {documents.map((document) => <option key={document.document.document_id} value={document.document.slug}>
                          {document.title} · /{document.document.slug}
                        </option>)}
                      </select> : canChooseTarget ? <select value={parameters[parameter] ?? ''}
                        onChange={(event) => setParameters((current) => ({ ...current, [parameter]: event.currentTarget.value }))}>
                        <option value="">대상을 선택하세요</option>
                        {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select> : <input value={parameters[parameter] ?? ''}
                        placeholder={source === 'board' || source === 'category' || source === 'product'
                          ? targetsLoading[source] ? '목록을 불러오는 중…' : '등록된 대상이 없어 직접 입력'
                          : `${parameter} 입력`}
                        onChange={(event) => setParameters((current) => ({ ...current, [parameter]: event.currentTarget.value }))} />}
                    </label>;
                  })}
                  <div className="g7pb-route-picker__preview"><span>연결 주소</span><code>{resolved ?? '필수 값을 입력해 주세요.'}</code></div>
                </> : <div className="g7pb-route-picker__empty"><Link2 size={28} /><p>왼쪽에서 서비스 화면을 선택하세요.</p></div>}
              </div>
            </div>
            <footer>
              <small>활성 템플릿: {catalog?.active_template ?? '확인 중'}</small>
              <div><button type="button" onClick={() => setOpen(false)}>취소</button><button type="button" className="is-primary"
                disabled={!resolved} onClick={apply}>이 경로 연결 <ArrowRight size={15} /></button></div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function createRouteUrlField(label: string, testId?: string): Field<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => (
      <RouteUrlPicker value={typeof value === 'string' ? value : ''} onChange={onChange}
        readOnly={readOnly} label={label} testId={testId} />
    ),
  };
}
