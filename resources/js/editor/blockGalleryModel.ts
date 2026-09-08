import { BLOCK_CATEGORY_LABELS, blockCatalogTestId, BUILTIN_BLOCK_DEFINITIONS, BUILTIN_BLOCK_PRESETS, BUILTIN_CORE_MANIFEST } from '../blocks/builtinCatalog';
import type { BlockCatalogItem } from '../blocks/types';
import type { Config } from '@puckeditor/core';
import { layoutPolicy } from '../documents/layoutPolicy';
import { BUILTIN_CANVAS_EDITING_CONTRACT, collectionLimit } from './canvasEditingContract';
import type { EditorComponents } from './puckEditorTypes';

export const LIBRARY_KINDS = [
  ['element', '기본 요소'], ['layout', '레이아웃'], ['component', '컴포넌트'], ['section', '완성 섹션'],
] as const;
export type LibraryKind = typeof LIBRARY_KINDS[number][0];
const SECTION_COMPONENTS = new Set([
  'Hero', 'HeroSplit', 'HeroSlider', 'Features', 'Cta', 'LogoCloud', 'Stats', 'Pricing', 'Team',
  'Testimonials', 'ProcessTimeline', 'ArticleList', 'LogoCarousel', 'TestimonialSlider',
  'EventSchedule', 'DownloadResources', 'CardGrid',
]);
const LAYOUT_COMPONENTS = new Set(['LayoutSection', 'LayoutColumns', 'LayoutStack']);

/** Editor discovery only: never changes the persisted block or Pack contract. */
export function libraryKind(type: string): LibraryKind {
  if (LAYOUT_COMPONENTS.has(type)) return 'layout';
  const definition = BUILTIN_BLOCK_DEFINITIONS.find((entry) => entry.editor_component === type);
  if (type === 'Card') return 'component';
  if (definition && layoutPolicy.leaf_types.includes(definition.block_id)) return 'element';
  if (definition && SECTION_COMPONENTS.has(type)) return 'section';
  // Older external packs keep their original editor and are conservatively grouped as components.
  return 'component';
}

export function libraryKindLabel(kind: LibraryKind): string {
  return LIBRARY_KINDS.find(([value]) => value === kind)?.[1] ?? '';
}

export function libraryCategories(types: readonly string[], layoutEnabled = true, allTypes: readonly string[] = types): NonNullable<Config<EditorComponents>['categories']> {
  const isRegistered = (type: string): type is keyof EditorComponents => LAYOUT_COMPONENTS.has(type)
    || BUILTIN_BLOCK_DEFINITIONS.some((entry) => entry.editor_component === type) || type.startsWith('External_');
  const registered = [...new Set(types.filter(isRegistered))].filter((type) => layoutEnabled || type !== 'Card');
  return {
    ...Object.fromEntries(LIBRARY_KINDS.map(([kind, title]) => [kind, {
      title, defaultExpanded: true, visible: kind !== 'layout' || layoutEnabled,
      components: registered.filter((type) => type !== 'HeroSplit' && type !== 'LayoutColumns'
        && type !== 'LayoutStack' && libraryKind(type) === kind),
    }])),
    internal: { visible: false, components: registered.filter((type) => ['HeroSplit', 'LayoutColumns', 'LayoutStack'].includes(type)) },
    unavailable: { visible: false, components: allTypes.filter(isRegistered).filter((type) => !registered.includes(type)) },
  };
}

export interface LibraryEditingCapability {
  key: 'fields' | 'style' | 'repeaters' | 'slots' | 'fixed';
  label: string;
  description: string;
  available: boolean;
}

const STYLE_FIELDS = new Set(['surface', 'spacing', 'layout', 'theme', 'alignment', 'mediaPosition',
  'textScale', 'textAlign', 'elementStyles', 'containerWidth', 'containerAlign', 'minHeight',
  'verticalAlign', 'responsiveOverrides', 'width', 'gap', 'ratio', 'columns', 'motion',
  'size', 'variant', 'aspectRatio', 'tabVariant', 'tone', 'measure']);

