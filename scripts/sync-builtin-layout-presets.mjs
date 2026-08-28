import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = resolve(root, 'resources/block-packs/builtin-core/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const asset = (name) => `/modules/jiwonpapa-page_builder/store/previews/${name}.webp`;
const clone = (value) => JSON.parse(JSON.stringify(value));

const imageSets = {
  hero: {
    product: 'company-launch-hero', poster: 'event-launch-hero-event', backdrop: 'local-business-hero-space',
    editorial: 'editorial-community-hero-editorial', device: 'service-conversion-hero-consultation',
  },
  split: {
    balanced: 'company-launch-hero-team', screenshot: 'service-conversion-hero',
    overlap: 'editorial-community-story-gathering', offset: 'local-business-hero',
  },
};

const imageAlts = {
  hero: {
    product: '고객과 대화하는 서비스 담당자',
    poster: '행사 무대에서 발표하는 연사',
    backdrop: '따뜻한 조명의 로컬 매장 내부',
    editorial: '지역 커뮤니티 현장을 소개하는 인물',
    device: '상담 서비스를 소개하는 담당자',
  },
  split: {
    balanced: '회의 중인 제품 팀 구성원',
    screenshot: '고객 상담 서비스를 소개하는 담당자',
    overlap: '행사에 모인 지역 커뮤니티',
    offset: '로컬 비즈니스 공간을 운영하는 담당자',
  },
};

const teamMembers = [
  ['김하늘', '대표 · 제품', '고객 문제를 제품 전략과 실행으로 연결합니다.', 'company-launch-team-product'],
  ['이로운', '브랜드 디자인', '복잡한 메시지를 선명한 경험으로 만듭니다.', 'company-launch-team-design'],
  ['박지수', '플랫폼 개발', '안정적으로 확장되는 서비스 기반을 만듭니다.', 'company-launch-team-engineering'],
  ['최유진', '고객 성공', '도입부터 운영까지 실제 성과를 함께 만듭니다.', 'event-launch-speaker-creative'],
].map(([name, role, bio, image]) => ({ name, role, bio, imageSrc: asset(image), imageAlt: `${name} ${role}`, profileUrl: '' }));

const galleryImages = [
  ['editorial-community-story-gathering', '사람들이 모인 커뮤니티 행사', '커뮤니티'],
  ['editorial-community-story-park', '도심 공원의 풍경', '장소'],
  ['editorial-community-story-shop', '지역 상점의 내부', '브랜드'],
  ['local-business-hero-space', '로컬 비즈니스 공간', '공간'],
  ['event-launch-speaker-design', '무대에서 발표하는 연사', '이벤트'],
].map(([image, alt, caption]) => ({ src: asset(image), alt, caption }));

const testimonialItems = [
  ['필요한 정보를 찾는 시간이 크게 줄었습니다.', '김민서', '브랜드 매니저', '오르빗', 'company-launch-customer-founder'],
  ['모바일에서도 핵심 메시지가 분명하게 전달됩니다.', '이도윤', '운영 리드', '노스스타', 'service-conversion-customer-operations'],
  ['수정과 발행 흐름이 단순해져 캠페인 대응이 빨라졌습니다.', '박서연', '프로덕트 디자이너', '버텍스', 'local-business-customer-neighbor'],
].map(([quote, name, role, company, image]) => ({ quote, name, role, company, avatarSrc: asset(image), avatarAlt: name, rating: 5 }));

const articleItems = [
  ['제품', '더 빠른 페이지 운영을 위한 구조', '편집과 발행 흐름을 실무 관점에서 소개합니다.', '2026-08-21', 'service-conversion-hero-consultation'],
  ['브랜드', '지역의 이야기를 시각 언어로 만드는 법', '사진과 긴 글의 리듬을 함께 설계하는 방법을 살펴봅니다.', '2026-08-18', 'editorial-community-story-shop'],
  ['인사이트', '행동을 만드는 랜딩 페이지의 순서', '첫 화면부터 마지막 행동 유도까지 정보 위계를 점검합니다.', '2026-08-15', 'company-launch-hero-team'],
  ['인터뷰', '현장에서 발견한 운영의 기준', '꾸준히 관리되는 페이지가 갖춘 공통점을 정리합니다.', '2026-08-12', 'local-business-customer-neighbor'],
].map(([category, title, summary, date, image]) => ({ category, title, summary, date, imageSrc: asset(image), imageAlt: title, url: '/' }));

const groups = [
  {
    baseId: 'hero.service-intro', primary: 'product', layouts: [
      ['product', 'service-intro', '제품 소개 히어로', '메시지와 실제 제품 이미지를 좌우로 구성합니다.'],
      ['poster', 'poster', '포스터형 히어로', '대형 타이포와 짧은 행동을 중심에 집중합니다.'],
      ['backdrop', 'backdrop', '배경 이미지 히어로', '전체 배경 이미지 위에 메시지를 겹쳐 보여줍니다.'],
      ['editorial', 'editorial', '에디토리얼 히어로', '세리프 제목과 세로 이미지로 잡지형 첫 화면을 만듭니다.'],
      ['device', 'device', '디바이스 쇼케이스 히어로', '제품 화면을 디바이스 프레임처럼 강조합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, alignment: layout === 'poster' ? 'center' : 'left', layout, image: { src: asset(imageSets.hero[layout]), alt: imageAlts.hero[layout] } }),
  },
  {
    baseId: 'hero-split.product-focus', targetBlockId: 'content.hero-centered-01', primary: 'screenshot', layouts: [
      ['screenshot', 'product-focus', '제품 스크린샷 히어로', '넓은 제품 화면과 설명을 비대칭으로 배치합니다.'],
      ['balanced', 'balanced', '균형 분할 히어로', '메시지와 이미지를 같은 비중으로 나눕니다.'],
      ['overlap', 'overlap', '겹침형 히어로', '이미지 위로 메시지 패널이 겹치는 구성을 만듭니다.'],
      ['offset', 'offset', '오프셋 히어로', '텍스트와 세로 이미지의 시작점을 다르게 둡니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout, image: { src: asset(imageSets.split[layout]), alt: imageAlts.split[layout] } }),
  },
  {
    baseId: 'features.core-benefits', primary: 'bento', layouts: [
      ['bento', 'core-benefits', '벤토 기능 소개', '큰 핵심 기능과 작은 보조 기능을 크기가 다른 패널로 보여줍니다.'],
      ['grid', 'grid', '균등 기능 그리드', '동일한 비중의 기능을 빠르게 비교합니다.'],
      ['editorial', 'editorial', '에디토리얼 기능 목록', '고정 제목 옆에 기능을 세로 흐름으로 설명합니다.'],
      ['panel', 'panel', '기능 패널', '기능 전체를 하나의 강조 패널 안에 묶습니다.'],
      ['list', 'list', '기능 세로 목록', '아이콘과 설명을 읽기 쉬운 행 단위로 정리합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout }),
  },
  {
    baseId: 'cta.contact', primary: 'split', layouts: [
      ['split', 'contact', '분할 문의 CTA', '메시지와 행동 버튼을 양쪽으로 분리합니다.'],
      ['centered', 'centered', '가운데 집중 CTA', '한 가지 핵심 행동에 시선을 집중합니다.'],
      ['banner', 'banner', '가로 배너 CTA', '페이지 중간에 얇은 전환 배너를 배치합니다.'],
      ['panel', 'panel', '강조 패널 CTA', '독립된 둥근 패널로 마지막 행동을 강조합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout }),
  },
  {
    baseId: 'logo-cloud.partners', primary: 'strip', layouts: [
      ['strip', 'partners', '파트너 로고 띠', '한 줄에 파트너 이름과 로고를 이어 보여줍니다.'],
      ['grid', 'grid', '파트너 로고 그리드', '고객사 로고를 정돈된 격자로 비교합니다.'],
      ['panel', 'panel', '신뢰 로고 패널', '신뢰 문구와 고객사 로고를 한 패널에 묶습니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout }),
  },
  {
    baseId: 'stats.business-proof', primary: 'editorial', layouts: [
      ['editorial', 'business-proof', '대형 핵심 지표', '가장 중요한 숫자 하나를 크게 강조합니다.'],
      ['grid', 'grid', '지표 그리드', '여러 성과 지표를 같은 비중으로 보여줍니다.'],
      ['strip', 'strip', '가로 지표 띠', '페이지 사이에 짧은 성과 띠를 배치합니다.'],
      ['split', 'split', '제목 분할 지표', '설명 제목과 수치 영역을 좌우로 나눕니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout }),
  },
  {
    baseId: 'pricing.three-tier', primary: 'featured', layouts: [
      ['featured', 'three-tier', '추천 플랜 강조', '가운데 추천 플랜의 크기와 비중을 높입니다.'],
      ['cards', 'cards', '균등 요금 카드', '플랜을 같은 비중의 카드로 비교합니다.'],
      ['compact', 'compact', '간결 요금 비교', '각 플랜을 한 행에 요약해 빠르게 비교합니다.'],
      ['editorial', 'editorial', '에디토리얼 요금제', '가격 설명과 플랜 목록을 좌우로 분리합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout }),
  },
  {
    baseId: 'team.leadership', primary: 'portraits', layouts: [
      ['portraits', 'leadership', '인물 중심 리더십', '실제 프로필 사진을 큰 세로 비율로 보여줍니다.'],
      ['grid', 'grid', '팀 그리드', '구성원을 균등한 카드로 정리합니다.'],
      ['editorial', 'editorial', '에디토리얼 팀 소개', '팀 설명과 인물 목록을 좌우로 분리합니다.'],
      ['featured', 'featured', '대표 인물 강조', '첫 인물을 크게 보여주고 나머지를 보조로 배치합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, members: teamMembers, layout }),
  },
  {
    baseId: 'gallery.project-scenes', primary: 'bento', layouts: [
      ['bento', 'project-scenes', '벤토 프로젝트 갤러리', '대표 장면과 보조 장면을 크기가 다른 격자로 보여줍니다.'],
      ['grid', 'grid', '균등 프로젝트 갤러리', '모든 장면을 같은 크기로 정돈합니다.'],
      ['masonry', 'masonry', '메이슨리 갤러리', '가로와 세로 사진의 원래 리듬을 살립니다.'],
      ['filmstrip', 'filmstrip', '필름 스트립 갤러리', '큰 장면을 가로로 넘겨 감상합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, images: galleryImages, columns: layout === 'grid' ? 3 : 4, layout }),
  },
  {
    baseId: 'testimonials.customer-proof', primary: 'wall', layouts: [
      ['wall', 'customer-proof', '고객 후기 월', '서로 다른 크기의 후기 카드로 고객 목소리를 풍부하게 보여줍니다.'],
      ['grid', 'grid', '고객 후기 그리드', '후기를 균등한 열로 비교합니다.'],
      ['spotlight', 'spotlight', '고객 후기 집중형', '후기를 한 줄씩 넓게 읽도록 구성합니다.'],
      ['split', 'split', '제목 분할 후기', '섹션 제목과 고객 후기를 좌우로 나눕니다.'],
      ['quote-hero', 'quote-hero', '대형 인용 후기', '대표 고객 문장을 큰 타이포로 강조합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, items: testimonialItems, layout }),
  },
  {
    baseId: 'articles.insights', primary: 'magazine', layouts: [
      ['magazine', 'insights', '매거진 인사이트', '네 개 기사를 빈칸 없는 2열 그리드로 보여줍니다.'],
      ['list', 'list', '인사이트 목록', '이미지와 요약을 행 단위로 차분하게 읽습니다.'],
      ['grid', 'grid', '인사이트 카드 그리드', '여러 글을 같은 비중의 카드로 탐색합니다.'],
      ['featured', 'featured', '대표 기사 중심', '첫 글을 크게 보여주고 나머지는 간결한 목록으로 둡니다.'],
      ['editorial', 'editorial', '에디토리얼 기사 목록', '섹션 소개와 기사 흐름을 두 열로 분리합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, items: articleItems, layout }),
  },
  {
    baseId: 'card-grid.services', primary: 'bento', layouts: [
      ['bento', 'services', '벤토 서비스 카드', '핵심 서비스와 보조 서비스를 다른 크기로 강조합니다.'],
      ['grid', 'grid', '균등 서비스 카드', '서비스를 같은 비중으로 비교합니다.'],
      ['rail', 'rail', '서비스 가로 레일', '큰 서비스 카드를 가로로 넘겨 탐색합니다.'],
      ['editorial', 'editorial', '에디토리얼 서비스 목록', '서비스 소개 제목과 카드 목록을 좌우로 나눕니다.'],
      ['numbered', 'numbered', '번호형 서비스 목록', '서비스를 큰 번호와 함께 행 단위로 정리합니다.'],
    ],
    enrich: (props, layout) => ({ ...props, layout }),
  },
];

const generatedIds = new Set(groups.flatMap((group) => group.layouts.filter(([layout]) => layout !== group.primary).map(([, suffix]) => `${group.baseId.split('.')[0]}.${suffix}`)));
manifest.presets = manifest.presets.filter((preset) => !generatedIds.has(preset.preset_id));

for (const group of groups) {
  const baseIndex = manifest.presets.findIndex((preset) => preset.preset_id === group.baseId);
  if (baseIndex < 0) throw new Error(`Missing base preset: ${group.baseId}`);
  const base = manifest.presets[baseIndex];
  for (const [layout, suffix, label, description] of group.layouts) {
    const preset = clone(base);
    if (group.targetBlockId) preset.block_id = group.targetBlockId;
    preset.preset_id = layout === group.primary ? group.baseId : `${group.baseId.split('.')[0]}.${suffix}`;
    preset.label = { ko: label };
    preset.description = { ko: description };
    preset.props = group.enrich(clone(base.props), layout);
    preset.thumbnail = '';
    if (layout === group.primary) manifest.presets[baseIndex] = preset;
    else manifest.presets.push(preset);
  }
}

manifest.pack_version = '0.15.0';
const slugify = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
manifest.presets.forEach((preset, index) => {
  preset.thumbnail = `thumbnails/generated/preset-${String(index + 1).padStart(2, '0')}-${slugify(preset.preset_id)}.png`;
});
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const pageKitLayouts = {
  'company-launch': {
    'content.hero-split-01': 'screenshot', 'content.features-grid-01': 'bento', 'data.stats-icons-01': 'editorial',
    'company.team-grid-01': 'portraits', 'trust.testimonials-01': 'wall', 'content.cta-split-01': 'panel',
  },
  'editorial-community': {
    'content.hero-split-01': 'offset', 'content.article-list-01': 'magazine', 'content.cta-split-01': 'banner',
  },
  'event-launch': {
    'content.hero-split-01': 'overlap', 'data.stats-icons-01': 'strip', 'company.team-grid-01': 'featured', 'trust.logo-cloud-01': 'grid',
  },
  'local-business': {
    'content.hero-split-01': 'balanced', 'content.features-grid-01': 'panel', 'trust.testimonials-01': 'split',
  },
  'service-conversion': {
    'content.hero-split-01': 'screenshot', 'trust.testimonials-01': 'quote-hero',
  },
};

if (process.env.G7PB_SYNC_PAGE_KITS !== '0') {
  for (const [kit, layouts] of Object.entries(pageKitLayouts)) {
    const path = resolve(root, `resources/store/source/page-kits/${kit}/document.json`);
    const document = JSON.parse(await readFile(path, 'utf8'));
    for (const block of document.blocks) {
      const layout = layouts[block.type];
      if (layout) block.props.layout = layout;
    }
    await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
  }
}

process.stdout.write(`Synchronized ${manifest.presets.length} meaningful built-in presets${process.env.G7PB_SYNC_PAGE_KITS === '0' ? ' without page kits' : ` and ${Object.keys(pageKitLayouts).length} page kits`}.\n`);
