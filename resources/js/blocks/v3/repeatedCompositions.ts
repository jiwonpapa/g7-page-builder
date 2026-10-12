import type { Node, Style } from '../../documents/v3/types';
import type { ArticleListBlockProps, BreadcrumbsBlockProps, ButtonsBlockProps, CardGridBlockProps, ComparisonTableBlockProps,
  DownloadResourcesBlockProps, EventScheduleBlockProps, GalleryBlockProps, LogoCloudBlockProps, PricingBlockProps,
  ProcessTimelineBlockProps, TeamBlockProps, TestimonialsBlockProps } from '../../documents/builtinBlockContracts';
import { CompositionBuilder, outline, padding, px, radius, token, vertical } from './compositionBuilder';

const muted: Style = { color: token('muted'), line_height: 1.6 };
const card: Style = { ...vertical(), ...padding(24), ...radius(12), ...outline() };
function collection(b: CompositionBuilder, name: string, items: Node[], layout: string, columns = 3): Node {
  if (['list', 'editorial', 'agenda', 'timeline', 'vertical', 'compact', 'quote-hero'].includes(layout)) {
    const frame = b.frame(name, items, vertical(layout === 'compact' ? 12 : 24));
    if (layout === 'editorial') frame.style.max_width = px(900);
    if (layout === 'quote-hero') items.forEach(item => { item.style.font_family = 'serif'; item.style.font_size = px(24); });
    return frame;
  }
  const root = b.grid(name, items, layout === 'split' ? 2 : columns);
  if (['featured', 'spotlight', 'bento', 'magazine'].includes(layout) && items[0]) {
    items[0].style.column_span = Math.min(2, columns);
    items[0].responsive.mobile = { ...items[0].responsive.mobile, column_span: 1 };
  }
  if (layout === 'rail' || layout === 'filmstrip' || layout === 'strip') {
    root.style = { display: 'flex', wrap: 'wrap', column_gap: px(24), row_gap: px(24) };
    items.forEach(item => { item.style = { ...item.style, basis: px(260), grow: 1 }; });
  }
  return root;
}

