import type { PageBuilderApiClient } from '../../api/pageBuilderApi';
import type { MediaChoice, MediaPort } from '../../editor-application/v3/media';
import { record } from '../../documents/v3/schema';
import { validateImageAsset } from '../../documents/v3/media';

function parseAsset(input: unknown): MediaChoice {
  if (!record(input) || typeof input.id !== 'string' || typeof input.url !== 'string'
    || typeof input.original_name !== 'string' || input.kind !== 'image'
    || typeof input.mime_type !== 'string' || !['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(input.mime_type)
    || typeof input.width !== 'number' || !Number.isFinite(input.width) || input.width < 0
    || typeof input.height !== 'number' || !Number.isFinite(input.height) || input.height < 0) throw new Error('지원되는 이미지 응답이 아닙니다.');
  let url = input.url;
  if (typeof location !== 'undefined') {
    const parsed = new URL(url, location.origin);
    if (parsed.origin === location.origin && !parsed.username && !parsed.password && !parsed.pathname.startsWith('//')) url = parsed.pathname + parsed.search + parsed.hash;
  }
  const asset = validateImageAsset({ asset_id: input.id, url });
  return { ...asset, name: input.original_name, width: input.width, height: input.height };
}

export function createApiMediaPort(client: Pick<PageBuilderApiClient, 'listMedia' | 'uploadMedia'>): MediaPort {
  return {
    async list() {
      const response: unknown = await client.listMedia('image');
      if (!record(response) || !Array.isArray(response.items)) throw new Error('이미지 목록 응답이 올바르지 않습니다.');
      return response.items.map(parseAsset);
    },
    async upload(file) {
      if (typeof File === 'undefined' || !(file instanceof File)) throw new Error('업로드할 이미지 파일을 선택해 주세요.');
      return parseAsset(await client.uploadMedia(file, 'image'));
    },
  };
}
