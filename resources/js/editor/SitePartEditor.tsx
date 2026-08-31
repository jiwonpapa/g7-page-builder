import React, { createContext, useContext, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { installShellDisclosures, mountMobileShell, paintShellProduct, shellControlsMarkup, shellIcon, shellRecord, shellSafeUrl, type ShellOptions } from '../public/siteShellControls';
import { installMobileNavigation } from '../public/mobileNavigation';
import '../../css/page-builder-site-shell.css';
import '../../css/page-builder-site-part-controls.css';
import { useSitePartActionBarPosition } from './SitePartActionBarPosition';
import { createPortal } from 'react-dom';
import { ActionBar, Puck, registerOverlayPortal, type Config, type Field, usePuck, type Viewports } from '@puckeditor/core';
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
  type HeaderSystemControlsProps,
  DEFAULT_HEADER_SYSTEM_CONTROLS,
  safeSitePartHref,
  type SitePartComponents,
  type SitePartPresetKey,
  sitePartCanonicalToPuck,
  sitePartPresetToPuck,
  type SitePartPuckData,
  sitePartPuckToCanonical,
} from './sitePartDocumentAdapter';
import {
  type FooterResponsiveOverride,
  type FooterResponsiveOverrides,
  type HeaderResponsiveOverride,
  type HeaderResponsiveOverrides,
  resolveFooterPresentation,
  resolveHeaderPresentation,
  resetResponsiveViewport,
  type SitePartResponsiveViewport,
  viewportFromWidth,
} from './sitePartResponsive';

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

function updateResponsiveValue<T extends object>(
  overrides: { tablet?: T; mobile?: T },
  viewport: SitePartResponsiveViewport,
  key: keyof T,
  value: unknown,
): { tablet?: T; mobile?: T } {
  const current = { ...(overrides[viewport] ?? {}) } as T;
  if (value === '' || value === 'inherit') delete current[key];
  else current[key] = value as T[keyof T];
  const next = { ...overrides };
  if (Object.keys(current).length === 0) delete next[viewport];
  else next[viewport] = current;
  return next;
}

function SitePartResponsiveField({
  kind,
  value,
  onChange,
  readOnly,
}: {
  kind: SitePartKind;
  value: HeaderResponsiveOverrides | FooterResponsiveOverrides | undefined;
  onChange: (next: HeaderResponsiveOverrides | FooterResponsiveOverrides) => void;
  readOnly?: boolean;
}): React.ReactElement {
  const { appState } = usePuck<Config<SitePartComponents>>();
  const viewport = viewportFromWidth(appState.ui.viewports.current.width);
  const overrides = value ?? {};

  if (viewport === 'desktop') {
    return <div className="g7pb-site-part-responsive-field is-desktop" data-testid="page-builder-site-part-responsive">
      <strong>PC 기본값</strong>
      <p>PC에서는 위 기본 설정을 편집합니다. 태블릿·모바일 버튼을 누르면 해당 화면만 재정의할 수 있습니다.</p>
    </div>;
  }

  const current = overrides[viewport];
  const update = (key: string, next: unknown): void => {
    if (kind === 'header') {
      onChange(updateResponsiveValue(overrides as HeaderResponsiveOverrides, viewport, key as keyof HeaderResponsiveOverride, next));
      return;
    }
    onChange(updateResponsiveValue(overrides as FooterResponsiveOverrides, viewport, key as keyof FooterResponsiveOverride, next));
  };
  const reset = (): void => onChange(resetResponsiveViewport(overrides, viewport));

  return <div className="g7pb-site-part-responsive-field" data-testid="page-builder-site-part-responsive" data-viewport={viewport}>
    <header><div><strong>{viewport === 'tablet' ? '태블릿' : '모바일'} 표시</strong><span>{current ? '재정의됨' : '상위 화면 상속'}</span></div>
      <button type="button" disabled={readOnly || !current} onClick={reset} data-testid="page-builder-responsive-reset">이 화면 초기화</button></header>
    <label><span>간격</span><select disabled={readOnly} value={current?.density ?? ''} onChange={(event) => update('density', event.currentTarget.value)} data-testid="page-builder-responsive-density">
      <option value="">상속</option><option value="compact">좁게</option><option value="comfortable">기본</option><option value="spacious">넓게</option>
    </select></label>
    <label><span>정렬</span><select disabled={readOnly} value={current?.alignment ?? ''} onChange={(event) => update('alignment', event.currentTarget.value)} data-testid="page-builder-responsive-alignment">
      <option value="">상속</option><option value="start">왼쪽</option><option value="center">가운데</option>{kind === 'header' ? <option value="spread">양쪽</option> : null}
    </select></label>
    {kind === 'header' ? <>
      <label><span>강조 버튼</span><select disabled={readOnly} value={typeof (current as HeaderResponsiveOverride | undefined)?.showCta === 'boolean' ? String((current as HeaderResponsiveOverride).showCta) : 'inherit'} onChange={(event) => update('showCta', event.currentTarget.value === 'inherit' ? 'inherit' : event.currentTarget.value === 'true')} data-testid="page-builder-responsive-cta">
        <option value="inherit">상속</option><option value="true">표시</option><option value="false">숨김</option>
      </select></label>
      <label><span>모바일 메뉴</span><select disabled={readOnly} value={(current as HeaderResponsiveOverride | undefined)?.mobileMenuStyle ?? ''} onChange={(event) => update('mobileMenuStyle', event.currentTarget.value)} data-testid="page-builder-responsive-menu-style">
        <option value="">상속</option><option value="drawer-right">오른쪽 패널</option><option value="drawer-left">왼쪽 패널</option><option value="dropdown">헤더 아래</option><option value="sheet-bottom">하단 시트</option>
      </select></label>
    </> : <>
      <label><span>하단 메뉴</span><select disabled={readOnly} value={typeof (current as FooterResponsiveOverride | undefined)?.showNavigation === 'boolean' ? String((current as FooterResponsiveOverride).showNavigation) : 'inherit'} onChange={(event) => update('showNavigation', event.currentTarget.value === 'inherit' ? 'inherit' : event.currentTarget.value === 'true')} data-testid="page-builder-responsive-navigation">
        <option value="inherit">상속</option><option value="true">표시</option><option value="false">숨김</option>
      </select></label>
      <label><span>메뉴 열 수</span><select disabled={readOnly} value={(current as FooterResponsiveOverride | undefined)?.columns ?? ''} onChange={(event) => update('columns', event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))} data-testid="page-builder-responsive-columns">
        <option value="">상속</option><option value="1">1열</option><option value="2">2열</option><option value="4">4열</option>
      </select></label>
    </>}
  </div>;
}

