import type { Data } from '@puckeditor/core';
import type { ExternalEditorComponents } from '../blocks/externalEditorData';
import type { BlockVisibility, PageBuilderDocument } from '../documents/types';
import type { BlockAppearance, BlockMotion, BlockResponsiveOverrides, ElementAppearanceMap } from '../documents/blockPresentation';
import type { CtaBlockProps, FeatureItem, FeaturesBlockProps, HeroBlockProps } from '../documents/builtinBlockContracts';
import type { BlockContainerEditorProps } from './blockAppearance';
import type { CatalogEditorComponents } from './catalogEditorTypes';
import type { LayoutCatalogEditorComponents } from './layoutCatalogBlocks';
import type { PageDesignProps } from './pageDesignTokens';

export interface HeroEditorProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  imageSrc: string;
  imageAlt: string;
  alignment: 'left' | 'center';
  mediaPosition: 'left' | 'right';
  layout: NonNullable<HeroBlockProps['layout']> | 'classic';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

export interface FeaturesEditorProps {
  title: string;
  items: FeatureItem[];
  layout: NonNullable<FeaturesBlockProps['layout']>;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

export interface CtaEditorProps {
  eyebrow: string;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  theme: 'light' | 'dark';
  layout: NonNullable<CtaBlockProps['layout']>;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

export interface ContactEditorProps {
  heading: string;
  address: string;
  phone: string;
  email: string;
  ctaLabel: string;
  ctaUrl: string;
  mapLabel: string;
  mapUrl: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

interface BuiltInEditorComponents extends CatalogEditorComponents, LayoutCatalogEditorComponents {
  Hero: HeroEditorProps;
  Features: FeaturesEditorProps;
  Cta: CtaEditorProps;
  Contact: ContactEditorProps;
}

export type CommonEditorProps = Partial<BlockContainerEditorProps> & {
  responsiveOverrides?: BlockResponsiveOverrides;
  __g7pbVisibilityAudience?: BlockVisibility['audience'];
};

export type EditorComponents = {
  [Name in keyof BuiltInEditorComponents]: BuiltInEditorComponents[Name] & CommonEditorProps;
} & ExternalEditorComponents;

export type PuckEditorData = Data<EditorComponents, PageDesignProps>;

export interface PuckEditorAdapterProps {
  document: PageBuilderDocument;
  revisionKey: number;
  disabled?: boolean;
  iframeEnabled?: boolean;
  onDirty?: () => void;
  onChange: (document: PageBuilderDocument) => void;
  onPublish: (document: PageBuilderDocument) => void | Promise<void>;
}
