<?php

declare(strict_types=1);

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\MediaAsset;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\PortableMedia;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\ZipPageKitArchiveAdapter;

require dirname(__DIR__).'/vendor/autoload.php';

$root = dirname(__DIR__);
$baseUrl = rtrim($argv[1] ?? 'https://g7devops.com/modules/jiwonpapa-page_builder/store', '/');
if (filter_var($baseUrl, FILTER_VALIDATE_URL) === false || ! str_starts_with($baseUrl, 'https://')) {
    fwrite(STDERR, "Store base URL must be HTTPS.\n");
    exit(1);
}
$storeBasePath = parse_url($baseUrl, PHP_URL_PATH);
if (! is_string($storeBasePath) || $storeBasePath === '' || ! str_starts_with($storeBasePath, '/')) {
    throw new RuntimeException('Store base URL path is invalid.');
}
$source = $root.'/resources/store/source';
$dist = $root.'/resources/store/dist';
$catalogMeta = json_decode(
    (string) file_get_contents("{$source}/catalog-meta.json"),
    true,
    32,
    JSON_THROW_ON_ERROR,
);
if (! is_array($catalogMeta)
    || ($catalogMeta['catalog_version'] ?? null) !== 'g7pb-store/v1'
    || ($catalogMeta['publisher']['id'] ?? null) !== 'jiwonpapa'
    || ! is_string($catalogMeta['generated_at'] ?? null)) {
    throw new RuntimeException('Official Store catalog metadata is invalid.');
}
try {
    $generatedAt = new DateTimeImmutable($catalogMeta['generated_at']);
} catch (Throwable) {
    throw new RuntimeException('Official Store catalog generated_at is invalid.');
}
if ($generatedAt->format(DATE_ATOM) !== $catalogMeta['generated_at']) {
    throw new RuntimeException('Official Store catalog generated_at must use DATE_ATOM.');
}
foreach (["{$dist}/artifacts", "{$dist}/demos", "{$dist}/previews"] as $directory) {
    if (! is_dir($directory) && ! mkdir($directory, 0755, true) && ! is_dir($directory)) {
        throw new RuntimeException("Cannot create {$directory}");
    }
}