function createHeaderResponsiveField(): Field<HeaderResponsiveOverrides | undefined> {
  return {
    type: 'custom',
    label: '기기별 표시',
    render: ({ value, onChange, readOnly }) => <SitePartResponsiveField kind="header" value={value} onChange={(next) => onChange(next as HeaderResponsiveOverrides)} readOnly={readOnly} />,
  };
}

function createFooterResponsiveField(): Field<FooterResponsiveOverrides | undefined> {
  return {
    type: 'custom',
    label: '기기별 표시',
    render: ({ value, onChange, readOnly }) => <SitePartResponsiveField kind="footer" value={value} onChange={(next) => onChange(next as FooterResponsiveOverrides)} readOnly={readOnly} />,
  };
}

export function HeaderSystemControlsPreview(props: HeaderSystemControlsProps & { onSelect?: () => void }): React.ReactElement {
  const persona = useContext(SitePartPersona);
  const ref = useRef<HTMLElement>(null);
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;
  // Puck adds changing selection/overlay metadata to render props. Only actual
  // control options may rebuild this interactive DOM and reset its open panel.
  const { search, account, cart, notifications, theme, locale, currency } = props;
  const signature = JSON.stringify({ search, account, cart, notifications, theme, locale, currency });
  const markup = useMemo(() => shellControlsMarkup(JSON.parse(signature) as HeaderSystemControlsProps), [signature]);
  const content = useMemo(() => ({ __html: markup }), [markup]);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = markup;
    paintShellProduct(host, { currentUser: persona === 'guest' ? null : { uuid: 'preview', name: persona === 'admin' ? '관리자 미리보기' : '회원 미리보기', is_admin: persona === 'admin' }, commerceAvailable: true, cartCount: 2, notificationCount: 3 });
    host.querySelectorAll<HTMLElement>('[data-g7pb-system-locale-host], [data-g7pb-system-currency-host]').forEach((node) => {
      const language = node.hasAttribute('data-g7pb-system-locale-host');
      node.innerHTML = `<label class="g7pb-system-select"><span>${language ? '언어' : '통화'}</span><select aria-label="${language ? '언어' : '통화'}">${language ? '<option>한국어</option><option>English</option>' : '<option>KRW</option><option>USD</option>'}</select></label>`;
    });
    const unregister = registerOverlayPortal(host, { disableDrag: true });
    const dispose = installShellDisclosures(host, (key) => {
      if (key === 'notifications') { const list = host.querySelector('[data-g7pb-notifications-list]'); if (list) list.textContent = '서비스 소식 · 상태 미리보기용 예시 알림입니다.'; }
    }, true);
    // Portal clicks bubble through both child and parent Puck components.
    // Select last at the document boundary, after Puck's parent handler, while
    // preserving the disclosure listener and its keyboard/click behavior.
    const select = (event: Event): void => {
      if (host.contains(event.target as Node)) onSelectRef.current?.();
    };
    host.ownerDocument.addEventListener('click', select);
    return () => { host.ownerDocument.removeEventListener('click', select); dispose(); unregister?.(); };
  }, [markup, persona]);
  return <nav ref={ref} aria-disabled="false" onFocusCapture={props.onSelect} className="g7pb-system-controls" aria-label="사이트 기능 미리보기" data-g7pb-system-controls data-g7pb-shell-options={signature} data-g7pb-shell-mounted="true" dangerouslySetInnerHTML={content} />;
}

