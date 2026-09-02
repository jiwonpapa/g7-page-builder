<?php

declare(strict_types=1);

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;

require dirname(__DIR__).'/vendor/autoload.php';

$root = dirname(__DIR__);
$output = $argv[1] ?? $root.'/output/block-thumbnail-fixtures';
$requestedIds = null;
for ($argument = 2; $argument < $argc; $argument++) {
    if ($argv[$argument] !== '--ids' || $requestedIds !== null || ! isset($argv[$argument + 1])) {
        throw new RuntimeException('Usage: render-block-thumbnail-fixtures.php OUTPUT [--ids id,id]');
    }
    $requestedIds = explode(',', $argv[++$argument]);
    if (in_array('', $requestedIds, true) || count(array_unique($requestedIds)) !== count($requestedIds)) {
        throw new RuntimeException('Renderer IDs must be nonempty and unique.');
    }
}
if (! str_starts_with($output, '/') || str_contains($output, "\0")) {
    throw new RuntimeException('Thumbnail fixture output must be an absolute path.');
}
if (! is_dir($output) && ! mkdir($output, 0755, true) && ! is_dir($output)) {
    throw new RuntimeException("Cannot create thumbnail fixture output: {$output}");
}

$manifestPath = $root.'/resources/block-packs/builtin-core/manifest.json';
$manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
if (! is_array($manifest) || ! is_array($manifest['blocks'] ?? null) || ! is_array($manifest['presets'] ?? null)) {
    throw new RuntimeException('Built-in Block Pack manifest is invalid.');
}

$registry = new BlockRegistry;
$registry->register((new BuiltInBlockPackLoader)->load($root), enabled: true);
$compiler = new HtmlDocumentCompiler($registry);
$publicCssPath = $root.'/dist/css/page-builder-public.css';
if (! is_file($publicCssPath)) {
    throw new RuntimeException('Built public viewer CSS is missing. Run npm run build first.');
}
$css = (string) file_get_contents($publicCssPath);
// URL-bearing CSS/srcset need explicit dependency support before they can be reviewed.
// Do not silently omit remote fonts, background images or responsive image candidates.
if (preg_match('/(?:url\s*\(|@import)/i', $css)) {
    throw new RuntimeException('Evidence collection does not yet support public CSS asset URLs.');
}
$collectEvidenceAssets = static function (string $html): array {
    $dom = new DOMDocument;
    $previousErrors = libxml_use_internal_errors(true);
    try {
        if (! $dom->loadHTML('<!doctype html><html><head><meta charset="utf-8"></head><body>'.$html.'</body></html>', LIBXML_NONET)) {
            throw new RuntimeException('Cannot parse rendered asset dependencies.');
        }
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previousErrors);
    }
    $xpath = new DOMXPath($dom);
    $assets = [];
    foreach ($xpath->query('//*') as $element) {
        if (! $element instanceof DOMElement) {
            continue;
        }
        if ($element->hasAttribute('srcset') || preg_match('/url\s*\(/i', $element->getAttribute('style'))) {
            throw new RuntimeException('Evidence collection does not yet support srcset or inline CSS asset URLs.');
        }
        $attributes = ['src', 'poster'];
        if ($element->tagName === 'object') {
            $attributes[] = 'data';
        }
        if (in_array($element->tagName, ['image', 'use', 'link'], true) || $element->hasAttribute('download')) {
            $attributes[] = 'href';
            $attributes[] = 'xlink:href';
        }
        foreach ($attributes as $attribute) {
            $url = trim($element->getAttribute($attribute));
            if ($url !== '' && ! str_starts_with($url, '#')) {
                $assets[$url] = true;
            }
        }
    }
    $urls = array_keys($assets);
    sort($urls, SORT_STRING);

    return $urls;
};
$slugify = static function (string $value): string {
    $kebab = preg_replace('/([a-z0-9])([A-Z])/', '$1-$2', $value) ?? $value;

    return trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($kebab)), '-');
};

