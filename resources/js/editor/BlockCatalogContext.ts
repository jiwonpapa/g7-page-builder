import { createContext } from 'react';
import { catalogEditorName } from '../blocks/runtimeRegistry';
import type { BlockCatalogItem } from '../blocks/types';
import { createBuiltinGalleryItems, galleryItemFromApi, type BlockGalleryItem } from './blockGalleryModel';
import { pageBuilderPuckConfig } from './puckEditorConfig';
import type { EditorComponents } from './puckEditorTypes';

function isRegisteredComponent(type: string): type is keyof EditorComponents {
  return Object.prototype.hasOwnProperty.call(pageBuilderPuckConfig.components, type);
}

export const BLOCK_GALLERY_ITEMS = createBuiltinGalleryItems(isRegisteredComponent);

export interface BlockCatalogContextValue {
  items: ReadonlyArray<BlockGalleryItem>;
  toggleFavorite: (catalogId: string, favorite: boolean) => Promise<void>;
}

export const BlockCatalogContext = createContext<BlockCatalogContextValue>({
  items: BLOCK_GALLERY_ITEMS,
  toggleFavorite: async () => undefined,
});

export function apiCatalogItemToGalleryItem(item: BlockCatalogItem, locale: string): BlockGalleryItem | null {
  return galleryItemFromApi(item, locale, catalogEditorName(item, pageBuilderPuckConfig.components), BLOCK_GALLERY_ITEMS);
}
