import type { CatalogComponentType } from './catalogEditorTypes';
import React from 'react';

export function CatalogGalleryThumbnail({ type }: { type: CatalogComponentType }): React.ReactElement {
  return <span className="g7pb-block-thumb g7pb-block-thumb--unavailable" data-block-preview={type}
    data-g7pb-thumbnail-state="unavailable">
    <span>미리보기를 불러오지 못했습니다</span>
  </span>;
}