function SelectableSystemControls(props: HeaderSystemControlsProps & { id: string }): React.ReactElement {
  const { appState, dispatch, getSelectorForId } = usePuck<Config<SitePartComponents>>();
  const select = (): void => {
    const width = appState.ui.viewports.current.width;
    if (typeof width === 'number' && width <= 768) return;
    const itemSelector = getSelectorForId(props.id);
    if (itemSelector) dispatch({ type: 'setUi', ui: { itemSelector }, recordHistory: false });
  };
  return <HeaderSystemControlsPreview {...props} onSelect={select} />;
}

export const SitePartPersona = createContext<'guest' | 'member' | 'admin'>('guest');

export function SitePartPersonaSelector({ value, onChange }: { value: 'guest' | 'member' | 'admin'; onChange: (value: 'guest' | 'member' | 'admin') => void }): React.ReactElement {
  return <div className="g7pb-site-part-persona">
    <span>접속 상태 미리보기</span>
    <div className="g7pb-site-part-persona__buttons" role="group" aria-label="접속 상태 미리보기">
      {([['guest', '비회원'], ['member', '일반 회원'], ['admin', '관리자']] as const).map(([persona, label]) => <button key={persona} type="button" aria-pressed={value === persona} onClick={() => onChange(persona)}>{label}</button>)}
    </div>
    <small>예시 상태 · 저장되지 않습니다</small>
  </div>;
}

function headerResponsiveAttributes(props: HeaderNavigationProps): Record<string, string> {
  const responsiveOverrides = props.responsiveOverrides ?? {};
  const tablet = resolveHeaderPresentation(props.mobileMenuStyle, responsiveOverrides, 'tablet');
  const mobile = resolveHeaderPresentation(props.mobileMenuStyle, responsiveOverrides, 'mobile');
  return {
    'data-g7pb-tablet-density': tablet.density,
    'data-g7pb-tablet-alignment': tablet.alignment,
    'data-g7pb-tablet-cta': tablet.showCta ? 'show' : 'hide',
    'data-g7pb-tablet-menu-style': tablet.mobileMenuStyle,
    'data-g7pb-mobile-density': mobile.density,
    'data-g7pb-mobile-alignment': mobile.alignment,
    'data-g7pb-mobile-cta': mobile.showCta ? 'show' : 'hide',
    'data-g7pb-mobile-menu-style': mobile.mobileMenuStyle,
  };
}

function footerResponsiveAttributes(
  overrides: FooterResponsiveOverrides,
  desktopColumns: 1 | 2 | 4,
): Record<string, string> {
  const tablet = resolveFooterPresentation(desktopColumns, overrides, 'tablet');
  const mobile = resolveFooterPresentation(desktopColumns, overrides, 'mobile');
  return {
    'data-g7pb-tablet-density': tablet.density,
    'data-g7pb-tablet-alignment': tablet.alignment,
    'data-g7pb-tablet-navigation': tablet.showNavigation ? 'show' : 'hide',
    'data-g7pb-tablet-columns': String(tablet.columns),
    'data-g7pb-mobile-density': mobile.density,
    'data-g7pb-mobile-alignment': mobile.alignment,
    'data-g7pb-mobile-navigation': mobile.showNavigation ? 'show' : 'hide',
    'data-g7pb-mobile-columns': String(mobile.columns),
  };
}

