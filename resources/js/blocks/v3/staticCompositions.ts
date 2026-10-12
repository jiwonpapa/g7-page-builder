import type { BarChartBlockProps, BlockquoteBlockProps, CtaBlockProps,
  DividerBlockProps, HeadingBlockProps, ImageBlockProps, NoticeBlockProps } from '../../documents/builtinBlockContracts';
import type { Color, Node, Style } from '../../documents/v3/types';
import { reject } from '../../documents/v3/schema';
import { CompositionBuilder, fluidTrack, outline, padding, px, radius, token, vertical } from './compositionBuilder';

const tones: Record<'blue' | 'indigo' | 'emerald' | 'amber', Color> = {
  blue: token('primary'), indigo: token('accent'),
  emerald: { kind: 'hex', value: '#059669' }, amber: { kind: 'hex', value: '#b45309' },
};
const hundredth = (value: number): number => Math.round(value * 100) / 100;
function actions(builder: CompositionBuilder, links: Array<{ label: string; url: string } | undefined>): Node {
  return builder.frame('버튼 영역', links.flatMap((link, index) => link
    ? [builder.link(index === 0 ? '기본 버튼' : '보조 버튼', link.label, link.url, index === 0 ? 'primary' : 'secondary')] : []),
  { display: 'flex', wrap: 'wrap', column_gap: px(12), row_gap: px(12), align: 'center' });
}
export function heading(props: HeadingBlockProps, b: CompositionBuilder): Node {
  // Bundled starters have no legacy anchor. A future conversion must explicitly
  // map authored anchors, never silently turn them into generated UUID anchors.
  if (props.anchor) reject('composition_anchor', '$');
  return b.frame('섹션 제목', [...(props.eyebrow ? [b.text('보조 문구', props.eyebrow, { color: token('accent') })] : []),
    b.heading('제목', props.heading, props.level, props.level === 2 ? 32 : 24)], { ...vertical(12), ...padding(24) });
}
export function image(props: ImageBlockProps, b: CompositionBuilder): Node {
  if (props.linkUrl) reject('composition_image_link', '$');
  const ratio = props.aspectRatio === 'auto' ? undefined : props.aspectRatio === '16:9' ? 16 / 9 : props.aspectRatio === '4:3' ? 4 / 3 : 1;
  const media = b.image('이미지', props.src, props.alt);
  if (ratio === undefined) delete media.style.aspect_ratio; else media.style.aspect_ratio = hundredth(ratio);
  return b.frame('이미지와 설명', [media, ...(props.caption ? [b.frame('사진 설명', [b.text('캡션', props.caption,
    { color: token('muted') })], {}, 'figcaption')] : [])], { ...vertical(12), ...padding(24) }, 'figure');
}
export function cta(props: CtaBlockProps, b: CompositionBuilder): Node {
  const copy = b.frame('메시지', [...(props.eyebrow ? [b.text('보조 문구', props.eyebrow)] : []),
    b.heading('제목', props.heading), b.text('본문', props.body)], vertical());
  const buttons = actions(b, [props.primaryLink, props.secondaryLink]);
  const root = b.frame('행동 안내', [copy, buttons], { ...padding(32), ...vertical(24), width: 'fill' }, 'section');
  const layout = props.layout ?? 'split';
  if (layout === 'split' || layout === 'banner') {
    root.style = { ...root.style, display: 'grid', columns: [fluidTrack(2), fluidTrack()], column_gap: px(24), align: 'center' };
    root.responsive.mobile = { columns: [fluidTrack()] };
  }
  if (layout === 'banner') root.style = { ...root.style, ...padding(20) };
  if (layout === 'centered') { root.style.text_align = 'center'; buttons.style.justify = 'center'; }
  if (layout === 'panel') root.style = { ...root.style, ...radius(24), ...outline() };
  if (props.theme === 'dark') {
    root.style.background = { kind: 'solid', color: token('text') }; root.style.color = token('surface');
    for (const button of buttons.slots.content ?? []) {
      button.style.color = token('surface');
      if (!button.style.background) Object.assign(button.style, outline(token('surface')));
    }
  } else { root.style.background = { kind: 'solid', color: token('surface') }; root.style.color = token('text'); }
  return root;
}
export function barChart(props: BarChartBlockProps, b: CompositionBuilder): Node {
  const maximum = Math.max(1, ...props.items.map(item => item.value));
  const rows = props.items.map((item, index) => b.frame('지표 ' + (index + 1), [
    b.frame('지표 설명', [b.text('항목 이름', item.label), b.text('값', String(item.value)), b.text('단위', props.unit)],
      { display: 'flex', wrap: 'wrap', column_gap: px(8), align: 'baseline' }),
    b.frame('막대 배경', [b.frame('막대', [], { width: { value: hundredth(item.value / maximum * 100), unit: '%' }, height: px(16),
      background: { kind: 'solid', color: tones[item.tone] }, ...radius(8) })], { width: 'fill', background: { kind: 'solid', color: token('border') }, ...radius(8) }),
  ], vertical(8), 'li'));
  // A starter chart becomes independently editable values and typed widths.
  // It is not a live data binding or a second calculation/interaction engine.
  return b.section('막대 그래프', props.eyebrow, props.heading, [b.text('설명', props.description),
    b.frame('지표 목록', rows, vertical(20), 'ul')]);
}
export function divider(props: DividerBlockProps, b: CompositionBuilder): Node {
  const rule: Style = props.variant === 'gradient'
    ? { height: px(2), background: { kind: 'linear', angle: 90, stops: [
      { offset: 0, color: token('border') }, { offset: .5, color: token('accent') }, { offset: 1, color: token('border') }] } }
    : { border_top: { width: 1, style: props.variant, color: token('border') } };
  return b.frame('섹션 구분', [...(props.label ? [b.text('구분 문구', props.label, { text_align: 'center', color: token('muted') })] : []),
    b.frame('구분선', [], { width: 'fill', ...rule })], { ...vertical(12), ...padding(24), width: 'fill',
    max_width: px(props.width === 'narrow' ? 480 : props.width === 'standard' ? 960 : 1920), margin_left: 'auto', margin_right: 'auto' });
}
export function blockquote(props: BlockquoteBlockProps, b: CompositionBuilder): Node {
  const quote = b.frame('인용 내용', [b.text('인용문', props.quote, { font_size: px(24), line_height: 1.5 })], {}, 'blockquote');
  if (props.variant === 'line') quote.style = { border_left: { width: 4, style: 'solid', color: token('accent') }, padding_left: px(20) };
  else quote.slots.content!.unshift(b.text('인용 기호', '“', { font_size: px(48), color: token('accent'), line_height: 1 }));
  return b.frame('인용', [quote, b.frame('출처', [b.text('인용자', props.citation), b.text('직함', props.role, { color: token('muted') })], vertical(4), 'figcaption')],
    { ...vertical(16), ...padding(32), text_align: props.alignment === 'center' ? 'center' : 'start' }, 'figure');
}
export function notice(props: NoticeBlockProps, b: CompositionBuilder): Node {
  const color = props.tone === 'info' ? token('primary') : props.tone === 'success' ? tones.emerald
    : props.tone === 'warning' ? tones.amber : { kind: 'hex' as const, value: '#b91c1c' };
  return b.frame('안내', [b.heading('안내 제목', props.title, 3, 22), b.text('안내 내용', props.body),
    ...(props.actionLabel ? [b.link('안내 링크', props.actionLabel, props.actionUrl)] : [])],
  { ...vertical(12), ...padding(24), ...radius(12), ...outline(), border_left: { width: 4, style: 'solid', color } }, 'aside');
}
