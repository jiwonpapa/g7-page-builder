export const PAGE_BUILDER_SCHEMA_VERSION = 'g7-page-builder/v1' as const;

export const HERO_BLOCK_TYPE = 'content.hero-centered-01' as const;
export const FEATURES_BLOCK_TYPE = 'content.features-grid-01' as const;
export const CTA_BLOCK_TYPE = 'content.cta-split-01' as const;
export const CONTACT_BLOCK_TYPE = 'content.contact-info-01' as const;

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
