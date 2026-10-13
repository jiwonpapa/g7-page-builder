/// <reference types="vite/client" />
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import '../../../css/page-builder-core.css';
import '../../../css/page-builder-structure.css';
import { ADMIN_AUTH_TOKEN_KEY, buildAdminLoginUrl, PAGE_BUILDER_EDITOR_PATH, PAGE_BUILDER_MANAGER_PATH, PageDocumentApiClient, PageBuilderApiClient } from '../../api/pageBuilderApi';
import { createStructureDocument, parseV3DocumentResource } from '../../api/v3DocumentResource';
import { createApiDraftPort } from './apiDraftPort';
import { createApiPublicationPort } from './apiPublicationPort';
import { StructureDocumentHost, type StructureHostPorts } from './StructureDocumentHost';
import compositionUrl from '../../../compositions/builtin-v3.json?url&no-inline';
import { compositionChoices } from '../../editor-application/v3/compositions';
import { ElementSitePartApi } from '../../api/elementSitePartApi';
import { StructureSitePartHost } from './StructureSitePartHost';
import { sitePartDraftPort, type SitePartHostPorts } from './sitePartPorts';
import { sitePartEditorUrl } from '../sitePartEditorRouting';
import { createApiMediaPort } from './apiMediaPort';
import { ElementCompositionApi } from '../../api/elementCompositionApi';
import { createApiCompositionPort } from './apiCompositionPort';

export function mountStructureDocument(element: HTMLElement): () => void {
  return mount(element, false);
}
export function mountStructureSiteParts(element: HTMLElement): () => void {
  return mount(element, true);
}
function mount(element: HTMLElement, siteParts: boolean): () => void {
  let token: string | null = null;
  try { token = window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY); } catch { /* Login owns unavailable storage. */ }
  if (!token) {
    window.location.replace(buildAdminLoginUrl(`${window.location.pathname}${window.location.search}`));
    return () => {};
  }
  const api = new PageDocumentApiClient();
  const media = createApiMediaPort(new PageBuilderApiClient());
  const library = createApiCompositionPort(new ElementCompositionApi());
  const ports: StructureHostPorts = {
    media, library,
    async load(id) {
      const resource = await api.getDocument(id);
      if (resource.document.document_id !== id) throw new Error('불러온 문서가 요청한 문서와 일치하지 않습니다.');
      return resource.document.schema_version === 'g7-page-builder/v1' || resource.document.schema_version === 'g7-page-builder/v2'
        ? { legacyUrl: `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(id)}` } : parseV3DocumentResource(resource, id);
    },
    create: input => createStructureDocument(api, input),
    drafts: createApiDraftPort(api),
    publication: createApiPublicationPort(api, window.location.origin),
    navigate: url => window.location.assign(url),
    created: id => window.history.replaceState(null, '', `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(id)}&editor=structure`),
    confirmLeave: () => window.confirm('저장하지 않은 변경이 있습니다. 문서함으로 이동할까요?'),
    nextId: () => crypto.randomUUID(),
  };
  const root = createRoot(element);
  const siteApi = new ElementSitePartApi();
  const locale = element.dataset.locale || 'ko';
  const initialSetId = new URLSearchParams(window.location.search).get('set_id') || undefined;
  const partPorts: SitePartHostPorts = {
    media, library,
    list: locale => siteApi.list(locale), create: (title, locale) => siteApi.create(title, locale),
    load: set => siteApi.load(set), draft: (source, saved) => sitePartDraftPort(siteApi, source, saved),
    publish: pair => siteApi.publish(pair), activate: set => siteApi.activate(set),
    navigate: ports.navigate, nextId: ports.nextId,
    selected: id => window.history.replaceState(null, '', sitePartEditorUrl(id, locale, true)),
    confirmLeave: () => window.confirm('저장하지 않은 변경 또는 처리 중인 요청이 있습니다. 이동할까요?'),
    confirmPublish: active => window.confirm(active
      ? 'Header와 Footer를 함께 발행합니다. 사용 중인 사이트의 공통영역이 변경됩니다. 계속할까요?'
      : 'Header와 Footer의 저장된 초안을 함께 발행할까요? 사이트 적용은 별도입니다.'),
    confirmActivate: () => window.confirm('이 세트의 마지막 발행본을 사이트 공통영역에 적용할까요?'),
  };
  const controller = new AbortController();
  let active = true;
  const render = (compositions: readonly unknown[], catalogMessage = '') => {
    if (active) root.render(siteParts
      ? <StructureSitePartHost setId={initialSetId} locale={locale}
          ports={partPorts} compositions={compositions} catalogMessage={catalogMessage} libraryUrl={PAGE_BUILDER_MANAGER_PATH} />
      : <StructureDocumentHost documentId={element.dataset.documentId || undefined} locale={locale}
          ports={ports} compositions={compositions} catalogMessage={catalogMessage} libraryUrl={PAGE_BUILDER_MANAGER_PATH} />);
  };
  render([], '구성 목록을 불러오는 중입니다. 기본 요소로 편집할 수 있습니다.');
  void fetch(compositionUrl, { credentials: 'same-origin', signal: controller.signal }).then(async response => {
    if (!response.ok) throw new Error('Composition asset unavailable');
    const sources: unknown = await response.json();
    if (!Array.isArray(sources)) throw new Error('Invalid composition asset');
    render(compositionChoices(sources).map(choice => choice.source));
  }).catch(() => render([], '구성 목록을 불러오지 못했습니다. 기본 요소 편집과 문서 저장은 계속 사용할 수 있습니다.'));
  return () => { active = false; controller.abort(); root.unmount(); };
}

if (typeof document !== 'undefined') {
  const element = document.querySelector<HTMLElement>('[data-g7pb-structure-editor]');
  if (element) mountStructureDocument(element);
  const siteParts = document.querySelector<HTMLElement>('[data-g7pb-structure-site-parts]');
  if (siteParts) mountStructureSiteParts(siteParts);
}