/** Read capabilities from the existing canvas/field contracts, including explicit unavailable states. */
export function libraryEditingCapabilities(type: string, fields: Record<string, unknown>): LibraryEditingCapability[] {
  const contract = BUILTIN_CANVAS_EDITING_CONTRACT.find((entry) => entry.componentType === type);
  const layout = LAYOUT_COMPONENTS.has(type);
  const known = Boolean(contract) || layout;
  const direct = Boolean(contract?.directText || contract?.directMedia || contract?.directRoute);
  const panelContent = Boolean(contract?.textFields.some((field) => field.kind === 'structural' && !STYLE_FIELDS.has(field.path)));
  const styles = Object.entries(fields).filter(([name, field]) => STYLE_FIELDS.has(name)
    && typeof field === 'object' && field !== null && 'type' in field && field.type !== 'array');
  const styleLabels = styles.flatMap(([name, field]) => typeof field === 'object' && field !== null
    && 'label' in field && typeof field.label === 'string' ? [name === 'elementStyles' ? '글자 모양' : field.label] : []);
  const repeaters = contract?.collections.filter((name) => collectionLimit(type, name) !== null) ?? [];
  const repeaterLimits = repeaters.map((name) => {
    const limit = collectionLimit(type, name);
    return limit ? `${limit.min}~${limit.max}개` : '';
  }).join(' · ');
  const slots = Object.entries(fields).filter(([, field]) => typeof field === 'object' && field !== null
    && 'type' in field && field.type === 'slot').map(([name]) => name);
  const plannedSlots = ['Hero', 'ImageText', 'Tabs', 'FaqAccordion'].includes(type);
  const fixed = contract?.dynamicData ? '실제 데이터·접근 권한·연결 동작은 연동 모듈이 관리합니다.'
    : type === 'InquiryForm' ? '필수 입력·동의·검증·전송 동작을 유지합니다.'
      : ['Tabs', 'FaqAccordion'].includes(type) ? '탭·개폐와 키보드·포커스 동작을 유지합니다.'
        : layout ? '허용 자식·깊이·개수 제한과 읽기 순서를 유지합니다.'
          : known ? '접근성 구조·링크 처리와 정해진 표시 동작을 유지합니다.'
            : '팩이 제공한 구성과 동작을 유지합니다. 내부 구성은 개방하지 않습니다.';
  return [
    { key: 'fields', label: '내용 수정', available: direct || panelContent,
      description: direct ? [contract?.directText && '화면 문구', contract?.directMedia && '이미지', contract?.directRoute && '링크'].filter(Boolean).join(' · ')
        : layout ? '구역 안의 각 요소를 선택해 내용을 수정합니다.'
          : known ? '설정 패널에서 공개된 값을 수정합니다.' : '팩의 설정 패널을 사용합니다. 직접 편집 범위는 확인되지 않았습니다.' },
    { key: 'style', label: '스타일 변경', available: styles.length > 0,
      description: styleLabels.length ? styleLabels.join(' · ') : '팩이 제공하는 설정을 확인하세요.' },
    { key: 'repeaters', label: '항목 추가', available: repeaters.length > 0,
      description: repeaters.length ? `항목 ${repeaterLimits}. 한도 안에서 추가·순서 변경·복제·삭제가 가능합니다.`
        : known ? '독립 반복 항목이 없습니다.' : '공통 항목 도구는 제공하지 않습니다. 팩의 설정을 확인하세요.' },
    { key: 'slots', label: '내부 구성', available: (layout || type === 'Hero' || type === 'ImageText' || type === 'Card') && slots.length > 0,
      description: type === 'Card' ? '이미지·본문·버튼 구역에 허용된 요소를 하나씩 배치하고 편집합니다.'
        : type === 'Hero' && slots.length > 0 ? '내부 구성에 배지·목록을 각각 하나씩 배치합니다. 제목·본문·이미지·기존 버튼은 유지합니다.'
        : type === 'ImageText' && slots.length > 0 ? '내부 구성에 배지·목록·구분선을 각각 하나씩 배치합니다. 제목·본문·이미지·기존 버튼은 유지합니다.'
        : layout ? '구역·열·세로 묶음의 허용 위치에 기본 요소를 배치합니다.'
        : plannedSlots ? '현재 내부 요소 삽입은 지원하지 않습니다. 후속 개발 대상입니다.' : '현재 내부 요소 삽입을 지원하지 않습니다.' },
    { key: 'fixed', label: '고정 동작', available: false, description: fixed },
  ];
}

export interface BlockGalleryItem {
  catalogId: string;
  kind: 'definition' | 'preset';
  productionKind: LibraryKind;
  type: keyof EditorComponents;
  testId: string;
  category: string;
  title: string;
  description: string;
  searchText: string;
  blockId: string;
  blockVersion: number;
  favorite: boolean;
  presetProps: Record<string, unknown> | null;
  thumbnail: string;
  packId: string;
  packLabel: string;
}

type BlockPreviewDensity = 'compact' | 'regular';

const COMPACT_BLOCK_PREVIEWS = new Set<keyof EditorComponents>([
  'Icon', 'List', 'Badge',
  'Heading',
  'RichText',
  'Buttons',
  'Divider',
  'Blockquote',
  'Notice',
  'Breadcrumbs',
  'AnchorMenu',
  'SocialLinks',
]);

