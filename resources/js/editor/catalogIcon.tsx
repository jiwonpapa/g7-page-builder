import React from 'react';
import type { IconName } from '../documents/v3/types';
import {
  AtSign,
  BriefcaseBusiness,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  Code2,
  ExternalLink,
  Globe2,
  Heart,
  Layers3,
  MessageCircle,
  Palette,
  PlaySquare,
  Rss,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type CatalogIconName = IconName;

const CATALOG_ICONS: Record<CatalogIconName, LucideIcon> = {
  bolt: Zap,
  check: Check,
  code: Code2,
  globe: Globe2,
  heart: Heart,
  layers: Layers3,
  mobile: Smartphone,
  palette: Palette,
  shield: ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  trend: TrendingUp,
  users: UsersRound,
  target: Target,
  chart: ChartNoAxesColumnIncreasing,
  instagram: Camera,
  youtube: PlaySquare,
  facebook: UsersRound,
  linkedin: BriefcaseBusiness,
  x: AtSign,
  kakao: MessageCircle,
  blog: Rss,
  website: ExternalLink,
};
export const catalogIconNames = Object.keys(CATALOG_ICONS).filter(isCatalogIconName);
export function isCatalogIconName(value: string): value is CatalogIconName { return Object.hasOwn(CATALOG_ICONS, value); }

export function CatalogIcon({
  name,
  size = 24,
  className,
  fillParent = false,
}: {
  name: CatalogIconName;
  size?: number;
  className?: string;
  fillParent?: boolean;
}): React.ReactElement {
  const Icon = CATALOG_ICONS[name];

  return <Icon aria-hidden="true" className={className} focusable="false" size={fillParent ? '100%' : size} strokeWidth={2.1}
    style={fillParent ? { display: 'block' } : undefined} />;
}