function HeaderMobileMenuPreview(props: HeaderNavigationProps): React.ReactElement | null {
  const persona = useContext(SitePartPersona);
  const menuId = `g7pb-preview-mobile-menu-${useId().replaceAll(':', '')}`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const responsiveAttributes = headerResponsiveAttributes(props);
  useEffect(() => registerOverlayPortal(interactionRef.current, { disableDrag: true }), [props.mobileMenu]);
  useEffect(() => {
    const doc = toggleRef.current?.ownerDocument;
    if (!props.mobileMenu || !doc) return;
    const host = doc.createElement('div');
    host.className = 'g7pb-header-mobile-overlay-host';
    doc.body.append(host);
    const unregister = registerOverlayPortal(host, { disableDrag: true });
    setOverlayHost(host);
    return () => { unregister?.(); host.remove(); };
  }, [props.mobileMenu]);
  useEffect(() => {
    const toggle = toggleRef.current;
    const menu = overlayHost?.querySelector<HTMLElement>('[data-g7pb-preview-mobile-menu]');
    const header = toggle?.closest('header');
    if (!toggle || !menu || !header) return;
    const paint = (): void => {
      const raw = header.querySelector<HTMLElement>('[data-g7pb-shell-options]')?.dataset.g7pbShellOptions ?? '{}';
      let options: ShellOptions;
      try { options = JSON.parse(raw) as ShellOptions; } catch { return; }
      mountMobileShell(menu, options);
      paintShellProduct(menu, { currentUser: persona === 'guest' ? null : { uuid: 'preview', name: persona === 'admin' ? '관리자 미리보기' : '회원 미리보기', is_admin: persona === 'admin' }, commerceAvailable: true, notificationCount: 3 });
      menu.querySelectorAll<HTMLElement>('[data-g7pb-system-locale-host], [data-g7pb-system-currency-host]').forEach((node) => {
        if (node.querySelector('select')) return;
        const language = node.hasAttribute('data-g7pb-system-locale-host');
        node.innerHTML = `<label class="g7pb-system-select"><span>${language ? '언어' : '통화'}</span><select aria-label="${language ? '언어' : '통화'}">${language ? '<option>한국어</option><option>English</option>' : '<option>KRW</option><option>USD</option>'}</select></label>`;
      });
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(header, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-g7pb-shell-options'] });
    return () => observer.disconnect();
  }, [overlayHost, persona]);
  useEffect(() => {
    const toggle = toggleRef.current;
    const menu = overlayHost?.querySelector<HTMLElement>('[data-g7pb-preview-mobile-menu]');
    if (!toggle || !menu) return;
    return installMobileNavigation({ toggle, menu, backdrop: overlayHost?.querySelector('[data-g7pb-preview-menu-backdrop]'), preview: true });
  }, [overlayHost, props.mobileMenu]);
  if (!props.mobileMenu) return null;
  const overlay = <>
    <button className="g7pb-mobile-menu__backdrop" type="button" aria-label="모바일 메뉴 닫기" data-g7pb-preview-menu-backdrop hidden {...responsiveAttributes} />
    <section id={menuId} className={`g7pb-mobile-menu g7pb-mobile-menu--preview g7pb-mobile-menu--${props.mobileMenuStyle}`} aria-label="전체 메뉴" data-g7pb-preview-mobile-menu data-g7pb-unified-menu data-g7pb-system-controls data-g7pb-menu-style={props.mobileMenuStyle} hidden {...responsiveAttributes}>
      <div className="g7pb-mobile-menu__heading"><strong>전체 메뉴</strong><button className="g7pb-mobile-menu__close" type="button" aria-label="모바일 메뉴 닫기" data-g7pb-preview-menu-close data-g7pb-menu-close>×</button></div>
      <div className="g7pb-mobile-account" data-g7pb-mobile-account />
      <nav aria-label="모바일 메뉴"><ul>{props.navigation.map((item, index) => {
        const submenuId = `${menuId}-submenu-${index}`;
        return <li key={index} className={item.children.length ? 'has-children' : undefined}>
          {item.children.length ? <><div className="g7pb-mobile-menu__row">
            <a href={safeSitePartHref(item.url)}>{item.label}</a>
            <button type="button" aria-controls={submenuId} aria-expanded="false" aria-label={`${item.label} 하위 메뉴 열기`} data-g7pb-preview-submenu-toggle data-g7pb-submenu-toggle><span aria-hidden="true">⌄</span></button>
          </div><ul id={submenuId} className="g7pb-mobile-subnav" data-g7pb-preview-mobile-submenu hidden>{item.children.map((child, childIndex) => <li key={childIndex}><a href={safeSitePartHref(child.url)}>{child.label}</a></li>)}</ul></> : <a href={safeSitePartHref(item.url)}>{item.label}</a>}
        </li>;
      })}</ul></nav>
      {props.ctaLabel ? <a className="g7pb-mobile-menu__cta" href={safeSitePartHref(props.ctaUrl)}>{props.ctaLabel}</a> : null}
      <div className="g7pb-mobile-settings" data-g7pb-mobile-settings />
    </section>
  </>;
  return <div ref={interactionRef} className="g7pb-header-mobile-editor-controls">
    <button ref={toggleRef} className="g7pb-menu-toggle" type="button" aria-controls={menuId} aria-expanded="false" aria-label="모바일 메뉴 열기" data-g7pb-preview-menu-toggle><span /></button>
    {overlayHost ? createPortal(overlay, overlayHost) : null}
  </div>;
}

export function HeaderNavigationPreview(props: HeaderNavigationProps & { systemControlsPreview?: React.ReactNode }): React.ReactElement {
  const information = previewSiteInformation(props);
  const navigation = (className: string, label: string): React.ReactElement => <nav className={className} aria-label={label}><ul>{props.navigation.map((item, index) => (
    <li key={`${item.label}-${index}`} className={item.children.length > 0 ? 'has-children' : undefined}>
      <a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}{item.children.length > 0 ? <span aria-hidden="true">⌄</span> : null}</a>
      {item.children.length > 0 ? <ul className="g7pb-site-subnav">{item.children.map((child, childIndex) => (
        <li key={`${child.label}-${childIndex}`}><a href={safeSitePartHref(child.url)} onClick={(event) => event.preventDefault()}>{child.label}</a></li>
      ))}</ul> : null}
    </li>
  ))}</ul></nav>;
  return (
    <header className={`g7pb-site-header ${props.sticky ? 'is-sticky' : ''} ${props.variant === 'transparent' ? 'is-transparent' : ''}`} data-g7pb-unified-header={props.mobileMenu ? '' : undefined} {...headerResponsiveAttributes(props)}>
      <div className="g7pb-site-header__inner">
        <a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()}>
          {props.logoUrl ? <img src={props.logoUrl} alt={props.brandName} /> : <span data-g7pb-inline-field="brandName">{information.brandName}</span>}
        </a>
        {props.navigation.length ? navigation('g7pb-site-nav', '주 메뉴') : <div className="g7pb-site-nav" aria-hidden="true" />}
        <div className="g7pb-site-header__actions">
          {props.ctaLabel ? <a className="g7pb-site-header__cta" href={safeSitePartHref(props.ctaUrl)} onClick={(event) => event.preventDefault()}>{props.ctaLabel}</a> : null}
          {props.systemControlsPreview}
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
  const information = previewSiteInformation(props);
  return <footer className="g7pb-site-footer" {...footerResponsiveAttributes(props.responsiveOverrides ?? {}, 2)}><div className="g7pb-site-footer__top">
    <div><a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()} data-g7pb-inline-field="brandName">{information.brandName}</a><SiteInformationPreview {...information} /></div>
    <nav aria-label="하단 메뉴"><ul>{props.navigation.map((item, index) => <li key={`${item.label}-${index}`}><a href={safeSitePartHref(item.url)} onClick={(event) => event.preventDefault()}>{item.label}</a></li>)}</ul></nav>
  </div>{props.footerText && !(information.inherit && props.footerText === '사이트 정보를 입력해 주세요.') ? <p className="g7pb-site-footer__legal" data-g7pb-inline-field="footerText">{props.footerText}</p> : null}</footer>;
}

