import type { Config } from '@puckeditor/core';
import type { CatalogEditorComponents } from './catalogEditorTypes';
import { foundationCatalogComponentConfigs } from './foundationCatalogBlocks';
import { phase2CatalogComponentConfigs } from './phase2CatalogBlocks';
import { phase3CatalogComponentConfigs } from './phase3CatalogBlocks';
import { phase4CatalogComponentConfigs } from './phase4CatalogBlocks';
import { productionCatalogComponentConfigs } from './productionCatalogBlocks';
import { DEFAULT_HERO_SPLIT, DEFAULT_HERO_SLIDER, DEFAULT_LOGO_CLOUD, DEFAULT_STATS, DEFAULT_PRICING, DEFAULT_TEAM, DEFAULT_GALLERY, DEFAULT_BAR_CHART, DEFAULT_G7_RECENT_POSTS, DEFAULT_G7_PRODUCT_GRID, DEFAULT_INQUIRY_FORM, DEFAULT_MAP_DIRECTIONS } from './catalogData';
import { heroSplitFields, heroSliderFields, logoCloudFields, statsFields, pricingFields, teamFields, galleryFields, barChartFields, g7RecentPostsFields, g7ProductGridFields, inquiryFormFields, mapDirectionsFields } from './catalogFields';
import { HeroSplitPreview, HeroSliderPreview, LogoCloudPreview, StatsPreview, PricingPreview, TeamPreview, GalleryPreview, BarChartPreview, G7RecentPostsPreview, G7ProductGridPreview, InquiryFormPreview, MapDirectionsPreview } from './catalogPreviews';

export const catalogComponentConfigs: Config<CatalogEditorComponents>['components'] = {
  ...foundationCatalogComponentConfigs,
  ...phase2CatalogComponentConfigs,
  ...phase3CatalogComponentConfigs,
  ...phase4CatalogComponentConfigs,
  ...productionCatalogComponentConfigs,
  HeroSplit: {
    label: '분할 히어로', defaultProps: DEFAULT_HERO_SPLIT,
    fields: heroSplitFields, render: (props) => <HeroSplitPreview {...props} />,
  },
  HeroSlider: {
    label: '슬라이더 히어로', defaultProps: DEFAULT_HERO_SLIDER,
    fields: heroSliderFields, render: (props) => <HeroSliderPreview {...props} />,
  },
  LogoCloud: {
    label: '로고 클라우드', defaultProps: DEFAULT_LOGO_CLOUD,
    fields: logoCloudFields, render: (props) => <LogoCloudPreview {...props} />,
  },
  Stats: {
    label: '숫자·아이콘 지표', defaultProps: DEFAULT_STATS,
    fields: statsFields, render: (props) => <StatsPreview {...props} />,
  },
  Pricing: {
    label: '요금제', defaultProps: DEFAULT_PRICING,
    fields: pricingFields, render: (props) => <PricingPreview {...props} />,
  },
  Team: {
    label: '팀 소개', defaultProps: DEFAULT_TEAM,
    fields: teamFields, render: (props) => <TeamPreview {...props} />,
  },
  Gallery: {
    label: '갤러리 그리드', defaultProps: DEFAULT_GALLERY,
    fields: galleryFields, render: (props) => <GalleryPreview {...props} />,
  },
  BarChart: {
    label: '막대그래프', defaultProps: DEFAULT_BAR_CHART,
    fields: barChartFields, render: (props) => <BarChartPreview {...props} />,
  },
  G7RecentPosts: {
    label: 'G7 최근 게시글', defaultProps: DEFAULT_G7_RECENT_POSTS,
    fields: g7RecentPostsFields, render: (props) => <G7RecentPostsPreview {...props} />,
  },
  G7ProductGrid: {
    label: 'G7 상품 그리드', defaultProps: DEFAULT_G7_PRODUCT_GRID,
    fields: g7ProductGridFields, render: (props) => <G7ProductGridPreview {...props} />,
  },
  InquiryForm: {
    label: '문의·신청 폼', defaultProps: DEFAULT_INQUIRY_FORM,
    fields: inquiryFormFields, render: (props) => <InquiryFormPreview {...props} />,
  },
  MapDirections: {
    label: '지도·오시는 길', defaultProps: DEFAULT_MAP_DIRECTIONS,
    fields: mapDirectionsFields, render: (props) => <MapDirectionsPreview {...props} />,
  },
};

export type { HeroSplitEditorProps, HeroSliderEditorProps, LogoCloudEditorProps, StatsEditorProps, PricingEditorProps, TeamEditorProps, GalleryEditorProps, BarChartEditorProps, G7RecentPostsEditorProps, G7ProductGridEditorProps, InquiryFormEditorProps, MapDirectionsEditorProps, CatalogEditorComponents } from './catalogEditorTypes';
export { canonicalCatalogBlockToPuck, catalogPuckBlockToCanonical } from './catalogCodec';
export { CatalogGalleryThumbnail } from './CatalogGalleryThumbnail';
