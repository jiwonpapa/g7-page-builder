import type { AppearanceEditorProps } from './catalogAppearance';
import type { BlockAppearance, BlockMotion } from '../documents/blockPresentation';
import type { HeroSlideItem, LogoItem, StatItem, PricingPlanItem, TeamMemberItem, GalleryImageItem, BarChartItem, InquiryFormKind } from '../documents/builtinBlockContracts';
import type { FoundationCatalogEditorComponents } from './foundationCatalogData';
import type { Phase2CatalogEditorComponents } from './phase2CatalogData';
import type { Phase3CatalogEditorComponents } from './phase3CatalogData';
import type { Phase4CatalogEditorComponents } from './phase4CatalogData';
import type { ProductionCatalogEditorComponents } from './productionCatalogData';

export interface HeroSplitEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  imageSrc: string;
  imageAlt: string;
  mediaPosition: 'left' | 'right';
  layout: 'balanced' | 'screenshot' | 'overlap' | 'offset';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface HeroSliderEditorProps extends AppearanceEditorProps {
  slides: HeroSlideItem[];
  autoplay: 'yes' | 'no';
  interval: '3000' | '5000' | '7000';
  loop: 'yes' | 'no';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface LogoCloudEditorProps extends AppearanceEditorProps {
  heading: string;
  logos: LogoItem[];
  layout: 'strip' | 'grid' | 'panel';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface StatsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: StatItem[];
  layout: 'grid' | 'strip' | 'split' | 'editorial';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface PricingFeatureEditor {
  text: string;
}

export interface PricingPlanEditor extends Omit<PricingPlanItem, 'features' | 'featured'> {
  features: PricingFeatureEditor[];
  featured: 'yes' | 'no';
}

export interface PricingEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  plans: PricingPlanEditor[];
  layout: 'cards' | 'featured' | 'compact' | 'editorial';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface TeamEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  members: TeamMemberItem[];
  layout: 'grid' | 'portraits' | 'editorial' | 'featured';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface GalleryEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  images: GalleryImageItem[];
  columns: '2' | '3' | '4';
  layout: 'grid' | 'bento' | 'masonry' | 'filmstrip';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface BarChartEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  unit: string;
  items: BarChartItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface G7RecentPostsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: '3' | '4' | '6' | '8' | '12';
  pageSize: '3' | '4' | '6';
  audience: 'all' | 'guest' | 'member';
  emptyMessage: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface G7ProductGridEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'latest' | 'new' | 'popular';
  limit: '2' | '3' | '4' | '6' | '8' | '12';
  columns: '2' | '3' | '4';
  pageSize: '2' | '3' | '4' | '6';
  audience: 'all' | 'guest' | 'member';
  detailBasePath: string;
  emptyMessage: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface InquiryFormEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  formKind: InquiryFormKind;
  submitLabel: string;
  successMessage: string;
  privacyLabel: string;
  showPhone: boolean;
  showSubject: boolean;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface MapDirectionsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  zoom: '12' | '14' | '16' | '18';
  provider: 'image' | 'openstreetmap' | 'google' | 'none';
  mapImageSrc: string;
  mapImageAlt: string;
  directionsLabel: string;
  directionsUrl: string;
  phone: string;
  hours: string;
  parking: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface CatalogEditorComponents extends FoundationCatalogEditorComponents, Phase2CatalogEditorComponents, Phase3CatalogEditorComponents, Phase4CatalogEditorComponents, ProductionCatalogEditorComponents {
  HeroSplit: HeroSplitEditorProps;
  HeroSlider: HeroSliderEditorProps;
  LogoCloud: LogoCloudEditorProps;
  Stats: StatsEditorProps;
  Pricing: PricingEditorProps;
  Team: TeamEditorProps;
  Gallery: GalleryEditorProps;
  BarChart: BarChartEditorProps;
  G7RecentPosts: G7RecentPostsEditorProps;
  G7ProductGrid: G7ProductGridEditorProps;
  InquiryForm: InquiryFormEditorProps;
  MapDirections: MapDirectionsEditorProps;
}

export type CatalogComponentType = keyof CatalogEditorComponents;
