import type { DocumentV3, Node } from './types';
import { reject } from './schema';

export const primitiveLabels: Record<Node['type'], string> = {
  'layout.section': '섹션', 'layout.container': '컨테이너', 'content.heading': '제목',
  'content.text': '본문', 'media.image': '이미지', 'action.link': '링크', 'action.button': '동작 버튼',
};
/** UI insertion defaults, not schema defaults. The resulting command validates every value. */
export function createPrimitive(type: Node['type'], id: string, document: DocumentV3): Node {
  const base = { instance_id: id, block_version: 1 as const, name: primitiveLabels[type], locked: false, slots: {}, style: {}, responsive: {} };
  switch (type) {
    case 'layout.section': return { ...base, type, props: { tag: 'section' }, slots: { content: [] } };
    case 'layout.container': return { ...base, type, props: { tag: 'div' }, slots: { content: [] } };
    case 'content.heading': return { ...base, type, props: { level: 2, runs: [{ text: '새 제목' }] } };
    case 'content.text': return { ...base, type, props: { paragraphs: [[{ text: '새 본문' }]] } };
    case 'action.link': return { ...base, type, props: { label: '자세히 보기', link: { url: '#content', new_tab: false } } };
    case 'action.button': return { ...base, type, props: { label: '내용 보기' } };
    case 'media.image': {
      const asset = document.assets[0] ?? reject('asset_required', '$');
      return { ...base, type, props: { asset_id: asset.asset_id, alt: '' } };
    }
  }
}
