import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';
import { ICON_OPTIONS } from './foundationCatalogData';
import type { CatalogIconName } from './catalogIcon';

export interface IconEditorProps extends AppearanceEditorProps {
  icon: string;
  size: string;
  tone: string;
  decorative: boolean;
  label: string;
}
export interface ListEditorProps extends AppearanceEditorProps {
  ordered: boolean;
  items: Array<{ text: string }>;
}
export interface BadgeEditorProps extends AppearanceEditorProps {
  label: string;
  icon: string;
  size: string;
  tone: string;
}
export interface BasicElementEditorComponents {
  Icon: IconEditorProps;
  List: ListEditorProps;
  Badge: BadgeEditorProps;
}
export type BasicElementType = keyof BasicElementEditorComponents;

export function isBasicIcon(value: unknown): value is CatalogIconName {
  return typeof value === 'string' && ICON_OPTIONS.some((option) => option.value === value);
}

const common = { surface: 'default', spacing: 'compact', motion: DEFAULT_BLOCK_MOTION } as const;
export const DEFAULT_ICON: IconEditorProps = { ...common, icon: 'star', size: 'medium', tone: 'accent', decorative: true, label: '' };
export const DEFAULT_LIST: ListEditorProps = { ...common, ordered: false, items: [{ text: '첫 번째 항목' }, { text: '두 번째 항목' }] };
export const DEFAULT_BADGE: BadgeEditorProps = { ...common, label: '새 소식', icon: '', size: 'medium', tone: 'accent' };
