/** Source-field ownership for explicit legacy-to-v3 composition conversion.
 * This table describes required mappings, not availability of a finished converter.
 * Values remain subject to the legacy validator and the target v3 validator.
 */
export type FieldRole = 'content' | 'design' | 'behavior' | 'binding';
export type TemplateScope = 'page' | 'header' | 'footer' | 'header-control';
export interface CompositionContract {
  blockId: string;
  version: 1;
  scope: TemplateScope;
  fields: Readonly<Record<string, FieldRole>>;
  collections: readonly string[];
  slots: readonly string[];
  runtime: readonly string[];
}
interface Definition {
  content?: string; design?: string; behavior?: string; binding?: string;
  collections?: string; slots?: string; runtime?: string; scope?: TemplateScope;
}
const words = (value = ''): string[] => value.split(' ').filter(Boolean);
function entry(blockId: string, definition: Definition): CompositionContract {
  const fields: Record<string, FieldRole> = {};
  for (const role of ['content', 'design', 'behavior', 'binding'] as const) {
    for (const field of words(definition[role])) {
      if (Object.hasOwn(fields, field)) throw new Error(`Duplicate composition field: ${blockId}.${field}`);
      fields[field] = role;
    }
  }
  // All page built-ins accept the existing appearance envelope. Site Parts do not.
  if (!definition.scope || definition.scope === 'page') fields.appearance = 'design';
  const collections = words(definition.collections);
  if (collections.some(field => fields[field] !== 'content')) throw new Error(`Invalid collection: ${blockId}`);
  return Object.freeze({ blockId, version: 1, scope: definition.scope ?? 'page', fields: Object.freeze(fields),
    collections: Object.freeze(collections), slots: Object.freeze(words(definition.slots)), runtime: Object.freeze(words(definition.runtime)) });
}
/** Every built-in, including the compatibility-only split Hero, has its own row. */
export const compositionContracts: readonly CompositionContract[] = Object.freeze([
  entry('content.hero-centered-01', { content: 'eyebrow title body primaryCta image', design: 'alignment layout mediaPosition', slots: 'extra actions' }),
  entry('content.hero-split-01', { content: 'eyebrow title body primaryCta image', design: 'mediaPosition layout' }),
  entry('content.hero-slider-01', { content: 'slides', collections: 'slides', behavior: 'autoplay interval loop', runtime: 'public.slider' }),
  entry('content.heading-01', { content: 'eyebrow heading', design: 'level', binding: 'anchor' }),
  entry('content.rich-text-01', { content: 'content', design: 'measure' }),
  entry('media.image-01', { content: 'src alt caption linkUrl', design: 'aspectRatio' }),
  entry('action.buttons-01', { content: 'items', collections: 'items', design: 'alignment' }),
  entry('media.image-text-01', { content: 'eyebrow heading body image primaryLink', design: 'mediaPosition', slots: 'extra actions' }),
  entry('content.icon-list-01', { content: 'eyebrow heading items', collections: 'items', design: 'layout' }),
  entry('content.features-grid-01', { content: 'title items', collections: 'items', design: 'layout' }),
  entry('content.cta-split-01', { content: 'eyebrow heading body primaryLink secondaryLink', design: 'theme layout' }),
  entry('content.contact-info-01', { content: 'heading address phone email cta mapLink' }),
  entry('trust.logo-cloud-01', { content: 'heading logos', collections: 'logos', design: 'layout' }),
  entry('data.stats-icons-01', { content: 'eyebrow heading items', collections: 'items', design: 'layout' }),
  entry('commerce.pricing-tiers-01', { content: 'eyebrow heading plans', collections: 'plans', design: 'layout' }),
  entry('company.team-grid-01', { content: 'eyebrow heading members', collections: 'members', design: 'layout' }),
  entry('media.gallery-grid-01', { content: 'eyebrow heading images', collections: 'images', design: 'columns layout' }),
  entry('data.bar-chart-01', { content: 'eyebrow heading description unit items', collections: 'items' }),
  entry('g7.board-recent-posts-01', { content: 'eyebrow heading emptyMessage', binding: 'source boardSlug period limit pageSize audience', runtime: 'g7.module.sirsoft-board public.dynamic-data' }),
  entry('g7.ecommerce-product-grid-01', { content: 'eyebrow heading emptyMessage', design: 'columns', binding: 'source limit pageSize audience detailBasePath', runtime: 'g7.module.sirsoft-ecommerce public.dynamic-data' }),
  entry('form.inquiry-01', { content: 'eyebrow heading description submitLabel successMessage privacyLabel', behavior: 'formKind showPhone showSubject', runtime: 'public.form-submission' }),
  entry('location.map-directions-01', { content: 'eyebrow heading description address mapImageSrc mapImageAlt directionsLabel directionsUrl phone hours parking', binding: 'latitude longitude zoom provider', runtime: 'public.map-embed' }),
  entry('trust.testimonials-01', { content: 'eyebrow heading items', collections: 'items', design: 'layout' }),
  entry('content.faq-accordion-01', { content: 'eyebrow heading items', collections: 'items', behavior: 'behavior openFirst', runtime: 'public.accordion' }),
  entry('content.process-timeline-01', { content: 'eyebrow heading items', collections: 'items', design: 'layout' }),
  entry('content.tabs-01', { content: 'eyebrow heading items', collections: 'items', behavior: 'initialTab', design: 'style', runtime: 'public.tabs' }),
  entry('commerce.comparison-table-01', { content: 'eyebrow heading columns rows', collections: 'columns rows', design: 'highlightColumn' }),
  entry('content.article-list-01', { content: 'eyebrow heading items', collections: 'items', design: 'layout' }),
  entry('media.video-embed-01', { content: 'eyebrow heading caption', binding: 'provider videoId', design: 'ratio', runtime: 'public.video-embed' }),
  entry('trust.logo-carousel-01', { content: 'eyebrow heading logos', collections: 'logos', behavior: 'autoplay interval', runtime: 'public.slider' }),
  entry('trust.testimonial-slider-01', { content: 'eyebrow heading items', collections: 'items', behavior: 'autoplay interval', runtime: 'public.slider' }),
  entry('content.event-schedule-01', { content: 'eyebrow heading items', collections: 'items', design: 'layout' }),
  entry('content.download-resources-01', { content: 'eyebrow heading items', collections: 'items' }),
  entry('g7.board-content-archive-01', { content: 'eyebrow heading emptyMessage', behavior: 'showSearch showBoardFilter', binding: 'source period limit pageSize audience', runtime: 'g7.module.sirsoft-board public.dynamic-data public.search-filter' }),
  entry('g7.ecommerce-product-showcase-01', { content: 'eyebrow heading emptyMessage', design: 'layout', binding: 'source limit pageSize audience detailBasePath', runtime: 'g7.module.sirsoft-ecommerce public.dynamic-data' }),
  entry('g7.board-post-detail-01', { content: 'eyebrow heading linkLabel emptyMessage', behavior: 'showContent', binding: 'boardSlug postId detailUrl audience', runtime: 'g7.module.sirsoft-board public.dynamic-data' }),
  entry('g7.ecommerce-product-detail-01', { content: 'eyebrow heading buttonLabel emptyMessage', behavior: 'showDescription', binding: 'productKey detailUrl audience', runtime: 'g7.module.sirsoft-ecommerce public.dynamic-data' }),
  entry('content.divider-01', { content: 'label', design: 'variant width' }),
  entry('content.blockquote-01', { content: 'quote citation role', design: 'alignment variant' }),
  entry('content.notice-01', { content: 'title body actionLabel actionUrl', design: 'tone' }),
  entry('content.card-grid-01', { content: 'eyebrow heading items', collections: 'items', design: 'columns variant layout' }),
  entry('navigation.breadcrumbs-01', { content: 'items currentLabel', collections: 'items' }),
  entry('navigation.anchor-menu-01', { content: 'label items', collections: 'items', behavior: 'sticky', design: 'alignment' }),
  entry('navigation.social-links-01', { content: 'heading items', collections: 'items', design: 'variant alignment' }),
  entry('media.image-carousel-01', { content: 'eyebrow heading images', collections: 'images', behavior: 'autoplay interval controls', design: 'aspectRatio', runtime: 'public.slider' }),
  entry('content.icon-01', { content: 'icon label', design: 'size tone', behavior: 'decorative' }),
  entry('content.list-01', { content: 'items', collections: 'items', behavior: 'ordered' }),
  entry('content.badge-01', { content: 'label icon', design: 'size tone' }),
  entry('content.card-01', { design: 'variant', slots: 'media body actions' }),
]);

