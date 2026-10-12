import type { DocumentV3, Node, Style, Color } from '../../documents/v3/types';
import { freshId, type NewId } from '../../documents/v3/clipboard';
import { indexTree } from '../../documents/v3/tree';
import { validateDocumentV3 } from '../../documents/v3/validate';
import { reject } from '../../documents/v3/schema';

export const basicCompositionOptions = [
  ['hero.poster', '히어로 · 포스터'], ['hero.product', '히어로 · 제품'], ['hero.backdrop', '히어로 · 배경'],
  ['hero.editorial', '히어로 · 에디토리얼'], ['hero.device', '히어로 · 디바이스'],
  ['hero.balanced', '히어로 · 균형'], ['hero.screenshot', '히어로 · 스크린샷'],
  ['hero.overlap', '히어로 · 겹침'], ['hero.offset', '히어로 · 엇갈림'],
  ['card.plain', '카드 · 기본'], ['card.outlined', '카드 · 테두리'],
  ['image-text.left', '이미지·텍스트 · 이미지 왼쪽'], ['image-text.right', '이미지·텍스트 · 이미지 오른쪽'],
] as const;
export type BasicCompositionKey = typeof basicCompositionOptions[number][0];
export function isBasicCompositionKey(value: string): value is BasicCompositionKey {
  return basicCompositionOptions.some(([key]) => key === value);
}
const px = (value: number) => ({ value, unit: 'px' as const });
const token = (value: Extract<Color, { kind: 'token' }>['value']): Color => ({ kind: 'token', value });
const gap: Style = { display: 'flex', direction: 'column', row_gap: px(20) };
const padding = (value: number): Style => ({ padding_top: px(value), padding_right: px(value), padding_bottom: px(value), padding_left: px(value) });
const radius = (value: number): Style => ({ radius_top_left: px(value), radius_top_right: px(value), radius_bottom_left: px(value), radius_bottom_right: px(value) });

/** New independent instances, never a read-time legacy migration or linked master.
 * Each visual element is an ordinary canonical node: no rendered HTML or vendor
 * state is retained. Existing document/assets are untouched until one insert command.
 */
export function createBasicComposition(key: BasicCompositionKey, document: DocumentV3, nextId: NewId): Node {
  validateDocumentV3(document);
  const option = basicCompositionOptions.find(([id]) => id === key) ?? reject('composition', '$');
  const used = new Set(indexTree(document).keys());
  const base = (name: string) => ({ instance_id: freshId(used, nextId), block_version: 1 as const, name,
    locked: false, slots: {}, style: {}, responsive: {} });
  const text = (name: string, value: string, style: Style = {}): Node => ({ ...base(name), type: 'content.text',
    props: { paragraphs: [[{ text: value }]] }, style });
  const frame = (name: string, children: Node[], style: Style = {}, tag: 'div' | 'section' | 'article' = 'div'): Node => ({
    ...base(name), type: tag === 'section' ? 'layout.section' : 'layout.container', props: { tag }, slots: { content: children }, style,
  });
  const isHero = key.startsWith('hero.'), isCard = key.startsWith('card.');
  const heading: Node = { ...base('제목'), type: 'content.heading', props: { level: isHero ? 1 : 2,
    runs: [{ text: isHero ? '우리의 이야기를 선명하게' : isCard ? '새로운 가능성을 만나세요' : '이미지와 함께 전하는 이야기' }] },
    style: { font_size: px(isHero ? 52 : 28), line_height: 1.2 },
    responsive: { mobile: { font_size: px(isHero ? 32 : 24) } } };
  const action: Node = { ...base('버튼'), type: 'action.link', props: { label: '자세히 보기', link: { url: '/', new_tab: false } },
    style: { ...padding(12), ...radius(8), width: 'hug', background: { kind: 'solid', color: token('primary') }, color: token('surface'), text_decoration: 'none' } };
  const copy = frame('내용', [text('보조 문구', '새로운 시작', { color: token('accent'), font_size: px(14) }), heading,
    text('본문', '이곳에 전하고 싶은 이야기를 입력하세요. 각 요소의 위치, 크기와 스타일을 자유롭게 편집할 수 있습니다.', { color: token('muted'), line_height: 1.6 }),
    frame('버튼 영역', [action], { display: 'flex', wrap: 'wrap', column_gap: px(12) })], { ...gap, width: 'fill' });
  const asset = document.assets[0];
  const image: Node = asset ? { ...base('이미지'), type: 'media.image', props: { asset_id: asset.asset_id, alt: '' },
    style: { width: 'fill', aspect_ratio: 1.5, object_fit: 'cover', ...radius(12) } }
    : frame('이미지 영역', [text('이미지 안내', '이미지를 추가해 주세요', { color: token('muted'), text_align: 'center' })],
      { ...padding(32), ...radius(12), width: 'fill', min_height: px(160), background: { kind: 'solid', color: token('surface') } });
  const split = key.startsWith('image-text.') || ['hero.product', 'hero.balanced', 'hero.screenshot', 'hero.overlap', 'hero.offset'].includes(key);
  const root = frame(option[1], key === 'image-text.left' || isCard ? [image, copy] : [copy, image], {
    ...padding(isCard ? 24 : 40), ...gap, row_gap: px(32), column_gap: px(32), width: 'fill',
    ...(split ? { display: 'grid', columns: [{ fr: 1 }, { fr: 1 }], align: 'center' } : {}),
    ...(isCard ? { max_width: px(480), ...radius(16) } : {}),
  }, isCard ? 'article' : 'section');
  if (split) root.responsive.mobile = { display: 'flex', direction: 'column', ...padding(20) };
  if (key === 'card.outlined' || key === 'hero.device' || key === 'hero.screenshot') {
    const outlined = isCard ? root : image;
    for (const side of ['top', 'right', 'bottom', 'left'] as const) outlined.style[`border_${side}`] = { width: key === 'hero.device' ? 8 : 1, style: 'solid', color: token('border') };
  }
  if (key === 'hero.poster' || key === 'hero.device') { copy.style.text_align = 'center'; copy.style.align = 'center'; }
  if (key === 'hero.editorial') { copy.style.max_width = px(780); heading.style.font_family = 'serif'; }
  if (key === 'hero.overlap') { copy.style.position = 'relative'; copy.style.z_index = 1; image.style.margin_left = px(-32); image.responsive.mobile = { margin_left: px(0) }; }
  if (key === 'hero.offset') { image.style.margin_top = px(64); image.responsive.mobile = { margin_top: px(0) }; }
  if (key === 'hero.backdrop') {
    root.style.position = 'relative'; root.style.min_height = px(480);
    image.style = { ...image.style, position: 'absolute', inset_left: px(0), inset_top: px(0), width: 'fill', height: 'fill', opacity: .2 };
    copy.style.position = 'relative'; copy.style.z_index = 1;
  }
  validateDocumentV3({ ...document, blocks: [...document.blocks, root] });
  return root;
}
