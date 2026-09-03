<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockRuntimeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BuiltInBlockCompilers;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BuiltInBlockTypes;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\TemplateMarkupPolicy;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDesignTokens;

final class HtmlDocumentCompiler implements DocumentCompilerPort
{
    public const COMPILER_VERSION = '0.19.0';

    public const TARGET_ENGINE_VERSION = 'g7-7.0.7';

    private BlockCompilerRegistry $blockCompilers;

    private readonly BlockPropertyReader $properties;

    private readonly BlockRuntimeCompiler $runtime;

    private readonly HtmlEscaper $escaper;

    private readonly TemplateMarkupPolicy $templateMarkup;

    public function __construct(
        private readonly BlockRegistry $blockRegistry,
        ?BlockCompilerRegistry $blockCompilers = null,
        private readonly ?BlockSchemaRegistry $blockSchemas = null,
        private readonly ?BlockPackAssetUrlPort $blockAssets = null,
        private readonly DocumentThemeCompiler $theme = new DocumentThemeCompiler,
        private readonly CompilationUrlPolicy $urls = new CompilationUrlPolicy,
        private readonly ElementAppearanceCompiler $elementAppearances = new ElementAppearanceCompiler,
        ?RichTextSanitizer $richText = null,
    ) {
        $this->blockCompilers = $blockCompilers ?? new BlockCompilerRegistry;
        $resolvedRichText = $richText ?? new RichTextSanitizer($this->urls);
        $this->properties = new BlockPropertyReader($resolvedRichText);
        $this->escaper = new HtmlEscaper;
        $appearance = new BlockAppearanceCompiler($this->properties);
        $markup = new BlockMarkupCompiler($this->properties, $this->urls, $resolvedRichText, $this->escaper);
        $icons = new BlockIconCompiler($this->escaper);
        $this->runtime = new BlockRuntimeCompiler($this->properties, $this->escaper);
        $this->templateMarkup = new TemplateMarkupPolicy;
        (new BuiltInBlockCompilers(
            $this->properties,
            $appearance,
            $markup,
            $this->urls,
            $icons,
            $this->escaper,
            $resolvedRichText,
        ))->registerDefaults($this->blockCompilers);
    }

    public function compile(
        PageBuilderDocument $document,
        int $sourceRevision,
        string $targetFormat,
        string $targetEngineVersion,
    ): CompileResult {
        if (! $this->supports($targetFormat, $targetEngineVersion)) {
            throw new DocumentCompileException('The requested compiler target is not supported.');
        }

        if (! in_array($document->schemaVersion, ['g7-page-builder/v1', 'g7-page-builder/v2'], true)) {
            throw new DocumentCompileException('The page document schema is not supported.');
        }

        try {
            $design = PageDesignTokens::fromArray($document->tokens);
        } catch (\InvalidArgumentException $exception) {
            throw new DocumentCompileException($exception->getMessage());
        }

        $heroCount = 0;
        $headingAnchors = [];
        $sections = [];
        $styleUrls = [];

        foreach ($document->blocks as $index => $block) {
            $sections[] = $this->compileBlock(
                $block,
                "Block {$index}",
                $document,
                $heroCount,
                $headingAnchors,
                $styleUrls,
            );
        }

        $styles = array_map(
            fn (string $url): string => '<link rel="stylesheet" href="'.$this->escaper->escapeAttribute($url).'">',
            array_keys($styleUrls),
        );
        $customPaletteStyle = $this->theme->customPaletteDeclarations($design);
        $body = '<div class="'.$this->theme->className($design).'"'.($customPaletteStyle === '' ? '' : ' style="'.$this->escaper->escapeAttribute($customPaletteStyle).'"').'>'."\n"
            .implode("\n", $sections)."\n"
            .'</div>';
        $artifact = implode("\n", [...$styles, $body]);
        $this->templateMarkup->assertTemplateCompatibleMarkup($artifact, 'Compiled document');
        $warnings = $heroCount > 1
            ? ["Hero 계열 블록이 {$heroCount}개 있습니다. 첫 화면 집중도가 낮아질 수 있습니다."]
            : [];

        return new CompileResult(
            compilerVersion: self::COMPILER_VERSION,
            documentId: $document->documentId,
            sourceRevision: $sourceRevision,
            targetFormat: 'html',
            targetEngineVersion: self::TARGET_ENGINE_VERSION,
            artifact: $artifact,
            artifactSha256: hash('sha256', $artifact),
            warnings: $warnings,
        );
    }

