function replaceElement(root: Document, marker: HTMLElement, tag: string): HTMLElement {
  const replacement = root.createElement(tag);
  for (const attribute of marker.attributes) replacement.setAttribute(attribute.name, attribute.value);
  replacement.append(...marker.childNodes);
  marker.replaceWith(replacement);
  return replacement;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ICON_MARKUP_PATTERN = /^(?:<(path|circle|rect)(?: (?:d|fill|cx|cy|r|x|y|width|height|rx|ry)="[-.,0-9A-Za-z ]+")+><\/\1>)+$/;

function hydrateCatalogIcons(root: Document): void {
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
    frame.referrerPolicy = 'no-referrer';
    frame.allowFullscreen = kind[0] === 'v';
    marker.replaceWith(frame);
  });
}

function hydrateInquiryHosts(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-inquiry-host]').forEach((host) => {
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
