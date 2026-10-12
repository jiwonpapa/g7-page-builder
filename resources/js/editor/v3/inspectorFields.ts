import schema from '../../../../schemas/page-builder-document-v3.schema.json';
import { record, validateRule, type Rule } from '../../documents/v3/schema';
import type { Style } from '../../documents/v3/types';
export const definitions: Record<string, Rule> = schema.$defs;
export const styleRules: Partial<Record<keyof Style, Rule>> = schema.$defs.style.properties;
export const groups: { title: string; keys: (keyof Style)[] }[] = [
  { title: '자동 배치', keys: ['display', 'direction', 'wrap', 'justify', 'align', 'row_gap', 'column_gap', 'columns', 'rows', 'column_start', 'column_span', 'row_start', 'row_span', 'align_self', 'grow', 'shrink', 'basis'] },
  { title: '크기', keys: ['width', 'height', 'min_width', 'max_width', 'min_height', 'max_height', 'aspect_ratio'] },
  { title: '여백', keys: ['padding_top', 'padding_right', 'padding_bottom', 'padding_left', 'margin_top', 'margin_right', 'margin_bottom', 'margin_left'] },
  { title: '테두리와 반경', keys: ['border_top', 'border_right', 'border_bottom', 'border_left', 'radius_top_left', 'radius_top_right', 'radius_bottom_right', 'radius_bottom_left'] },
  { title: '외형', keys: ['background', 'color', 'opacity', 'shadows'] },
  { title: '글자', keys: ['font_family', 'font_size', 'font_weight', 'line_height', 'letter_spacing', 'text_align', 'text_decoration'] },
  { title: '위치와 표시', keys: ['position', 'inset_top', 'inset_right', 'inset_bottom', 'inset_left', 'rotation', 'z_index', 'hidden'] },
  { title: '이미지 맞춤', keys: ['object_fit', 'object_x', 'object_y'] },
];
const names: Record<string, string> = { display: '배치', direction: '방향', wrap: '줄바꿈', justify: '주축 정렬', align: '교차축 정렬',
  row_gap: '행 간격', column_gap: '열 간격', columns: '열 트랙', rows: '행 트랙', column_start: '시작 열', column_span: '열 span',
  row_start: '시작 행', row_span: '행 span', align_self: '자식 정렬', grow: '늘어남', shrink: '줄어듦', basis: '기준 크기',
  width: '너비', height: '높이', min_width: '최소 너비', max_width: '최대 너비', min_height: '최소 높이', max_height: '최대 높이',
  aspect_ratio: '가로세로 비율', background: '배경', color: '색상', opacity: '불투명도', shadows: '그림자',
  font_family: '글꼴', font_size: '글자 크기', font_weight: '굵기', line_height: '행간', letter_spacing: '자간', text_align: '글자 정렬', text_decoration: '글자 장식',
  position: '위치 방식', inset_top: '위 좌표', inset_right: '오른쪽 좌표', inset_bottom: '아래 좌표', inset_left: '왼쪽 좌표',
  rotation: '회전 각도', z_index: '겹침 순서', hidden: '숨김 여부', object_fit: '이미지 맞춤', object_x: '이미지 가로 초점', object_y: '이미지 세로 초점',
  value: '값', unit: '단위', kind: '종류', min: '최소', max: '최대', fr: '비율', angle: '각도', stops: '중지점', offset: '위치',
  asset_id: '이미지', fit: '맞춤', x: 'X', y: 'Y', blur: '흐림', spread: '확장', inset: '안쪽', style: '선 종류' };
for (const [prefix, label] of [['padding', '안쪽'], ['margin', '바깥'], ['border', '테두리'], ['radius', '반경']]) {
  for (const [suffix, direction] of [['top', '위'], ['right', '오른쪽'], ['bottom', '아래'], ['left', '왼쪽'], ['top_left', '왼쪽 위'], ['top_right', '오른쪽 위'], ['bottom_left', '왼쪽 아래'], ['bottom_right', '오른쪽 아래']]) names[prefix + '_' + suffix] = label + ' ' + direction;
}
export const labelFor = (key: string): string => names[key] ?? key;
export function resolve(rule: Rule): Rule { return rule.$ref ? resolve(definitions[rule.$ref.replace('#/$defs/', '')]) : rule; }
export function choices(rule: Rule): Rule[] {
  const resolved = resolve(rule);
  if (resolved.anyOf) return resolved.anyOf.flatMap(choices);
  if (resolved.enum) return resolved.enum.map(value => ({ const: value }));
  return [resolved];
}
export function matches(value: unknown, rule: Rule): boolean {
  try { validateRule(value, rule, definitions); return true; } catch { return false; }
}
export function seed(rule: Rule, previous?: unknown): unknown {
  const resolved = resolve(rule);
  if (resolved.anyOf) return seed(resolved.anyOf[0], previous);
  if (Object.hasOwn(resolved, 'const')) return resolved.const;
  if (resolved.enum) return resolved.enum[0];
  if (resolved.type === 'object') return Object.fromEntries((resolved.required ?? []).map(key => [key, seed(resolved.properties![key]!, record(previous) ? previous[key] : undefined)]));
  if (resolved.type === 'array') return Array.from({ length: resolved.minItems ?? 0 }, () => seed(resolved.items!));
  if (resolved.type === 'number') return typeof previous === 'number' && matches(previous, resolved) ? previous : Math.max(0, resolved.minimum ?? 0);
  if (resolved.type === 'boolean') return false;
  return typeof previous === 'string' ? previous : resolved.pattern?.includes('#') ? '#000000' : '';
}
export function choiceLabel(rule: Rule): string {
  const resolved = resolve(rule);
  if (Object.hasOwn(resolved, 'const')) return String(resolved.const);
  const properties = resolved.properties;
  if (properties?.unit?.const) return String(properties.unit.const);
  if (properties?.kind?.const) return String(properties.kind.const);
  if (properties?.fr) return 'fr';
  if (properties?.min) return 'minmax';
  return resolved.type === 'number' ? '배수' : '값';
}
