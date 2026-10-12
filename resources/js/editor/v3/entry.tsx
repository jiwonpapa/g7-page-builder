/// <reference types="vite/client" />
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import '../../../css/page-builder-core.css';
import '../../../css/page-builder-structure.css';
import { ADMIN_AUTH_TOKEN_KEY, buildAdminLoginUrl, PAGE_BUILDER_EDITOR_PATH, PAGE_BUILDER_MANAGER_PATH, PageDocumentApiClient } from '../../api/pageBuilderApi';
import { createStructureDocument, parseV3DocumentResource } from '../../api/v3DocumentResource';
import { createApiDraftPort } from './apiDraftPort';
import { StructureDocumentHost, type StructureHostPorts } from './StructureDocumentHost';
import compositionUrl from '../../../compositions/builtin-v3.json?url&no-inline';
import { compositionChoices } from '../../editor-application/v3/compositions';

export function mountStructureDocument(element: HTMLElement): () => void {
  let token: string | null = null;
  try { token = window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY); } catch { /* Login owns unavailable storage. */ }
  if (!token) {
    window.location.replace(buildAdminLoginUrl(`${window.location.pathname}${window.location.search}`));
    return () => {};
  }
  const api = new PageDocumentApiClient();
  const ports: StructureHostPorts = {
    async load(id) {
      const resource = await api.getDocument(id);
      if (resource.document.document_id !== id) throw new Error('불러온 문서가 요청한 문서와 일치하지 않습니다.');
      return resource.document.schema_version === 'g7-page-builder/v1' || resource.document.schema_version === 'g7-page-builder/v2'
        ? { legacyUrl: `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(id)}` } : parseV3DocumentResource(resource, id);
    },
    create: input => createStructureDocument(api, input),
    drafts: createApiDraftPort(api),
    navigate: url => window.location.assign(url),
    created: id => window.history.replaceState(null, '', `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(id)}&editor=structure`),
    confirmLeave: () => window.confirm('저장하지 않은 변경이 있습니다. 문서함으로 이동할까요?'),
    nextId: () => crypto.randomUUID(),
  };
  const root = createRoot(element);
  const controller = new AbortController();
  let active = true;
  const render = (compositions: readonly unknown[], catalogMessage = '') => {
    if (active) root.render(<StructureDocumentHost documentId={element.dataset.documentId || undefined} locale={element.dataset.locale || 'ko'}
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
}
