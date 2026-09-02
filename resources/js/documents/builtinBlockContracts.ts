import type { DynamicAudience, PageBuilderBlock, PageBuilderCallToAction, PageBuilderImage, PageBuilderLink } from './types';
import type { BlockAppearance } from './blockPresentation';

export const HERO_BLOCK_TYPE = 'content.hero-centered-01' as const;

export const FEATURES_BLOCK_TYPE = 'content.features-grid-01' as const;

export const CTA_BLOCK_TYPE = 'content.cta-split-01' as const;

export const CONTACT_BLOCK_TYPE = 'content.contact-info-01' as const;

export const HERO_SPLIT_BLOCK_TYPE = 'content.hero-split-01' as const;

export const HERO_SLIDER_BLOCK_TYPE = 'content.hero-slider-01' as const;

export const LOGO_CLOUD_BLOCK_TYPE = 'trust.logo-cloud-01' as const;

export const STATS_BLOCK_TYPE = 'data.stats-icons-01' as const;

export const PRICING_BLOCK_TYPE = 'commerce.pricing-tiers-01' as const;

export const TEAM_BLOCK_TYPE = 'company.team-grid-01' as const;

export const GALLERY_BLOCK_TYPE = 'media.gallery-grid-01' as const;

export const BAR_CHART_BLOCK_TYPE = 'data.bar-chart-01' as const;

export const G7_RECENT_POSTS_BLOCK_TYPE = 'g7.board-recent-posts-01' as const;

export const G7_PRODUCT_GRID_BLOCK_TYPE = 'g7.ecommerce-product-grid-01' as const;

export const INQUIRY_FORM_BLOCK_TYPE = 'form.inquiry-01' as const;

export const MAP_DIRECTIONS_BLOCK_TYPE = 'location.map-directions-01' as const;

export const TESTIMONIALS_BLOCK_TYPE = 'trust.testimonials-01' as const;

export const FAQ_ACCORDION_BLOCK_TYPE = 'content.faq-accordion-01' as const;

export const PROCESS_TIMELINE_BLOCK_TYPE = 'content.process-timeline-01' as const;

export const TABS_BLOCK_TYPE = 'content.tabs-01' as const;

export const COMPARISON_TABLE_BLOCK_TYPE = 'commerce.comparison-table-01' as const;

export const ARTICLE_LIST_BLOCK_TYPE = 'content.article-list-01' as const;

export const VIDEO_EMBED_BLOCK_TYPE = 'media.video-embed-01' as const;

export const LOGO_CAROUSEL_BLOCK_TYPE = 'trust.logo-carousel-01' as const;

export const TESTIMONIAL_SLIDER_BLOCK_TYPE = 'trust.testimonial-slider-01' as const;

export const EVENT_SCHEDULE_BLOCK_TYPE = 'content.event-schedule-01' as const;

export const DOWNLOAD_RESOURCES_BLOCK_TYPE = 'content.download-resources-01' as const;

export const G7_BOARD_ARCHIVE_BLOCK_TYPE = 'g7.board-content-archive-01' as const;

export const G7_PRODUCT_SHOWCASE_BLOCK_TYPE = 'g7.ecommerce-product-showcase-01' as const;

export const HEADING_BLOCK_TYPE = 'content.heading-01' as const;

export const RICH_TEXT_BLOCK_TYPE = 'content.rich-text-01' as const;

export const IMAGE_BLOCK_TYPE = 'media.image-01' as const;

export const BUTTONS_BLOCK_TYPE = 'action.buttons-01' as const;

export const IMAGE_TEXT_BLOCK_TYPE = 'media.image-text-01' as const;

export const ICON_LIST_BLOCK_TYPE = 'content.icon-list-01' as const;

export const G7_POST_DETAIL_BLOCK_TYPE = 'g7.board-post-detail-01' as const;

export const G7_PRODUCT_DETAIL_BLOCK_TYPE = 'g7.ecommerce-product-detail-01' as const;