$thumbnailImage = static fn (string $filename): string => '/modules/jiwonpapa-page_builder/store/previews/'.$filename;
$dynamicThumbnailSamples = [
    'g7.board-recent-posts-01' => [
        'target' => 'list',
        'items' => [
            '<article data-g7pb-thumbnail-item><a href="/board/news/31"><strong>서비스 업데이트와 달라진 이용 흐름</strong><span>새소식 · 2026-08-28</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/board/guide/18"><strong>처음 방문한 고객을 위한 시작 안내</strong><span>이용 가이드 · 2026-08-25</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/board/story/12"><strong>운영팀이 전하는 이번 달 현장 이야기</strong><span>고객 이야기 · 2026-08-21</span></a></article>',
        ],
    ],
    'g7.ecommerce-product-grid-01' => [
        'target' => 'list',
        'items' => [
            '<article data-g7pb-thumbnail-item><a href="/shop/products/STARTER"><img src="'.$thumbnailImage('service-conversion-hero-consultation.webp').'" alt="상담 서비스 대표 상품"><strong>비즈니스 시작 패키지</strong><span>89,000원</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/shop/products/TEAM"><img src="'.$thumbnailImage('company-launch-hero-team.webp').'" alt="팀 협업 서비스 상품"><strong>팀 협업 플랜</strong><span>129,000원</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/shop/products/LOCAL"><img src="'.$thumbnailImage('local-business-hero-space.webp').'" alt="로컬 매장 운영 상품"><strong>로컬 매장 키트</strong><span>65,000원</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/shop/products/EVENT"><img src="'.$thumbnailImage('event-launch-hero-event.webp').'" alt="행사 운영 서비스 상품"><strong>이벤트 운영 패키지</strong><span>149,000원</span></a></article>',
        ],
    ],
    'g7.board-content-archive-01' => [
        'target' => 'list',
        'items' => [
            '<article data-g7pb-thumbnail-item><a href="/board/insight/44"><strong>고객 문의를 빠르게 정리하는 세 가지 기준</strong><span>인사이트 · 2026-08-26</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/board/case/29"><strong>작은 팀이 반복 업무를 줄인 과정</strong><span>활용 사례 · 2026-08-19</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/board/news/21"><strong>8월 제품 개선 사항을 안내합니다</strong><span>새소식 · 2026-08-12</span></a></article>',
        ],
    ],
    'g7.ecommerce-product-showcase-01' => [
        'target' => 'list',
        'items' => [
            '<article data-g7pb-thumbnail-item><a href="/shop/products/BRAND"><img src="'.$thumbnailImage('service-conversion-customer-brand.webp').'" alt="브랜드 성장 컨설팅 상품"><strong>브랜드 성장 컨설팅</strong><span>220,000원</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/shop/products/DESIGN"><img src="'.$thumbnailImage('company-launch-team-design.webp').'" alt="디자인 검토 서비스 상품"><strong>디자인 집중 검토</strong><span>95,000원</span></a></article>',
            '<article data-g7pb-thumbnail-item><a href="/shop/products/PLATFORM"><img src="'.$thumbnailImage('event-launch-speaker-platform.webp').'" alt="플랫폼 운영 교육 상품"><strong>플랫폼 운영 클래스</strong><span>79,000원</span></a></article>',
        ],
    ],
    'g7.board-post-detail-01' => [
        'target' => 'detail',
        'items' => [
            '<article data-g7pb-thumbnail-item><p class="g7pb-data-detail__meta">운영팀 · 2026-08-28 · 조회 128</p><h3>더 빠른 페이지 운영을 위한 업데이트</h3><p>콘텐츠를 구성하고 발행하는 흐름을 단순하게 다듬었습니다. 이번 업데이트에서 달라진 핵심 기능과 적용 방법을 확인해 보세요.</p><a href="/board/notice/1">게시글 전체 보기</a></article>',
        ],
    ],
    'g7.ecommerce-product-detail-01' => [
        'target' => 'detail',
        'items' => [
            '<article data-g7pb-thumbnail-item><img src="'.$thumbnailImage('service-conversion-hero-consultation.webp').'" alt="맞춤 운영 컨설팅 상품"><div><p class="g7pb-data-detail__meta">컨설팅 · CONSULT-01</p><h3>맞춤 운영 컨설팅</h3><strong>220,000원</strong><p>현재 운영 흐름을 진단하고 우선순위가 분명한 개선안을 함께 설계합니다.</p><a href="/shop/products/CONSULT-01">상품 전체 보기</a></div></article>',
        ],
    ],
];
$decorateDynamicThumbnail = static function (string $blockId, string $html) use ($dynamicThumbnailSamples): array {
    $sample = $dynamicThumbnailSamples[$blockId] ?? null;
    if (! is_array($sample)) {
        return [$html, 0];
    }

    $html = preg_replace(
        '/<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">.*?<\/p>/',
        '<p class="g7pb-dynamic__status" data-g7pb-data-status role="status" hidden></p>',
        $html,
        1,
    ) ?? $html;
    $items = implode('', $sample['items']);
    $attribute = $sample['target'] === 'detail' ? 'data-g7pb-data-detail' : 'data-g7pb-data-list';
    $pattern = '/<div class="([^"]+)" '.$attribute.' aria-busy="true">.*?<\/div>/s';
    $replacement = '<div class="$1" '.$attribute.' aria-busy="false" data-g7pb-thumbnail-sample="true">'.$items.'</div>';
    $decorated = preg_replace($pattern, $replacement, $html, 1, $count);
    if ($count !== 1 || ! is_string($decorated)) {
        throw new RuntimeException("Cannot install deterministic thumbnail sample for {$blockId}");
    }

    return [$decorated, count($sample['items'])];
};

