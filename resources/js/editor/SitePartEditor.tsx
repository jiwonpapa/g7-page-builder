import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Puck, registerOverlayPortal, type Config, type Viewports } from '@puckeditor/core';
import {
  ArrowLeft,
  Check,
  CloudUpload,
  LayoutTemplate,
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
import { createRouteUrlField } from './RouteUrlField';
import {
  type AnnouncementProps,
  type FooterColumnsProps,
  type FooterSimpleProps,
  type HeaderNavigationProps,
  safeSitePartHref,
  type SitePartComponents,
  type SitePartPresetKey,
  sitePartCanonicalToPuck,
  sitePartPresetToPuck,
  type SitePartPuckData,
  sitePartPuckToCanonical,
} from './sitePartDocumentAdapter';

interface SitePartEditorProps {
  kind: SitePartKind;
  locale: string;
  setId?: string;
  embedded?: boolean;
  paired?: boolean;
  iframeEnabled?: boolean;
  onBack?: () => void;
  onChanged?: (resource: SitePartResource) => void;
}

const VIEWPORTS: Viewports = [
  { width: 360, height: 'auto', label: '모바일', icon: 'Smartphone' },
  { width: 768, height: 'auto', label: '태블릿', icon: 'Tablet' },
  { width: 1280, height: 'auto', label: 'PC', icon: 'Monitor' },
];

export function HeaderSystemControlsPreview(): React.ReactElement {
  const prevent = (event: React.SyntheticEvent): void => event.preventDefault();
  return <nav className="g7pb-system-controls" aria-label="사이트 기능 미리보기" data-g7pb-system-controls>
    <form className="g7pb-system-search" action="/search" onSubmit={prevent}>
      <input name="q" aria-label="통합 검색" placeholder="통합 검색" readOnly />
      <button type="submit">검색</button>
    </form>
    <a href="/shop/cart" onClick={prevent}>장바구니</a>
    <button type="button">화면 모드</button>
    <label className="g7pb-system-select"><span>언어</span><select aria-label="언어" value="ko" disabled><option value="ko">한국어</option></select></label>
    <a href="/login" onClick={prevent}>로그인</a>
  </nav>;
}

function HeaderMobileMenuPreview(props: HeaderNavigationProps): React.ReactElement | null {
  const menuId = `g7pb-preview-mobile-menu-${useId().replaceAll(':', '')}`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<number, boolean>>({});
  const drawer = props.mobileMenuStyle !== 'dropdown';
  const direction = props.mobileMenuStyle === 'drawer-left' ? '왼쪽' : props.mobileMenuStyle === 'drawer-right' ? '오른쪽' : '아래';

  const close = useCallback((restoreFocus = false): void => {
    setOpen(false);
    setOpenSubmenus({});
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!props.mobileMenu) close();
  }, [close, props.mobileMenu]);

  useEffect(() => registerOverlayPortal(interactionRef.current, { disableDrag: true }), [props.mobileMenu]);

  useEffect(() => {
    if (!props.mobileMenu) {
      setOverlayHost(null);
      return undefined;
    }
    const ownerDocument = toggleRef.current?.ownerDocument;
    if (!ownerDocument) return undefined;
    const host = ownerDocument.createElement('div');
    host.className = 'g7pb-header-mobile-overlay-host';
    ownerDocument.body.append(host);
    const unregister = registerOverlayPortal(host, { disableDrag: true });
    setOverlayHost(host);
    return () => {
      unregister?.();
      host.remove();
    };
  }, [props.mobileMenu]);

  useEffect(() => {
    if (!open) return undefined;
    const ownerDocument = toggleRef.current?.ownerDocument;
    if (!ownerDocument) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close(true);
    };
    ownerDocument.addEventListener('keydown', onKeyDown);
    return () => ownerDocument.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  if (!props.mobileMenu) return null;

  const overlay = <>
    {drawer ? <button
      className="g7pb-mobile-menu__backdrop"
      type="button"
      aria-label="모바일 메뉴 닫기"
      data-g7pb-preview-menu-backdrop
      hidden={!open}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }}
    /> : null}
    <nav
      id={menuId}
      className={`g7pb-mobile-menu g7pb-mobile-menu--preview g7pb-mobile-menu--${props.mobileMenuStyle}`}
      aria-label="모바일 메뉴"
      data-g7pb-preview-mobile-menu
      data-g7pb-menu-style={props.mobileMenuStyle}
      hidden={!open}
    >
      {drawer ? <button
        className="g7pb-mobile-menu__close"
        type="button"
        aria-label="모바일 메뉴 닫기"
        data-g7pb-preview-menu-close
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }}
      >×</button> : null}
      <ul>{props.navigation.map((item, index) => {
        const submenuId = `${menuId}-submenu-${index}`;
        const submenuOpen = openSubmenus[index] === true;
        return <li key={`${item.label}-${index}`} className={item.children.length > 0 ? 'has-children' : undefined}>
          {item.children.length > 0 ? <>
            <div className="g7pb-mobile-menu__row">
              <a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}</a>
              <button
                type="button"
                aria-controls={submenuId}
                aria-expanded={submenuOpen}
                aria-label={`${item.label} 하위 메뉴 ${submenuOpen ? '닫기' : '열기'}`}
                data-g7pb-preview-submenu-toggle
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpenSubmenus((current) => ({ ...current, [index]: !submenuOpen }));
                }}
              ><span aria-hidden="true">⌄</span></button>
            </div>
            <ul id={submenuId} className="g7pb-mobile-subnav" data-g7pb-preview-mobile-submenu hidden={!submenuOpen}>
              {item.children.map((child, childIndex) => <li key={`${child.label}-${childIndex}`}><a href={safeSitePartHref(child.url)} onClick={(event) => event.preventDefault()}>{child.label}</a></li>)}
            </ul>
          </> : <a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}</a>}
        </li>;
      })}</ul>
      {props.ctaLabel ? <a className="g7pb-mobile-menu__cta" href={safeSitePartHref(props.ctaUrl)} onClick={(event) => event.preventDefault()}>{props.ctaLabel}</a> : null}
    </nav>
  </>;

  return <div ref={interactionRef} className="g7pb-header-mobile-editor-controls">
    <button
      ref={toggleRef}
      className="g7pb-menu-toggle"
      type="button"
      aria-controls={menuId}
      aria-expanded={open}
      aria-label={`${direction} 모바일 메뉴 ${open ? '닫기' : '열기'}`}
      data-g7pb-preview-menu-toggle
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (open) close();
        else setOpen(true);
      }}
    ><span /></button>
    {overlayHost ? createPortal(overlay, overlayHost) : null}
  </div>;
}