$json = static function (array $value): string {
    return json_encode($value, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";
};

$copy = static function (string $from, string $to): void {
    if (! copy($from, $to)) {
        throw new RuntimeException("Cannot copy {$from}");
    }
};

$packSource = "{$source}/block-packs/marketing-presets";
$packManifest = json_decode((string) file_get_contents("{$packSource}/manifest.json"), true, 128, JSON_THROW_ON_ERROR);
$packAssetPath = 'assets/hero-product-launch.svg';
$packAsset = (string) file_get_contents("{$packSource}/{$packAssetPath}");
$packManifest['files'] = [$packAssetPath => hash('sha256', $packAsset)];
$packArtifactName = 'jiwonpapa-marketing-presets-1.0.0.zip';
$packArtifactPath = "{$dist}/artifacts/{$packArtifactName}";
$zip = new ZipArchive;
if ($zip->open($packArtifactPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    throw new RuntimeException('Cannot create Block Pack artifact.');
}
$zip->addFromString('manifest.json', $json($packManifest));
$zip->addFromString($packAssetPath, $packAsset);
$zip->setMtimeName('manifest.json', 315532800);
$zip->setMtimeName($packAssetPath, 315532800);
$zip->close();

$copy("{$packSource}/{$packAssetPath}", "{$dist}/previews/marketing-presets.svg");

$artifact = static function (string $path, string $url): array {
    $bytes = filesize($path);
    $sha256 = hash_file('sha256', $path);
    if (! is_int($bytes) || ! is_string($sha256)) {
        throw new RuntimeException("Cannot inspect {$path}");
    }

    return ['url' => $url, 'sha256' => $sha256, 'bytes' => $bytes];
};

$pageKitDefinitions = [
    [
        'slug' => 'company-launch',
        'title' => ['ko' => '회사 소개 랜딩', 'en' => 'Company launch page'],
        'description' => [
            'ko' => '회사 소개, 일하는 방식, 성과, 팀, 고객 후기와 문의 CTA로 구성된 완성 페이지입니다.',
            'en' => 'A complete company introduction and trust-building page.',
        ],
        'category' => 'company',
        'tags' => ['회사소개', '랜딩', '팀', '고객후기'],
        'media' => 'media/hero-team.webp',
    ],
    [
        'slug' => 'service-conversion',
        'title' => ['ko' => '전문 서비스 상담 랜딩', 'en' => 'Professional service landing'],
        'description' => [
            'ko' => '서비스 가치, 진행 방식, 고객 후기, FAQ와 상담 요청으로 구성된 전환 페이지입니다.',
            'en' => 'A service conversion page with proof, process, FAQ, and inquiry.',
        ],
        'category' => 'services',
        'tags' => ['전문서비스', '상담', '고객후기', 'FAQ'],
        'media' => 'media/hero-consultation.webp',
    ],
    [
        'slug' => 'local-business',
        'title' => ['ko' => '로컬 비즈니스 방문 안내', 'en' => 'Local business visit page'],
        'description' => [
            'ko' => '서비스, 이용 순서, 후기, 위치와 방문 예약을 한 페이지에 안내합니다.',
            'en' => 'A local business page for services, directions, and reservations.',
        ],
        'category' => 'local-business',
        'tags' => ['매장', '예약', '오시는길', '지역서비스'],
        'media' => 'media/hero-space.webp',
    ],
    [
        'slug' => 'event-launch',
        'title' => ['ko' => '컨퍼런스·행사 랜딩', 'en' => 'Conference and event landing'],
        'description' => [
            'ko' => '행사 개요, 일정, 연사, 파트너, FAQ와 참가 신청을 연결합니다.',
            'en' => 'A conference page with agenda, speakers, partners, FAQ, and signup.',
        ],
        'category' => 'events',
        'tags' => ['행사', '컨퍼런스', '일정', '참가신청'],
        'media' => 'media/hero-event.webp',
    ],
    [
        'slug' => 'editorial-community',
        'title' => ['ko' => '에디토리얼·커뮤니티 홈', 'en' => 'Editorial community home'],
        'description' => [
            'ko' => '대표 기사, 지역 일정, 자료와 뉴스레터 신청을 묶은 콘텐츠 홈입니다.',
            'en' => 'An editorial home for stories, events, resources, and newsletter signup.',
        ],
        'category' => 'editorial',
        'tags' => ['에디토리얼', '커뮤니티', '기사', '뉴스레터'],
        'media' => 'media/hero-editorial.webp',
    ],
];

$pageKits = new ZipPageKitArchiveAdapter;
$blockRegistry = new BlockRegistry;
$blockRegistry->register((new BuiltInBlockPackLoader)->load($root), enabled: true);
$compiler = new HtmlDocumentCompiler($blockRegistry);
$pageProducts = [];
foreach ($pageKitDefinitions as $definition) {
    $slug = $definition['slug'];
    $kitSource = "{$source}/page-kits/{$slug}";
    $documentValue = json_decode(
        (string) file_get_contents("{$kitSource}/document.json"),
        true,
        128,
        JSON_THROW_ON_ERROR,
    );
    $document = PageBuilderDocument::fromArray($documentValue);
    $mediaPath = "{$kitSource}/{$definition['media']}";
    $contents = (string) file_get_contents($mediaPath);
    /** @var array<int|string, mixed>|false $image */
    $image = @getimagesizefromstring($contents);
    if ($image === false
        || ! is_int($image[0] ?? null)
        || ! is_int($image[1] ?? null)
        || ! is_string($image['mime'] ?? null)) {
        throw new RuntimeException("Page Kit image is invalid: {$mediaPath}");
    }
    $portableMedia = new PortableMedia(
        new MediaAsset(
            id: "official-{$slug}-hero",
            url: "official-store://{$slug}/{$definition['media']}",
            originalName: basename($mediaPath),
            mimeType: $image['mime'],
            bytes: strlen($contents),
            width: $image[0],
            height: $image[1],
            createdAt: $generatedAt,
        ),
        $contents,
    );
    $pageArtifact = $pageKits->write(
        "jiwonpapa/{$slug}",
        '1.0.0',
        $definition['title']['ko'],
        $definition['description']['ko'],
        $document,
        [$portableMedia],
    );
    $pageArtifactName = "jiwonpapa-{$slug}-1.0.0.zip";
    $pageArtifactPath = "{$dist}/artifacts/{$pageArtifactName}";
    $copy($pageArtifact->path, $pageArtifactPath);
    $pageKits->release($pageArtifact);
    $copy("{$source}/previews/{$slug}.svg", "{$dist}/previews/{$slug}.svg");
    $copy($mediaPath, "{$dist}/previews/{$slug}-hero.webp");

    $screenshotUrls = [];
    foreach (['desktop', 'tablet', 'mobile'] as $viewport) {
        $screenshotName = "{$slug}-{$viewport}.webp";
        $screenshotSource = "{$source}/screenshots/{$screenshotName}";
        if (! is_file($screenshotSource)) {
            throw new RuntimeException("Page Kit screenshot is missing: {$screenshotSource}");
        }
        $copy($screenshotSource, "{$dist}/previews/{$screenshotName}");
        $screenshotUrls[] = "{$baseUrl}/previews/{$screenshotName}";
    }

    $demoValue = $documentValue;
    array_walk_recursive($demoValue, static function (mixed &$value) use ($slug, $storeBasePath): void {
        if (! is_string($value)) {
            return;
        }
        if ($value === 'g7pb-media://image-1') {
            $value = "{$storeBasePath}/previews/{$slug}-hero.webp";
        } elseif ($value === '/' || str_starts_with($value, 'g7pb-route://')) {
            $value = '/demo-action';
        }
    });
    $compiledDemo = $compiler->compile(
        PageBuilderDocument::fromArray($demoValue),
        1,
        'html',
        HtmlDocumentCompiler::TARGET_ENGINE_VERSION,
    );
    $demoHtml = str_replace(
        [
            'method="post" action="/pages/'.rawurlencode($document->slug).'/inquiries"',
            'data-g7pb-inquiry-form',
            '<button type="submit">',
            'href="/demo-action"',
        ],
        [
            'method="get" action="#demo-form"',
            'data-g7pb-demo-form',
            '<button type="button" aria-disabled="true">',
            'href="#demo-action"',
        ],
        (string) $compiledDemo->artifact,
    );
    if (file_put_contents("{$dist}/demos/{$slug}.html", $demoHtml, LOCK_EX) === false) {
        throw new RuntimeException("Cannot write Page Kit demo: {$slug}");
    }

    $requirements = [];
    $seenRequirements = [];
    foreach ($document->blocks as $block) {
        $blockId = $block['type'] ?? null;
        $blockVersion = $block['block_version'] ?? null;
        if (! is_string($blockId) || ! is_int($blockVersion)) {
            throw new RuntimeException("Page Kit block contract is invalid: {$slug}");
        }
        $requirementKey = "{$blockId}@{$blockVersion}";
        if (isset($seenRequirements[$requirementKey])) {
            continue;
        }
        $seenRequirements[$requirementKey] = true;
        $requirements[] = ['block_id' => $blockId, 'block_version' => $blockVersion];
    }

    $pageProducts[] = [
        'product_id' => "jiwonpapa/{$slug}",
        'product_type' => 'page_kit',
        'product_version' => '1.0.0',
        'title' => $definition['title'],
        'description' => $definition['description'],
        'category' => $definition['category'],
        'tags' => $definition['tags'],
        'license' => 'free',
        'compatibility' => ['page_builder' => '>=0.10.0 <1.0.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
        'preview' => [
            'thumbnail_url' => $screenshotUrls[0],
            'screenshots' => $screenshotUrls,
            'demo_url' => "{$baseUrl}/demos/{$slug}",
        ],
        'artifact' => $artifact($pageArtifactPath, "{$baseUrl}/artifacts/{$pageArtifactName}"),
        'requirements' => ['blocks' => $requirements],
    ];
}

$catalog = [
    ...$catalogMeta,
    'products' => [
        [
            'product_id' => 'jiwonpapa/marketing-presets',
            'product_type' => 'block_pack',
            'product_version' => '1.0.0',
            'title' => ['ko' => '마케팅 시작 블록', 'en' => 'Marketing starter blocks'],
            'description' => ['ko' => '제품 출시 Hero와 문의 CTA 프리셋을 즉시 추가합니다.', 'en' => 'Install launch and contact presets.'],
            'category' => 'marketing',
            'tags' => ['히어로', 'CTA', '마케팅'],
            'license' => 'free',
            'compatibility' => ['page_builder' => '>=0.10.0 <1.0.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'preview' => [
                'thumbnail_url' => "{$baseUrl}/previews/marketing-presets.svg",
                'screenshots' => [],
                'demo_url' => null,
            ],
            'artifact' => $artifact($packArtifactPath, "{$baseUrl}/artifacts/{$packArtifactName}"),
            'requirements' => ['blocks' => [
                ['block_id' => 'content.hero-centered-01', 'block_version' => 1],
                ['block_id' => 'content.cta-split-01', 'block_version' => 1],
            ]],
        ],
        ...$pageProducts,
    ],
];

file_put_contents("{$dist}/catalog.json", $json($catalog), LOCK_EX);
fwrite(STDOUT, 'Built official free store with '.count($catalog['products'])." products.\n");