export const DIVIDER_BLOCK_TYPE = 'content.divider-01' as const;

export const BLOCKQUOTE_BLOCK_TYPE = 'content.blockquote-01' as const;

export const NOTICE_BLOCK_TYPE = 'content.notice-01' as const;

export const CARD_GRID_BLOCK_TYPE = 'content.card-grid-01' as const;

export const BREADCRUMBS_BLOCK_TYPE = 'navigation.breadcrumbs-01' as const;

export const ANCHOR_MENU_BLOCK_TYPE = 'navigation.anchor-menu-01' as const;

export const SOCIAL_LINKS_BLOCK_TYPE = 'navigation.social-links-01' as const;

export const IMAGE_CAROUSEL_BLOCK_TYPE = 'media.image-carousel-01' as const;

export interface HeroBlockProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryCta?: PageBuilderCallToAction;
  image?: PageBuilderImage;
  alignment: 'left' | 'center';
  layout?: 'poster' | 'product' | 'backdrop' | 'editorial' | 'device' | 'balanced' | 'screenshot' | 'overlap' | 'offset';
  mediaPosition?: 'left' | 'right';
  appearance?: BlockAppearance;
}

export interface FeatureItem {
  icon: string;
  title: string;
  body: string;
}

export interface FeaturesBlockProps {
  title: string;
  items: FeatureItem[];
  layout?: 'grid' | 'bento' | 'editorial' | 'panel' | 'list';
  appearance?: BlockAppearance;
}

export interface CtaBlockProps {
  eyebrow: string;
  heading: string;
  body: string;
  primaryLink?: PageBuilderLink;
  secondaryLink?: PageBuilderLink;
  theme: 'light' | 'dark';
  layout?: 'split' | 'centered' | 'banner' | 'panel';
  appearance?: BlockAppearance;
}

export interface ContactBlockProps {
  heading: string;
  address: string;
  phone: string;
  email: string;
  cta?: PageBuilderLink;
  mapLink?: PageBuilderLink;
  appearance?: BlockAppearance;
}

export interface HeroSplitBlockProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryCta?: PageBuilderLink;
  image?: PageBuilderImage;
  mediaPosition: 'left' | 'right';
  layout?: 'balanced' | 'screenshot' | 'overlap' | 'offset';
  appearance?: BlockAppearance;
}

export interface HeroSlideItem {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  imageSrc: string;
  imageAlt: string;
}

export interface HeroSliderBlockProps {
  slides: HeroSlideItem[];
  autoplay?: boolean;
  interval?: 3000 | 5000 | 7000;
  loop?: boolean;
  appearance?: BlockAppearance;
}

export interface LogoItem {
  name: string;
  imageSrc: string;
  imageAlt: string;
  url: string;
}

export interface LogoCloudBlockProps {
  heading: string;
  logos: LogoItem[];
  layout?: 'strip' | 'grid' | 'panel';
  appearance?: BlockAppearance;
}

export interface StatItem {
  icon: string;
  value: string;
  label: string;
  detail: string;
}

export interface StatsBlockProps {
  eyebrow: string;
  heading: string;
  items: StatItem[];
  layout?: 'grid' | 'strip' | 'split' | 'editorial';
  appearance?: BlockAppearance;
}

export interface PricingPlanItem {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  buttonLabel: string;
  buttonUrl: string;
  featured: boolean;
}

export interface PricingBlockProps {
  eyebrow: string;
  heading: string;
  plans: PricingPlanItem[];
  layout?: 'cards' | 'featured' | 'compact' | 'editorial';
  appearance?: BlockAppearance;
}

export interface TeamMemberItem {
  name: string;
  role: string;
  bio: string;
  imageSrc: string;
  imageAlt: string;
  profileUrl: string;
}

