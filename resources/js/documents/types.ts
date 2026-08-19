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

export interface PageBuilderBlock<TProps extends Record<string, unknown> = Record<string, unknown>> {
  instance_id: string;
  type: string;
  block_version: number;
  props: TProps;
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
  tokens?: Record<string, ScalarToken>;
  blocks: PageBuilderBlock[];
}

export interface DocumentResource {
  document: PageBuilderDocument;
  title: string;
  lock_version: number;
  revision: number;
  public_url: string | null;
  active_artifact_sha256: string | null;
  is_home: boolean;
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