export function FooterColumnsPreview(props: FooterColumnsProps): React.ReactElement {
  const information = previewSiteInformation(props);
  return <footer className="g7pb-site-footer g7pb-site-footer--columns" {...footerResponsiveAttributes(props.responsiveOverrides ?? {}, 4)}><div className="g7pb-site-footer__columns">
    <div><a className="g7pb-site-brand" href={safeSitePartHref(props.homeUrl)} onClick={(event) => event.preventDefault()}>{information.brandName}</a><SiteInformationPreview {...information} /></div>
    {props.columns.map((column, index) => <section key={`${column.heading}-${index}`}><h2>{column.heading}</h2><ul>{column.links.map((link, linkIndex) => <li key={`${link.label}-${linkIndex}`}><a href={safeSitePartHref(link.url)} onClick={(event) => event.preventDefault()}>{link.label}</a></li>)}</ul></section>)}
  </div>{props.legalText && !(information.inherit && props.legalText === '사이트 정보를 입력해 주세요.') ? <p className="g7pb-site-footer__legal">{props.legalText}</p> : null}</footer>;
}

function previewSiteInformation(props: { brandName: string; useSiteSettings?: boolean; logoUrl?: string }): { inherit: boolean; brandName: string; description: string; socials: Record<string, unknown> } {
  const inherit = props.useSiteSettings ?? (props.brandName === '사이트 이름' && !props.logoUrl);
  let config: Record<string, unknown> = {};
  try { if (typeof document !== 'undefined') config = shellRecord(JSON.parse(document.querySelector<HTMLElement>('[data-g7pb-runtime-config]')?.dataset.g7pbRuntimeConfig ?? '{}')); } catch { /* Keep authored fallback during isolated preview tests. */ }
  const settings = shellRecord(config.settings); const general = shellRecord(settings.general);
  return { inherit, brandName: inherit && typeof general.site_name === 'string' && general.site_name ? general.site_name : props.brandName, description: inherit && typeof general.site_description === 'string' ? general.site_description : '', socials: inherit ? shellRecord(settings.social) : {} };
}

function SiteInformationPreview(info: ReturnType<typeof previewSiteInformation>): React.ReactElement {
  const socials = ['github', 'twitter', 'discord', 'facebook', 'instagram', 'youtube'].flatMap((name) => {
    const url = shellSafeUrl(info.socials[name]); return url.startsWith('https:') ? [{ name, url }] : [];
  });
  return <>{info.description ? <p className="g7pb-site-description">{info.description}</p> : null}{socials.length ? <nav className="g7pb-site-socials" aria-label="소셜 채널">{socials.map(({ name, url }) => <a key={name} href={url} aria-label={`${name} (새 창)`} onClick={(event) => event.preventDefault()} dangerouslySetInnerHTML={{ __html: shellIcon(name) }} />)}</nav> : null}</>;
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
  if (name === 'HeaderSystemControls') return <div className="g7pb-site-part-thumb g7pb-site-part-thumb--navigation" aria-hidden="true"><b /><span><i /><i /><i /></span></div>;
  return <div className="g7pb-site-part-thumb g7pb-site-part-thumb--footer" aria-hidden="true"><span><b /><i /><i /></span><em /></div>;
}

