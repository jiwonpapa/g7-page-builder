import type { ElementSitePartApi } from '../../api/elementSitePartApi';
import type { ElementPartPair, ElementPartResource } from '../../api/elementSitePartResource';
import type { SitePartSetResource } from '../../api/resources';
import { reopenDraft, type DraftPort } from '../../editor-application/v3/session';
import type { MediaPort } from '../../editor-application/v3/media';

export interface SitePartHostPorts {
  media?: MediaPort;
  list: (locale: string) => Promise<SitePartSetResource[]>;
  create: (title: string, locale: string) => Promise<SitePartSetResource>;
  load: (set: SitePartSetResource) => Promise<ElementPartPair | { legacy: true }>;
  draft: (source: ElementPartResource, saved: (value: ElementPartResource) => void) => DraftPort;
  publish: (pair: ElementPartPair) => Promise<ElementPartPair>;
  activate: (set: SitePartSetResource) => Promise<SitePartSetResource>;
  navigate: (url: string) => void;
  selected: (id: string) => void;
  confirmLeave: () => boolean;
  confirmPublish: (active: boolean) => boolean;
  confirmActivate: () => boolean;
  nextId: () => string;
}
/** Session owns late-input handling; transport never replaces the editor document. */
export function sitePartDraftPort(api: Pick<ElementSitePartApi, 'save'>, source: ElementPartResource,
  saved: (value: ElementPartResource) => void): DraftPort {
  return { async save(request) {
    const document = reopenDraft(request.json, request.documentId);
    if (request.documentId !== source.document.content.document_id) throw new Error('공통영역 저장 대상이 일치하지 않습니다.');
    const result = await api.save(source, document, request.expectedRevision);
    saved(result);
    return { documentId: result.document.content.document_id, revision: result.lock_version };
  } };
}