export function pricing(p: PricingBlockProps, b: CompositionBuilder): Node {
  const layout = p.layout ?? 'cards';
  const plans = p.plans.map((plan, index) => {
    const row = b.frame(`플랜 ${index + 1}`, [b.heading('플랜 이름', plan.name, 3, 24),
      b.text('가격', plan.price, { font_size: px(36), font_weight: 700 }), b.text('결제 기간', plan.period, muted),
      b.text('설명', plan.description, muted),
      b.frame('포함 항목', plan.features.map((feature, i) => b.frame(`항목 ${i + 1}`, [b.text('항목 내용', feature)], {}, 'li')), vertical(8), 'ul'),
      b.link('플랜 선택', plan.buttonLabel, plan.buttonUrl, 'primary')], { ...card,
      ...(plan.featured ? outline(token('primary')) : {}), ...(layout === 'compact' ? padding(16) : {}),
      ...(layout === 'featured' && plan.featured ? { column_span: Math.min(2, p.plans.length) } : {}) }, 'article');
    if (layout === 'featured' && plan.featured) row.responsive.mobile = { column_span: 1 };
    return row;
  });
  return b.section('가격 플랜', p.eyebrow, p.heading, [collection(b, '플랜 목록', plans, layout === 'featured' ? 'cards' : layout, p.plans.length)]);
}
export function logos(p: LogoCloudBlockProps, b: CompositionBuilder): Node {
  const rows = p.logos.map((logo, index) => b.frame(`파트너 ${index + 1}`, [
    b.image('로고', logo.imageSrc, logo.imageAlt, { object_fit: 'contain', height: px(64) }),
    b.link('파트너 이름', logo.name, logo.url),
  ], { ...vertical(12), ...(p.layout === 'panel' ? card : {}), text_align: 'center' }, 'figure'));
  return b.section('파트너 로고', '', p.heading, [collection(b, '파트너 목록', rows, p.layout ?? 'strip', 4)]);
}
export function team(p: TeamBlockProps, b: CompositionBuilder): Node {
  const rows = p.members.map((member, index) => b.frame(`팀원 ${index + 1}`, [
    b.image('프로필 사진', member.imageSrc, member.imageAlt, { aspect_ratio: p.layout === 'portraits' ? .75 : 1 }),
    b.heading('이름', member.name, 3, 22), b.text('역할', member.role, muted), b.text('소개', member.bio, muted),
    ...(member.profileUrl ? [b.link('프로필 링크', `${member.name} 프로필`, member.profileUrl)] : []),
  ], vertical(), 'article'));
  return b.section('팀 소개', p.eyebrow, p.heading, [collection(b, '팀원 목록', rows, p.layout ?? 'grid')]);
}
export function gallery(p: GalleryBlockProps, b: CompositionBuilder): Node {
  const rows = p.images.map((image, index) => b.frame(`사진 ${index + 1}`, [b.image('사진', image.src, image.alt),
    b.frame('사진 설명', [b.text('캡션', image.caption, muted)], {}, 'figcaption')], vertical(12), 'figure'));
  // Masonry is an owned column composition: every column and item remains a node.
  const content = p.layout === 'masonry' ? b.grid('사진 열', Array.from({ length: p.columns }, (_, column) =>
    b.frame(`열 ${column + 1}`, rows.filter((_, index) => index % p.columns === column), vertical(24))), p.columns)
    : collection(b, '사진 목록', rows, p.layout ?? 'grid', p.columns);
  return b.section('갤러리', p.eyebrow, p.heading, [content]);
}
export function testimonials(p: TestimonialsBlockProps, b: CompositionBuilder): Node {
  const rows = p.items.map((item, index) => b.frame(`후기 ${index + 1}`, [
    b.frame('인용문', [b.text('후기 내용', item.quote, { line_height: 1.7 })], {}, 'blockquote'),
    b.text('평점', `${item.rating} / 5`, { color: token('accent') }),
    b.image('작성자 사진', item.avatarSrc, item.avatarAlt, { width: px(64), height: px(64), aspect_ratio: 1, ...radius(32) }),
    b.text('이름', item.name, { font_weight: 700 }), b.text('직책', item.role, muted), b.text('회사', item.company, muted),
  ], card, 'article'));
  return b.section('고객 후기', p.eyebrow, p.heading, [collection(b, '후기 목록', rows, p.layout)]);
}
export function process(p: ProcessTimelineBlockProps, b: CompositionBuilder): Node {
  const items = p.items.map((item, index) => b.frame(`단계 ${index + 1}`, [
    b.text('순서', String(index + 1).padStart(2, '0'), { color: token('accent'), font_size: px(28) }),
    b.heading('단계 제목', item.title, 3, 22), b.text('단계 설명', item.body, muted),
    ...(item.linkLabel ? [b.link('단계 링크', item.linkLabel, item.linkUrl)] : []),
  ], { ...card, display: 'block' }, 'li'));
  const list = b.frame('진행 순서', items, p.layout === 'horizontal'
    ? { display: 'grid', columns: items.map(() => ({ fr: 1 })), column_gap: px(24), row_gap: px(24) } : vertical(24), 'ol');
  list.responsive.mobile = { display: 'flex', direction: 'column' };
  return b.section('진행 과정', p.eyebrow, p.heading, [list]);
}
export function comparison(p: ComparisonTableBlockProps, b: CompositionBuilder): Node {
  const cellStyle = (index: number): Style => ({ ...padding(12), ...outline(),
    ...(index === p.highlightColumn ? { background: { kind: 'solid', color: token('border') } } : {}) });
  const heading = b.frame('비교 제목 행', [b.frame('항목 제목', [b.text('항목', '비교 항목')], cellStyle(-1), 'th'),
    ...p.columns.map((column, index) => b.frame(`열 ${index + 1}`, [b.text('열 제목', column.title, { font_weight: 700 }),
      b.text('열 설명', column.description, muted)], cellStyle(index), 'th'))], {}, 'tr');
  const rows = p.rows.map((row, index) => b.frame(`비교 행 ${index + 1}`, [
    b.frame('항목 이름', [b.text('항목 내용', row.feature)], cellStyle(-1), 'th'),
    ...row.values.map((value, i) => b.frame(`값 ${i + 1}`, [b.text('비교 값', value)], cellStyle(i), 'td')),
  ], {}, 'tr'));
  return b.section('비교표', p.eyebrow, '', [b.frame('비교표', [
    b.frame('표 제목', [b.heading('제목', p.heading)], { padding_bottom: px(16), text_align: 'start' }, 'caption'),
    b.frame('표 머리', [heading], {}, 'thead'), b.frame('표 본문', rows, {}, 'tbody'),
  ], { width: 'fill' }, 'table')]);
}
export function articles(p: ArticleListBlockProps, b: CompositionBuilder): Node {
  const rows = p.items.map((item, index) => b.frame(`글 ${index + 1}`, [b.image('대표 이미지', item.imageSrc, item.imageAlt),
    b.text('분류', item.category, { color: token('accent') }), b.heading('글 제목', item.title, 3, 24),
    b.text('요약', item.summary, muted), b.text('날짜', item.date, muted), b.link('글 링크', item.title, item.url),
  ], vertical(), 'article'));
  return b.section('글 모음', p.eyebrow, p.heading, [collection(b, '글 목록', rows, p.layout)]);
}
export function events(p: EventScheduleBlockProps, b: CompositionBuilder): Node {
  const rows = p.items.map((item, index) => b.frame(`행사 ${index + 1}`, [b.text('날짜', item.date, { font_weight: 700 }),
    b.text('시간', item.time, muted), b.heading('행사명', item.title, 3, 24), b.text('장소', item.location, muted),
    b.text('행사 설명', item.description, muted), b.link('행사 링크', item.buttonLabel, item.buttonUrl, 'secondary')], card, 'article'));
  return b.section('행사 일정', p.eyebrow, p.heading, [collection(b, '행사 목록', rows, p.layout)]);
}
export function downloads(p: DownloadResourcesBlockProps, b: CompositionBuilder): Node {
  const rows = p.items.map((item, index) => b.frame(`자료 ${index + 1}`, [b.heading('자료명', item.title, 3, 22),
    b.text('자료 설명', item.description, muted), b.text('파일 형식', item.fileType, muted), b.text('파일 크기', item.fileSize, muted),
    b.link('자료 링크', item.buttonLabel, item.url, 'secondary')], card, 'article'));
  return b.section('자료 모음', p.eyebrow, p.heading, [b.grid('자료 목록', rows, 2)]);
}
export function cards(p: CardGridBlockProps, b: CompositionBuilder): Node {
  const rows = p.items.map((item, index) => b.frame(`카드 ${index + 1}`, [b.text('보조 제목', item.kicker, { color: token('accent') }),
    ...(p.layout === 'numbered' ? [b.text('순번', String(index + 1).padStart(2, '0'), { font_size: px(40) })] : []),
    b.heading('카드 제목', item.title, 3, 24), b.text('카드 설명', item.body, muted), b.link('카드 링크', item.linkLabel, item.linkUrl)],
  { ...vertical(), ...padding(24), ...(p.variant === 'outlined' ? { ...outline(), ...radius(12) } : {}) }, 'article'));
  return b.section('카드 모음', p.eyebrow, p.heading, [collection(b, '카드 목록', rows, p.layout ?? 'grid', p.columns)]);
}
export function buttons(p: ButtonsBlockProps, b: CompositionBuilder): Node {
  return b.frame('버튼 모음', p.items.map((item, index) => b.link(`버튼 ${index + 1}`, item.label, item.url, item.variant)),
    { display: 'flex', wrap: 'wrap', column_gap: px(12), row_gap: px(12),
      justify: p.alignment === 'left' ? 'start' : p.alignment === 'right' ? 'end' : 'center' });
}
export function breadcrumbs(p: BreadcrumbsBlockProps, b: CompositionBuilder): Node {
  return b.frame('현재 위치', [b.frame('경로 목록', [...p.items.map((item, index) => b.frame(`경로 ${index + 1}`,
    [b.link('경로 링크', item.label, item.url)], {}, 'li')), b.frame('현재 페이지', [b.text('현재 위치', p.currentLabel, { font_weight: 700 })], {}, 'li')],
  { display: 'flex', wrap: 'wrap', column_gap: px(20), row_gap: px(8) }, 'ol')], {}, 'nav');
}
export function list(p: { ordered: boolean; items: { text: string }[] }, b: CompositionBuilder): Node {
  return b.frame('목록', p.items.map((item, index) => b.frame(`항목 ${index + 1}`, [b.text('항목 내용', item.text)], {}, 'li')),
    { ...vertical(12), padding_left: px(24) }, p.ordered ? 'ol' : 'ul');
}