$presetsByBlock = [];
foreach ($manifest['presets'] as $preset) {
    if (! is_array($preset) || ! is_string($preset['block_id'] ?? null) || ! is_array($preset['props'] ?? null)) {
        throw new RuntimeException('Built-in preset contract is invalid.');
    }
    $presetsByBlock[$preset['block_id']] ??= $preset;
}

$compatibilityPropsByBlock = [
    'content.hero-split-01' => [
        'eyebrow' => '기존 문서 호환',
        'title' => '기존 분할 히어로도 안전하게 렌더링됩니다',
        'body' => '<p>새 문서에서는 히어로 블록의 분할 레이아웃을 사용합니다.</p>',
        'primaryCta' => ['label' => '자세히 보기', 'url' => '/'],
        'image' => [
            'src' => '/modules/jiwonpapa-page_builder/store/previews/company-launch-hero.webp',
            'alt' => '기존 분할 히어로 호환 이미지',
        ],
        'mediaPosition' => 'right',
        'layout' => 'screenshot',
    ],
];

$catalog = [];
foreach ($manifest['blocks'] as $index => $definition) {
    if (! is_array($definition)
        || ! is_string($definition['block_id'] ?? null)
        || ! is_int($definition['block_version'] ?? null)
        || ! is_array($definition['capabilities'] ?? null)) {
        throw new RuntimeException('Built-in block definition is invalid.');
    }
    $blockId = $definition['block_id'];
    $preset = $presetsByBlock[$blockId] ?? null;
    $props = is_array($preset)
        ? $preset['props']
        : ($compatibilityPropsByBlock[$blockId] ?? null);
    if (! is_array($props)
        || ($preset === null && ! in_array('editor.compatibility-only', $definition['capabilities'], true))) {
        throw new RuntimeException("Active built-in block requires a canonical thumbnail preset: {$blockId}");
    }
    $catalog[] = [
        'catalog_id' => 'block:'.$blockId.'@'.$definition['block_version'],
        'filename' => sprintf('block-%02d-%s.png', $index + 1, $slugify((string) ($definition['editor_component'] ?? $definition['block_id']))),
        'block_id' => $blockId,
        'block_version' => $definition['block_version'],
        'props' => $props,
    ];
}
foreach ($manifest['presets'] as $index => $preset) {
    $catalog[] = [
        'catalog_id' => 'preset:'.$manifest['pack_id'].':'.$preset['preset_id'],
        'filename' => sprintf('preset-%02d-%s.png', $index + 1, $slugify($preset['preset_id'])),
        'block_id' => $preset['block_id'],
        'block_version' => $preset['block_version'],
        'props' => $preset['props'],
    ];
}

