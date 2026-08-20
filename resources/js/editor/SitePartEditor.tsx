import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puck, type Config, type Viewports } from '@puckeditor/core';
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Monitor,
  Save,
  Smartphone,
  Tablet,
} from 'lucide-react';

import {
  PAGE_BUILDER_MANAGER_PATH,
  PageBuilderApiClient,
  PageBuilderApiError,
} from '../api/pageBuilderApi';
import type { SitePartKind, SitePartResource } from '../documents/types';
import { createMediaField } from './MediaPickerField';
import {
  type AnnouncementProps,
  type FooterColumnsProps,
  type FooterSimpleProps,
  type HeaderNavigationProps,
  linesToLinks,
  safeSitePartHref,
  type SitePartComponents,
  sitePartCanonicalToPuck,
  type SitePartPuckData,
  sitePartPuckToCanonical,
} from './sitePartDocumentAdapter';

interface SitePartEditorProps {
  kind: SitePartKind;
  locale: string;
}

const VIEWPORTS: Viewports = [
  { width: 360, height: 'auto', label: '모바일', icon: 'Smartphone' },
  { width: 768, height: 'auto', label: '태블릿', icon: 'Tablet' },
  { width: 1280, height: 'auto', label: 'PC', icon: 'Monitor' },
];

function HeaderNavigationPreview(props: HeaderNavigationProps): React.ReactElement {
  return (
    <header className={`g7pb-site-header ${props.sticky ? 'is-sticky' : ''} ${props.variant === 'transparent' ? 'is-transparent' : ''}`}>
      <div className="g7pb-site-header__inner">
        <a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()}>
          {props.logoUrl ? <img src={props.logoUrl} alt={props.brandName} /> : <span data-g7pb-inline-field="brandName">{props.brandName}</span>}
        </a>
        <nav className="g7pb-site-nav" aria-label="주 메뉴"><ul>{props.navigation.map((item, index) => (
          <li key={`${item.label}-${index}`}><a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}</a></li>
        ))}</ul></nav>
        {props.ctaLabel ? <a className="g7pb-site-header__cta" href={safeSitePartHref(props.ctaUrl)} onClick={(event) => event.preventDefault()}>{props.ctaLabel}</a> : null}
        {props.mobileMenu ? <button className="g7pb-menu-toggle" type="button" aria-label="모바일 메뉴"><span /></button> : null}
      </div>
    </header>
  );
}

function AnnouncementPreview(props: AnnouncementProps): React.ReactElement {
  return <aside className={`g7pb-site-announcement g7pb-site-announcement--${props.tone}`}><p>
    <span data-g7pb-inline-field="text">{props.text}</span>
    {props.linkLabel ? <a href={safeSitePartHref(props.linkUrl)} onClick={(event) => event.preventDefault()}>{props.linkLabel}</a> : null}
  </p></aside>;
}

function FooterSimplePreview(props: FooterSimpleProps): React.ReactElement {
  return <footer className="g7pb-site-footer"><div className="g7pb-site-footer__top">
    <a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()} data-g7pb-inline-field="brandName">{props.brandName}</a>
    <nav aria-label="하단 메뉴"><ul>{props.navigation.map((item, index) => <li key={`${item.label}-${index}`}><a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}</a></li>)}</ul></nav>
  </div>{props.footerText ? <p className="g7pb-site-footer__legal" data-g7pb-inline-field="footerText">{props.footerText}</p> : null}</footer>;
}

function FooterColumnsPreview(props: FooterColumnsProps): React.ReactElement {
  return <footer className="g7pb-site-footer g7pb-site-footer--columns"><div className="g7pb-site-footer__columns">
    <div><a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()}>{props.brandName}</a></div>
    {props.columns.map((column, index) => <section key={`${column.heading}-${index}`}><h2>{column.heading}</h2><ul>{linesToLinks(column.linksText).map((link, linkIndex) => <li key={`${link.label}-${linkIndex}`}><a href={safeSitePartHref(link.url)} onClick={(event) => event.preventDefault()}>{link.label}</a></li>)}</ul></section>)}
  </div>{props.legalText ? <p className="g7pb-site-footer__legal">{props.legalText}</p> : null}</footer>;
}

