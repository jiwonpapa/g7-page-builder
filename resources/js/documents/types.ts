export const PAGE_BUILDER_SCHEMA_VERSION = 'g7-page-builder/v1' as const;

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

export type ScalarToken = string | number | boolean | null;

export interface PageBuilderCallToAction {
  label: string;
  url: string;
}

export type PageBuilderLink = PageBuilderCallToAction;

export interface PageBuilderImage {
  src: string;
  alt: string;
}

export interface BlockAppearance {
  surface: 'default' | 'soft' | 'contrast';
  spacing: 'compact' | 'normal' | 'spacious';
}

export type BlockMotionPreset = 'none' | 'reveal' | 'stagger' | 'parallax-soft' | 'counter' | 'chart-draw';

export interface BlockMotion {
  preset: BlockMotionPreset;
  intensity: 'subtle' | 'normal' | 'strong';
  trigger: 'once' | 'repeat';
  stagger_ms: 60 | 100 | 160;
}

export interface HeroBlockProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryCta?: PageBuilderCallToAction;
  image?: PageBuilderImage;
  alignment: 'left' | 'center';
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
  appearance?: BlockAppearance;
}

export interface CtaBlockProps {
  eyebrow: string;
  heading: string;
  body: string;
  primaryLink?: PageBuilderLink;
  secondaryLink?: PageBuilderLink;
  theme: 'light' | 'dark';
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

export type DynamicAudience = 'all' | 'guest' | 'member';

export interface G7RecentPostsBlockProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: 3 | 4 | 6 | 8 | 12;
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
  audience: DynamicAudience;
  detailBasePath: string;
  emptyMessage: string;
  appearance?: BlockAppearance;
}

export interface PageBuilderBlock<TProps extends Record<string, unknown> = Record<string, unknown>> {
  instance_id: string;
  type: string;
  block_version: number;
  props: TProps;
  motion?: BlockMotion;
  slots?: Record<string, PageBuilderBlock[]>;
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

export interface PageBuilderDocument {
  schema_version: typeof PAGE_BUILDER_SCHEMA_VERSION;
  document_id: string;
  slug: string;
  mode: 'canvas';
  locale: string;
  shell_mode?: PageShellMode;
  tokens?: Record<string, ScalarToken>;
  blocks: PageBuilderBlock[];
}

export type PageShellMode = 'template' | 'builder' | 'none' | 'global';

export interface RouteCatalogEntry {
  id: string;
  label: string;
  category: string;
  path: string;
  action?: 'logout';
  auth_required: boolean;
  guest_only: boolean;
  parameters: string[];
  parameter_sources: Record<string, 'page' | 'board' | 'category' | 'product' | 'manual'>;
  source: {
    kind: 'template' | 'module' | 'core';
    identifier: string | null;
  };
}

export interface RouteCatalogResource {
  active_template: string;
  routes: RouteCatalogEntry[];
}

export interface DocumentResource {
  document: PageBuilderDocument;
  title: string;
  lock_version: number;
  revision: number;
  public_url: string | null;
  active_artifact_sha256: string | null;
  is_home: boolean;
  status: 'draft' | 'published' | 'published_with_changes' | 'archived';
  has_unpublished_changes: boolean;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  archived_at: string | null;
}

export interface RevisionSummary {
  revision: number;
  schema_version: string;
  title: string;
  slug: string;
  locale: string;
  block_count: number;
  author_id: number | null;
  created_at: string;
}

export interface RevisionListResource {
  current_revision: number;
  items: RevisionSummary[];
}

export interface RevisionResource extends RevisionSummary {
  document: PageBuilderDocument;
}

export interface DocumentListResource {
  items: DocumentResource[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface MediaAssetResource {
  id: string;
  url: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
}

export interface MediaListResource {
  items: MediaAssetResource[];
}

export interface SiteShellLink {
  label: string;
  url: string;
}

export type SitePartLink = SiteShellLink;

export interface SiteShellResource {
  locale: string;
  lock_version: number;
  brand_name: string;
  logo_url: string;
  home_url: string;
  header_variant: 'solid' | 'transparent';
  sticky: boolean;
  navigation: SiteShellLink[];
  cta: SiteShellLink | null;
  footer_text: string;
  show_footer_navigation: boolean;
  updated_at: string | null;
}

export type SitePartKind = 'header' | 'footer';

export interface SitePartDocument {
  schema_version: 'g7-page-builder/site-part/v1';
  site_part_id: string;
  kind: SitePartKind;
  locale: string;
  tokens: Record<string, ScalarToken>;
  blocks: PageBuilderBlock[];
}

export interface SitePartResource {
  title: string;
  document: SitePartDocument;
  lock_version: number;
  revision: number;
  active_revision: number | null;
  status: 'draft' | 'published_with_changes' | 'published';
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
}

export interface SitePartRevisionResource {
  revision: number;
  title: string;
  document: SitePartDocument;
  author_id: number | null;
  created_at: string;
}

export interface PreviewResource {
  preview_url: string;
  expires_at: string;
}

export interface PublicationPreparation {
  publication_token: string;
  artifact_sha256: string;
  warnings: string[];
}

export interface PublicationCommit {
  public_url: string;
  artifact_sha256: string;
  published_at: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

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