export interface TeamBlockProps {
  eyebrow: string;
  heading: string;
  members: TeamMemberItem[];
  layout?: 'grid' | 'portraits' | 'editorial' | 'featured';
  appearance?: BlockAppearance;
}

export interface GalleryImageItem {
  src: string;
  alt: string;
  caption: string;
}

export interface GalleryBlockProps {
  eyebrow: string;
  heading: string;
  images: GalleryImageItem[];
  columns: 2 | 3 | 4;
  layout?: 'grid' | 'bento' | 'masonry' | 'filmstrip';
  appearance?: BlockAppearance;
}

export interface BarChartItem {
  label: string;
  value: number;
  tone: 'blue' | 'indigo' | 'emerald' | 'amber';
}

export interface BarChartBlockProps {
  eyebrow: string;
  heading: string;
  description: string;
  unit: string;
  items: BarChartItem[];
  appearance?: BlockAppearance;
}

export interface G7RecentPostsBlockProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: 3 | 4 | 6 | 8 | 12;
  pageSize?: 3 | 4 | 6;
  audience: DynamicAudience;
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export interface G7ProductGridBlockProps {
  eyebrow: string;
  heading: string;
  source: 'latest' | 'new' | 'popular';
  limit: 2 | 3 | 4 | 6 | 8 | 12;
  columns: 2 | 3 | 4;
  pageSize?: 2 | 3 | 4 | 6;
  audience: DynamicAudience;
  detailBasePath: string;
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export type InquiryFormKind = 'inquiry' | 'quote' | 'reservation' | 'application' | 'newsletter';

export interface InquiryFormBlockProps {
  eyebrow: string;
  heading: string;
  description: string;
  formKind: InquiryFormKind;
  submitLabel: string;
  successMessage: string;
  privacyLabel: string;
  showPhone: boolean;
  showSubject: boolean;
  appearance?: BlockAppearance;
}

export interface MapDirectionsBlockProps {
  eyebrow: string;
  heading: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  zoom: 12 | 14 | 16 | 18;
  provider: 'image' | 'openstreetmap' | 'google' | 'none';
  mapImageSrc?: string;
  mapImageAlt?: string;
  directionsLabel: string;
  directionsUrl: string;
  phone: string;
  hours: string;
  parking: string;
  appearance?: BlockAppearance;
}

export interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  company: string;
  avatarSrc: string;
  avatarAlt: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface TestimonialsBlockProps {
  eyebrow: string;
  heading: string;
  items: TestimonialItem[];
  layout: 'grid' | 'spotlight' | 'split' | 'wall' | 'quote-hero';
  appearance?: BlockAppearance;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqAccordionBlockProps {
  eyebrow: string;
  heading: string;
  items: FaqItem[];
  behavior: 'single' | 'multiple';
  openFirst: boolean;
  appearance?: BlockAppearance;
}

export interface ProcessStepItem {
  title: string;
  body: string;
  linkLabel: string;
  linkUrl: string;
}

export interface ProcessTimelineBlockProps {
  eyebrow: string;
  heading: string;
  items: ProcessStepItem[];
  layout: 'vertical' | 'horizontal';
  appearance?: BlockAppearance;
}

export interface TabItem {
  label: string;
  heading: string;
  body: string;
}

export interface TabsBlockProps {
  eyebrow: string;
  heading: string;
  items: TabItem[];
  initialTab: number;
  style: 'underline' | 'pills';
  appearance?: BlockAppearance;
}

export interface ComparisonColumnItem {
  title: string;
  description: string;
}

export interface ComparisonRowItem {
  feature: string;
  values: string[];
}

export interface ComparisonTableBlockProps {
  eyebrow: string;
  heading: string;
  columns: ComparisonColumnItem[];
  rows: ComparisonRowItem[];
  highlightColumn: number;
  appearance?: BlockAppearance;
}

export interface ArticleListItem {
  category: string;
  title: string;
  summary: string;
  date: string;
  imageSrc: string;
  imageAlt: string;
  url: string;
}

export interface ArticleListBlockProps {
  eyebrow: string;
  heading: string;
  items: ArticleListItem[];
  layout: 'list' | 'grid' | 'featured' | 'magazine' | 'editorial';
  appearance?: BlockAppearance;
}

export interface VideoEmbedBlockProps {
  eyebrow: string;
  heading: string;
  caption: string;
  provider: 'youtube' | 'vimeo';
  videoId: string;
  ratio: '16:9' | '4:3' | '1:1';
  appearance?: BlockAppearance;
}

export interface LogoCarouselBlockProps {
  eyebrow: string;
  heading: string;
  logos: LogoItem[];
  autoplay: boolean;
  interval: 3000 | 5000 | 7000;
  appearance?: BlockAppearance;
}

export interface TestimonialSliderBlockProps {
  eyebrow: string;
  heading: string;
  items: TestimonialItem[];
  autoplay: boolean;
  interval: 5000 | 7000 | 9000;
  appearance?: BlockAppearance;
}

export interface EventScheduleItem {
  date: string;
  time: string;
  title: string;
  location: string;
  description: string;
  buttonLabel: string;
  buttonUrl: string;
}

export interface EventScheduleBlockProps {
  eyebrow: string;
  heading: string;
  items: EventScheduleItem[];
  layout: 'agenda' | 'timeline';
  appearance?: BlockAppearance;
}

export interface DownloadResourceItem {
  title: string;
  description: string;
  fileType: string;
  fileSize: string;
  buttonLabel: string;
  url: string;
}

export interface DownloadResourcesBlockProps {
  eyebrow: string;
  heading: string;
  items: DownloadResourceItem[];
  appearance?: BlockAppearance;
}

export interface G7BoardArchiveBlockProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: 6 | 8 | 12;
  pageSize?: 3 | 4 | 6;
  audience: DynamicAudience;
  showSearch: boolean;
  showBoardFilter: boolean;
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export interface G7ProductShowcaseBlockProps {
  eyebrow: string;
  heading: string;
  source: 'latest' | 'new' | 'popular';
  limit: 3 | 4 | 6 | 8;
  pageSize?: 3 | 4;
  audience: DynamicAudience;
  detailBasePath: string;
  layout: 'featured' | 'rail';
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export interface HeadingBlockProps {
  eyebrow: string;
  heading: string;
  level: 2 | 3 | 4;
  anchor: string;
  appearance?: BlockAppearance;
}

export interface RichTextBlockProps {
  content: string;
  measure: 'narrow' | 'standard' | 'wide';
  appearance?: BlockAppearance;
}

export interface ImageBlockProps {
  src: string;
  alt: string;
  caption: string;
  linkUrl: string;
  aspectRatio: 'auto' | '16:9' | '4:3' | '1:1';
  appearance?: BlockAppearance;
}

export interface ButtonItem {
  label: string;
  url: string;
  variant: 'primary' | 'secondary' | 'text';
}

export interface ButtonsBlockProps {
  items: ButtonItem[];
  alignment: 'left' | 'center' | 'right';
  appearance?: BlockAppearance;
}

export interface ImageTextBlockProps {
  eyebrow: string;
  heading: string;
  body: string;
  image: PageBuilderImage;
  mediaPosition: 'left' | 'right';
  primaryLink?: PageBuilderLink;
  appearance?: BlockAppearance;
}

export interface IconListItem {
  icon: string;
  title: string;
  body: string;
}

export interface IconListBlockProps {
  eyebrow: string;
  heading: string;
  items: IconListItem[];
  layout: 'single' | 'two-column';
  appearance?: BlockAppearance;
}

export interface G7PostDetailBlockProps {
  eyebrow: string;
  heading: string;
  boardSlug: string;
  postId: number;
  detailUrl: string;
  linkLabel: string;
  audience: DynamicAudience;
  showContent: boolean;
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export interface G7ProductDetailBlockProps {
  eyebrow: string;
  heading: string;
  productKey: string;
  detailUrl: string;
  buttonLabel: string;
  audience: DynamicAudience;
  showDescription: boolean;
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export interface DividerBlockProps {
  variant: 'solid' | 'dashed' | 'gradient';
  width: 'narrow' | 'standard' | 'full';
  label: string;
  appearance?: BlockAppearance;
}

export interface BlockquoteBlockProps {
  quote: string;
  citation: string;
  role: string;
  alignment: 'left' | 'center';
  variant: 'line' | 'mark';
  appearance?: BlockAppearance;
}

export interface NoticeBlockProps {
  tone: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  appearance?: BlockAppearance;
}

export interface CardGridItem {
  kicker: string;
  title: string;
  body: string;
  linkLabel: string;
  linkUrl: string;
}

export interface CardGridBlockProps {
  eyebrow: string;
  heading: string;
  items: CardGridItem[];
  columns: 2 | 3;
  variant: 'plain' | 'outlined';
  layout?: 'grid' | 'bento' | 'rail' | 'editorial' | 'numbered';
  appearance?: BlockAppearance;
}

export interface BreadcrumbItem {
  label: string;
  url: string;
}

export interface BreadcrumbsBlockProps {
  items: BreadcrumbItem[];
  currentLabel: string;
  appearance?: BlockAppearance;
}

export interface AnchorMenuItem {
  label: string;
  anchor: string;
}

export interface AnchorMenuBlockProps {
  label: string;
  items: AnchorMenuItem[];
  sticky: boolean;
  alignment: 'left' | 'center';
  appearance?: BlockAppearance;
}

export type SocialNetwork = 'instagram' | 'youtube' | 'facebook' | 'linkedin' | 'x' | 'kakao' | 'blog' | 'website';

export interface SocialLinkItem {
  network: SocialNetwork;
  label: string;
  url: string;
}

export interface SocialLinksBlockProps {
  heading: string;
  items: SocialLinkItem[];
  variant: 'icons' | 'labels';
  alignment: 'left' | 'center' | 'right';
  appearance?: BlockAppearance;
}

export interface ImageCarouselItem extends PageBuilderImage {
  caption: string;
}

export interface ImageCarouselBlockProps {
  eyebrow: string;
  heading: string;
  images: ImageCarouselItem[];
  autoplay: boolean;
  interval: 3000 | 5000 | 7000;
  controls: 'arrows' | 'dots' | 'both';
  aspectRatio: '16:9' | '4:3' | '1:1';
  appearance?: BlockAppearance;
}

export type HeroBlock = PageBuilderBlock<HeroBlockProps & Record<string, unknown>> & {
  type: typeof HERO_BLOCK_TYPE;
};

export type FeaturesBlock = PageBuilderBlock<FeaturesBlockProps & Record<string, unknown>> & {
  type: typeof FEATURES_BLOCK_TYPE;
};

export type CtaBlock = PageBuilderBlock<CtaBlockProps & Record<string, unknown>> & {
  type: typeof CTA_BLOCK_TYPE;
};

export type ContactBlock = PageBuilderBlock<ContactBlockProps & Record<string, unknown>> & {
  type: typeof CONTACT_BLOCK_TYPE;
};

export function isHeroBlock(block: PageBuilderBlock): block is HeroBlock {
  return block.type === HERO_BLOCK_TYPE;
}

export function isFeaturesBlock(block: PageBuilderBlock): block is FeaturesBlock {
  return block.type === FEATURES_BLOCK_TYPE;
}

export function isCtaBlock(block: PageBuilderBlock): block is CtaBlock {
  return block.type === CTA_BLOCK_TYPE;
}

export function isContactBlock(block: PageBuilderBlock): block is ContactBlock {
  return block.type === CONTACT_BLOCK_TYPE;
}
