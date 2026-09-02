import React from 'react';
import type { SitePartResource } from '../api/resources';
import type { PageBuilderDocument } from '../documents/types';
import { pageDesignClassName, pageDesignCustomCss, type PageDesignProps } from './pageDesignTokens';
import { sitePartCanonicalToPuck, type SitePartComponents } from './sitePartDocumentAdapter';
import { AnnouncementPreview, FooterColumnsPreview, FooterSimplePreview, HeaderNavigationPreview } from './SitePartEditor';

export interface FullSiteCanvasValue {
  locale: PageBuilderDocument['locale'];
  shellMode: PageBuilderDocument['shell_mode'];
  header: SitePartResource | null;
  footer: SitePartResource | null;
  canEdit: boolean;
  edit: (kind: 'header' | 'footer') => void;
}

export const FullSiteCanvasContext = React.createContext<FullSiteCanvasValue>({ locale: 'ko', shellMode: 'none', header: null, footer: null, canEdit: false, edit: () => undefined });
function SitePartCanvasContent({ resource }: { resource: SitePartResource }): React.ReactElement {
  const data = sitePartCanonicalToPuck(resource.document);
  return <>{data.content.map((block, index) => {
    const props = block.props as SitePartComponents[keyof SitePartComponents] & { id?: string };
    if (block.type === 'HeaderNavigation') return <HeaderNavigationPreview key={props.id ?? index} {...props as SitePartComponents['HeaderNavigation']} />;
    if (block.type === 'Announcement') return <AnnouncementPreview key={props.id ?? index} {...props as SitePartComponents['Announcement']} />;
    if (block.type === 'FooterSimple') return <FooterSimplePreview key={props.id ?? index} {...props as SitePartComponents['FooterSimple']} />;
    return <FooterColumnsPreview key={props.id ?? index} {...props as SitePartComponents['FooterColumns']} />;
  })}</>;
}

function FullSiteCanvasPart({ kind, resource, template }: { kind: 'header' | 'footer'; resource: SitePartResource | null; template: boolean }): React.ReactElement {
  const canvas = React.useContext(FullSiteCanvasContext);
  return <section className={`g7pb-full-site-part g7pb-full-site-part--${kind}`} data-testid={`page-builder-canvas-${kind}`}>
    {resource ? <SitePartCanvasContent resource={resource} /> : <div className="g7pb-full-site-part__placeholder"><strong>{template ? `G7 활성 템플릿 ${kind === 'header' ? 'Header' : 'Footer'}` : `${kind === 'header' ? 'Header' : 'Footer'}가 아직 없습니다.`}</strong><span>{template ? '템플릿 공통 영역은 공개 미리보기에서 정확히 확인합니다.' : '공통 Site Part를 만들어 전체 사이트 흐름을 완성하세요.'}</span></div>}
    {!template ? <button type="button" className="g7pb-full-site-part__edit" disabled={!canvas.canEdit}
      onClick={() => canvas.edit(kind)}>{kind === 'header' ? 'Header' : 'Footer'} 편집</button> : null}
  </section>;
}

export function FullSiteRoot({ children, design }: { children: React.ReactNode; design: PageDesignProps }): React.ReactElement {
  const canvas = React.useContext(FullSiteCanvasContext);
  const template = canvas.shellMode === 'template';
  const builder = canvas.shellMode === 'builder' || canvas.shellMode === 'global';

  // Puck's iframe language is independent of the canonical document. Set the
  // content language here so font fallback/normal line boxes match publication.
  return <div lang={canvas.locale} className={`g7pb-preview-page ${pageDesignClassName(design)}`}>
    <style data-g7pb-custom-palette="true">{pageDesignCustomCss(design)}</style>
    {(template || builder) ? <FullSiteCanvasPart kind="header" resource={builder ? canvas.header : null} template={template} /> : null}
    <div className={`g7pb-full-site-page${template ? ' g7pb-full-site-page--template' : ''}`} data-testid="page-builder-canvas-page">{children}</div>
    {(template || builder) ? <FullSiteCanvasPart kind="footer" resource={builder ? canvas.footer : null} template={template} /> : null}
  </div>;
}