    /**
     * @param  array<string, mixed>  $block
     * @param  array<string, bool>  $headingAnchors
     * @param  array<string, bool>  $styleUrls
     */
    private function compileBlock(
        array $block,
        string $path,
        PageBuilderDocument $document,
        int &$heroCount,
        array &$headingAnchors,
        array &$styleUrls,
    ): string {
        $type = $block['type'] ?? null;
        $version = $block['block_version'] ?? null;
        $instanceId = $block['instance_id'] ?? null;
        $props = $block['props'] ?? null;
        $slots = $block['slots'] ?? [];

        if (! is_string($instanceId) || ! $this->isUuid($instanceId)) {
            throw new DocumentCompileException("{$path} has an invalid instance id.");
        }
        if (! is_string($type) || ! is_int($version) || ! is_array($props) || ! is_array($slots)) {
            throw new DocumentCompileException("{$path} has an invalid version, props, or slots value.");
        }

        if (in_array($type, [BuiltInBlockTypes::LAYOUT_SECTION_TYPE, BuiltInBlockTypes::LAYOUT_COLUMNS_TYPE, BuiltInBlockTypes::LAYOUT_STACK_TYPE], true)) {
            $compiled = $this->compileLayoutBlock(
                $type,
                $version,
                $props,
                $slots,
                $path,
                $document,
                $heroCount,
                $headingAnchors,
                $styleUrls,
            );

            return $this->runtime->compile(
                $compiled,
                $instanceId,
                $type,
                $block['motion'] ?? null,
                $block['visibility'] ?? null,
                $block['responsive'] ?? null,
                $type === BuiltInBlockTypes::LAYOUT_STACK_TYPE ? 'div' : 'section',
            );
        }

        if ($slots !== []) {
            throw new DocumentCompileException("{$path} uses slots that are not supported by this block.");
        }

        $definition = $this->blockRegistry->definition($type, $version);
        if ($definition === null || ! $this->blockCompilers->has($definition->compiler)) {
            throw new DocumentCompileException("{$path} has an unsupported type or compiler.");
        }
        if (in_array($type, [BuiltInBlockTypes::HERO_TYPE, BuiltInBlockTypes::HERO_SPLIT_TYPE, BuiltInBlockTypes::HERO_SLIDER_TYPE], true)) {
            $heroCount++;
        }
        if ($type === BuiltInBlockTypes::HEADING_TYPE && is_string($props['anchor'] ?? null) && $props['anchor'] !== '') {
            if (isset($headingAnchors[$props['anchor']])) {
                throw new DocumentCompileException("Heading anchor {$props['anchor']} is duplicated.");
            }
            $headingAnchors[$props['anchor']] = true;
        }
        if ($definition->packId !== 'jiwonpapa/builtin-core' && $this->blockAssets !== null) {
            foreach ($this->blockAssets->styleUrls($definition->packId, $definition->packVersion) as $styleUrl) {
                $styleUrls[$styleUrl] = true;
            }
        }

        try {
            if ($definition->packId !== 'jiwonpapa/builtin-core') {
                if ($this->blockSchemas === null || ! $this->blockSchemas->has($definition->schemaRef)) {
                    throw new \DomainException('Block schema validator is not registered.');
                }
                $this->blockSchemas->validate($definition->schemaRef, $props);
            }
            $compiled = str_replace(
                '__G7PB_PAGE_SLUG__',
                rawurlencode($document->slug),
                $this->blockCompilers->compile($definition->compiler, $props),
            );
            $compiled = $this->elementAppearances->apply($compiled, $props, $type);
            $this->templateMarkup->assertTemplateCompatibleMarkup($compiled, $path);
        } catch (DocumentCompileException $exception) {
            throw $exception;
        } catch (\Throwable) {
            throw new DocumentCompileException("{$path} failed schema validation or compilation.", 'G7PB_BLOCK_RUNTIME_FAILED');
        }

        return $this->runtime->compile($compiled, $instanceId, $type, $block['motion'] ?? null, $block['visibility'] ?? null, $block['responsive'] ?? null);
    }