export function blockPreviewDensity(type: keyof EditorComponents): BlockPreviewDensity {
  return COMPACT_BLOCK_PREVIEWS.has(type) ? 'compact' : 'regular';
}

function blockPackAssetUrl(packId: string, packVersion: string, path: string): string {
  const [publisher, pack] = packId.split('/', 2);
  if (!publisher || !pack || !path || path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return '';
  }
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `/modules/jiwonpapa-page_builder/block-packs/${encodeURIComponent(publisher)}/${encodeURIComponent(pack)}/${encodeURIComponent(packVersion)}/${encodedPath}`;
}

const BLOCK_SEARCH_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  Icon: '아이콘 장식 기호', List: '목록 리스트 글머리 번호', Badge: '배지 뱃지 라벨 태그',
  Heading: '제목 헤딩 섹션 타이틀', RichText: '본문 글 문단 에디터', Image: '사진 이미지 배너', Buttons: '버튼 링크 행동 전환',
  Divider: '구분선 선 여백 분리', Blockquote: '인용문 후기 명언', Hero: '히어로 첫 화면 랜딩', HeroSplit: '분할 히어로 이미지',
  HeroSlider: '슬라이더 캠페인 배너', Features: '기능 특징 장점', Cta: '행동 유도 전환 문의', Notice: '알림 안내 주의 공지',
  ImageText: '이미지 텍스트 소개', IconList: '아이콘 목록 체크', CardGrid: '카드 서비스 목록', FaqAccordion: 'FAQ 질문 답변',
  ProcessTimeline: '절차 단계 과정', Tabs: '탭 정보 분류', ArticleList: '글 기사 소식', EventSchedule: '행사 일정 이벤트', DownloadResources: '자료 다운로드 파일',
  Gallery: '갤러리 사진 그리드', VideoEmbed: '영상 유튜브 비메오', ImageCarousel: '이미지 캐러셀 슬라이드',
  Breadcrumbs: '경로 탐색 브레드크럼', AnchorMenu: '앵커 메뉴 목차 바로가기', SocialLinks: '소셜 SNS 채널',
  Contact: '연락처 회사 안내', LogoCloud: '로고 고객사 파트너', LogoCarousel: '로고 캐러셀 고객사', Testimonials: '고객 후기 리뷰',
  TestimonialSlider: '후기 슬라이더 리뷰', Team: '팀 구성원 회사', Stats: '통계 수치 지표', BarChart: '막대 그래프 데이터',
  Pricing: '가격 요금제 플랜', ComparisonTable: '비교 표 기능', InquiryForm: '문의 견적 예약 신청 구독 폼', MapDirections: '지도 오시는 길 위치',
});

export const BLOCK_CATEGORY_ORDER = ['기본', '첫 화면·전환', '콘텐츠', '미디어', '탐색', '신뢰·회사', '데이터·비교', '문의·방문', 'G7 데이터'] as const;
export const QUICK_ADD_COMPONENTS = ['Heading', 'RichText', 'Image', 'Buttons', 'Hero', 'Cta'] as const;
export const OPEN_BLOCK_GALLERY_EVENT = 'g7pb:open-block-gallery';
const LEGACY_LIBRARY_DEFINITION_IDS = new Set(['content.hero-split-01']);
export const BLOCK_GALLERY_WINDOW_SIZE = 24;

function blockPackLabel(packId: string): string {
  if (packId === BUILTIN_CORE_MANIFEST.pack_id) return '기본 제공';
  return packId.split('/').at(-1)?.replace(/[-_]+/g, ' ') || packId;
}