export function HeaderNavigationPreview(props: HeaderNavigationProps): React.ReactElement {
  const navigation = (className: string, label: string): React.ReactElement => <nav className={className} aria-label={label}><ul>{props.navigation.map((item, index) => (
    <li key={`${item.label}-${index}`} className={item.children.length > 0 ? 'has-children' : undefined}>
      <a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}{item.children.length > 0 ? <span aria-hidden="true">⌄</span> : null}</a>
      {item.children.length > 0 ? <ul className="g7pb-site-subnav">{item.children.map((child, childIndex) => (
        <li key={`${child.label}-${childIndex}`}><a href={safeSitePartHref(child.url)} onClick={(event) => event.preventDefault()}>{child.label}</a></li>
      ))}</ul> : null}
    </li>
  ))}</ul></nav>;
  return (
    <header className={`g7pb-site-header ${props.sticky ? 'is-sticky' : ''} ${props.variant === 'transparent' ? 'is-transparent' : ''}`}>
      <div className="g7pb-site-header__inner">
        <a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()}>
          {props.logoUrl ? <img src={props.logoUrl} alt={props.brandName} /> : <span data-g7pb-inline-field="brandName">{props.brandName}</span>}
        </a>
        {navigation('g7pb-site-nav', '주 메뉴')}
        <div className="g7pb-site-header__actions">
          {props.ctaLabel ? <a className="g7pb-site-header__cta" href={safeSitePartHref(props.ctaUrl)} onClick={(event) => event.preventDefault()}>{props.ctaLabel}</a> : null}
          <HeaderSystemControlsPreview />
          <HeaderMobileMenuPreview {...props} />
        </div>
      </div>
    </header>
  );
}

