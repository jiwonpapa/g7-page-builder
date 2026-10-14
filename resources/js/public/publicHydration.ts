function replaceElement(root: Document, marker: HTMLElement, tag: string): HTMLElement {
  const replacement = root.createElement(tag);
  for (const attribute of marker.attributes) replacement.setAttribute(attribute.name, attribute.value);
  replacement.append(...marker.childNodes);
  marker.replaceWith(replacement);
  return replacement;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ICON_MARKUP_PATTERN = /^(?:<(path|circle|rect)(?: (?:d|fill|cx|cy|r|x|y|width|height|rx|ry)="[-.,0-9A-Za-z ]+")+><\/\1>)+$/;

export function hydrateCatalogIcons(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-runtime-icon]').forEach((marker) => {
    const markup = marker.dataset.g7pbIconMarkup ?? '';
    if (!ICON_MARKUP_PATTERN.test(markup)) return;
    const svg = root.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.1');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (marker.dataset.g7pbIconSizing === 'parent') {
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
      svg.setAttribute('focusable', 'false'); svg.style.display = 'block';
    }
    if (marker.className) svg.setAttribute('class', marker.className);
    svg.innerHTML = markup;
    marker.replaceWith(svg);
  });
}

function hydrateEmbeds(root: Document): void {
  const allowedPrefixes: Record<string, string> = {
    'map-openstreetmap': 'https://www.openstreetmap.org/',
    'map-google': 'https://www.google.com/maps',
    'video-youtube': 'https://www.youtube-nocookie.com/embed/',
    'video-vimeo': 'https://player.vimeo.com/video/',
  };
  root.querySelectorAll<HTMLElement>('[data-g7pb-embed]').forEach((marker) => {
    const kind = marker.dataset.g7pbEmbedKind ?? '';
    const src = marker.dataset.g7pbEmbedSrc ?? '';
    const prefix = Object.hasOwn(allowedPrefixes, kind) ? allowedPrefixes[kind] : undefined;
    if (!prefix || !src.startsWith(prefix)) return;
    const frame = root.createElement('iframe');
    frame.src = src;
    frame.title = marker.dataset.g7pbEmbedTitle ?? '';
    frame.loading = 'lazy';
    // YouTube requires client identification; cross-origin requests expose only the origin.
    frame.referrerPolicy = kind === 'video-youtube' ? 'strict-origin-when-cross-origin' : 'no-referrer';
    frame.allowFullscreen = kind[0] === 'v';
    if (marker.dataset.g7pbEmbedSizing === 'parent') {
      Object.assign(frame.style, { display: 'block', width: '100%', height: '100%', border: '0', minWidth: '0', minHeight: '0' });
    }
    marker.replaceWith(frame);
  });
}

function hydrateInquiryHosts(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-inquiry-host]').forEach((host) => {
    if (host.hasAttribute('data-g7pb-v3-inquiry')) {
      const preview = Boolean(host.closest('[data-testid="page-builder-preview-root"]'))
        || Boolean(root.defaultView?.location.pathname.includes('/modules/jiwonpapa-page_builder/preview/'));
      if (preview || host.closest('[data-g7pb-element-site-part]')) {
        host.dataset.g7pbInquiryDisabled = preview ? '미리보기에서는 전송하지 않습니다.' : '공통영역의 문의 전송 서비스가 연결되지 않았습니다.';
        delete host.dataset.g7pbInquiryHost; delete host.dataset.g7pbInquiryForm;
        return;
      }
    }
    const form = replaceElement(root, host, 'form') as HTMLFormElement;
    form.method = 'post';
    form.action = host.dataset.g7pbFormAction ?? '';
    delete form.dataset.g7pbInquiryHost;
  });
}

function hydrateTypedControls(root: Document): void {
  const attributes = ['type', 'name', 'maxlength', 'autocomplete', 'tabindex', 'value', 'rows', 'placeholder', 'required'] as const;
  root.querySelectorAll<HTMLElement>('[data-g7pb-form-control]').forEach((marker) => {
    const tag = marker.dataset.g7pbFormControl;
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'button' && tag !== 'select') return;
    const control = root.createElement(tag);
    for (const name of attributes) {
      const value = marker.getAttribute(`data-g7pb-control-${name}`);
      if (value !== null) control.setAttribute(name, value);
    }
    if (marker.hasAttribute('data-v3-node')) {
      for (const name of ['id', 'style', 'data-v3-node', 'data-g7pb-v3-style', 'data-g7pb-form-submit', 'aria-label', 'aria-labelledby']) {
        const value = marker.getAttribute(name);
        if (value !== null) control.setAttribute(name, value);
      }
    }
    const unavailable = marker.closest<HTMLElement>('[data-g7pb-inquiry-disabled]');
    if (tag === 'button' && unavailable) {
      control.setAttribute('type', 'button'); control.setAttribute('disabled', '');
      control.setAttribute('title', unavailable.dataset.g7pbInquiryDisabled ?? '');
    }
    const controlMarker = marker.dataset.g7pbControlMarker;
    if (controlMarker === 'archive-search') control.dataset.g7pbArchiveSearch = '';
    if (controlMarker === 'archive-filter') {
      control.dataset.g7pbArchiveFilter = '';
      control.append(new Option(marker.textContent ?? '', ''));
    }
    if (tag === 'button') control.replaceChildren(...marker.childNodes);
    marker.replaceWith(control);
  });
}

export function hydrateTemplateRuntime(root: Document): void {
  prepareDataTemplates(root);
  hydrateCatalogIcons(root);
  hydrateEmbeds(root);
  hydrateInquiryHosts(root);
  hydrateTypedControls(root);
}

export function ensureSiteShellButtons(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-menu-toggle],[data-g7pb-menu-backdrop],[data-g7pb-menu-close],[data-g7pb-submenu-toggle],[data-g7pb-runtime-button]').forEach((marker) => {
    if (marker instanceof HTMLButtonElement) return;
    const button = replaceElement(root, marker, 'button') as HTMLButtonElement;
    button.type = 'button';
  });
}
import { prepareDataTemplates } from './publicDataTemplates';

