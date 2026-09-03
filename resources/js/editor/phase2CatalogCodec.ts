import {
  ARTICLE_LIST_BLOCK_TYPE,
  COMPARISON_TABLE_BLOCK_TYPE,
  FAQ_ACCORDION_BLOCK_TYPE,
  PROCESS_TIMELINE_BLOCK_TYPE,
  TABS_BLOCK_TYPE,
  TESTIMONIALS_BLOCK_TYPE,
  VIDEO_EMBED_BLOCK_TYPE,
} from '../documents/builtinBlockContracts';
import type { BlockAppearance, ComparisonRowItem, PageBuilderBlock } from '../documents/types';
import { appearance, attachAppearance, type AppearanceEditorProps } from './catalogAppearance';
import { normalizeBlockMotion } from './blockMotionData';
import {
  type TabsEditorProps,
  type ComparisonTableEditorProps,
  type Phase2CatalogEditorComponents,
  type Phase2ComponentType,
  asString,
  testimonialsLayout,
  articleLayout,
  asRecord,
  normalizeTestimonials,
  normalizeFaq,
  normalizeProcess,
  normalizeTabs,
  normalizeColumns,
  normalizeComparisonRows,
  normalizeArticles,
} from './phase2CatalogData';

export function canonicalPhase2BlockToPuck(block: PageBuilderBlock): { type: Phase2ComponentType; props: Phase2CatalogEditorComponents[Phase2ComponentType] } | null {
  const props = block.props;
  const common = (fallback: BlockAppearance): AppearanceEditorProps => ({ ...appearance(asRecord(props.appearance), fallback), motion: normalizeBlockMotion(block.motion) });
  if (block.type === TESTIMONIALS_BLOCK_TYPE) return { type: 'Testimonials', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeTestimonials(props.items), layout: testimonialsLayout(props.layout), ...common({ surface: 'soft', spacing: 'normal' }) } };
  if (block.type === FAQ_ACCORDION_BLOCK_TYPE) return { type: 'FaqAccordion', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeFaq(props.items), behavior: props.behavior === 'multiple' ? 'multiple' : 'single', openFirst: props.openFirst !== false, ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === PROCESS_TIMELINE_BLOCK_TYPE) return { type: 'ProcessTimeline', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeProcess(props.items), layout: props.layout === 'vertical' ? 'vertical' : 'horizontal', ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === TABS_BLOCK_TYPE) return { type: 'Tabs', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeTabs(props.items), initialTab: String(Math.min(5, Math.max(0, Number(props.initialTab) || 0))) as TabsEditorProps['initialTab'], tabVariant: props.style === 'pills' ? 'pills' : 'underline', ...common({ surface: 'soft', spacing: 'normal' }) } };
  if (block.type === COMPARISON_TABLE_BLOCK_TYPE) return { type: 'ComparisonTable', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), columns: normalizeColumns(props.columns), rows: normalizeComparisonRows(props.rows), highlightColumn: Number.isInteger(props.highlightColumn) && Number(props.highlightColumn) >= 0 ? String(Math.min(3, Number(props.highlightColumn))) as ComparisonTableEditorProps['highlightColumn'] : 'none', ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === ARTICLE_LIST_BLOCK_TYPE) return { type: 'ArticleList', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeArticles(props.items), layout: articleLayout(props.layout), ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === VIDEO_EMBED_BLOCK_TYPE) return { type: 'VideoEmbed', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), caption: asString(props.caption), provider: props.provider === 'vimeo' ? 'vimeo' : 'youtube', videoId: asString(props.videoId), ratio: props.ratio === '4:3' || props.ratio === '1:1' ? props.ratio : '16:9', ...common({ surface: 'contrast', spacing: 'normal' }) } };
  return null;
}

export function phase2PuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'Testimonials') return { type: TESTIMONIALS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeTestimonials(raw.items), layout: testimonialsLayout(raw.layout) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'FaqAccordion') return { type: FAQ_ACCORDION_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeFaq(raw.items), behavior: raw.behavior === 'multiple' ? 'multiple' : 'single', openFirst: raw.openFirst !== false }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'ProcessTimeline') return { type: PROCESS_TIMELINE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeProcess(raw.items), layout: raw.layout === 'vertical' ? 'vertical' : 'horizontal' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'Tabs') return { type: TABS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeTabs(raw.items), initialTab: Math.max(0, Number(raw.initialTab) || 0), style: raw.tabVariant === 'pills' ? 'pills' : 'underline' }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'ComparisonTable') {
    const columns = normalizeColumns(raw.columns);
    const rows: ComparisonRowItem[] = normalizeComparisonRows(raw.rows).map((row) => ({ feature: row.feature, values: row.valuesText.split('\n').map((value) => value.trim()).slice(0, columns.length) }));
    return { type: COMPARISON_TABLE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), columns, rows, highlightColumn: raw.highlightColumn === 'none' ? -1 : Math.min(3, Math.max(0, Number(raw.highlightColumn) || 0)) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  }
  if (type === 'ArticleList') return { type: ARTICLE_LIST_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeArticles(raw.items), layout: articleLayout(raw.layout) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'VideoEmbed') return { type: VIDEO_EMBED_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), caption: asString(raw.caption), provider: raw.provider === 'vimeo' ? 'vimeo' : 'youtube', videoId: asString(raw.videoId), ratio: raw.ratio === '4:3' || raw.ratio === '1:1' ? raw.ratio : '16:9' }, raw, { surface: 'contrast', spacing: 'normal' }, includeAppearance) };
  return null;
}