export function AnnouncementPreview(props: AnnouncementProps): React.ReactElement {
  return <aside className={`g7pb-site-announcement g7pb-site-announcement--${props.tone}`}><p>
    <span data-g7pb-inline-field="text">{props.text}</span>
    {props.linkLabel ? <a href={safeSitePartHref(props.linkUrl)} onClick={(event) => event.preventDefault()}>{props.linkLabel}</a> : null}
  </p></aside>;
}

export function FooterSimplePreview(props: FooterSimpleProps): React.ReactElement {
  return <footer className="g7pb-site-footer"><div className="g7pb-site-footer__top">
    <a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()} data-g7pb-inline-field="brandName">{props.brandName}</a>
    <nav aria-label="하단 메뉴"><ul>{props.navigation.map((item, index) => <li key={`${item.label}-${index}`}><a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}</a></li>)}</ul></nav>
  </div>{props.footerText ? <p className="g7pb-site-footer__legal" data-g7pb-inline-field="footerText">{props.footerText}</p> : null}</footer>;
}

export function FooterColumnsPreview(props: FooterColumnsProps): React.ReactElement {
  return <footer className="g7pb-site-footer g7pb-site-footer--columns"><div className="g7pb-site-footer__columns">
    <div><a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()}>{props.brandName}</a></div>
    {props.columns.map((column, index) => <section key={`${column.heading}-${index}`}><h2>{column.heading}</h2><ul>{column.links.map((link, linkIndex) => <li key={`${link.label}-${linkIndex}`}><a href={safeSitePartHref(link.url)} onClick={(event) => event.preventDefault()}>{link.label}</a></li>)}</ul></section>)}
  </div>{props.legalText ? <p className="g7pb-site-footer__legal">{props.legalText}</p> : null}</footer>;
}

