import type { BlockPackResource } from '../blocks/types';
import type { DocumentResource } from '../api/resources';

export type OfficialStoreProductType = 'block_pack' | 'page_kit';

export interface OfficialStoreProduct {
  product_id: string;
  product_type: OfficialStoreProductType;
  product_version: string;
  title: { ko: string; en?: string };
  description: { ko: string; en?: string };
  category: string;
  tags: string[];
  license: 'free';
  compatibility: { page_builder: string; php: string; g7: string };
  preview: { thumbnail_url: string; screenshots: string[]; demo_url?: string | null };
  artifact: { url: string; sha256: string; bytes: number };
  requirements: { blocks: Array<{ block_id: string; block_version: number }> };
  compatible: boolean;
  compatibility_error: string | null;
  installed: boolean;
  installed_state: BlockPackResource['state'] | null;
}

export interface OfficialStoreCatalogResource {
  catalog_version: 'g7pb-store/v1';
  publisher: { id: 'jiwonpapa'; name: string };
  generated_at: string;
  products: OfficialStoreProduct[];
}

export interface PageKitApplyInput {
  product_id: string;
  product_version: string;
  title: string;
  slug: string;
}

export type PageKitApplyResource = DocumentResource;

export interface PageKitExportInput {
  kit_id: string;
  kit_version: string;
  title: string;
  description: string;
}