/** Layouts and Site Parts are separate source catalogs, not page-block count padding. */
export const structuralContracts: readonly CompositionContract[] = Object.freeze([
  entry('layout.section-01', { design: 'width spacing', slots: 'content' }),
  entry('layout.columns-01', { design: 'columns ratio gap', slots: 'column1 column2 column3' }),
  entry('layout.stack-01', { design: 'gap', slots: 'content' }),
]);
export const sitePartContracts: readonly CompositionContract[] = Object.freeze([
  entry('site.header.navigation-01', { scope: 'header', content: 'brand_name logo_url home_url navigation cta', collections: 'navigation',
    design: 'variant responsive', behavior: 'sticky mobile_menu mobile_menu_style', binding: 'use_site_settings', slots: 'systemControls', runtime: 'public.site-navigation' }),
  entry('site.header.announcement-01', { scope: 'header', content: 'text link_label link_url', design: 'tone' }),
  entry('site.footer.simple-01', { scope: 'footer', content: 'brand_name home_url navigation footer_text', collections: 'navigation', design: 'responsive', binding: 'use_site_settings' }),
  entry('site.footer.columns-01', { scope: 'footer', content: 'brand_name home_url columns legal_text', collections: 'columns', design: 'responsive', binding: 'use_site_settings' }),
  entry('site.header.system-controls-01', { scope: 'header-control', behavior: 'search account cart notifications theme locale currency', runtime: 'g7.site-controls' }),
]);
