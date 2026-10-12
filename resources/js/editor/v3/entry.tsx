import React from 'react';
import { createRoot } from 'react-dom/client';
import '@puckeditor/core/puck.css';
import '../../../css/page-builder-core.css';
import '../../../css/page-builder-structure.css';
import { ADMIN_AUTH_TOKEN_KEY, buildAdminLoginUrl, PAGE_BUILDER_EDITOR_PATH, PAGE_BUILDER_MANAGER_PATH, PageDocumentApiClient } from '../../api/pageBuilderApi';
import { createStructureDocument, parseV3DocumentResource } from '../../api/v3DocumentResource';
import { createApiDraftPort } from './apiDraftPort';
import { StructureDocumentHost, type StructureHostPorts } from './StructureDocumentHost';
import compositions from '../../../compositions/builtin-v3.json';

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
  root.render(<StructureDocumentHost documentId={element.dataset.documentId || undefined} locale={element.dataset.locale || 'ko'}
    ports={ports} compositions={compositions} libraryUrl={PAGE_BUILDER_MANAGER_PATH} />);
  return () => root.unmount();
}

if (typeof document !== 'undefined') {
  const element = document.querySelector<HTMLElement>('[data-g7pb-structure-editor]');
  if (element) mountStructureDocument(element);
}
