import { BLOCK_CATEGORY_LABELS, blockCatalogTestId, BUILTIN_BLOCK_DEFINITIONS, BUILTIN_BLOCK_PRESETS, BUILTIN_CORE_MANIFEST } from '../blocks/builtinCatalog';
import type { BlockCatalogItem } from '../blocks/types';
import type { EditorComponents } from './puckEditorTypes';

export interface BlockGalleryItem {
  catalogId: string;
  kind: 'definition' | 'preset';
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