    /**
     * @param  array<string, mixed>  $props
     * @param  array<string, list<array<string, mixed>>>  $slots
     * @param  array<string, bool>  $headingAnchors
     * @param  array<string, bool>  $styleUrls
     */
    private function compileLayoutBlock(
        string $type,
        int $version,
        array $props,
        array $slots,
        string $path,
        PageBuilderDocument $document,
        int &$heroCount,
        array &$headingAnchors,
        array &$styleUrls,
    ): string {
        if ($version !== 1 || $document->schemaVersion !== 'g7-page-builder/v2') {
            throw new DocumentCompileException("{$path} has an unsupported layout version.");
        }

        if ($type === BuiltInBlockTypes::LAYOUT_SECTION_TYPE) {
            $this->properties->assertOnlyKeys($props, ['width', 'spacing'], $path);
            $width = $this->properties->requiredString($props, 'width', 16);
            $spacing = $this->properties->requiredString($props, 'spacing', 16);
            if (! in_array($width, ['standard', 'wide', 'full'], true)
                || ! in_array($spacing, ['compact', 'normal', 'spacious'], true)
                || array_diff(array_keys($slots), ['content']) !== []) {
                throw new DocumentCompileException("{$path} has invalid Section properties or slots.");
            }
            $content = $this->compileLayoutSlot($slots['content'] ?? [], $path.'.content', $document, $heroCount, $headingAnchors, $styleUrls);

            return '<section class="g7pb-layout-section g7pb-layout-section--'.$width.' g7pb-layout-section--'.$spacing.'" data-testid="page-builder-rendered-layout" data-block-type="layout-section"><div class="g7pb-layout-section__inner">'.$content.'</div></section>';
        }

        if ($type === BuiltInBlockTypes::LAYOUT_STACK_TYPE) {
            $this->properties->assertOnlyKeys($props, ['gap'], $path);
            $gap = $this->properties->requiredString($props, 'gap', 16);
            if (! in_array($gap, ['none', 'compact', 'normal', 'spacious'], true)
                || array_diff(array_keys($slots), ['content']) !== []) {
                throw new DocumentCompileException("{$path} has invalid Stack properties or slots.");
            }
            $content = $this->compileLayoutSlot($slots['content'] ?? [], $path.'.content', $document, $heroCount, $headingAnchors, $styleUrls);

            return '<div class="g7pb-layout-stack g7pb-layout-stack--gap-'.$gap.'" data-testid="page-builder-rendered-layout" data-block-type="layout-stack">'.$content.'</div>';
        }

        $this->properties->assertOnlyKeys($props, ['columns', 'ratio', 'gap'], $path);
        $columns = $props['columns'] ?? null;
        $ratio = $this->properties->requiredString($props, 'ratio', 16);
        $gap = $this->properties->requiredString($props, 'gap', 16);
        $ratios = [1 => ['1'], 2 => ['1:1', '1:2', '2:1'], 3 => ['1:1:1']];
        $expectedSlots = is_int($columns) && isset($ratios[$columns])
            ? array_map(static fn (int $column): string => 'column'.$column, range(1, $columns))
            : [];
        if (! is_int($columns)
            || ! isset($ratios[$columns])
            || ! in_array($ratio, $ratios[$columns], true)
            || ! in_array($gap, ['none', 'compact', 'normal', 'spacious'], true)
            || array_diff(array_keys($slots), $expectedSlots) !== []) {
            throw new DocumentCompileException("{$path} has invalid Columns properties or slots.");
        }
        $columnsMarkup = [];
        foreach (range(1, $columns) as $column) {
            $slotName = 'column'.$column;
            $content = $this->compileLayoutSlot($slots[$slotName] ?? [], $path.'.'.$slotName, $document, $heroCount, $headingAnchors, $styleUrls);
            $columnsMarkup[] = '<div class="g7pb-layout-columns__column" data-g7pb-layout-column="'.$column.'">'.$content.'</div>';
        }

        return '<section class="g7pb-layout-columns g7pb-layout-columns--'.str_replace(':', '-', $ratio).' g7pb-layout-columns--gap-'.$gap.'" data-testid="page-builder-rendered-layout" data-block-type="layout-columns">'.implode('', $columnsMarkup).'</section>';
    }

    /**
     * @param  array<int, mixed>  $children
     * @param  array<string, bool>  $headingAnchors
     * @param  array<string, bool>  $styleUrls
     */
    private function compileLayoutSlot(
        array $children,
        string $path,
        PageBuilderDocument $document,
        int &$heroCount,
        array &$headingAnchors,
        array &$styleUrls,
    ): string {
        $compiled = [];
        foreach ($children as $index => $child) {
            if (! is_array($child)) {
                throw new DocumentCompileException("{$path}.{$index} is not a block.");
            }
            $compiled[] = $this->compileBlock($child, "{$path}.{$index}", $document, $heroCount, $headingAnchors, $styleUrls);
        }

        return implode('', $compiled);
    }

    public function supports(string $targetFormat, string $targetEngineVersion): bool
    {
        return $targetFormat === 'html' && $targetEngineVersion === self::TARGET_ENGINE_VERSION;
    }

    private function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }
}
