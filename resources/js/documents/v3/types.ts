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
export interface ControlPair { trigger_id: string; panel_id: string }
export type SystemControlKind = 'search' | 'account' | 'cart' | 'notifications' | 'theme' | 'locale' | 'currency';
export interface DataControls { page_size: number; search_id?: string; filter_id?: string; previous_id?: string; next_id?: string; status_id?: string }
export type DataControlRole = Exclude<keyof DataControls, 'page_size'>;
export interface DataConnection {
  source: 'posts' | 'post-archive' | 'post-detail' | 'products' | 'product-showcase' | 'product-detail';
  feed: 'recent' | 'popular' | 'board' | 'latest' | 'new'; period: 'today' | 'week' | 'month' | 'year';
  limit: 3 | 4 | 6 | 8 | 12; board_slug: string; post_id: number; product_key: string;
  audience: 'all' | 'guest' | 'member';
  controls?: DataControls;
  fields: { node_id: string; property: 'text' | 'image' | 'link'; field: 'title' | 'description' | 'image' | 'link' | 'meta' | 'price' }[];
}
export type FormControlKind = 'text' | 'email' | 'tel' | 'textarea' | 'checkbox';
export type InquiryField = 'name' | 'email' | 'phone' | 'subject' | 'message' | 'privacy';
/** A fixed service capability and stable element references, never an endpoint or runtime value. */
export interface ServiceBinding {
  kind: 'inquiry'; form_kind: 'inquiry' | 'quote' | 'reservation' | 'application' | 'newsletter';
  success_message: string; fields: { name: InquiryField; input_id: string; label_id: string }[];
  submit_id: string; status_id: string;
}
export type EmbedSource = { provider: 'none' }
  | { provider: 'youtube' | 'vimeo'; video_id: string }
  | { provider: 'openstreetmap' | 'google'; latitude: number; longitude: number; zoom: 12 | 14 | 16 | 18 };
export type IconName = 'bolt' | 'check' | 'code' | 'globe' | 'heart' | 'layers' | 'mobile' | 'palette' | 'shield' | 'sparkles' | 'star'
  | 'trend' | 'users' | 'target' | 'chart' | 'instagram' | 'youtube' | 'facebook' | 'linkedin' | 'x' | 'kakao' | 'blog' | 'website';
/** Authored defaults and stable references only; live interaction state is not persisted. */
export type Behavior =
  | { kind: 'disclosure'; mode: 'single' | 'multiple'; pairs: (ControlPair & { item_id: string; expanded: boolean })[] }
  | { kind: 'tabs'; label: string; orientation: 'horizontal' | 'vertical'; tablist_id: string; active_panel_id: string; pairs: ControlPair[] }
  | { kind: 'carousel'; label: string; viewport_id: string; track_id: string; active_slide_id: string;
      previous_id: string; next_id: string; rotation_id?: string; autoplay: boolean; loop: boolean; interval_ms: number };
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
  behavior?: Behavior;
  binding?: ServiceBinding;
  data?: DataConnection;
  /** Opaque runtime capability host; handlers and live values are never source fields. */
  system?: { kind: SystemControlKind };
}
export type LayoutTag = 'section' | 'article' | 'aside' | 'div' | 'nav' | 'header' | 'footer'
  | 'ul' | 'ol' | 'li' | 'dl' | 'dt' | 'dd' | 'blockquote' | 'figure' | 'figcaption'
  | 'table' | 'caption' | 'thead' | 'tbody' | 'tfoot' | 'tr' | 'th' | 'td';
export type Node = NodeBase & (
  { type: 'layout.section' | 'layout.container'; props: { tag: LayoutTag } } |
  { type: 'content.heading'; props: { level: number; runs: Run[] } } |
  { type: 'content.text'; props: { paragraphs: Run[][] } } |
  { type: 'media.image'; props: { asset_id: string; alt: string } } |
  { type: 'media.icon'; props: { icon: IconName; label: string; decorative: boolean } } |
  { type: 'media.embed'; props: { title: string; source: EmbedSource } } |
  { type: 'action.button'; props: { label: string } } |
  { type: 'form.label'; props: { label: string } } |
  { type: 'form.control'; props: { kind: FormControlKind; label: string; placeholder: string } } |
  { type: 'action.link'; props: { label: string; link: Link } }
);
export interface DocumentV3 {
  schema_version: 'g7-page-builder/v3'; document_id: string; slug: string; mode: 'canvas'; locale: string;
  shell_mode: 'template' | 'builder' | 'none'; tokens: Record<'text' | 'muted' | 'primary' | 'surface' | 'border' | 'accent', Color>;
  assets: { asset_id: string; url: string }[]; blocks: Node[];
  seo?: import('../types').PageSeoMetadata;
}