export function sitePartConfigFor(kind: SitePartKind): Config<SitePartComponents> {
  const all: Config<SitePartComponents>['components'] = {
    HeaderNavigation: {
      label: 'Header · 내비게이션',
      defaultProps: { brandName: '사이트 이름', logoUrl: '', homeUrl: '/', variant: 'solid', sticky: true, navigation: [{ label: '소개', url: '/pages/about' }], ctaLabel: '문의하기', ctaUrl: '/pages/contact', mobileMenu: true },
      fields: {
        brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, logoUrl: createMediaField('로고 이미지'), homeUrl: { type: 'text', label: '홈 URL' },
        variant: { type: 'radio', label: '배경', options: [{ label: '기본', value: 'solid' }, { label: '투명', value: 'transparent' }] }, sticky: { type: 'radio', label: '스크롤 고정', options: [{ label: '고정', value: true }, { label: '고정 안 함', value: false }] },
        navigation: { type: 'array', label: '메뉴', min: 0, max: 10, defaultItemProps: (index) => ({ label: `메뉴 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, url: { type: 'text', label: 'URL' } } },
        ctaLabel: { type: 'text', label: '강조 버튼 문구', contentEditable: true }, ctaUrl: { type: 'text', label: '강조 버튼 URL' }, mobileMenu: { type: 'radio', label: '모바일 메뉴', options: [{ label: '사용', value: true }, { label: '숨김', value: false }] },
      },
      render: (props) => <HeaderNavigationPreview {...props} />,
    },
    Announcement: {
      label: 'Header · 공지 바',
      defaultProps: { text: '새로운 소식을 알려보세요.', linkLabel: '자세히', linkUrl: '/', tone: 'brand' },
      fields: { text: { type: 'text', label: '공지 문구', contentEditable: true }, linkLabel: { type: 'text', label: '링크 문구', contentEditable: true }, linkUrl: { type: 'text', label: '링크 URL' }, tone: { type: 'select', label: '색상', options: [{ label: '브랜드', value: 'brand' }, { label: '어둡게', value: 'dark' }, { label: '밝게', value: 'light' }] } },
      render: (props) => <AnnouncementPreview {...props} />,
    },
    FooterSimple: {
      label: 'Footer · 기본',
      defaultProps: { brandName: '사이트 이름', homeUrl: '/', navigation: [{ label: '소개', url: '/pages/about' }], footerText: '사이트 정보를 입력해 주세요.' },
      fields: { brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, homeUrl: { type: 'text', label: '홈 URL' }, navigation: { type: 'array', label: '하단 메뉴', min: 0, max: 10, defaultItemProps: (index) => ({ label: `메뉴 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, url: { type: 'text', label: 'URL' } } }, footerText: { type: 'textarea', label: '법적·사업자 문구', contentEditable: true } },
      render: (props) => <FooterSimplePreview {...props} />,
    },
    FooterColumns: {
      label: 'Footer · 다단 메뉴',
      defaultProps: { brandName: '사이트 이름', homeUrl: '/', columns: [{ heading: '서비스', linksText: '소개|/pages/about\n문의|/pages/contact' }], legalText: '사이트 정보를 입력해 주세요.' },
      fields: { brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, homeUrl: { type: 'text', label: '홈 URL' }, columns: { type: 'array', label: '메뉴 그룹', min: 1, max: 4, defaultItemProps: (index) => ({ heading: `메뉴 ${index + 1}`, linksText: '링크|/' }), getItemSummary: (item) => item.heading, arrayFields: { heading: { type: 'text', label: '그룹 제목', contentEditable: true }, linksText: { type: 'textarea', label: '링크(이름|URL, 줄바꿈)' } } }, legalText: { type: 'textarea', label: '법적·사업자 문구', contentEditable: true } },
      render: (props) => <FooterColumnsPreview {...props} />,
    },
  };
  const allowed = kind === 'header' ? ['HeaderNavigation', 'Announcement'] : ['FooterSimple', 'FooterColumns'];
  return {
    components: Object.fromEntries(Object.entries(all).filter(([name]) => allowed.includes(name))) as Config<SitePartComponents>['components'],
    root: { fields: {}, render: ({ children }) => <div className={`g7pb-site-part-preview g7pb-site-part-preview--${kind}`}>{kind === 'footer' ? <div className="g7pb-site-part-sample"><span>페이지 본문 미리보기</span></div> : null}{children}{kind === 'header' ? <div className="g7pb-site-part-sample"><span>페이지 본문 미리보기</span></div> : null}</div> },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

export function SitePartEditor({ kind, locale }: SitePartEditorProps): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const config = useMemo(() => sitePartConfigFor(kind), [kind]);
  const [resource, setResource] = useState<SitePartResource | null>(null);
  const [data, setData] = useState<SitePartPuckData>({ root: { props: {} }, content: [] });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const resourceRef = useRef<SitePartResource | null>(null);
  const dataRef = useRef(data);

  const apply = useCallback((next: SitePartResource): void => {
    resourceRef.current = next;
    setResource(next);
    const nextData = sitePartCanonicalToPuck(next.document);
    dataRef.current = nextData;
    setData(nextData);
    setDirty(false);
  }, []);

  useEffect(() => {
    let active = true;
    setBusy(true);
    api.getSitePart(kind, locale).catch((error: unknown) => {
      if (error instanceof PageBuilderApiError && error.status === 404) return api.bootstrapSitePart(kind, locale);
      throw error;
    }).then((next) => { if (active) apply(next); })
      .catch((error: unknown) => { if (active) setMessage(errorMessage(error)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [api, apply, kind, locale]);

  const save = useCallback(async (): Promise<SitePartResource | null> => {
    const current = resourceRef.current;
    if (!current) return null;
    setBusy(true);
    setMessage(null);
    try {
      const document = sitePartPuckToCanonical(dataRef.current, current.document);
      const saved = await api.saveSitePart(kind, current.title, document, current.lock_version);
      apply(saved);
      return saved;
    } catch (error) {
      setMessage(errorMessage(error));
      return null;
    } finally {
      setBusy(false);
    }
  }, [api, apply, kind]);

  useEffect(() => {
    if (!dirty || busy) return undefined;
    const timer = window.setTimeout(() => { void save(); }, 2_000);
    return () => window.clearTimeout(timer);
  }, [busy, dirty, save]);

  const publish = async (): Promise<void> => {
    const saved = dirty ? await save() : resourceRef.current;
    if (!saved) return;
    setBusy(true);
    setMessage(null);
    try {
      apply(await api.publishSitePart(kind, locale, saved.lock_version));
      setMessage(`${kind === 'header' ? 'Header' : 'Footer'} 발행을 완료했습니다.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const update = (next: SitePartPuckData): void => {
    dataRef.current = next;
    setData(next);
    setDirty(true);
    setMessage(null);
  };

  return <main className="g7pb-root g7pb-site-part-editor" data-testid="page-builder-site-part-editor" data-kind={kind}>
    <header className="g7pb-command-bar">
      <div className="g7pb-command-bar__identity"><a href={PAGE_BUILDER_MANAGER_PATH} className="g7pb-icon-link" aria-label="문서함으로 돌아가기"><ArrowLeft size={18} /></a><div><p>Global Site Part</p><strong>{kind === 'header' ? 'Header 편집' : 'Footer 편집'}</strong></div></div>
      <div className="g7pb-command-bar__actions">
        <span className="g7pb-status" data-state={dirty ? 'dirty' : 'saved'}>{dirty ? '저장할 변경 있음' : resource?.status === 'published' ? '발행됨' : '저장됨'}</span>
        <button type="button" className="g7pb-button g7pb-button--quiet" disabled={busy || !resource} onClick={() => void save()}><Save size={17} /> 저장</button>
        <button type="button" className="g7pb-button g7pb-button--primary" disabled={busy || !resource} data-testid="page-builder-site-part-publish" onClick={() => void publish()}>{resource?.status === 'published' && !dirty ? <Check size={17} /> : <CloudUpload size={17} />} 발행</button>
      </div>
    </header>
    {message ? <div className="g7pb-notice" role="alert"><span>{message}</span><button type="button" className="g7pb-notice__dismiss" onClick={() => setMessage(null)}>닫기</button></div> : null}
    {busy && !resource ? <div className="g7pb-loading">Site Part를 준비하는 중입니다.</div> : null}
    {resource ? <div className="g7pb-site-part-puck" aria-busy={busy}>
      <div className="g7pb-site-part-device-legend" aria-hidden="true"><Smartphone size={15} /><Tablet size={15} /><Monitor size={15} /><span>상단 기기 버튼으로 반응형 화면을 확인하세요.</span></div>
      <Puck config={config} data={data} height="100%" iframe={{ enabled: true, syncHostStyles: true, waitForStyles: false }} viewports={VIEWPORTS} ui={{ viewports: { current: { width: 1280, height: 'auto' }, controlsVisible: true, options: VIEWPORTS } }} permissions={{ edit: !busy, insert: !busy, delete: !busy, duplicate: !busy, drag: !busy }} headerTitle={kind === 'header' ? 'Header 블록' : 'Footer 블록'} headerPath={resource.title} onChange={update} onPublish={() => void publish()} />
    </div> : null}
  </main>;
}
