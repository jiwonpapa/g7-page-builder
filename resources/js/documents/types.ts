import type { BlockMotion, BlockResponsiveOverrides } from './blockPresentation';

export const PAGE_BUILDER_SCHEMA_VERSION = 'g7-page-builder/v1' as const;
export const PAGE_BUILDER_SCHEMA_V2 = 'g7-page-builder/v2' as const;
export type PageBuilderSchemaVersion = typeof PAGE_BUILDER_SCHEMA_VERSION | typeof PAGE_BUILDER_SCHEMA_V2;

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

export type DynamicAudience = 'all' | 'guest' | 'member';

export interface BlockVisibility {
  audience: DynamicAudience;
}

export interface PageBuilderBlock<TProps extends Record<string, unknown> = Record<string, unknown>> {
  instance_id: string;
  type: string;
  block_version: number;
  props: TProps;
  motion?: BlockMotion;
  visibility?: BlockVisibility;
  responsive?: BlockResponsiveOverrides;
  slots?: Record<string, PageBuilderBlock[]>;
}

export interface PageBuilderDocument {
  schema_version: PageBuilderSchemaVersion;
  document_id: string;
  slug: string;
  mode: 'canvas';
  locale: string;
  shell_mode?: PageShellMode;
  seo?: PageSeoMetadata;
  tokens?: Record<string, ScalarToken>;
  blocks: PageBuilderBlock[];
}

export interface PageSeoMetadata {
  title: string;
  description: string;
  og_image_url: string;
  robots: 'index' | 'noindex';
}

export type PageShellMode = 'template' | 'builder' | 'none' | 'global';

export interface SiteShellLink {
  label: string;
  url: string;
}

export interface SitePartLink extends SiteShellLink {
  children?: SiteShellLink[];
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

// Preserve the document entry point while definitions belong to the built-in contract.
export {
  HERO_BLOCK_TYPE,
  FEATURES_BLOCK_TYPE,
  CTA_BLOCK_TYPE,
  CONTACT_BLOCK_TYPE,
  HERO_SPLIT_BLOCK_TYPE,
  HERO_SLIDER_BLOCK_TYPE,
  LOGO_CLOUD_BLOCK_TYPE,
  STATS_BLOCK_TYPE,
  PRICING_BLOCK_TYPE,
  TEAM_BLOCK_TYPE,
  GALLERY_BLOCK_TYPE,
  BAR_CHART_BLOCK_TYPE,
  G7_RECENT_POSTS_BLOCK_TYPE,
  G7_PRODUCT_GRID_BLOCK_TYPE,
  INQUIRY_FORM_BLOCK_TYPE,
  MAP_DIRECTIONS_BLOCK_TYPE,
  TESTIMONIALS_BLOCK_TYPE,
  FAQ_ACCORDION_BLOCK_TYPE,
  PROCESS_TIMELINE_BLOCK_TYPE,
  TABS_BLOCK_TYPE,
  COMPARISON_TABLE_BLOCK_TYPE,
  ARTICLE_LIST_BLOCK_TYPE,
  VIDEO_EMBED_BLOCK_TYPE,
  LOGO_CAROUSEL_BLOCK_TYPE,
  TESTIMONIAL_SLIDER_BLOCK_TYPE,
  EVENT_SCHEDULE_BLOCK_TYPE,
  DOWNLOAD_RESOURCES_BLOCK_TYPE,
  G7_BOARD_ARCHIVE_BLOCK_TYPE,
  G7_PRODUCT_SHOWCASE_BLOCK_TYPE,
  HEADING_BLOCK_TYPE,
  RICH_TEXT_BLOCK_TYPE,
  IMAGE_BLOCK_TYPE,
  BUTTONS_BLOCK_TYPE,
  IMAGE_TEXT_BLOCK_TYPE,
  ICON_LIST_BLOCK_TYPE,
  G7_POST_DETAIL_BLOCK_TYPE,
  G7_PRODUCT_DETAIL_BLOCK_TYPE,
  DIVIDER_BLOCK_TYPE,
  BLOCKQUOTE_BLOCK_TYPE,
  NOTICE_BLOCK_TYPE,
  CARD_GRID_BLOCK_TYPE,
  BREADCRUMBS_BLOCK_TYPE,
  ANCHOR_MENU_BLOCK_TYPE,
  SOCIAL_LINKS_BLOCK_TYPE,
  IMAGE_CAROUSEL_BLOCK_TYPE,
  isHeroBlock,
  isFeaturesBlock,
  isCtaBlock,
  isContactBlock,
} from './builtinBlockContracts';
export type {
  HeroBlockProps,
  FeatureItem,
  FeaturesBlockProps,
  CtaBlockProps,
  ContactBlockProps,
  HeroSplitBlockProps,
  HeroSlideItem,
  HeroSliderBlockProps,
  LogoItem,
  LogoCloudBlockProps,
  StatItem,
  StatsBlockProps,
  PricingPlanItem,
  PricingBlockProps,
  TeamMemberItem,
  TeamBlockProps,
  GalleryImageItem,
  GalleryBlockProps,
  BarChartItem,
  BarChartBlockProps,
  G7RecentPostsBlockProps,
  G7ProductGridBlockProps,
  InquiryFormKind,
  InquiryFormBlockProps,
  MapDirectionsBlockProps,
  TestimonialItem,
  TestimonialsBlockProps,
  FaqItem,
  FaqAccordionBlockProps,
  ProcessStepItem,
  ProcessTimelineBlockProps,
  TabItem,
  TabsBlockProps,
  ComparisonColumnItem,
  ComparisonRowItem,
  ComparisonTableBlockProps,
  ArticleListItem,
  ArticleListBlockProps,
  VideoEmbedBlockProps,
  LogoCarouselBlockProps,
  TestimonialSliderBlockProps,
  EventScheduleItem,
  EventScheduleBlockProps,
  DownloadResourceItem,
  DownloadResourcesBlockProps,
  G7BoardArchiveBlockProps,
  G7ProductShowcaseBlockProps,
  HeadingBlockProps,
  RichTextBlockProps,
  ImageBlockProps,
  ButtonItem,
  ButtonsBlockProps,
  ImageTextBlockProps,
  IconListItem,
  IconListBlockProps,
  G7PostDetailBlockProps,
  G7ProductDetailBlockProps,
  DividerBlockProps,
  BlockquoteBlockProps,
  NoticeBlockProps,
  CardGridItem,
  CardGridBlockProps,
  BreadcrumbItem,
  BreadcrumbsBlockProps,
  AnchorMenuItem,
  AnchorMenuBlockProps,
  SocialNetwork,
  SocialLinkItem,
  SocialLinksBlockProps,
  ImageCarouselItem,
  ImageCarouselBlockProps,
  HeroBlock,
  FeaturesBlock,
  CtaBlock,
  ContactBlock,
} from './builtinBlockContracts';

export type {
  BlockAppearance,
  ElementAppearance,
  ElementAppearanceMap,
  ResponsiveAppearanceOverride,
  ResponsiveLayoutOverride,
  BlockResponsiveOverride,
  BlockResponsiveOverrides,
  BlockMotionPreset,
  BlockMotion,
} from './blockPresentation';
export { LAYOUT_SECTION_BLOCK_TYPE, LAYOUT_COLUMNS_BLOCK_TYPE, LAYOUT_STACK_BLOCK_TYPE } from './layoutContracts';
export type { LayoutSectionBlockProps, LayoutColumnsBlockProps, LayoutStackBlockProps } from './layoutContracts';