export function SitePartDrawerItem({ name }: { children: React.ReactNode; name: string }): React.ReactElement {
  const descriptions: Record<string, string> = {
    HeaderNavigation: '브랜드·PC 메뉴·모바일 메뉴·강조 버튼',
    HeaderSystemControls: '검색·회원 상태·알림·장바구니·테마·언어·통화',
    Announcement: '상단 공지와 선택 링크',
    FooterSimple: '브랜드·하단 메뉴·사업자 문구',
    FooterColumns: '브랜드와 최대 4개 메뉴 그룹',
  };

  return <div className="g7pb-site-part-library-card" data-site-part-block={name}>
    <SitePartThumbnail name={name} />
    <div><strong>{name === 'HeaderNavigation' ? 'Header · 내비게이션' : name === 'HeaderSystemControls' ? 'G7 시스템 기능' : name === 'Announcement' ? 'Header · 공지 바' : name === 'FooterColumns' ? 'Footer · 다단 메뉴' : 'Footer · 기본'}</strong><span>{descriptions[name]}</span></div>
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

function SitePartPuckShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { appState, dispatch } = usePuck<Config<SitePartComponents>>();
  const currentViewportWidth = appState.ui.viewports.current.width;
  const selectedItem = appState.ui.itemSelector;
  const previousViewportWidth = useRef(currentViewportWidth);
  const lastSelectedItem = useRef(selectedItem);

  useEffect(() => {
    if (selectedItem) lastSelectedItem.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    if (previousViewportWidth.current === currentViewportWidth) return;
    previousViewportWidth.current = currentViewportWidth;
    const itemSelector = lastSelectedItem.current
      ?? (appState.data.content.length > 0 ? { index: 0, zone: 'root:default-zone' } : null);
    if (!itemSelector) return;
    dispatch({ type: 'setUi', ui: { itemSelector }, recordHistory: false });
  }, [appState.data.content.length, currentViewportWidth, dispatch]);

  return <>{children}</>;
}

export function SitePartActionBar({
  label,
  children,
  parentAction,
}: {
  label?: string;
  children: React.ReactNode;
  parentAction: React.ReactNode;
}): React.ReactElement {
  const { appState } = usePuck<Config<SitePartComponents>>();
  const responsive = viewportFromWidth(appState.ui.viewports.current.width) !== 'desktop';
  const actionBarRef = useSitePartActionBarPosition();
  return <div ref={actionBarRef} className={`g7pb-site-part-action-bar${responsive ? ' is-responsive' : ''}`}>
    <ActionBar>
      <ActionBar.Group>{parentAction}{label ? <ActionBar.Label label={label} /> : null}</ActionBar.Group>
      <ActionBar.Group>{children}</ActionBar.Group>
    </ActionBar>
  </div>;
}