function SitePartDrawer({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="g7pb-site-part-library" data-testid="page-builder-site-part-library">
    <header><strong>Site Part 블록</strong><p>구조를 보고 원하는 위치로 끌어 놓으세요.</p></header>
    {children}
  </div>;
}

function SitePartThumbnail({ name }: { name: string }): React.ReactElement {
  if (name === 'HeaderNavigation') return <div className="g7pb-site-part-thumb g7pb-site-part-thumb--navigation" aria-hidden="true"><b /><span><i /><i /><i /></span><em /></div>;
  if (name === 'Announcement') return <div className="g7pb-site-part-thumb g7pb-site-part-thumb--announcement" aria-hidden="true"><b /><i /></div>;
  if (name === 'FooterColumns') return <div className="g7pb-site-part-thumb g7pb-site-part-thumb--columns" aria-hidden="true"><b /><span><i /><i /><i /></span></div>;
  return <div className="g7pb-site-part-thumb g7pb-site-part-thumb--footer" aria-hidden="true"><span><b /><i /><i /></span><em /></div>;
}

function SitePartDrawerItem({ name }: { children: React.ReactNode; name: string }): React.ReactElement {
  const descriptions: Record<string, string> = {
    HeaderNavigation: '브랜드·PC 메뉴·모바일 메뉴·강조 버튼',
    Announcement: '상단 공지와 선택 링크',
    FooterSimple: '브랜드·하단 메뉴·사업자 문구',
    FooterColumns: '브랜드와 최대 4개 메뉴 그룹',
  };

  return <div className="g7pb-site-part-library-card" data-site-part-block={name}>
    <SitePartThumbnail name={name} />
    <div><strong>{name === 'HeaderNavigation' ? 'Header · 내비게이션' : name === 'Announcement' ? 'Header · 공지 바' : name === 'FooterColumns' ? 'Footer · 다단 메뉴' : 'Footer · 기본'}</strong><span>{descriptions[name]}</span><em>끌어서 배치</em></div>
    <span className="g7pb-site-part-library-card__handle" aria-hidden="true">⠿</span>
  </div>;
}

const SITE_PART_PRESETS: Record<SitePartKind, Array<{ key: SitePartPresetKey; label: string; description: string }>> = {
  header: [
    { key: 'header-business', label: '비즈니스', description: '공지·2단 메뉴·문의 CTA' },
    { key: 'header-minimal', label: '미니멀', description: '투명 헤더와 핵심 링크' },
    { key: 'header-community', label: '커뮤니티', description: '게시판 하위 메뉴·로그인' },
  ],
  footer: [
    { key: 'footer-business', label: '비즈니스', description: '3개 메뉴 그룹과 사업자 정보' },
    { key: 'footer-compact', label: '컴팩트', description: '핵심 링크만 있는 짧은 Footer' },
    { key: 'footer-community', label: '커뮤니티', description: '게시판·회원·정책 메뉴' },
  ],
};

function SitePartPresetBar({ kind, onApply }: { kind: SitePartKind; onApply: (preset: SitePartPresetKey) => void }): React.ReactElement {
  return <section className="g7pb-site-part-presets" data-testid="page-builder-site-part-presets" aria-label={`${kind === 'header' ? 'Header' : 'Footer'} 프리셋`}>
    <header><LayoutTemplate size={18} /><div><strong>빠른 시작 프리셋</strong><span>적용 후 화면과 우측 설정에서 자유롭게 바꾸세요.</span></div></header>
    <div>{SITE_PART_PRESETS[kind].map((preset) => <button key={preset.key} type="button" onClick={() => onApply(preset.key)}><strong>{preset.label}</strong><span>{preset.description}</span></button>)}</div>
  </section>;
}

export function sitePartConfigFor(kind: SitePartKind): Config<SitePartComponents> {
  const all: Config<SitePartComponents>['components'] = {
    HeaderNavigation: {
      label: 'Header · 내비게이션',
      defaultProps: { brandName: '사이트 이름', logoUrl: '', homeUrl: '/', variant: 'solid', sticky: true, navigation: [{ label: '소개', url: '/pages/about', children: [] }], ctaLabel: '문의하기', ctaUrl: '/pages/contact', mobileMenu: true, mobileMenuStyle: 'drawer-right' },
      fields: {
        brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, logoUrl: createMediaField('로고 이미지'), homeUrl: createRouteUrlField('홈 연결'),
        variant: { type: 'radio', label: '배경', options: [{ label: '기본', value: 'solid' }, { label: '투명', value: 'transparent' }] }, sticky: { type: 'radio', label: '스크롤 고정', options: [{ label: '고정', value: true }, { label: '고정 안 함', value: false }] },
        navigation: { type: 'array', label: '1차 메뉴', min: 0, max: 10, defaultItemProps: (index) => ({ label: `메뉴 ${index + 1}`, url: '/', children: [] }), getItemSummary: (item) => item.label, arrayFields: {
          label: { type: 'text', label: '이름', contentEditable: true },
          url: createRouteUrlField('1차 메뉴 연결'),
          children: { type: 'array', label: '2차 메뉴', min: 0, max: 8, defaultItemProps: (index) => ({ label: `하위 메뉴 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름' }, url: createRouteUrlField('2차 메뉴 연결') } },
        } },
        ctaLabel: { type: 'text', label: '강조 버튼 문구', contentEditable: true }, ctaUrl: createRouteUrlField('강조 버튼 연결'),
        mobileMenu: { type: 'radio', label: '모바일 메뉴', options: [{ label: '사용', value: true }, { label: '숨김', value: false }] },
        mobileMenuStyle: { type: 'radio', label: '모바일 열림 방향', options: [{ label: '오른쪽', value: 'drawer-right' }, { label: '왼쪽', value: 'drawer-left' }, { label: '아래', value: 'dropdown' }] },
      },
      render: (props) => <HeaderNavigationPreview {...props} />,
    },
    Announcement: {
      label: 'Header · 공지 바',
      defaultProps: { text: '새로운 소식을 알려보세요.', linkLabel: '자세히', linkUrl: '/', tone: 'brand' },
      fields: { text: { type: 'text', label: '공지 문구', contentEditable: true }, linkLabel: { type: 'text', label: '링크 문구', contentEditable: true }, linkUrl: createRouteUrlField('공지 연결'), tone: { type: 'select', label: '색상', options: [{ label: '브랜드', value: 'brand' }, { label: '어둡게', value: 'dark' }, { label: '밝게', value: 'light' }] } },
      render: (props) => <AnnouncementPreview {...props} />,
    },
    FooterSimple: {
      label: 'Footer · 기본',
      defaultProps: { brandName: '사이트 이름', homeUrl: '/', navigation: [{ label: '소개', url: '/pages/about' }], footerText: '사이트 정보를 입력해 주세요.' },
      fields: { brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, homeUrl: createRouteUrlField('홈 연결'), navigation: { type: 'array', label: '하단 메뉴', min: 0, max: 10, defaultItemProps: (index) => ({ label: `메뉴 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, url: createRouteUrlField('메뉴 연결') } }, footerText: { type: 'textarea', label: '법적·사업자 문구', contentEditable: true } },
      render: (props) => <FooterSimplePreview {...props} />,
    },
    FooterColumns: {
      label: 'Footer · 다단 메뉴',
      defaultProps: { brandName: '사이트 이름', homeUrl: '/', columns: [{ heading: '서비스', links: [{ label: '소개', url: '/pages/about' }, { label: '문의', url: '/pages/contact' }] }], legalText: '사이트 정보를 입력해 주세요.' },
      fields: { brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, homeUrl: createRouteUrlField('홈 연결'), columns: { type: 'array', label: '메뉴 그룹', min: 1, max: 4, defaultItemProps: (index) => ({ heading: `메뉴 ${index + 1}`, links: [{ label: '링크', url: '/' }] }), getItemSummary: (item) => item.heading, arrayFields: {
        heading: { type: 'text', label: '그룹 제목', contentEditable: true },
        links: { type: 'array', label: '그룹 링크', min: 0, max: 8, defaultItemProps: (index) => ({ label: `링크 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름' }, url: createRouteUrlField('하단 메뉴 연결') } },
      } }, legalText: { type: 'textarea', label: '법적·사업자 문구', contentEditable: true } },
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

export function SitePartEditor({ kind, locale, setId, embedded = false, paired = false, iframeEnabled = true, onBack, onChanged }: SitePartEditorProps): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const config = useMemo(() => sitePartConfigFor(kind), [kind]);
  const overrides = useMemo(() => ({
    drawer: SitePartDrawer,
    drawerItem: SitePartDrawerItem,
    headerActions: () => <span className="g7pb-site-part-header-help">블록 선택 후 우측에서 세부 설정</span>,
  }), []);
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
    onChanged?.(next);
  }, [onChanged]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    api.getSitePart(kind, locale, setId).catch((error: unknown) => {
      if (!setId && error instanceof PageBuilderApiError && error.status === 404) return api.bootstrapSitePart(kind, locale);
      throw error;
    }).then((next) => { if (active) apply(next); })
      .catch((error: unknown) => { if (active) setMessage(errorMessage(error)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [api, apply, kind, locale, setId]);

  const save = useCallback(async (): Promise<SitePartResource | null> => {
    const current = resourceRef.current;
    if (!current) return null;
    setBusy(true);
    setMessage(null);
    try {
      const document = sitePartPuckToCanonical(dataRef.current, current.document);
      const saved = await api.saveSitePart(kind, current.title, document, current.lock_version, setId);
      apply(saved);
      return saved;
    } catch (error) {
      setMessage(errorMessage(error));
      return null;
    } finally {
      setBusy(false);
    }
  }, [api, apply, kind, setId]);

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
      apply(await api.publishSitePart(kind, locale, saved.lock_version, setId));
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

  const applyPreset = (preset: SitePartPresetKey): void => {
    const current = resourceRef.current;
    if (!current) return;
    if (dataRef.current.content.length > 0 && !window.confirm('현재 Site Part 블록을 선택한 프리셋으로 바꾸시겠습니까?')) return;
    const next = sitePartPresetToPuck(current.document, preset);
    dataRef.current = next;
    setData(next);
    setDirty(true);
    setMessage('프리셋을 적용했습니다. 라우트와 문구를 확인한 뒤 저장·발행하세요.');
  };

  return <section className={`g7pb-root g7pb-site-part-editor ${embedded ? 'is-embedded' : ''} ${paired ? 'is-paired' : ''}`} data-testid="page-builder-site-part-editor" data-kind={kind}>
    <header className="g7pb-command-bar">
      <div className="g7pb-command-bar__identity">{paired ? null : embedded ? <button type="button" className="g7pb-icon-link" aria-label="페이지 편집으로 돌아가기" onClick={onBack}><ArrowLeft size={18} /></button> : <a href={PAGE_BUILDER_MANAGER_PATH} className="g7pb-icon-link" aria-label="문서함으로 돌아가기"><ArrowLeft size={18} /></a>}<div><p>{paired ? '공통 영역' : 'Global Site Part'}</p><strong>{kind === 'header' ? 'Header 편집' : 'Footer 편집'}</strong></div></div>
      <div className="g7pb-command-bar__actions">
        <span className="g7pb-status" data-state={dirty ? 'dirty' : 'saved'}>{dirty ? '저장할 변경 있음' : resource?.status === 'published' ? '발행됨' : '저장됨'}</span>
        <button type="button" className="g7pb-button g7pb-button--quiet" disabled={busy || !resource} onClick={() => void save()}><Save size={17} /> 저장</button>
        <button type="button" className="g7pb-button g7pb-button--primary" disabled={busy || !resource} data-testid="page-builder-site-part-publish" onClick={() => void publish()}>{resource?.status === 'published' && !dirty ? <Check size={17} /> : <CloudUpload size={17} />} 발행</button>
      </div>
    </header>
    {message ? <div className="g7pb-notice" role="alert"><span>{message}</span><button type="button" className="g7pb-notice__dismiss" onClick={() => setMessage(null)}>닫기</button></div> : null}
    {busy && !resource ? <div className="g7pb-loading">Site Part를 준비하는 중입니다.</div> : null}
    {resource ? <div className="g7pb-site-part-puck" aria-busy={busy}>
      <SitePartPresetBar kind={kind} onApply={applyPreset} />
      <div className="g7pb-site-part-device-legend" aria-hidden="true"><Smartphone size={15} /><Tablet size={15} /><Monitor size={15} /><span>상단 기기 버튼으로 반응형 화면을 확인하세요.</span></div>
      <Puck config={config} data={data} height="100%" iframe={{ enabled: iframeEnabled, syncHostStyles: true, waitForStyles: false }} viewports={VIEWPORTS} ui={{ itemSelector: data.content.length > 0 ? { index: 0, zone: 'root:default-zone' } : null, viewports: { current: { width: 1280, height: 'auto' }, controlsVisible: true, options: VIEWPORTS } }} permissions={{ edit: !busy, insert: !busy, delete: !busy, duplicate: !busy, drag: !busy }} overrides={overrides} headerTitle={kind === 'header' ? 'Header 블록' : 'Footer 블록'} headerPath={resource.title} onChange={update} onPublish={() => void publish()} />
    </div> : null}
  </section>;
}
