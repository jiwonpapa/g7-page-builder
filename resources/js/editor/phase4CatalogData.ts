import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';

export interface G7PostDetailEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  boardSlug: string;
  postId: number;
  detailUrl: string;
  linkLabel: string;
  audience: 'all' | 'guest' | 'member';
  showContent: boolean;
  emptyMessage: string;
}

export interface G7ProductDetailEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  productKey: string;
  detailUrl: string;
  buttonLabel: string;
  audience: 'all' | 'guest' | 'member';
  showDescription: boolean;
  emptyMessage: string;
}

export interface Phase4CatalogEditorComponents {
  G7PostDetail: G7PostDetailEditorProps;
  G7ProductDetail: G7ProductDetailEditorProps;
}

export type Phase4ComponentType = keyof Phase4CatalogEditorComponents;

export const DEFAULT_POST_DETAIL: G7PostDetailEditorProps = {
  eyebrow: '게시글 상세', heading: '선택한 게시글을 소개합니다', boardSlug: 'notice', postId: 1,
  detailUrl: '/board/notice/1', linkLabel: '게시글 전체 보기', audience: 'all', showContent: true,
  emptyMessage: '게시글을 불러오지 못했습니다.', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_PRODUCT_DETAIL: G7ProductDetailEditorProps = {
  eyebrow: '상품 상세', heading: '선택한 상품을 소개합니다', productKey: 'SAMPLE',
  detailUrl: '/shop/products/SAMPLE', buttonLabel: '상품 전체 보기', audience: 'all', showDescription: true,
  emptyMessage: '상품을 불러오지 못했습니다.', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function asString(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }

export function audience(value: unknown): 'all' | 'guest' | 'member' { return value === 'guest' || value === 'member' ? value : 'all'; }
