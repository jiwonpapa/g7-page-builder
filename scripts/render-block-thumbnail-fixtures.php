<?php

declare(strict_types=1);

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;

require dirname(__DIR__).'/vendor/autoload.php';

$root = dirname(__DIR__);
$output = $argv[1] ?? $root.'/output/block-thumbnail-fixtures';
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
$css = (string) file_get_contents($root.'/resources/css/page-builder.css');
$slugify = static function (string $value): string {
    $kebab = preg_replace('/([a-z0-9])([A-Z])/', '$1-$2', $value) ?? $value;

    return trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($kebab)), '-');
};

$presetsByBlock = [];
foreach ($manifest['presets'] as $preset) {
    if (! is_array($preset) || ! is_string($preset['block_id'] ?? null) || ! is_array($preset['props'] ?? null)) {
        throw new RuntimeException('Built-in preset contract is invalid.');
    }
    $presetsByBlock[$preset['block_id']] ??= $preset;
}

$catalog = [];
foreach ($manifest['blocks'] as $index => $definition) {
    if (! is_array($definition)
        || ! is_string($definition['block_id'] ?? null)
        || ! is_int($definition['block_version'] ?? null)
        || ! isset($presetsByBlock[$definition['block_id']])) {
        throw new RuntimeException('Every built-in block requires a canonical thumbnail preset.');
    }
    $preset = $presetsByBlock[$definition['block_id']];
    $catalog[] = [
        'catalog_id' => 'block:'.$definition['block_id'].'@'.$definition['block_version'],
        'filename' => sprintf('block-%02d-%s.png', $index + 1, $slugify((string) ($definition['editor_component'] ?? $definition['block_id']))),
        'block_id' => $definition['block_id'],
        'block_version' => $definition['block_version'],
        'props' => $preset['props'],
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

$index = [];
foreach ($catalog as $position => $item) {
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
    $html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        .'<style>html,body{margin:0;background:#f6f7f9}*{box-sizing:border-box}body{width:960px;overflow:hidden}.g7pb-thumbnail-stage{width:960px;background:#fff}'.$css.'</style>'
        .'</head><body><main class="g7pb-public-shell g7pb-theme-mode-light g7pb-theme-palette-blue g7pb-theme-font-system g7pb-theme-radius-soft g7pb-theme-width-standard g7pb-theme-scale-balanced"><div class="g7pb-thumbnail-stage">'
        .$artifact->artifact.'</div></main></body></html>';
    $fixtureName = str_replace('.png', '.html', $item['filename']);
    if (file_put_contents($output.'/'.$fixtureName, $html, LOCK_EX) === false) {
        throw new RuntimeException("Cannot write thumbnail fixture: {$fixtureName}");
    }
    $index[] = [
        'catalog_id' => $item['catalog_id'],
        'filename' => $item['filename'],
        'fixture' => $fixtureName,
        'source_hash' => hash('sha256', $item['catalog_id']."\n".json_encode($item['props'], JSON_THROW_ON_ERROR)."\n".$artifact->artifact."\n".hash('sha256', $css)),
    ];
}

file_put_contents(
    $output.'/index.json',
    json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n",
    LOCK_EX,
);

fwrite(STDOUT, sprintf("Rendered %d block thumbnail fixtures.\n", count($index)));