export function createBuiltinGalleryItems(isRegisteredComponent: (type: string) => type is keyof EditorComponents): ReadonlyArray<BlockGalleryItem> {
  const definitions: ReadonlyArray<BlockGalleryItem> = BUILTIN_BLOCK_DEFINITIONS
    .filter((definition) => !LEGACY_LIBRARY_DEFINITION_IDS.has(definition.block_id))
    .map((definition) => {
      const type = definition.editor_component;
      if (!isRegisteredComponent(type)) {
        throw new Error(`Builtin Block Pack editor component is not registered: ${type}`);
      }

      return {
        catalogId: `block:${definition.block_id}@${definition.block_version}`,
        kind: 'definition',
        productionKind: libraryKind(type),
        type,
        testId: blockCatalogTestId(type),
        category: BLOCK_CATEGORY_LABELS[definition.category] ?? definition.category,
        title: definition.label.ko,
        description: definition.description.ko,
        searchText: [definition.block_id, definition.category, BLOCK_CATEGORY_LABELS[definition.category], type, BLOCK_SEARCH_ALIASES[type], ...Object.values(definition.label), ...Object.values(definition.description)].join(' '),
        blockId: definition.block_id,
        blockVersion: definition.block_version,
        favorite: false,
        presetProps: null,
        thumbnail: blockPackAssetUrl(BUILTIN_CORE_MANIFEST.pack_id, BUILTIN_CORE_MANIFEST.pack_version, definition.thumbnail),
        packId: BUILTIN_CORE_MANIFEST.pack_id,
        packLabel: blockPackLabel(BUILTIN_CORE_MANIFEST.pack_id),
      };
    });

  const presets: ReadonlyArray<BlockGalleryItem> = BUILTIN_BLOCK_PRESETS.map((preset) => {
    const definition = BUILTIN_BLOCK_DEFINITIONS.find((candidate) =>
      candidate.block_id === preset.block_id && candidate.block_version === preset.block_version);
    if (!definition) {
      throw new Error(`Builtin preset references an unavailable definition: ${preset.preset_id}`);
    }
    const type = definition.editor_component;
    if (!isRegisteredComponent(type)) {
      throw new Error(`Builtin preset editor component is not registered: ${type}`);
    }

    return {
      catalogId: `preset:${BUILTIN_CORE_MANIFEST.pack_id}:${preset.preset_id}`,
      kind: 'preset',
      productionKind: libraryKind(type),
      type,
      testId: `page-builder-preset-${preset.preset_id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      category: BLOCK_CATEGORY_LABELS[preset.category] ?? preset.category,
      title: preset.label.ko,
      description: preset.description.ko,
      searchText: [preset.block_id, preset.preset_id, preset.category, BLOCK_CATEGORY_LABELS[preset.category], type, BLOCK_SEARCH_ALIASES[type], ...Object.values(preset.label), ...Object.values(preset.description)].join(' '),
      blockId: preset.block_id,
      blockVersion: preset.block_version,
      favorite: false,
      presetProps: preset.props,
      thumbnail: blockPackAssetUrl(BUILTIN_CORE_MANIFEST.pack_id, BUILTIN_CORE_MANIFEST.pack_version, preset.thumbnail),
      packId: BUILTIN_CORE_MANIFEST.pack_id,
      packLabel: blockPackLabel(BUILTIN_CORE_MANIFEST.pack_id),
    };
  });

  return Object.freeze([
    ...definitions,
    ...presets,
  ]);
}

export function galleryItemFromApi(item: BlockCatalogItem, locale: string, type: keyof EditorComponents | null, defaults: ReadonlyArray<BlockGalleryItem>): BlockGalleryItem | null {
  if (item.kind === 'definition' && LEGACY_LIBRARY_DEFINITION_IDS.has(item.block_id)) return null;
  if (!type) return null;
  const staticItem = defaults.find((candidate) => candidate.catalogId === item.catalog_id);
  const safeLocale = locale === 'en' ? 'en' : 'ko';

  return {
    catalogId: item.catalog_id,
    kind: item.kind,
    productionKind: libraryKind(type),
    type,
    testId: staticItem?.testId ?? `page-builder-block-${item.catalog_id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    category: BLOCK_CATEGORY_LABELS[item.category] ?? item.category,
    title: item.label[safeLocale] ?? item.label.ko,
    description: item.description[safeLocale] ?? item.description.ko,
    searchText: [item.block_id, item.category, BLOCK_CATEGORY_LABELS[item.category], item.editor_component, BLOCK_SEARCH_ALIASES[item.editor_component], ...Object.values(item.label), ...Object.values(item.description)].join(' '),
    blockId: item.block_id,
    blockVersion: item.block_version,
    favorite: item.favorite,
    presetProps: item.preset_props,
    thumbnail: blockPackAssetUrl(item.pack_id, item.pack_version, item.thumbnail),
    packId: staticItem?.packId ?? item.pack_id,
    packLabel: staticItem?.packLabel ?? blockPackLabel(item.pack_id),
  };
}

export const LAYOUT_GALLERY_ITEM: BlockGalleryItem = {
  catalogId: 'layout:section', kind: 'definition', productionKind: 'layout', type: 'LayoutSection',
  testId: blockCatalogTestId('LayoutSection'), category: '구조', title: '구역',
  description: '열과 세로 묶음으로 제목·본문·이미지·버튼을 배치합니다.',
  searchText: '레이아웃 구역 Section 구조 열 Columns 세로 묶음 Stack',
  blockId: layoutPolicy.layouts.section, blockVersion: 1, favorite: false, presetProps: null,
  thumbnail: '', packId: BUILTIN_CORE_MANIFEST.pack_id, packLabel: '기본 제공',
};