$availableIds = array_column($catalog, 'catalog_id');
if ($requestedIds !== null && array_diff($requestedIds, $availableIds) !== []) {
    throw new RuntimeException('Unknown renderer IDs: '.implode(', ', array_diff($requestedIds, $availableIds)));
}
$index = [];
foreach ($catalog as $position => $item) {
    // Keep the original position: stable identities must not change for a scoped render.
    if ($requestedIds !== null && ! in_array($item['catalog_id'], $requestedIds, true)) {
        continue;
    }
    $document = PageBuilderDocument::fromArray([
        'schema_version' => 'g7-page-builder/v1',
        'document_id' => sprintf('20000000-0000-4000-8000-%012d', $position + 1),
        'slug' => 'block-thumbnail-'.($position + 1),
        'mode' => 'canvas',
        'locale' => 'ko',
        'tokens' => [
            'design.color_mode' => 'light',
            'design.palette' => 'blue',
            'design.font' => 'system',
            'design.radius' => 'soft',
            'design.width' => 'standard',
            'design.scale' => 'balanced',
        ],
        'shell_mode' => 'none',
        'blocks' => [[
            'instance_id' => sprintf('30000000-0000-4000-8000-%012d', $position + 1),
            'type' => $item['block_id'],
            'block_version' => $item['block_version'],
            'props' => $item['props'],
            'slots' => [],
        ]],
    ]);
    $artifact = $compiler->compile($document, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
    $artifactHtml = $artifact->artifact;
    [$artifactHtml, $dynamicSampleCount] = $decorateDynamicThumbnail($item['block_id'], $artifactHtml);
    $artifactSourceHtml = $artifactHtml;
    $artifactHtml = str_replace(
        '/modules/jiwonpapa-page_builder/store/previews/',
        'file://'.$root.'/resources/store/dist/previews/',
        $artifactHtml,
    );
    $html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        .'<style>html,body{margin:0;background:#f6f7f9}*{box-sizing:border-box}body{width:960px;overflow:hidden}.g7pb-thumbnail-stage{width:960px;background:#fff}'.$css.'</style>'
        .'</head><body><main class="g7pb-public-shell g7pb-theme-mode-light g7pb-theme-palette-blue g7pb-theme-font-system g7pb-theme-radius-soft g7pb-theme-width-standard g7pb-theme-scale-balanced"><div class="g7pb-thumbnail-stage">'
        .$artifactHtml.'</div></main></body></html>';
    $fixtureName = str_replace('.png', '.html', $item['filename']);
    if (file_put_contents($output.'/'.$fixtureName, $html, LOCK_EX) === false) {
        throw new RuntimeException("Cannot write thumbnail fixture: {$fixtureName}");
    }
    $index[] = [
        'catalog_id' => $item['catalog_id'],
        'filename' => $item['filename'],
        'fixture' => $fixtureName,
        'source_hash' => hash('sha256', $item['catalog_id']."\n".json_encode($item['props'], JSON_THROW_ON_ERROR)."\n".$artifactSourceHtml."\n".hash('sha256', $css)),
        'dynamic_sample_count' => $dynamicSampleCount,
        'evidence_version' => 'g7pb-render-fixture-evidence/v1',
        'semantic_hash' => hash('sha256', $item['catalog_id']."\n".json_encode($item['props'], JSON_THROW_ON_ERROR)."\n".$artifactSourceHtml),
        'public_css_hash' => hash('sha256', $css),
        'asset_urls' => $collectEvidenceAssets($artifactSourceHtml),
    ];
}

file_put_contents(
    $output.'/index.json',
    json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n",
    LOCK_EX,
);

fwrite(STDOUT, sprintf("Rendered %d block thumbnail fixtures.\n", count($index)));
