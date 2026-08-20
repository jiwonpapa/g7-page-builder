<?php

declare(strict_types=1);

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\ZipPageKitArchiveAdapter;

require dirname(__DIR__).'/vendor/autoload.php';

$root = dirname(__DIR__);
$baseUrl = rtrim($argv[1] ?? 'https://g7devops.com/modules/jiwonpapa-page_builder/store', '/');
if (filter_var($baseUrl, FILTER_VALIDATE_URL) === false || ! str_starts_with($baseUrl, 'https://')) {
    fwrite(STDERR, "Store base URL must be HTTPS.\n");
    exit(1);
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
foreach (["{$dist}/artifacts", "{$dist}/previews"] as $directory) {
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

$pageDocumentValue = json_decode(
    (string) file_get_contents("{$source}/page-kits/company-launch/document.json"),
    true,
    128,
    JSON_THROW_ON_ERROR,
);
$pageDocument = PageBuilderDocument::fromArray($pageDocumentValue);
$pageKits = new ZipPageKitArchiveAdapter;
$pageArtifact = $pageKits->write(
    'jiwonpapa/company-launch',
    '1.0.0',
    '회사 소개 랜딩',
    '회사 소개, 핵심 성과, 팀 소개와 문의 CTA를 갖춘 시작 페이지입니다.',
    $pageDocument,
    [],
);
$pageArtifactName = 'jiwonpapa-company-launch-1.0.0.zip';
$pageArtifactPath = "{$dist}/artifacts/{$pageArtifactName}";
$copy($pageArtifact->path, $pageArtifactPath);
$pageKits->release($pageArtifact);

$copy("{$packSource}/{$packAssetPath}", "{$dist}/previews/marketing-presets.svg");
$copy("{$source}/previews/company-launch.svg", "{$dist}/previews/company-launch.svg");

$artifact = static function (string $path, string $url): array {
    $bytes = filesize($path);
    $sha256 = hash_file('sha256', $path);
    if (! is_int($bytes) || ! is_string($sha256)) {
        throw new RuntimeException("Cannot inspect {$path}");
    }

    return ['url' => $url, 'sha256' => $sha256, 'bytes' => $bytes];
};

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
        [
            'product_id' => 'jiwonpapa/company-launch',
            'product_type' => 'page_kit',
            'product_version' => '1.0.0',
            'title' => ['ko' => '회사 소개 랜딩', 'en' => 'Company launch page'],
            'description' => ['ko' => '회사 소개, 성과, 팀과 문의 CTA로 구성된 완성 페이지입니다.', 'en' => 'A complete company introduction page.'],
            'category' => 'company',
            'tags' => ['회사소개', '랜딩', '팀', 'CTA'],
            'license' => 'free',
            'compatibility' => ['page_builder' => '>=0.10.0 <1.0.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'preview' => [
                'thumbnail_url' => "{$baseUrl}/previews/company-launch.svg",
                'screenshots' => [],
                'demo_url' => null,
            ],
            'artifact' => $artifact($pageArtifactPath, "{$baseUrl}/artifacts/{$pageArtifactName}"),
            'requirements' => ['blocks' => [
                ['block_id' => 'content.hero-split-01', 'block_version' => 1],
                ['block_id' => 'data.stats-icons-01', 'block_version' => 1],
                ['block_id' => 'company.team-grid-01', 'block_version' => 1],
                ['block_id' => 'content.cta-split-01', 'block_version' => 1],
            ]],
        ],
    ],
];

file_put_contents("{$dist}/catalog.json", $json($catalog), LOCK_EX);
fwrite(STDOUT, 'Built official free store with '.count($catalog['products'])." products.\n");