export function sitePartConfigFor(kind: SitePartKind, data?: SitePartPuckData, canInsert = true): Config<SitePartComponents> {
  const all: Config<SitePartComponents>['components'] = {
    HeaderNavigation: {
      label: 'Header · 내비게이션',
      defaultProps: { brandName: '사이트 이름', logoUrl: '', homeUrl: '/', variant: 'solid', sticky: true, navigation: [{ label: '소개', url: '/pages/about', children: [] }], ctaLabel: '문의하기', ctaUrl: '/pages/contact', mobileMenu: true, mobileMenuStyle: 'drawer-right', responsiveOverrides: { tablet: { density: 'comfortable', alignment: 'spread', showCta: false, mobileMenuStyle: 'drawer-right' }, mobile: { density: 'compact', alignment: 'spread', showCta: false, mobileMenuStyle: 'drawer-right' } }, systemControls: [{ type: 'HeaderSystemControls', props: { id: '6a741d82-3080-4e72-a2f1-7d2d968eb881', ...DEFAULT_HEADER_SYSTEM_CONTROLS } }] },
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
        mobileMenuStyle: { type: 'radio', label: '기본 메뉴 방식', options: [{ label: '오른쪽', value: 'drawer-right' }, { label: '왼쪽', value: 'drawer-left' }, { label: '헤더 아래', value: 'dropdown' }, { label: '하단 시트', value: 'sheet-bottom' }] },
        responsiveOverrides: createHeaderResponsiveField(),
        systemControls: { type: 'slot', label: 'G7 시스템 기능', allow: ['HeaderSystemControls'] },
      },
      render: ({ systemControls: SystemControls, ...props }) => <HeaderNavigationPreview
        {...props}
        systemControlsPreview={SystemControls ? <SystemControls className="g7pb-site-header__system-slot" /> : null}
      />,
    },
    HeaderSystemControls: {
      label: 'G7 시스템 기능',
      defaultProps: { search: true, account: true, cart: true, notifications: true, theme: true, locale: true, currency: true },
      fields: {
        search: { type: 'radio', label: '통합 검색', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
        account: { type: 'radio', label: '로그인·회원 상태', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
        cart: { type: 'radio', label: '장바구니 개수', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
        notifications: { type: 'radio', label: '알림 개수', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
        theme: { type: 'radio', label: '라이트·다크 전환', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
        locale: { type: 'radio', label: '언어 선택', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
        currency: { type: 'radio', label: '통화 선택', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
      },
      render: (props) => <SelectableSystemControls {...props} />,
    },
    Announcement: {
      label: 'Header · 공지 바',
      defaultProps: { text: '새로운 소식을 알려보세요.', linkLabel: '자세히', linkUrl: '/', tone: 'brand' },
      fields: { text: { type: 'text', label: '공지 문구', contentEditable: true }, linkLabel: { type: 'text', label: '링크 문구', contentEditable: true }, linkUrl: createRouteUrlField('공지 연결'), tone: { type: 'select', label: '색상', options: [{ label: '브랜드', value: 'brand' }, { label: '어둡게', value: 'dark' }, { label: '밝게', value: 'light' }] } },
      render: (props) => <AnnouncementPreview {...props} />,
    },
    FooterSimple: {
      label: 'Footer · 기본',
      defaultProps: { brandName: '사이트 이름', homeUrl: '/', navigation: [{ label: '소개', url: '/pages/about' }], footerText: '사이트 정보를 입력해 주세요.', responsiveOverrides: { tablet: { density: 'comfortable', alignment: 'start', showNavigation: true, columns: 2 }, mobile: { density: 'compact', alignment: 'start', showNavigation: true, columns: 1 } } },
      fields: { brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, homeUrl: createRouteUrlField('홈 연결'), navigation: { type: 'array', label: '하단 메뉴', min: 0, max: 10, defaultItemProps: (index) => ({ label: `메뉴 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, url: createRouteUrlField('메뉴 연결') } }, footerText: { type: 'textarea', label: '법적·사업자 문구', contentEditable: true }, responsiveOverrides: createFooterResponsiveField() },
      render: (props) => <FooterSimplePreview {...props} />,
    },
    FooterColumns: {
      label: 'Footer · 다단 메뉴',
      defaultProps: { brandName: '사이트 이름', homeUrl: '/', columns: [{ heading: '서비스', links: [{ label: '소개', url: '/pages/about' }, { label: '문의', url: '/pages/contact' }] }], legalText: '사이트 정보를 입력해 주세요.', responsiveOverrides: { tablet: { density: 'comfortable', alignment: 'start', showNavigation: true, columns: 2 }, mobile: { density: 'compact', alignment: 'start', showNavigation: true, columns: 1 } } },
      fields: { brandName: { type: 'text', label: '사이트 이름', contentEditable: true }, homeUrl: createRouteUrlField('홈 연결'), columns: { type: 'array', label: '메뉴 그룹', min: 1, max: 4, defaultItemProps: (index) => ({ heading: `메뉴 ${index + 1}`, links: [{ label: '링크', url: '/' }] }), getItemSummary: (item) => item.heading, arrayFields: {
        heading: { type: 'text', label: '그룹 제목', contentEditable: true },
        links: { type: 'array', label: '그룹 링크', min: 0, max: 8, defaultItemProps: (index) => ({ label: `링크 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름' }, url: createRouteUrlField('하단 메뉴 연결') } },
      } }, legalText: { type: 'textarea', label: '법적·사업자 문구', contentEditable: true }, responsiveOverrides: createFooterResponsiveField() },
      render: (props) => <FooterColumnsPreview {...props} />,
    },
  };
  const allowed = kind === 'header' ? ['HeaderNavigation', 'HeaderSystemControls', 'Announcement'] : ['FooterSimple', 'FooterColumns'];
  const settingsField: Field<boolean | undefined> = {
    type: 'custom', label: 'G7 사이트 정보 연결',
    render: ({ value, onChange, readOnly }) => <label><select aria-label="G7 사이트 정보 연결" disabled={readOnly} value={value === undefined ? 'auto' : String(value)} onChange={(event) => onChange(event.target.value === 'auto' ? undefined : event.target.value === 'true')}><option value="auto">기본 이름만 자동 연결</option><option value="true">G7 사이트 설정 사용</option><option value="false">직접 입력한 정보 사용</option></select><small>사이트 이름·설명·소셜을 G7 설정에서 가져옵니다. 법적 문구와 메뉴는 유지됩니다.</small></label>,
  };
  all.HeaderNavigation.fields = { ...all.HeaderNavigation.fields!, useSiteSettings: settingsField };
  all.FooterSimple.fields = { ...all.FooterSimple.fields!, useSiteSettings: settingsField };
  all.FooterColumns.fields = { ...all.FooterColumns.fields!, useSiteSettings: settingsField };
  const content = data?.content ?? [];
  const existing = (types: string[]): boolean => content.some((block) => types.includes(block.type));
  const headerBlock = content.find((block) => block.type === 'HeaderNavigation');
  for (const name of allowed as Array<keyof SitePartComponents>) {
    const occupied = name === 'HeaderSystemControls'
      ? !headerBlock || Boolean(headerBlock.props.systemControls?.length)
      : existing(name.startsWith('Footer') ? ['FooterSimple', 'FooterColumns'] : [name]);
    // Drawer insertion checks type-level permissions, not resolvePermissions(item).
    all[name].permissions = { insert: canInsert && !occupied, duplicate: false };
  }
  return {
    components: Object.fromEntries(Object.entries(all).filter(([name]) => allowed.includes(name))) as Config<SitePartComponents>['components'],
    root: { fields: {}, render: ({ puck }) => <div className={`g7pb-site-part-preview g7pb-site-part-preview--${kind}`}>{kind === 'footer' ? <div className="g7pb-site-part-sample"><span>페이지 본문 미리보기</span></div> : null}{puck.renderDropZone({ zone: 'default-zone', allow: allowed.filter((name) => name !== 'HeaderSystemControls') })}{kind === 'header' ? <div className="g7pb-site-part-sample"><span>페이지 본문 미리보기</span></div> : null}</div> },
  };
}

export function sitePartSetConfig(data?: SitePartPuckData, canInsert = true): Config<SitePartComponents> {
  const header = sitePartConfigFor('header', data, canInsert);
  const footer = sitePartConfigFor('footer', data, canInsert);
  return {
    categories: {
      header: { title: '헤더 · 각 1개', components: ['Announcement', 'HeaderNavigation'], defaultExpanded: true },
      system: { title: 'G7 시스템 기능 · 헤더 안에 1개', components: ['HeaderSystemControls'], defaultExpanded: true },
      footer: { title: '푸터 · 두 형태 중 1개', components: ['FooterSimple', 'FooterColumns'], defaultExpanded: true },
    },
    components: { ...header.components, ...footer.components },
    root: {
      fields: {},
      render: ({ puck }) => <div className="g7pb-site-part-preview g7pb-site-part-preview--set">
        {puck.renderDropZone({ zone: 'default-zone', allow: ['Announcement', 'HeaderNavigation', 'FooterSimple', 'FooterColumns'] })}
      </div>,
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

export function SitePartEditor({ kind, locale, setId, embedded = false, paired = false, iframeEnabled = true, onBack, onChanged }: SitePartEditorProps): React.ReactElement {
  const [persona, setPersona] = useState<'guest' | 'member' | 'admin'>('guest');
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const overrides = useMemo(() => ({
    drawer: SitePartDrawer,
    drawerItem: SitePartDrawerItem,
    actionBar: SitePartActionBar,
    headerActions: () => <span className="g7pb-site-part-header-help">PC 기본 편집 · 태블릿/모바일은 기기별 표시</span>,
    puck: SitePartPuckShell,
  }), []);
  const [resource, setResource] = useState<SitePartResource | null>(null);
  const [data, setData] = useState<SitePartPuckData>({ root: { props: {} }, content: [] });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const config = useMemo(() => sitePartConfigFor(kind, data, !busy), [kind, data, busy]);
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

  return <SitePartPersona.Provider value={persona}><section className={`g7pb-root g7pb-site-part-editor ${embedded ? 'is-embedded' : ''} ${paired ? 'is-paired' : ''}`} data-testid="page-builder-site-part-editor" data-kind={kind}>
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
      <div>
        <SitePartPresetBar kind={kind} onApply={applyPreset} />
        {kind === 'header' ? <SitePartPersonaSelector value={persona} onChange={setPersona} /> : null}
      </div>
      <div className="g7pb-site-part-device-legend"><Smartphone size={15} /><Tablet size={15} /><Monitor size={15} /><span>기기 버튼을 바꾸면 우측의 기기별 표시 설정도 함께 바뀝니다.</span></div>
      <Puck config={config} data={data} height="100%" iframe={{ enabled: iframeEnabled, syncHostStyles: true, waitForStyles: false }} viewports={VIEWPORTS} ui={{ itemSelector: data.content.length > 0 ? { index: 0, zone: 'root:default-zone' } : null, viewports: { current: { width: 1280, height: 'auto' }, controlsVisible: true, options: VIEWPORTS } }} permissions={{ edit: !busy, insert: !busy, delete: !busy, duplicate: !busy, drag: !busy }} overrides={overrides} headerTitle={kind === 'header' ? 'Header 블록' : 'Footer 블록'} headerPath={resource.title} onChange={update} onPublish={() => void publish()} />
    </div> : null}
  </section></SitePartPersona.Provider>;
}
