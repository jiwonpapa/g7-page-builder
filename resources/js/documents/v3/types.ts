/** Target v3 contract only. Legacy PageBuilderDocument/save/compiler are unchanged. */
export type Unit = 'px' | '%' | 'rem' | 'vw' | 'vh';
export interface Length { value: number; unit: Unit }
export type Size = Length | 'auto' | 'hug' | 'fill';
export type Color = { kind: 'hex'; value: string } | { kind: 'token'; value: 'text' | 'muted' | 'primary' | 'surface' | 'border' | 'accent' };
export type Track = Length | 'auto' | 'min-content' | 'max-content' | { fr: number };
export type GridTrack = Track | { min: Exclude<Track, { fr: number }>; max: Track };
export interface Link { url: string; new_tab: boolean }
export interface Run { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: Color; font_size?: Length; link?: Link }
export interface Border { width: number; style: 'solid' | 'dashed' | 'dotted' | 'none'; color: Color }
export interface Shadow { x: number; y: number; blur: number; spread: number; color: Color; inset: boolean }
export type Background = { kind: 'solid'; color: Color } | { kind: 'linear'; angle: number; stops: { offset: number; color: Color }[] } | { kind: 'image'; asset_id: string; fit: 'cover' | 'contain'; x: number; y: number };
type Side = 'top' | 'right' | 'bottom' | 'left';
type Corner = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
export type Style = Partial<Record<`padding_${Side}`, Length> & Record<`margin_${Side}` | `inset_${Side}`, Length | 'auto'> & Record<`border_${Side}`, Border> & Record<`radius_${Corner}`, Length> & {
  width: Size; height: Size; min_width: Length; max_width: Length; min_height: Length; max_height: Length; aspect_ratio: number;
  display: 'block' | 'flex' | 'grid'; direction: 'row' | 'column'; wrap: 'nowrap' | 'wrap';
  justify: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  align: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  align_self: 'auto' | 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  grow: number; shrink: number; basis: Size; row_gap: Length; column_gap: Length;
  columns: GridTrack[]; rows: GridTrack[]; column_start: number; row_start: number; column_span: number; row_span: number;
  position: 'flow' | 'relative' | 'absolute'; z_index: number; rotation: number; opacity: number;
  background: Background; color: Color; shadows: Shadow[];
  font_family: 'sans' | 'serif' | 'mono'; font_weight: number; font_size: Length; line_height: Length | number; letter_spacing: Length;
  text_align: 'start' | 'end' | 'center' | 'justify'; text_decoration: 'none' | 'underline' | 'line-through';
  object_fit: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'; object_x: number; object_y: number; hidden: boolean;
}>;
interface NodeBase {
  instance_id: string; block_version: 1; name: string; locked: boolean;
  slots: { content?: Node[] }; style: Style; responsive: { tablet?: Style; mobile?: Style };
}
export type Node = NodeBase & (
  { type: 'layout.section' | 'layout.container'; props: { tag: 'section' | 'article' | 'aside' | 'div' | 'nav' | 'header' | 'footer' } } |
  { type: 'content.heading'; props: { level: number; runs: Run[] } } |
  { type: 'content.text'; props: { paragraphs: Run[][] } } |
  { type: 'media.image'; props: { asset_id: string; alt: string } } |
  { type: 'action.link'; props: { label: string; link: Link } }
);
export interface DocumentV3 {
  schema_version: 'g7-page-builder/v3'; document_id: string; slug: string; mode: 'canvas'; locale: string;
  shell_mode: 'template' | 'builder' | 'none'; tokens: Record<'text' | 'muted' | 'primary' | 'surface' | 'border' | 'accent', Color>;
  assets: { asset_id: string; url: string }[]; blocks: Node[];
}
