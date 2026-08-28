import React from 'react';
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

export type CatalogIconName =
  | 'bolt' | 'check' | 'code' | 'globe' | 'heart' | 'layers' | 'mobile' | 'palette' | 'shield' | 'sparkles' | 'star'
  | 'trend' | 'users' | 'target' | 'chart'
  | 'instagram' | 'youtube' | 'facebook' | 'linkedin' | 'x' | 'kakao' | 'blog' | 'website';

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

export function CatalogIcon({
  name,
  size = 24,
  className,
}: {
  name: CatalogIconName;
  size?: number;
  className?: string;
}): React.ReactElement {
  const Icon = CATALOG_ICONS[name];

  return <Icon aria-hidden="true" className={className} focusable="false" size={size} strokeWidth={2.1} />;
}
