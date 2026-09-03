<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\CallbackBlockTypeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockRuntimeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BuiltInBlockTypes;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDesignTokens;

final class HtmlDocumentCompiler implements DocumentCompilerPort
{
    public const COMPILER_VERSION = '0.19.0';

    /** @var list<string> */
    private const TEMPLATE_FORBIDDEN_TAGS = [
        'script', 'noscript', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal',
        'form', 'input', 'textarea', 'select', 'option', 'button', 'style', 'meta', 'base',
        'body', 'head', 'html', 'title', 'svg', 'math', 'audio', 'video', 'source', 'track', 'canvas',
        'details', 'dialog', 'plaintext', 'xmp', 'listing', 'marquee', 'noframes', 'noembed', 'template', 'slot',
    ];

    public const TARGET_ENGINE_VERSION = 'g7-7.0.7';

    /** @var list<string> */
    private const FEATURE_ICONS = [
        'bolt',
        'check',
        'code',
        'globe',
        'heart',
        'layers',
        'mobile',
        'palette',
        'shield',
        'sparkles',
        'star',
    ];

    /** @var array<string, string> */
    private const CATALOG_ICON_MARKUP = [
        'bolt' => '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"></path>',
        'check' => '<path d="M20 6 9 17l-5-5"></path>',
        'code' => '<path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path>',
        'globe' => '<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"></path><path d="M7 3.34V5a3 3 0 0 0 3 3 2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"></path><path d="M11 21.95V18a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"></path><circle cx="12" cy="12" r="10"></circle>',
        'heart' => '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>',
        'layers' => '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"></path><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"></path><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"></path>',
        'mobile' => '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>',
        'palette' => '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"></path><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>',
        'shield' => '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path>',
        'sparkles' => '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle>',
        'star' => '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>',
        'trend' => '<path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path>',
        'users' => '<path d="M18 21a8 8 0 0 0-16 0"></path><circle cx="10" cy="8" r="5"></circle><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"></path>',
        'target' => '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
        'chart' => '<path d="M5 21v-6"></path><path d="M12 21V9"></path><path d="M19 21V3"></path>',
        'camera' => '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle>',
        'play' => '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"></path>',
        'briefcase' => '<path d="M12 12h.01"></path><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M22 13a18.15 18.15 0 0 1-20 0"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect>',
        'at-sign' => '<circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"></path>',
        'message' => '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path>',
        'rss' => '<path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle>',
        'external-link' => '<path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
    ];

    private BlockCompilerRegistry $blockCompilers;

    private readonly RichTextSanitizer $richText;

    private readonly BlockPropertyReader $properties;

    private readonly BlockRuntimeCompiler $runtime;

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
        $this->richText = $richText ?? new RichTextSanitizer($this->urls);
        $this->properties = new BlockPropertyReader($this->richText);
        $this->runtime = new BlockRuntimeCompiler($this->properties);
        $this->registerBuiltInCompilers();
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
            fn (string $url): string => '<link rel="stylesheet" href="'.$this->escapeAttribute($url).'">',
            array_keys($styleUrls),
        );
        $customPaletteStyle = $this->theme->customPaletteDeclarations($design);
        $body = '<div class="'.$this->theme->className($design).'"'.($customPaletteStyle === '' ? '' : ' style="'.$this->escapeAttribute($customPaletteStyle).'"').'>'."\n"
            .implode("\n", $sections)."\n"
            .'</div>';
        $artifact = implode("\n", [...$styles, $body]);
        $this->assertTemplateCompatibleMarkup($artifact, 'Compiled document');
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
            $this->assertTemplateCompatibleMarkup($compiled, $path);
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

    private function registerBuiltInCompilers(): void
    {
        /** @var array<string, \Closure(array<string, mixed>): string> $compilers */
        $compilers = [
            'builtin.hero-centered-01' => fn (array $props): string => $this->compileHero($props),
            'builtin.features-grid-01' => fn (array $props): string => $this->compileFeatures($props),
            'builtin.cta-split-01' => fn (array $props): string => $this->compileCta($props),
            'builtin.contact-info-01' => fn (array $props): string => $this->compileContact($props),
            'builtin.hero-split-01' => fn (array $props): string => $this->compileHeroSplit($props),
            'builtin.hero-slider-01' => fn (array $props): string => $this->compileHeroSlider($props),
            'builtin.logo-cloud-01' => fn (array $props): string => $this->compileLogoCloud($props),
            'builtin.stats-icons-01' => fn (array $props): string => $this->compileStats($props),
            'builtin.pricing-tiers-01' => fn (array $props): string => $this->compilePricing($props),
            'builtin.team-grid-01' => fn (array $props): string => $this->compileTeam($props),
            'builtin.gallery-grid-01' => fn (array $props): string => $this->compileGallery($props),
            'builtin.bar-chart-01' => fn (array $props): string => $this->compileBarChart($props),
            'builtin.g7-board-recent-posts-01' => fn (array $props): string => $this->compileG7RecentPosts($props),
            'builtin.g7-ecommerce-product-grid-01' => fn (array $props): string => $this->compileG7ProductGrid($props),
            'builtin.inquiry-form-01' => fn (array $props): string => $this->compileInquiryForm($props),
            'builtin.map-directions-01' => fn (array $props): string => $this->compileMapDirections($props),
            'builtin.testimonials-01' => fn (array $props): string => $this->compileTestimonials($props),
            'builtin.faq-accordion-01' => fn (array $props): string => $this->compileFaqAccordion($props),
            'builtin.process-timeline-01' => fn (array $props): string => $this->compileProcessTimeline($props),
            'builtin.tabs-01' => fn (array $props): string => $this->compileTabs($props),
            'builtin.comparison-table-01' => fn (array $props): string => $this->compileComparisonTable($props),
            'builtin.article-list-01' => fn (array $props): string => $this->compileArticleList($props),
            'builtin.video-embed-01' => fn (array $props): string => $this->compileVideoEmbed($props),
            'builtin.logo-carousel-01' => fn (array $props): string => $this->compileLogoCarousel($props),
            'builtin.testimonial-slider-01' => fn (array $props): string => $this->compileTestimonialSlider($props),
            'builtin.event-schedule-01' => fn (array $props): string => $this->compileEventSchedule($props),
            'builtin.download-resources-01' => fn (array $props): string => $this->compileDownloadResources($props),
            'builtin.g7-board-content-archive-01' => fn (array $props): string => $this->compileG7BoardArchive($props),
            'builtin.g7-ecommerce-product-showcase-01' => fn (array $props): string => $this->compileG7ProductShowcase($props),
            'builtin.g7-board-post-detail-01' => fn (array $props): string => $this->compileG7PostDetail($props),
            'builtin.g7-ecommerce-product-detail-01' => fn (array $props): string => $this->compileG7ProductDetail($props),
            'builtin.heading-01' => fn (array $props): string => $this->compileHeading($props),
            'builtin.rich-text-01' => fn (array $props): string => $this->compileRichText($props),
            'builtin.image-01' => fn (array $props): string => $this->compileImage($props),
            'builtin.buttons-01' => fn (array $props): string => $this->compileButtons($props),
            'builtin.image-text-01' => fn (array $props): string => $this->compileImageText($props),
            'builtin.icon-list-01' => fn (array $props): string => $this->compileIconList($props),
            'builtin.divider-01' => fn (array $props): string => $this->compileDivider($props),
            'builtin.blockquote-01' => fn (array $props): string => $this->compileBlockquote($props),
            'builtin.notice-01' => fn (array $props): string => $this->compileNotice($props),
            'builtin.card-grid-01' => fn (array $props): string => $this->compileCardGrid($props),
            'builtin.breadcrumbs-01' => fn (array $props): string => $this->compileBreadcrumbs($props),
            'builtin.anchor-menu-01' => fn (array $props): string => $this->compileAnchorMenu($props),
            'builtin.social-links-01' => fn (array $props): string => $this->compileSocialLinks($props),
            'builtin.image-carousel-01' => fn (array $props): string => $this->compileImageCarousel($props),
        ];

        foreach ($compilers as $key => $compiler) {
            if (! $this->blockCompilers->has($key)) {
                $this->blockCompilers->register(new CallbackBlockTypeCompiler($key, $compiler));
            }
        }
    }

    /** @param array<string, mixed> $props */
    private function compileHeading(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'level', 'anchor', 'appearance'], 'Heading');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $level = $this->properties->requiredIntegerChoice($props, 'level', [2, 3, 4]);
        $anchor = $this->properties->optionalString($props, 'anchor', 80) ?? '';
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if ($anchor !== '' && preg_match('/^[a-z][a-z0-9-]{0,79}$/D', $anchor) !== 1) {
            throw new DocumentCompileException('Heading anchor is invalid.');
        }
        $eyebrowMarkup = $eyebrow === null || $eyebrow === ''
            ? ''
            : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
        $anchorAttribute = $anchor === '' ? '' : ' id="'.$this->escapeAttribute($anchor).'"';

        return '<section class="g7pb-block g7pb-heading-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="heading">'
            .$eyebrowMarkup.'<h'.$level.' class="g7pb-heading-block__heading"'.$anchorAttribute.'>'.$this->richText->sanitizeInlineRichText($heading).'</h'.$level.'></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileRichText(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['content', 'measure', 'appearance'], 'Rich text');
        $content = $this->properties->requiredString($props, 'content', 20000);
        $measure = $this->properties->requiredString($props, 'measure', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($measure, ['narrow', 'standard', 'wide'], true)) {
            throw new DocumentCompileException('Rich text measure is invalid.');
        }

        return '<section class="g7pb-block g7pb-rich-text '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="rich-text"><div class="g7pb-rich-text__content g7pb-rich-text__content--'.$measure.'">'.$this->richText->sanitizeRichText($content).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileImage(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['src', 'alt', 'caption', 'linkUrl', 'aspectRatio', 'appearance'], 'Image');
        $src = $this->properties->optionalString($props, 'src', 2048) ?? '';
        $alt = $this->properties->optionalString($props, 'alt', 300) ?? '';
        $caption = $this->properties->optionalString($props, 'caption', 500) ?? '';
        $linkUrl = $this->properties->optionalString($props, 'linkUrl', 2048) ?? '';
        $aspectRatio = $this->properties->requiredString($props, 'aspectRatio', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($aspectRatio, ['auto', '16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Image aspect ratio is invalid.');
        }
        $media = $this->compileCatalogImage($src, $alt, 'g7pb-image-block__image', '이미지를 선택하세요');
        if ($linkUrl !== '') {
            $this->urls->assertAllowedUrl($linkUrl, 'Image link');
            $media = '<a class="g7pb-image-block__link" href="'.$this->escapeAttribute($linkUrl).'">'.$media.'</a>';
        }
        $captionMarkup = $caption === '' ? '' : '<figcaption>'.$this->escape($caption).'</figcaption>';

        return '<section class="g7pb-block g7pb-image-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image"><figure class="g7pb-image-block__figure g7pb-image-block__figure--'.str_replace(':', '-', $aspectRatio).'">'.$media.$captionMarkup.'</figure></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileButtons(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['items', 'alignment', 'appearance'], 'Buttons');
        $items = $props['items'] ?? null;
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! is_array($items) || count($items) < 1 || count($items) > 3) {
            throw new DocumentCompileException('Buttons must contain between one and three items.');
        }
        if (! in_array($alignment, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Button alignment is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Button item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'url', 'variant'], "Button item {$index}");
            $label = $this->properties->requiredString($item, 'label', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            $variant = $this->properties->requiredString($item, 'variant', 16);
            if (! in_array($variant, ['primary', 'secondary', 'text'], true)) {
                throw new DocumentCompileException("Button item {$index} variant is invalid.");
            }
            $this->urls->assertAllowedUrl($url, "Button item {$index}");
            $compiled[] = '<a class="g7pb-button g7pb-button--'.$variant.'" href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a>';
        }

        return '<section class="g7pb-block g7pb-buttons '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="buttons"><div class="g7pb-buttons__items g7pb-buttons__items--'.$alignment.'" role="group" aria-label="페이지 행동">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileImageText(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'body', 'image', 'mediaPosition', 'primaryLink', 'appearance'], 'Image text');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $body = $this->properties->optionalString($props, 'body', 10000) ?? '';
        $image = $this->properties->optionalMap($props, 'image');
        $mediaPosition = $this->properties->requiredString($props, 'mediaPosition', 16);
        $primaryLink = $this->properties->optionalMap($props, 'primaryLink');
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if ($image === null) {
            throw new DocumentCompileException('Image text image is required.');
        }
        $this->properties->assertOnlyKeys($image, ['src', 'alt'], 'Image text image');
        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Image text media position is invalid.');
        }
        $src = $this->properties->optionalString($image, 'src', 2048) ?? '';
        $alt = $this->properties->optionalString($image, 'alt', 300) ?? '';
        $media = '<figure class="g7pb-image-text__media">'.$this->compileCatalogImage($src, $alt, 'g7pb-image-text__image', '대표 이미지를 선택하세요').'</figure>';
        $copy = '<div class="g7pb-image-text__copy">'.($eyebrow === null || $eyebrow === '' ? '' : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>')
            .'<h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2>'.($body === '' ? '' : '<div class="g7pb-image-text__body">'.$this->richText->sanitizeRichText($body).'</div>')
            .($primaryLink === null ? '' : $this->compileActionLink($primaryLink, 'Image text primary link', 'g7pb-button g7pb-button--primary')).'</div>';
        $content = $media.$copy;

        return '<section class="g7pb-block g7pb-image-text g7pb-image-text--'.$mediaPosition.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-text">'.$content.'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileIconList(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Icon list');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 24);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Icon list must contain between two and eight items.');
        }
        if (! in_array($layout, ['single', 'two-column'], true)) {
            throw new DocumentCompileException('Icon list layout is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Icon list item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['icon', 'title', 'body'], "Icon list item {$index}");
            $icon = $this->properties->requiredString($item, 'icon', 32);
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->properties->optionalRichTextString($item, 'body', 2000) ?? '';
            if (! in_array($icon, self::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Icon list item {$index} uses an unsupported icon.");
            }
            $bodyMarkup = $this->richText->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-icon-list__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $compiled[] = '<li class="g7pb-icon-list__item">'.$this->catalogIconSvg($icon, 'g7pb-icon-list__icon g7pb-icon--'.$icon).'<div><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.'</div></li>';
        }

        return '<section class="g7pb-block g7pb-icon-list g7pb-icon-list--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="icon-list">'.$this->compileSectionHeading($eyebrow, $heading).'<ul class="g7pb-icon-list__items">'.implode('', $compiled).'</ul></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileDivider(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['variant', 'width', 'label', 'appearance'], 'Divider');
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $width = $this->properties->requiredString($props, 'width', 16);
        $label = $this->properties->optionalString($props, 'label', 120) ?? '';
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! in_array($variant, ['solid', 'dashed', 'gradient'], true)) {
            throw new DocumentCompileException('Divider variant is invalid.');
        }
        if (! in_array($width, ['narrow', 'standard', 'full'], true)) {
            throw new DocumentCompileException('Divider width is invalid.');
        }
        $labelMarkup = $label === '' ? '' : '<span class="g7pb-divider__label">'.$this->escape($label).'</span>';

        return '<section class="g7pb-block g7pb-divider g7pb-divider--'.$variant.' g7pb-divider--'.$width.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="divider"><span class="g7pb-divider__line" aria-hidden="true"></span>'.$labelMarkup.'<span class="g7pb-divider__line" aria-hidden="true"></span></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileBlockquote(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['quote', 'citation', 'role', 'alignment', 'variant', 'appearance'], 'Blockquote');
        $quote = $this->properties->requiredString($props, 'quote', 2000);
        $citation = $this->properties->requiredString($props, 'citation', 120);
        $role = $this->properties->optionalString($props, 'role', 160) ?? '';
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($alignment, ['left', 'center'], true) || ! in_array($variant, ['line', 'mark'], true)) {
            throw new DocumentCompileException('Blockquote alignment or variant is invalid.');
        }
        $roleMarkup = $role === '' ? '' : '<span class="g7pb-blockquote__role">'.$this->escape($role).'</span>';

        $quoteMarkup = $this->richText->hasRichTextMarkup($quote)
            ? '<div class="g7pb-blockquote__quote">'.$this->richText->sanitizeRichText($quote).'</div>'
            : '<p class="g7pb-blockquote__quote">'.$this->formatText($quote).'</p>';

        return '<section class="g7pb-block g7pb-blockquote g7pb-blockquote--'.$alignment.' g7pb-blockquote--'.$variant.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="blockquote"><blockquote>'.$quoteMarkup.'<footer><cite>'.$this->escape($citation).'</cite>'.$roleMarkup.'</footer></blockquote></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileNotice(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['tone', 'title', 'body', 'actionLabel', 'actionUrl', 'appearance'], 'Notice');
        $tone = $this->properties->requiredString($props, 'tone', 16);
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->properties->requiredString($props, 'body', 2000);
        $actionLabel = $this->properties->optionalString($props, 'actionLabel', 120) ?? '';
        $actionUrl = $this->properties->optionalString($props, 'actionUrl', 2048) ?? '';
        $appearance = $this->appearanceClasses($props, 'soft', 'compact');
        if (! in_array($tone, ['info', 'success', 'warning', 'critical'], true)) {
            throw new DocumentCompileException('Notice tone is invalid.');
        }
        if (($actionLabel === '') !== ($actionUrl === '')) {
            throw new DocumentCompileException('Notice action label and URL must be provided together.');
        }
        $action = '';
        if ($actionLabel !== '') {
            $this->urls->assertAllowedUrl($actionUrl, 'Notice action');
            $action = '<a class="g7pb-content-notice__action" href="'.$this->escapeAttribute($actionUrl).'">'.$this->escape($actionLabel).'<span aria-hidden="true"> →</span></a>';
        }
        $role = $tone === 'critical' ? 'alert' : 'note';

        $bodyMarkup = $this->richText->hasRichTextMarkup($body)
            ? '<div class="g7pb-content-notice__body">'.$this->richText->sanitizeRichText($body).'</div>'
            : '<p class="g7pb-content-notice__body">'.$this->formatText($body).'</p>';

        return '<section class="g7pb-block g7pb-content-notice g7pb-content-notice--'.$tone.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="notice" role="'.$role.'"><span class="g7pb-content-notice__icon" aria-hidden="true"></span><div><h2 class="g7pb-content-notice__title">'.$this->richText->sanitizePromotedInlineRichText($title).'</h2>'.$bodyMarkup.'</div>'.$action.'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileCardGrid(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'columns', 'variant', 'layout', 'appearance'], 'Card grid');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $columns = $this->properties->requiredIntegerChoice($props, 'columns', [2, 3]);
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Card grid must contain between two and six items.');
        }
        if (! in_array($variant, ['plain', 'outlined'], true)) {
            throw new DocumentCompileException('Card grid variant is invalid.');
        }
        if ($layout !== null && ! in_array($layout, ['grid', 'bento', 'rail', 'editorial', 'numbered'], true)) {
            throw new DocumentCompileException('Card grid layout is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Card grid item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['kicker', 'title', 'body', 'linkLabel', 'linkUrl'], "Card grid item {$index}");
            $kicker = $this->properties->optionalString($item, 'kicker', 80) ?? '';
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->properties->optionalString($item, 'body', 1000) ?? '';
            $linkLabel = $this->properties->optionalString($item, 'linkLabel', 120) ?? '';
            $linkUrl = $this->properties->optionalString($item, 'linkUrl', 2048) ?? '';
            if (($linkLabel === '') !== ($linkUrl === '')) {
                throw new DocumentCompileException("Card grid item {$index} link label and URL must be provided together.");
            }
            $link = '';
            if ($linkLabel !== '') {
                $this->urls->assertAllowedUrl($linkUrl, "Card grid item {$index}");
                $link = '<a href="'.$this->escapeAttribute($linkUrl).'">'.$this->escape($linkLabel).'<span aria-hidden="true"> →</span></a>';
            }
            $bodyMarkup = $body === '' ? '' : ($this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-card-grid__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-card-grid__body">'.$this->formatText($body).'</p>');
            $compiled[] = '<article class="g7pb-card-grid__item">'.($kicker === '' ? '' : '<p class="g7pb-card-grid__kicker">'.$this->escape($kicker).'</p>').'<h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-card-grid--layout-'.$layout;

        return '<section class="g7pb-block g7pb-card-grid g7pb-card-grid--'.$columns.' g7pb-card-grid--'.$variant.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="card-grid">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-card-grid__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileBreadcrumbs(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['items', 'currentLabel', 'appearance'], 'Breadcrumbs');
        $items = $props['items'] ?? null;
        $currentLabel = $this->properties->requiredString($props, 'currentLabel', 160);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! is_array($items) || count($items) < 1 || count($items) > 6) {
            throw new DocumentCompileException('Breadcrumbs must contain between one and six parent items.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Breadcrumb item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'url'], "Breadcrumb item {$index}");
            $label = $this->properties->requiredString($item, 'label', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            $this->urls->assertPageOrHttpsUrl($url, "Breadcrumb item {$index}");
            $compiled[] = '<li><a href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a></li>';
        }
        $compiled[] = '<li aria-current="page">'.$this->escape($currentLabel).'</li>';

        return '<section class="g7pb-block g7pb-breadcrumbs '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="breadcrumbs"><nav aria-label="경로"><ol>'.implode('', $compiled).'</ol></nav></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileAnchorMenu(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['label', 'items', 'sticky', 'alignment', 'appearance'], 'Anchor menu');
        $label = $this->properties->requiredString($props, 'label', 120);
        $items = $props['items'] ?? null;
        $sticky = $this->properties->requiredBoolean($props, 'sticky');
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Anchor menu must contain between two and eight items.');
        }
        if (! in_array($alignment, ['left', 'center'], true)) {
            throw new DocumentCompileException('Anchor menu alignment is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Anchor menu item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'anchor'], "Anchor menu item {$index}");
            $itemLabel = $this->properties->requiredString($item, 'label', 120);
            $anchor = $this->properties->requiredString($item, 'anchor', 80);
            if (preg_match('/^[a-z][a-z0-9-]{0,79}$/D', $anchor) !== 1) {
                throw new DocumentCompileException("Anchor menu item {$index} anchor is invalid.");
            }
            $compiled[] = '<li><a href="#'.$this->escapeAttribute($anchor).'">'.$this->escape($itemLabel).'</a></li>';
        }
        $stickyClass = $sticky ? ' g7pb-anchor-menu--sticky' : '';

        return '<section class="g7pb-block g7pb-anchor-menu g7pb-anchor-menu--'.$alignment.$stickyClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="anchor-menu"><nav aria-label="'.$this->escapeAttribute($label).'"><strong>'.$this->escape($label).'</strong><ul>'.implode('', $compiled).'</ul></nav></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileSocialLinks(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['heading', 'items', 'variant', 'alignment', 'appearance'], 'Social links');
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        $networks = ['instagram', 'youtube', 'facebook', 'linkedin', 'x', 'kakao', 'blog', 'website'];
        if (! is_array($items) || count($items) < 1 || count($items) > 8) {
            throw new DocumentCompileException('Social links must contain between one and eight items.');
        }
        if (! in_array($variant, ['icons', 'labels'], true) || ! in_array($alignment, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Social links variant or alignment is invalid.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Social link item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['network', 'label', 'url'], "Social link item {$index}");
            $network = $this->properties->requiredString($item, 'network', 16);
            $label = $this->properties->requiredString($item, 'label', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            if (! in_array($network, $networks, true)) {
                throw new DocumentCompileException("Social link item {$index} network is invalid.");
            }
            $this->urls->assertPageOrHttpsUrl($url, "Social link item {$index}");
            $compiled[] = '<li><a class="g7pb-social-links__link g7pb-social-links__link--'.$network.'" href="'.$this->escapeAttribute($url).'" rel="noopener noreferrer"><span class="g7pb-social-links__icon" aria-hidden="true">'.$this->catalogIconSvg($network, 'g7pb-social-links__glyph').'</span><span>'.$this->escape($label).'</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-social-links g7pb-social-links--'.$variant.' g7pb-social-links--'.$alignment.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="social-links"><nav aria-label="'.$this->escapeAttribute($this->richText->inlinePlainText($heading)).'"><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $compiled).'</ul></nav></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileImageCarousel(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'autoplay', 'interval', 'controls', 'aspectRatio', 'appearance'], 'Image carousel');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $autoplay = $this->properties->requiredBoolean($props, 'autoplay');
        $interval = $this->properties->requiredIntegerChoice($props, 'interval', [3000, 5000, 7000]);
        $controls = $this->properties->requiredString($props, 'controls', 16);
        $aspectRatio = $this->properties->requiredString($props, 'aspectRatio', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! is_array($images) || count($images) < 2 || count($images) > 8) {
            throw new DocumentCompileException('Image carousel must contain between two and eight images.');
        }
        if (! in_array($controls, ['arrows', 'dots', 'both'], true) || ! in_array($aspectRatio, ['16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Image carousel controls or aspect ratio is invalid.');
        }
        $slides = [];
        foreach (array_values($images) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Image carousel item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['src', 'alt', 'caption'], "Image carousel item {$index}");
            $src = $this->properties->optionalString($item, 'src', 2048) ?? '';
            $alt = $this->properties->requiredString($item, 'alt', 300);
            $caption = $this->properties->optionalString($item, 'caption', 300) ?? '';
            $media = $this->compileCatalogImage($src, $alt, 'g7pb-image-carousel__image', ($index + 1).'번 이미지를 선택하세요', $index === 0 ? 'eager' : 'lazy');
            $slides[] = '<figure class="g7pb-hero-slider__slide g7pb-image-carousel__slide">'.$media.($caption === '' ? '' : '<figcaption>'.$this->escape($caption).'</figcaption>').'</figure>';
        }

        return '<section class="g7pb-block g7pb-hero-slider g7pb-image-carousel g7pb-image-carousel--'.str_replace(':', '-', $aspectRatio).' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" data-g7pb-slider-controls="'.$controls.'" aria-label="'.$this->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHero(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'alignment', 'mediaPosition', 'layout', 'appearance'], 'Hero');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->properties->optionalString($props, 'body', 4000);
        $alignment = $this->properties->optionalString($props, 'alignment', 16) ?? 'center';
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $mediaPosition = $this->properties->optionalString($props, 'mediaPosition', 16) ?? 'right';
        $appearance = $this->appearanceClasses($props, 'default', 'spacious');
        $splitLayouts = ['balanced', 'screenshot', 'overlap', 'offset'];

        if (! in_array($alignment, ['left', 'center'], true)) {
            throw new DocumentCompileException('Hero alignment must be left or center.');
        }
        if ($layout !== null && ! in_array($layout, ['poster', 'product', 'backdrop', 'editorial', 'device', ...$splitLayouts], true)) {
            throw new DocumentCompileException('Hero layout is invalid.');
        }
        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Hero media position is invalid.');
        }

        $cta = $this->properties->optionalMap($props, 'primaryCta');
        $image = $this->properties->optionalMap($props, 'image');

        if ($layout !== null && in_array($layout, $splitLayouts, true)) {
            $copy = [];
            if ($eyebrow !== null && $eyebrow !== '') {
                $copy[] = '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
            }
            $copy[] = '<h1>'.$this->richText->sanitizeInlineRichText($title).'</h1>';
            if ($body !== null && $body !== '') {
                $copy[] = $this->richText->hasCanonicalRichTextMarkup($body)
                    ? '<div class="g7pb-hero-split__body">'.$this->richText->sanitizeRichText($body).'</div>'
                    : '<p class="g7pb-hero-split__body">'.$this->formatText($body).'</p>';
            }
            if ($cta !== null) {
                $copy[] = $this->compileActionLink($cta, 'Hero CTA', 'g7pb-button g7pb-button--primary');
            }
            if ($image !== null) {
                $this->properties->assertOnlyKeys($image, ['src', 'alt'], 'Hero image');
            }
            $src = $image === null ? '' : $this->properties->requiredString($image, 'src', 2048);
            $alt = $image === null ? '대표 이미지' : $this->properties->requiredString($image, 'alt', 300);
            $media = '<figure class="g7pb-hero-split__media">'.$this->compileCatalogImage(
                $src,
                $alt,
                'g7pb-hero-split__image',
                '대표 이미지 자리',
                'eager',
            ).'</figure>';

            return '<section class="g7pb-block g7pb-hero g7pb-hero-split g7pb-hero-split--'.$mediaPosition.' g7pb-hero-split--layout-'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero"><div class="g7pb-hero-split__copy">'.implode('', $copy).'</div>'.$media.'</section>';
        }

        $parts = [];

        if ($eyebrow !== null && $eyebrow !== '') {
            $parts[] = '<p class="g7pb-hero__eyebrow">'.$this->escape($eyebrow).'</p>';
        }

        $parts[] = '<h1 class="g7pb-hero__title">'.$this->richText->sanitizeInlineRichText($title).'</h1>';

        if ($body !== null && $body !== '') {
            $parts[] = '<div class="g7pb-hero__body">'.$this->richText->sanitizeRichText($body).'</div>';
        }

        if ($cta !== null) {
            $label = $this->properties->requiredString($cta, 'label', 120);
            $url = $this->properties->requiredString($cta, 'url', 2048);
            $this->urls->assertAllowedUrl($url, 'Hero CTA');
            $parts[] = '<a class="g7pb-button g7pb-button--primary" href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a>';
        }

        if ($image !== null) {
            $src = $this->properties->requiredString($image, 'src', 2048);
            $alt = $this->properties->optionalString($image, 'alt', 300) ?? '';
            $this->urls->assertAllowedImageUrl($src);
            $parts[] = '<img class="g7pb-hero__image" src="'.$this->escapeAttribute($src).'" alt="'.$this->escapeAttribute($alt).'" loading="eager">';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-hero--layout-'.$layout;

        return '<section class="g7pb-block g7pb-hero g7pb-hero--'.$alignment.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero">'.implode('', $parts).'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileFeatures(array $props): string
    {
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Features must contain between two and six items.');
        }
        if ($layout !== null && ! in_array($layout, ['grid', 'bento', 'editorial', 'panel', 'list'], true)) {
            throw new DocumentCompileException('Features layout is invalid.');
        }

        $compiledItems = [];

        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Feature item {$index} must be an object.");
            }

            $icon = $this->properties->requiredString($item, 'icon', 32);
            $itemTitle = $this->properties->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->properties->requiredRichTextString($item, 'body', 2000);

            if (! in_array($icon, self::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Feature item {$index} uses an unsupported icon.");
            }

            $bodyMarkup = $this->richText->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-features__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $compiledItems[] = '<article class="g7pb-features__item">'.$this->catalogIconSvg($icon, 'g7pb-features__icon g7pb-icon--'.$icon).'<h3>'.$this->richText->sanitizePromotedInlineRichText($itemTitle).'</h3>'.$bodyMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-features--layout-'.$layout;

        return '<section class="g7pb-block g7pb-features'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="features"><h2 class="g7pb-features__title">'.$this->richText->sanitizeInlineRichText($title).'</h2><div class="g7pb-features__grid">'.implode('', $compiledItems).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileCta(array $props): string
    {
        $this->properties->assertOnlyKeys(
            $props,
            ['eyebrow', 'heading', 'body', 'primaryLink', 'secondaryLink', 'theme', 'layout', 'appearance'],
            'CTA',
        );

        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $body = $this->properties->optionalRichTextString($props, 'body', 2000);
        $theme = $this->properties->requiredString($props, 'theme', 16);
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (! in_array($theme, ['light', 'dark'], true)) {
            throw new DocumentCompileException('CTA theme must be light or dark.');
        }
        if ($layout !== null && ! in_array($layout, ['split', 'centered', 'banner', 'panel'], true)) {
            throw new DocumentCompileException('CTA layout is invalid.');
        }

        $copy = [];
        if ($eyebrow !== null && $eyebrow !== '') {
            $copy[] = '<p class="g7pb-cta__eyebrow">'.$this->escape($eyebrow).'</p>';
        }
        $copy[] = '<h2 class="g7pb-cta__heading">'.$this->richText->sanitizeInlineRichText($heading).'</h2>';
        if ($body !== null && $body !== '') {
            $copy[] = $this->richText->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-cta__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-cta__body">'.$this->formatText($body).'</p>';
        }

        $actions = [];
        $primaryLink = $this->properties->optionalMap($props, 'primaryLink');
        if ($primaryLink !== null) {
            $actions[] = $this->compileActionLink($primaryLink, 'CTA primary link', 'g7pb-button g7pb-button--primary');
        }
        $secondaryLink = $this->properties->optionalMap($props, 'secondaryLink');
        if ($secondaryLink !== null) {
            $actions[] = $this->compileActionLink($secondaryLink, 'CTA secondary link', 'g7pb-button g7pb-button--secondary');
        }

        $actionMarkup = $actions === []
            ? ''
            : '<div class="g7pb-cta__actions">'.implode('', $actions).'</div>';

        $layoutClass = $layout === null ? '' : ' g7pb-cta--layout-'.$layout;

        return '<section class="g7pb-block g7pb-cta g7pb-cta--'.$theme.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="cta"><div class="g7pb-cta__copy">'.implode('', $copy).'</div>'.$actionMarkup.'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileContact(array $props): string
    {
        $this->properties->assertOnlyKeys(
            $props,
            ['heading', 'address', 'phone', 'email', 'cta', 'mapLink', 'appearance'],
            'Contact',
        );

        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $address = $this->properties->requiredString($props, 'address', 1000);
        $phone = $this->properties->requiredString($props, 'phone', 40);
        $email = $this->properties->requiredString($props, 'email', 320);
        $phoneHref = $this->urls->phoneHref($phone);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new DocumentCompileException('Contact email is invalid.');
        }

        $actions = [];
        $cta = $this->properties->optionalMap($props, 'cta');
        if ($cta !== null) {
            $actions[] = $this->compileActionLink($cta, 'Contact CTA', 'g7pb-button g7pb-button--primary');
        }
        $mapLink = $this->properties->optionalMap($props, 'mapLink');
        if ($mapLink !== null) {
            $actions[] = $this->compileActionLink($mapLink, 'Contact map link', 'g7pb-button g7pb-button--secondary');
        }

        $actionMarkup = $actions === []
            ? ''
            : '<div class="g7pb-contact__actions">'.implode('', $actions).'</div>';

        return '<section class="g7pb-block g7pb-contact '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="contact"><div class="g7pb-contact__heading"><p class="g7pb-contact__eyebrow">Contact</p><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2></div><address class="g7pb-contact__details"><p>'.$this->formatText($address).'</p><a href="'.$this->escapeAttribute($phoneHref).'">'.$this->escape($phone).'</a><a href="'.$this->escapeAttribute('mailto:'.$email).'">'.$this->escape($email).'</a></address>'.$actionMarkup.'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHeroSplit(array $props): string
    {
        $this->properties->assertOnlyKeys(
            $props,
            ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'mediaPosition', 'layout', 'appearance'],
            'Split Hero',
        );

        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $title = $this->properties->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->properties->optionalString($props, 'body', 2000);
        $mediaPosition = $this->properties->requiredString($props, 'mediaPosition', 16);
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'spacious');

        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Split Hero media position is invalid.');
        }
        if ($layout !== null && ! in_array($layout, ['balanced', 'screenshot', 'overlap', 'offset'], true)) {
            throw new DocumentCompileException('Split Hero layout is invalid.');
        }

        $copy = [];
        if ($eyebrow !== null && $eyebrow !== '') {
            $copy[] = '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
        }
        $copy[] = '<h1>'.$this->richText->sanitizeInlineRichText($title).'</h1>';
        if ($body !== null && $body !== '') {
            $copy[] = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-hero-split__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-hero-split__body">'.$this->formatText($body).'</p>';
        }

        $cta = $this->properties->optionalMap($props, 'primaryCta');
        if ($cta !== null) {
            $copy[] = $this->compileActionLink($cta, 'Split Hero CTA', 'g7pb-button g7pb-button--primary');
        }

        $image = $this->properties->optionalMap($props, 'image');
        $src = $image === null ? '' : $this->properties->requiredString($image, 'src', 2048);
        $alt = $image === null ? '대표 이미지' : $this->properties->requiredString($image, 'alt', 300);
        if ($image !== null) {
            $this->properties->assertOnlyKeys($image, ['src', 'alt'], 'Split Hero image');
        }
        $media = '<figure class="g7pb-hero-split__media">'.$this->compileCatalogImage(
            $src,
            $alt,
            'g7pb-hero-split__image',
            '대표 이미지 자리',
            'eager',
        ).'</figure>';

        $layoutClass = $layout === null ? '' : ' g7pb-hero-split--layout-'.$layout;

        return '<section class="g7pb-block g7pb-hero-split g7pb-hero-split--'.$mediaPosition.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero-split"><div class="g7pb-hero-split__copy">'.implode('', $copy).'</div>'.$media.'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHeroSlider(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['slides', 'autoplay', 'interval', 'loop', 'appearance'], 'Slider Hero');
        $slides = $props['slides'] ?? null;
        $appearance = $this->appearanceClasses($props, 'contrast', 'spacious');
        $autoplay = $props['autoplay'] ?? true;
        $interval = $props['interval'] ?? 5000;
        $loop = $props['loop'] ?? true;

        if (! is_array($slides) || count($slides) < 2 || count($slides) > 5) {
            throw new DocumentCompileException('Slider Hero must contain between two and five slides.');
        }
        if (! is_bool($autoplay) || ! is_bool($loop) || ! in_array($interval, [3000, 5000, 7000], true)) {
            throw new DocumentCompileException('Slider Hero playback settings are invalid.');
        }

        $compiled = [];
        foreach (array_values($slides) as $index => $slide) {
            if (! is_array($slide)) {
                throw new DocumentCompileException("Slider Hero item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys(
                $slide,
                ['eyebrow', 'title', 'body', 'buttonLabel', 'buttonUrl', 'imageSrc', 'imageAlt'],
                "Slider Hero item {$index}",
            );
            $eyebrow = $this->properties->optionalString($slide, 'eyebrow', 120);
            $title = $this->properties->requiredInlineRichTextString($slide, 'title', 200);
            $body = $this->properties->optionalString($slide, 'body', 2000);
            $buttonLabel = $this->properties->requiredString($slide, 'buttonLabel', 120);
            $buttonUrl = $this->properties->requiredString($slide, 'buttonUrl', 2048);
            $imageSrc = $this->properties->optionalString($slide, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($slide, 'imageAlt', 300) ?? '';
            $this->urls->assertAllowedUrl($buttonUrl, "Slider Hero item {$index}");

            $copy = $eyebrow === null || $eyebrow === ''
                ? ''
                : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
            $copy .= '<h2>'.$this->richText->sanitizePromotedInlineRichText($title).'</h2>';
            if ($body !== null && $body !== '') {
                $copy .= $this->richText->hasRichTextMarkup($body)
                    ? '<div class="g7pb-hero-slider__body">'.$this->richText->sanitizeRichText($body).'</div>'
                    : '<p>'.$this->formatText($body).'</p>';
            }
            $copy .= '<a class="g7pb-button g7pb-button--primary" href="'.$this->escapeAttribute($buttonUrl).'">'.$this->escape($buttonLabel).'</a>';
            $media = $this->compileCatalogImage(
                $imageSrc,
                $imageAlt,
                'g7pb-hero-slider__image',
                '슬라이드 '.($index + 1).' 이미지 자리',
                $index === 0 ? 'eager' : 'lazy',
            );
            $compiled[] = '<article class="g7pb-hero-slider__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($slides).'"><div class="g7pb-hero-slider__copy">'.$copy.'</div><figure>'.$media.'</figure></article>';
        }

        return '<section class="g7pb-block g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero-slider" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="'.($loop ? 'true' : 'false').'" aria-label="대표 콘텐츠 슬라이더"><div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $compiled).'</div></div><div class="g7pb-hero-slider__controls"><div class="g7pb-hero-slider__dots" data-g7pb-slider-dots aria-label="슬라이드 선택"></div></div><p class="g7pb-hero-slider__status" data-g7pb-slider-status aria-live="polite"></p></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileLogoCloud(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['heading', 'logos', 'layout', 'appearance'], 'Logo Cloud');
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');

        if (! is_array($logos) || count($logos) < 2 || count($logos) > 12) {
            throw new DocumentCompileException('Logo Cloud must contain between two and twelve logos.');
        }
        if ($layout !== null && ! in_array($layout, ['strip', 'grid', 'panel'], true)) {
            throw new DocumentCompileException('Logo Cloud layout is invalid.');
        }

        $items = [];
        foreach (array_values($logos) as $index => $logo) {
            if (! is_array($logo)) {
                throw new DocumentCompileException("Logo item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($logo, ['name', 'imageSrc', 'imageAlt', 'url'], "Logo item {$index}");
            $name = $this->properties->requiredString($logo, 'name', 120);
            $imageSrc = $this->properties->optionalString($logo, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($logo, 'imageAlt', 300) ?? '';
            $url = $this->properties->optionalString($logo, 'url', 2048) ?? '';
            $visual = $imageSrc === ''
                ? '<span>'.$this->escape($name).'</span>'
                : $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name.' 로고', 'g7pb-logo-cloud__image', $name);
            if ($url !== '') {
                $this->urls->assertAllowedUrl($url, "Logo item {$index}");
                $visual = '<a href="'.$this->escapeAttribute($url).'" aria-label="'.$this->escapeAttribute($name).'">'.$visual.'</a>';
            }
            $items[] = '<li>'.$visual.'</li>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-logo-cloud--layout-'.$layout;

        return '<section class="g7pb-block g7pb-logo-cloud'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-cloud"><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $items).'</ul></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileStats(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Stats');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        $icons = ['trend', 'users', 'target', 'chart'];
        if ($layout !== null && ! in_array($layout, ['grid', 'strip', 'split', 'editorial'], true)) {
            throw new DocumentCompileException('Stats layout is invalid.');
        }

        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Stats must contain between two and six items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Stats item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['icon', 'value', 'label', 'detail'], "Stats item {$index}");
            $icon = $this->properties->requiredString($item, 'icon', 32);
            if (! in_array($icon, $icons, true)) {
                throw new DocumentCompileException("Stats item {$index} icon is invalid.");
            }
            $value = $this->properties->requiredString($item, 'value', 80);
            $label = $this->properties->requiredInlineRichTextString($item, 'label', 120);
            $detail = $this->properties->optionalRichTextString($item, 'detail', 500) ?? '';
            $detailMarkup = $this->richText->hasCanonicalRichTextMarkup($detail)
                ? '<div class="g7pb-stats__detail">'.$this->richText->sanitizeRichText($detail).'</div>'
                : '<p>'.$this->formatText($detail).'</p>';
            $compiled[] = '<article>'.$this->catalogIconSvg($icon, 'g7pb-stats__icon g7pb-stats__icon--'.$icon).'<strong>'.$this->escape($value).'</strong><h3>'.$this->richText->sanitizePromotedInlineRichText($label).'</h3>'.$detailMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-stats--layout-'.$layout;

        return '<section class="g7pb-block g7pb-stats'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="stats">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-stats__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compilePricing(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'plans', 'layout', 'appearance'], 'Pricing');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $plans = $props['plans'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'spacious');
        if ($layout !== null && ! in_array($layout, ['cards', 'featured', 'compact', 'editorial'], true)) {
            throw new DocumentCompileException('Pricing layout is invalid.');
        }

        if (! is_array($plans) || count($plans) < 2 || count($plans) > 4) {
            throw new DocumentCompileException('Pricing must contain between two and four plans.');
        }

        $compiled = [];
        foreach (array_values($plans) as $index => $plan) {
            if (! is_array($plan)) {
                throw new DocumentCompileException("Pricing plan {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys(
                $plan,
                ['name', 'price', 'period', 'description', 'features', 'buttonLabel', 'buttonUrl', 'featured'],
                "Pricing plan {$index}",
            );
            $name = $this->properties->requiredInlineRichTextString($plan, 'name', 120);
            $price = $this->properties->requiredString($plan, 'price', 80);
            $period = $this->properties->optionalString($plan, 'period', 40) ?? '';
            $description = $this->properties->optionalRichTextString($plan, 'description', 500) ?? '';
            $buttonLabel = $this->properties->requiredString($plan, 'buttonLabel', 120);
            $buttonUrl = $this->properties->requiredString($plan, 'buttonUrl', 2048);
            $featured = $this->properties->requiredBoolean($plan, 'featured');
            $features = $plan['features'] ?? null;
            $this->urls->assertAllowedUrl($buttonUrl, "Pricing plan {$index}");

            if (! is_array($features) || count($features) < 1 || count($features) > 12) {
                throw new DocumentCompileException("Pricing plan {$index} features are invalid.");
            }
            $featureItems = [];
            foreach (array_values($features) as $featureIndex => $feature) {
                $feature = $this->properties->requiredInlineRichTextValue(
                    $feature,
                    "Pricing plan {$index} feature {$featureIndex}",
                    200,
                );
                $featureItems[] = '<li>'.$this->richText->sanitizePromotedInlineRichText($feature).'</li>';
            }
            $featuredClass = $featured ? ' g7pb-pricing__plan--featured' : '';
            $badge = $featured ? '<span class="g7pb-pricing__badge">추천</span>' : '';
            $descriptionMarkup = $this->richText->hasCanonicalRichTextMarkup($description)
                ? '<div class="g7pb-pricing__description">'.$this->richText->sanitizeRichText($description).'</div>'
                : '<p>'.$this->formatText($description).'</p>';
            $compiled[] = '<article class="g7pb-pricing__plan'.$featuredClass.'">'.$badge.'<h3>'.$this->richText->sanitizePromotedInlineRichText($name).'</h3><p class="g7pb-pricing__price"><strong>'.$this->escape($price).'</strong><span>'.$this->escape($period).'</span></p>'.$descriptionMarkup.'<ul>'.implode('', $featureItems).'</ul><a class="g7pb-button '.($featured ? 'g7pb-button--primary' : 'g7pb-button--secondary').'" href="'.$this->escapeAttribute($buttonUrl).'">'.$this->escape($buttonLabel).'</a></article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-pricing--layout-'.$layout;

        return '<section class="g7pb-block g7pb-pricing'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="pricing">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-pricing__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileTeam(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'members', 'layout', 'appearance'], 'Team');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $members = $props['members'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if ($layout !== null && ! in_array($layout, ['grid', 'portraits', 'editorial', 'featured'], true)) {
            throw new DocumentCompileException('Team layout is invalid.');
        }

        if (! is_array($members) || count($members) < 2 || count($members) > 8) {
            throw new DocumentCompileException('Team must contain between two and eight members.');
        }

        $compiled = [];
        foreach (array_values($members) as $index => $member) {
            if (! is_array($member)) {
                throw new DocumentCompileException("Team member {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($member, ['name', 'role', 'bio', 'imageSrc', 'imageAlt', 'profileUrl'], "Team member {$index}");
            $name = $this->properties->requiredString($member, 'name', 120);
            $role = $this->properties->requiredString($member, 'role', 160);
            $bio = $this->properties->optionalRichTextString($member, 'bio', 1000) ?? '';
            $imageSrc = $this->properties->optionalString($member, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($member, 'imageAlt', 300) ?? '';
            $profileUrl = $this->properties->optionalString($member, 'profileUrl', 2048) ?? '';
            $media = $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name, 'g7pb-team__image', mb_substr($name, 0, 1));
            $memberName = '<h3>'.$this->escape($name).'</h3>';
            if ($profileUrl !== '') {
                $this->urls->assertAllowedUrl($profileUrl, "Team member {$index}");
                $memberName = '<h3><a href="'.$this->escapeAttribute($profileUrl).'">'.$this->escape($name).'</a></h3>';
            }
            $bioMarkup = $this->richText->hasCanonicalRichTextMarkup($bio)
                ? '<div class="g7pb-team__bio">'.$this->richText->sanitizeRichText($bio).'</div>'
                : '<p>'.$this->formatText($bio).'</p>';
            $compiled[] = '<article><figure>'.$media.'</figure>'.$memberName.'<strong>'.$this->escape($role).'</strong>'.$bioMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-team--layout-'.$layout;

        return '<section class="g7pb-block g7pb-team'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="team">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-team__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileGallery(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'columns', 'layout', 'appearance'], 'Gallery');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $columns = $props['columns'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (! is_int($columns) || ! in_array($columns, [2, 3, 4], true)) {
            throw new DocumentCompileException('Gallery columns are invalid.');
        }
        if ($layout !== null && ! in_array($layout, ['grid', 'bento', 'masonry', 'filmstrip'], true)) {
            throw new DocumentCompileException('Gallery layout is invalid.');
        }
        if (! is_array($images) || count($images) < 2 || count($images) > 12) {
            throw new DocumentCompileException('Gallery must contain between two and twelve images.');
        }

        $compiled = [];
        foreach (array_values($images) as $index => $image) {
            if (! is_array($image)) {
                throw new DocumentCompileException("Gallery image {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($image, ['src', 'alt', 'caption'], "Gallery image {$index}");
            $src = $this->properties->optionalString($image, 'src', 2048) ?? '';
            $alt = $this->properties->requiredString($image, 'alt', 300);
            $caption = $this->properties->optionalString($image, 'caption', 300) ?? '';
            $media = $this->compileCatalogImage($src, $alt, 'g7pb-gallery__image', '이미지 '.($index + 1));
            $figcaption = $caption === '' ? '' : '<figcaption>'.$this->escape($caption).'</figcaption>';
            $compiled[] = '<figure>'.$media.$figcaption.'</figure>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-gallery--layout-'.$layout;

        return '<section class="g7pb-block g7pb-gallery'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="gallery">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-gallery__grid g7pb-gallery__grid--'.$columns.'">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileBarChart(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'unit', 'items', 'appearance'], 'Bar Chart');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->properties->optionalRichTextString($props, 'description', 1000) ?? '';
        $unit = $this->properties->optionalString($props, 'unit', 20) ?? '';
        $items = $props['items'] ?? null;
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        $tones = ['blue', 'indigo', 'emerald', 'amber'];

        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Bar Chart must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Bar Chart item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'value', 'tone'], "Bar Chart item {$index}");
            $label = $this->properties->requiredString($item, 'label', 120);
            $value = $this->properties->requiredNumber($item, 'value', 0, 100);
            $tone = $this->properties->requiredString($item, 'tone', 16);
            if (! in_array($tone, $tones, true)) {
                throw new DocumentCompileException("Bar Chart item {$index} tone is invalid.");
            }
            $formattedValue = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
            $compiled[] = '<label><span><span>'.$this->escape($label).'</span><strong>'.$this->escape($formattedValue).'<span class="g7pb-bar-chart__unit">'.$this->escape($unit).'</span></strong></span><progress max="100" value="'.$this->escapeAttribute($formattedValue).'" data-tone="'.$tone.'">'.$this->escape($formattedValue).'</progress></label>';
        }

        $descriptionMarkup = $description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description)
            ? '<div class="g7pb-bar-chart__description">'.$this->richText->sanitizeRichText($description).'</div>'
            : '<p>'.$this->formatText($description).'</p>');

        return '<section class="g7pb-block g7pb-bar-chart '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="bar-chart"><figure><figcaption>'.$this->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.'</figcaption><div class="g7pb-bar-chart__plot">'.implode('', $compiled).'</div></figure></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileG7RecentPosts(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'period', 'limit', 'pageSize', 'audience', 'emptyMessage', 'appearance'], 'G7 recent posts');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->properties->requiredString($props, 'source', 16);
        $period = $this->properties->requiredString($props, 'period', 16);
        $limit = $this->properties->requiredIntegerChoice($props, 'limit', [3, 4, 6, 8, 12]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->properties->requiredIntegerChoice($props, 'pageSize', [3, 4, 6]) : 3;
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (! in_array($source, ['recent', 'popular'], true)
            || ! in_array($period, ['today', 'week', 'month', 'year'], true)
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 recent posts configuration is invalid.');
        }

        $endpoint = $source === 'popular'
            ? "/api/modules/sirsoft-board/boards/popular?period={$period}&limit={$limit}"
            : "/api/modules/sirsoft-board/boards/posts/recent?limit={$limit}";
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--posts '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-recent-posts" data-g7pb-data-source="posts" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">콘텐츠를 불러오는 중입니다.</p><div class="g7pb-dynamic-posts" data-g7pb-data-list aria-busy="true"></div>'.$this->compilePagination('게시글').'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileG7ProductGrid(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'limit', 'columns', 'pageSize', 'audience', 'detailBasePath', 'emptyMessage', 'appearance'], 'G7 product grid');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->properties->requiredString($props, 'source', 16);
        $limit = $this->properties->requiredIntegerChoice($props, 'limit', [2, 3, 4, 6, 8, 12]);
        $columns = $this->properties->requiredIntegerChoice($props, 'columns', [2, 3, 4]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->properties->requiredIntegerChoice($props, 'pageSize', [2, 3, 4, 6]) : 4;
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $detailBasePath = $this->properties->requiredString($props, 'detailBasePath', 200);
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (! in_array($source, ['latest', 'new', 'popular'], true)
            || ! in_array($audience, ['all', 'guest', 'member'], true)
            || preg_match('#^/[A-Za-z0-9/_-]*$#', $detailBasePath) !== 1) {
            throw new DocumentCompileException('G7 product grid configuration is invalid.');
        }

        $endpoint = match ($source) {
            'new' => "/api/modules/sirsoft-ecommerce/products/new?limit={$limit}",
            'popular' => "/api/modules/sirsoft-ecommerce/products/popular?limit={$limit}",
            default => "/api/modules/sirsoft-ecommerce/products?per_page={$limit}&sort=latest",
        };
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--products '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-grid" data-g7pb-data-source="products" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-product-base="'.$this->escapeAttribute(rtrim($detailBasePath, '/')).'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-dynamic-products g7pb-dynamic-products--'.$columns.'" data-g7pb-data-list aria-busy="true"></div>'.$this->compilePagination('상품').'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileInquiryForm(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'formKind', 'submitLabel', 'successMessage', 'privacyLabel', 'showPhone', 'showSubject', 'appearance'], 'Inquiry form');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->properties->optionalRichTextString($props, 'description', 1000) ?? '';
        $kind = $this->properties->requiredString($props, 'formKind', 24);
        $submitLabel = $this->properties->requiredString($props, 'submitLabel', 80);
        $successMessage = $this->properties->requiredString($props, 'successMessage', 300);
        $privacyLabel = $this->properties->requiredString($props, 'privacyLabel', 300);
        $showPhone = $this->properties->requiredBoolean($props, 'showPhone');
        $showSubject = $this->properties->requiredBoolean($props, 'showSubject');
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($kind, ['inquiry', 'quote', 'reservation', 'application', 'newsletter'], true)) {
            throw new DocumentCompileException('Inquiry form kind is invalid.');
        }

        $phone = $showPhone ? '<label><span>전화번호</span><span data-g7pb-form-control="input" data-g7pb-control-type="tel" data-g7pb-control-name="phone" data-g7pb-control-maxlength="40" data-g7pb-control-autocomplete="tel"></span></label>' : '';
        $subject = $showSubject ? '<label class="g7pb-inquiry-form__wide"><span>문의 제목</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="subject" data-g7pb-control-maxlength="200"></span></label>' : '';

        return '<section class="g7pb-block g7pb-inquiry '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="inquiry-form">'
            .'<div class="g7pb-inquiry__intro">'.$this->compileSectionHeading($eyebrow, $heading).($description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description) ? '<div class="g7pb-inquiry__description">'.$this->richText->sanitizeRichText($description).'</div>' : '<p>'.$this->formatText($description).'</p>')).'</div>'
            .'<div class="g7pb-inquiry-form" data-g7pb-inquiry-host data-g7pb-inquiry-form data-g7pb-form-action="/pages/__G7PB_PAGE_SLUG__/inquiries" data-g7pb-form-kind="'.$kind.'" data-g7pb-success-message="'.$this->escapeAttribute($successMessage).'" data-g7pb-privacy-label="'.$this->escapeAttribute($privacyLabel).'" data-g7pb-submit-label="'.$this->escapeAttribute($submitLabel).'" data-g7pb-show-phone="'.($showPhone ? 'true' : 'false').'" data-g7pb-show-subject="'.($showSubject ? 'true' : 'false').'">'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="form_kind" data-g7pb-control-value="'.$kind.'"></span>'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="block_instance_id"></span>'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="started_at"></span>'
            .'<label class="g7pb-inquiry-form__honeypot" aria-hidden="true"><span>웹사이트</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="website" data-g7pb-control-tabindex="-1" data-g7pb-control-autocomplete="off"></span></label>'
            .'<label><span>이름</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="name" data-g7pb-control-maxlength="120" data-g7pb-control-autocomplete="name" data-g7pb-control-required="true"></span></label>'
            .'<label><span>이메일</span><span data-g7pb-form-control="input" data-g7pb-control-type="email" data-g7pb-control-name="email" data-g7pb-control-maxlength="320" data-g7pb-control-autocomplete="email" data-g7pb-control-required="true"></span></label>'.$phone.$subject
            .'<label class="g7pb-inquiry-form__wide"><span>문의 내용</span><span data-g7pb-form-control="textarea" data-g7pb-control-name="message" data-g7pb-control-maxlength="5000" data-g7pb-control-rows="6" data-g7pb-control-required="true"></span></label>'
            .'<label class="g7pb-inquiry-form__consent"><span data-g7pb-form-control="input" data-g7pb-control-type="checkbox" data-g7pb-control-name="privacy" data-g7pb-control-value="1" data-g7pb-control-required="true"></span><span data-g7pb-privacy-copy>'.$this->escape($privacyLabel).'</span></label>'
            .'<div class="g7pb-inquiry-form__footer"><span data-g7pb-form-control="button" data-g7pb-control-type="submit" data-g7pb-submit-copy>'.$this->escape($submitLabel).'</span><p role="status" aria-live="polite" data-g7pb-form-status></p></div></div>'
            .'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileMapDirections(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'address', 'latitude', 'longitude', 'zoom', 'provider', 'mapImageSrc', 'mapImageAlt', 'directionsLabel', 'directionsUrl', 'phone', 'hours', 'parking', 'appearance'], 'Map directions');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->properties->optionalRichTextString($props, 'description', 1000) ?? '';
        $address = $this->properties->requiredString($props, 'address', 500);
        $latitude = $this->properties->requiredNumber($props, 'latitude', -90, 90);
        $longitude = $this->properties->requiredNumber($props, 'longitude', -180, 180);
        $zoom = $this->properties->requiredIntegerChoice($props, 'zoom', [12, 14, 16, 18]);
        $provider = $this->properties->requiredString($props, 'provider', 24);
        $mapImageSrc = $this->properties->optionalString($props, 'mapImageSrc', 2048) ?? '';
        $mapImageAlt = $this->properties->optionalString($props, 'mapImageAlt', 300) ?? '';
        $directionsLabel = $this->properties->requiredString($props, 'directionsLabel', 80);
        $directionsUrl = $this->properties->requiredString($props, 'directionsUrl', 2048);
        $phone = $this->properties->optionalString($props, 'phone', 40) ?? '';
        $hours = $this->properties->optionalString($props, 'hours', 300) ?? '';
        $parking = $this->properties->optionalString($props, 'parking', 300) ?? '';
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($provider, ['image', 'openstreetmap', 'google', 'none'], true)) {
            throw new DocumentCompileException('Map provider is invalid.');
        }
        $this->urls->assertAllowedUrl($directionsUrl, 'Directions link');

        $map = '<div class="g7pb-map__placeholder" role="img" aria-label="'.$this->escapeAttribute($address).' 지도 자리"><span>지도 표시 안 함</span></div>';
        if ($provider === 'image') {
            $map = $this->compileCatalogImage($mapImageSrc, $mapImageAlt, 'g7pb-map__image', '지도 이미지를 등록하세요');
        } elseif ($provider === 'openstreetmap') {
            $delta = match ($zoom) {
                18 => 0.002, 16 => 0.008, 14 => 0.03, default => 0.12
            };
            $bbox = implode(',', [$longitude - $delta, $latitude - $delta, $longitude + $delta, $latitude + $delta]);
            $src = 'https://www.openstreetmap.org/export/embed.html?bbox='.rawurlencode($bbox).'&marker='.rawurlencode($latitude.','.$longitude);
            $map = $this->embedPlaceholder('map-openstreetmap', $src, $address.' 지도');
        } elseif ($provider === 'google') {
            $src = 'https://www.google.com/maps?q='.rawurlencode($latitude.','.$longitude).'&z='.$zoom.'&output=embed';
            $map = $this->embedPlaceholder('map-google', $src, $address.' 지도');
        }
        $details = '<address><strong>'.$this->escape($address).'</strong>'
            .($phone === '' ? '' : '<span class="g7pb-map__phone">'.$this->escape($phone).'</span>')
            .($hours === '' ? '' : '<span class="g7pb-map__hours">'.$this->formatText($hours).'</span>')
            .($parking === '' ? '' : '<span class="g7pb-map__parking">'.$this->formatText($parking).'</span>')
            .'<a class="g7pb-button g7pb-button--primary" href="'.$this->escapeAttribute($directionsUrl).'">'.$this->escape($directionsLabel).'</a></address>';

        $descriptionMarkup = $description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description)
            ? '<div class="g7pb-map__description">'.$this->richText->sanitizeRichText($description).'</div>'
            : '<p>'.$this->formatText($description).'</p>');

        return '<section class="g7pb-block g7pb-map '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="map-directions"><div class="g7pb-map__intro">'.$this->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.$details.'</div><div class="g7pb-map__frame">'.$map.'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTestimonials(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Testimonials');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($layout, ['grid', 'spotlight', 'split', 'wall', 'quote-hero'], true)) {
            throw new DocumentCompileException('Testimonials layout is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Testimonials must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Testimonial item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['quote', 'name', 'role', 'company', 'avatarSrc', 'avatarAlt', 'rating'], "Testimonial item {$index}");
            $quote = $this->properties->requiredString($item, 'quote', 1200);
            $name = $this->properties->requiredString($item, 'name', 120);
            $role = $this->properties->optionalString($item, 'role', 120) ?? '';
            $company = $this->properties->optionalString($item, 'company', 120) ?? '';
            $avatarSrc = $this->properties->optionalString($item, 'avatarSrc', 2048) ?? '';
            $avatarAlt = $this->properties->optionalString($item, 'avatarAlt', 300) ?? '';
            $rating = $this->properties->requiredIntegerChoice($item, 'rating', [1, 2, 3, 4, 5]);
            $avatar = $this->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonials__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escape($company).'</span>');
            $compiled[] = '<blockquote><p class="g7pb-testimonials__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p><div class="g7pb-testimonials__quote">'.$this->richText->sanitizeRichText($quote).'</div><footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonials g7pb-testimonials--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonials">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-testimonials__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileFaqAccordion(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'behavior', 'openFirst', 'appearance'], 'FAQ accordion');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $behavior = $this->properties->requiredString($props, 'behavior', 16);
        $openFirst = $this->properties->requiredBoolean($props, 'openFirst');
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($behavior, ['single', 'multiple'], true)) {
            throw new DocumentCompileException('FAQ accordion behavior is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 12) {
            throw new DocumentCompileException('FAQ accordion must contain between two and twelve items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("FAQ item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['question', 'answer'], "FAQ item {$index}");
            $question = $this->properties->requiredInlineRichTextString($item, 'question', 300);
            $answer = $this->properties->requiredString($item, 'answer', 4000);
            $open = $openFirst && $index === 0;
            $compiled[] = '<div class="g7pb-faq__item" data-g7pb-accordion-item data-g7pb-open="'.($open ? 'true' : 'false').'">'
                .'<div class="g7pb-faq__trigger" role="button" tabindex="0" data-g7pb-accordion-trigger aria-expanded="'.($open ? 'true' : 'false').'"><span>'.$this->richText->sanitizePromotedInlineRichText($question).'</span><i aria-hidden="true">+</i></div>'
                .'<div class="g7pb-faq__answer" data-g7pb-accordion-panel>'.$this->richText->sanitizeRichText($answer).'</div></div>';
        }

        return '<section class="g7pb-block g7pb-faq '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="faq-accordion" data-g7pb-accordion data-g7pb-accordion-behavior="'.$behavior.'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-faq__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileProcessTimeline(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Process timeline');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['vertical', 'horizontal'], true)) {
            throw new DocumentCompileException('Process timeline layout is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Process timeline must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Process step {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['title', 'body', 'linkLabel', 'linkUrl'], "Process step {$index}");
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 200);
            $body = $this->properties->requiredString($item, 'body', 1500);
            $linkLabel = $this->properties->optionalString($item, 'linkLabel', 120) ?? '';
            $linkUrl = $this->properties->optionalString($item, 'linkUrl', 2048) ?? '';
            if (($linkLabel === '') !== ($linkUrl === '')) {
                throw new DocumentCompileException("Process step {$index} link requires both a label and URL.");
            }
            $link = '';
            if ($linkUrl !== '') {
                $this->urls->assertAllowedUrl($linkUrl, "Process step {$index}");
                $link = '<a href="'.$this->escapeAttribute($linkUrl).'">'.$this->escape($linkLabel).' <span aria-hidden="true">→</span></a>';
            }
            $bodyMarkup = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-process__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $compiled[] = '<li><span class="g7pb-process__number">'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT).'</span><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</li>';
        }

        return '<section class="g7pb-block g7pb-process g7pb-process--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="process-timeline">'.$this->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTabs(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'initialTab', 'style', 'appearance'], 'Tabs');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $initialTab = $props['initialTab'] ?? null;
        $style = $this->properties->requiredString($props, 'style', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($style, ['underline', 'pills'], true)) {
            throw new DocumentCompileException('Tabs style is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Tabs must contain between two and six items.');
        }
        if (! is_int($initialTab) || $initialTab < 0 || $initialTab >= count($items)) {
            throw new DocumentCompileException('Tabs initial tab is invalid.');
        }

        $buttons = [];
        $panels = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Tab item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['label', 'heading', 'body'], "Tab item {$index}");
            $label = $this->properties->requiredString($item, 'label', 80);
            $itemHeading = $this->properties->requiredInlineRichTextString($item, 'heading', 200);
            $body = $this->properties->requiredString($item, 'body', 4000);
            $selected = $initialTab === $index;
            $buttons[] = '<span data-g7pb-runtime-button role="tab" data-g7pb-tab="'.$index.'" aria-selected="'.($selected ? 'true' : 'false').'" tabindex="'.($selected ? '0' : '-1').'">'.$this->escape($label).'</span>';
            $bodyMarkup = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-tabs__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $panels[] = '<article role="tabpanel" data-g7pb-tab-panel="'.$index.'" tabindex="0"'.($selected ? '' : ' hidden').'><h3>'.$this->richText->sanitizePromotedInlineRichText($itemHeading).'</h3>'.$bodyMarkup.'</article>';
        }

        return '<section class="g7pb-block g7pb-tabs g7pb-tabs--'.$style.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="tabs" data-g7pb-tabs data-g7pb-tabs-initial="'.$initialTab.'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-tabs__list" role="tablist" aria-label="'.$this->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.implode('', $buttons).'</div><div class="g7pb-tabs__panels">'.implode('', $panels).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileComparisonTable(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'columns', 'rows', 'highlightColumn', 'appearance'], 'Comparison table');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $columns = $props['columns'] ?? null;
        $rows = $props['rows'] ?? null;
        $highlight = $props['highlightColumn'] ?? null;
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! is_array($columns) || count($columns) < 2 || count($columns) > 4) {
            throw new DocumentCompileException('Comparison table must contain between two and four columns.');
        }
        if (! is_array($rows) || count($rows) < 1 || count($rows) > 12) {
            throw new DocumentCompileException('Comparison table must contain between one and twelve rows.');
        }
        if (! is_int($highlight) || $highlight < -1 || $highlight >= count($columns)) {
            throw new DocumentCompileException('Comparison table highlighted column is invalid.');
        }

        $headings = [];
        foreach (array_values($columns) as $index => $column) {
            if (! is_array($column)) {
                throw new DocumentCompileException("Comparison column {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($column, ['title', 'description'], "Comparison column {$index}");
            $title = $this->properties->requiredInlineRichTextString($column, 'title', 120);
            $description = $this->properties->optionalInlineRichTextString($column, 'description', 300) ?? '';
            $headings[] = '<th scope="col"'.($highlight === $index ? ' class="is-highlighted"' : '').'><strong>'.$this->richText->sanitizePromotedInlineRichText($title).'</strong>'.($description === '' ? '' : '<span>'.$this->richText->sanitizePromotedInlineRichText($description).'</span>').'</th>';
        }

        $compiledRows = [];
        foreach (array_values($rows) as $rowIndex => $row) {
            if (! is_array($row)) {
                throw new DocumentCompileException("Comparison row {$rowIndex} must be an object.");
            }
            $this->properties->assertOnlyKeys($row, ['feature', 'values'], "Comparison row {$rowIndex}");
            $feature = $this->properties->requiredInlineRichTextString($row, 'feature', 200);
            $values = $row['values'] ?? null;
            if (! is_array($values) || count($values) !== count($columns)) {
                throw new DocumentCompileException("Comparison row {$rowIndex} values must match the columns.");
            }
            $cells = [];
            foreach (array_values($values) as $columnIndex => $value) {
                if (! is_string($value) || trim($value) === '' || mb_strlen($value) > 300) {
                    throw new DocumentCompileException("Comparison row {$rowIndex} value {$columnIndex} is invalid.");
                }
                $cells[] = '<td'.($highlight === $columnIndex ? ' class="is-highlighted"' : '').'>'.$this->formatText($value).'</td>';
            }
            $compiledRows[] = '<tr><th scope="row">'.$this->richText->sanitizePromotedInlineRichText($feature).'</th>'.implode('', $cells).'</tr>';
        }

        return '<section class="g7pb-block g7pb-comparison '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="comparison-table">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-comparison__scroll" role="region" aria-label="'.$this->escapeAttribute($this->richText->inlinePlainText($heading)).' 비교표" tabindex="0"><table><caption class="g7pb-visually-hidden">'.$this->escape($this->richText->inlinePlainText($heading)).'</caption><thead><tr><th scope="col">항목</th>'.implode('', $headings).'</tr></thead><tbody>'.implode('', $compiledRows).'</tbody></table></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileArticleList(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Article list');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['list', 'grid', 'featured', 'magazine', 'editorial'], true)) {
            throw new DocumentCompileException('Article list layout is invalid.');
        }
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Article list must contain between two and eight items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Article item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['category', 'title', 'summary', 'date', 'imageSrc', 'imageAlt', 'url'], "Article item {$index}");
            $category = $this->properties->optionalString($item, 'category', 80) ?? '';
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 240, allowLinks: false);
            $summary = $this->properties->requiredString($item, 'summary', 1200);
            $date = $this->properties->optionalString($item, 'date', 40) ?? '';
            if ($date !== '') {
                $parsedDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
                if ($parsedDate === false || $parsedDate->format('Y-m-d') !== $date) {
                    throw new DocumentCompileException("Article item {$index} 날짜는 날짜 선택기로 입력해 주세요.");
                }
            }
            $imageSrc = $this->properties->optionalString($item, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($item, 'imageAlt', 300) ?? '';
            $url = $this->properties->requiredString($item, 'url', 2048);
            $this->urls->assertAllowedUrl($url, "Article item {$index}");
            $plainTitle = $this->richText->promotedInlinePlainText($title, allowLinks: false);
            $media = $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $plainTitle, 'g7pb-articles__image', str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT));
            $meta = array_filter([
                $category === '' ? '' : '<span>'.$this->escape($category).'</span>',
                $date === '' ? '' : '<time datetime="'.$this->escapeAttribute($date).'">'.$this->escape($date).'</time>',
            ]);
            $summaryMarkup = $this->richText->hasRichTextMarkup($summary)
                ? '<div class="g7pb-articles__summary">'.$this->richText->sanitizeRichText($summary).'</div>'
                : '<p>'.$this->formatText($summary).'</p>';
            $compiled[] = '<article><figure>'.$media.'</figure><div>'.($meta === [] ? '' : '<p class="g7pb-articles__meta">'.implode('<i>·</i>', $meta).'</p>').'<h3><a href="'.$this->escapeAttribute($url).'">'.$this->richText->sanitizePromotedInlineRichText($title, allowLinks: false).'</a></h3>'.$summaryMarkup.'<a class="g7pb-articles__link" href="'.$this->escapeAttribute($url).'">읽어보기 <span aria-hidden="true">→</span></a></div></article>';
        }

        return '<section class="g7pb-block g7pb-articles g7pb-articles--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="article-list">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-articles__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileVideoEmbed(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'caption', 'provider', 'videoId', 'ratio', 'appearance'], 'Video embed');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $caption = $this->properties->optionalRichTextString($props, 'caption', 1000) ?? '';
        $provider = $this->properties->requiredString($props, 'provider', 16);
        $videoId = $this->properties->requiredString($props, 'videoId', 32);
        $ratio = $this->properties->requiredString($props, 'ratio', 8);
        $appearance = $this->appearanceClasses($props, 'contrast', 'normal');
        if (! in_array($provider, ['youtube', 'vimeo'], true) || preg_match('/^[A-Za-z0-9_-]{6,32}$/D', $videoId) !== 1) {
            throw new DocumentCompileException('Video provider or identifier is invalid.');
        }
        if (! in_array($ratio, ['16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Video ratio is invalid.');
        }
        $src = $provider === 'youtube'
            ? 'https://www.youtube-nocookie.com/embed/'.$videoId.'?rel=0'
            : 'https://player.vimeo.com/video/'.$videoId;

        $captionMarkup = $caption === '' ? '' : '<figcaption>'.($this->richText->hasCanonicalRichTextMarkup($caption) ? $this->richText->sanitizeRichText($caption) : $this->formatText($caption)).'</figcaption>';

        $embed = $this->embedPlaceholder('video-'.$provider, $src, $this->richText->inlinePlainText($heading));

        return '<section class="g7pb-block g7pb-video '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="video-embed">'.$this->compileSectionHeading($eyebrow, $heading).'<figure><div class="g7pb-video__frame" data-ratio="'.$this->escapeAttribute($ratio).'">'.$embed.'</div>'.$captionMarkup.'</figure></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileLogoCarousel(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'logos', 'autoplay', 'interval', 'appearance'], 'Logo carousel');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $autoplay = $this->properties->requiredBoolean($props, 'autoplay');
        $interval = $this->properties->requiredIntegerChoice($props, 'interval', [3000, 5000, 7000]);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! is_array($logos) || count($logos) < 3 || count($logos) > 12) {
            throw new DocumentCompileException('Logo carousel must contain between three and twelve logos.');
        }

        $slides = [];
        foreach (array_values($logos) as $index => $logo) {
            if (! is_array($logo)) {
                throw new DocumentCompileException("Logo carousel item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($logo, ['name', 'imageSrc', 'imageAlt', 'url'], "Logo carousel item {$index}");
            $name = $this->properties->requiredString($logo, 'name', 120);
            $imageSrc = $this->properties->optionalString($logo, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->properties->optionalString($logo, 'imageAlt', 300) ?? '';
            $url = $this->properties->optionalString($logo, 'url', 2048) ?? '';
            $visual = $imageSrc === ''
                ? '<span>'.$this->escape($name).'</span>'
                : $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name.' 로고', 'g7pb-logo-carousel__image', $name);
            if ($url !== '') {
                $this->urls->assertAllowedUrl($url, "Logo carousel item {$index}");
                $visual = '<a href="'.$this->escapeAttribute($url).'" aria-label="'.$this->escapeAttribute($name).'">'.$visual.'</a>';
            }
            $slides[] = '<div class="g7pb-hero-slider__slide g7pb-logo-carousel__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($logos).'">'.$visual.'</div>';
        }

        return '<section class="g7pb-block g7pb-logo-carousel g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" aria-label="'.$this->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTestimonialSlider(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'autoplay', 'interval', 'appearance'], 'Testimonial slider');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $autoplay = $this->properties->requiredBoolean($props, 'autoplay');
        $interval = $this->properties->requiredIntegerChoice($props, 'interval', [5000, 7000, 9000]);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Testimonial slider must contain between two and eight items.');
        }

        $slides = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Testimonial slider item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['quote', 'name', 'role', 'company', 'avatarSrc', 'avatarAlt', 'rating'], "Testimonial slider item {$index}");
            $quote = $this->properties->requiredString($item, 'quote', 1200);
            $name = $this->properties->requiredString($item, 'name', 120);
            $role = $this->properties->optionalString($item, 'role', 120) ?? '';
            $company = $this->properties->optionalString($item, 'company', 120) ?? '';
            $avatarSrc = $this->properties->optionalString($item, 'avatarSrc', 2048) ?? '';
            $avatarAlt = $this->properties->optionalString($item, 'avatarAlt', 300) ?? '';
            $rating = $this->properties->requiredIntegerChoice($item, 'rating', [1, 2, 3, 4, 5]);
            $avatar = $this->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonial-slider__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escape($company).'</span>');
            $quoteMarkup = $this->richText->hasRichTextMarkup($quote)
                ? '<div class="g7pb-testimonial-slider__quote">'.$this->richText->sanitizeRichText($quote).'</div>'
                : '<p class="g7pb-testimonial-slider__quote">'.$this->formatText($quote).'</p>';
            $slides[] = '<blockquote class="g7pb-hero-slider__slide g7pb-testimonial-slider__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($items).'"><p class="g7pb-testimonial-slider__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p>'.$quoteMarkup.'<footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonial-slider g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonial-slider" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" aria-label="'.$this->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileEventSchedule(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Event schedule');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['agenda', 'timeline'], true) || ! is_array($items) || count($items) < 1 || count($items) > 12) {
            throw new DocumentCompileException('Event schedule configuration is invalid.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Event item {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['date', 'time', 'title', 'location', 'description', 'buttonLabel', 'buttonUrl'], "Event item {$index}");
            $date = $this->properties->requiredString($item, 'date', 40);
            $time = $this->properties->optionalString($item, 'time', 40) ?? '';
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 240);
            $location = $this->properties->optionalString($item, 'location', 240) ?? '';
            $description = $this->properties->requiredString($item, 'description', 1500);
            $buttonLabel = $this->properties->optionalString($item, 'buttonLabel', 120) ?? '';
            $buttonUrl = $this->properties->optionalString($item, 'buttonUrl', 2048) ?? '';
            if (($buttonLabel === '') !== ($buttonUrl === '')) {
                throw new DocumentCompileException("Event item {$index} link requires both a label and URL.");
            }
            $action = '';
            if ($buttonUrl !== '') {
                $this->urls->assertAllowedUrl($buttonUrl, "Event item {$index}");
                $action = '<a href="'.$this->escapeAttribute($buttonUrl).'">'.$this->escape($buttonLabel).' <span aria-hidden="true">→</span></a>';
            }
            $descriptionMarkup = $this->richText->hasRichTextMarkup($description)
                ? '<div class="g7pb-events__description">'.$this->richText->sanitizeRichText($description).'</div>'
                : '<p>'.$this->formatText($description).'</p>';
            $compiled[] = '<li><time datetime="'.$this->escapeAttribute($date.($time === '' ? '' : 'T'.$time)).'"><strong>'.$this->escape($date).'</strong>'.($time === '' ? '' : '<span>'.$this->escape($time).'</span>').'</time><article>'.($location === '' ? '' : '<p class="g7pb-events__location">'.$this->escape($location).'</p>').'<h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$descriptionMarkup.$action.'</article></li>';
        }

        return '<section class="g7pb-block g7pb-events g7pb-events--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="event-schedule">'.$this->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileDownloadResources(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'appearance'], 'Download resources');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! is_array($items) || count($items) < 1 || count($items) > 12) {
            throw new DocumentCompileException('Download resources must contain between one and twelve items.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Download resource {$index} must be an object.");
            }
            $this->properties->assertOnlyKeys($item, ['title', 'description', 'fileType', 'fileSize', 'buttonLabel', 'url'], "Download resource {$index}");
            $title = $this->properties->requiredInlineRichTextString($item, 'title', 240);
            $description = $this->properties->optionalString($item, 'description', 1200) ?? '';
            $fileType = $this->properties->requiredString($item, 'fileType', 20);
            $fileSize = $this->properties->optionalString($item, 'fileSize', 40) ?? '';
            $buttonLabel = $this->properties->requiredString($item, 'buttonLabel', 120);
            $url = $this->properties->requiredString($item, 'url', 2048);
            $this->urls->assertAllowedUrl($url, "Download resource {$index}");
            $fileMeta = '<span class="g7pb-downloads__file-type">'.$this->escape($fileType).'</span>'
                .($fileSize === '' ? '' : '<i aria-hidden="true"> · </i><span class="g7pb-downloads__file-size">'.$this->escape($fileSize).'</span>');
            $descriptionMarkup = $description === '' ? '' : ($this->richText->hasRichTextMarkup($description)
                ? '<div class="g7pb-downloads__description">'.$this->richText->sanitizeRichText($description).'</div>'
                : '<p>'.$this->formatText($description).'</p>');
            $compiled[] = '<li><span class="g7pb-downloads__type">'.$this->escape(mb_strtoupper($fileType)).'</span><div><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$descriptionMarkup.'<small>'.$fileMeta.'</small></div><a href="'.$this->escapeAttribute($url).'" download>'.$this->escape($buttonLabel).' <span aria-hidden="true">↓</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-downloads '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="download-resources">'.$this->compileSectionHeading($eyebrow, $heading).'<ul>'.implode('', $compiled).'</ul></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileG7BoardArchive(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'period', 'limit', 'pageSize', 'audience', 'showSearch', 'showBoardFilter', 'emptyMessage', 'appearance'], 'G7 board archive');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->properties->requiredString($props, 'source', 16);
        $period = $this->properties->requiredString($props, 'period', 16);
        $limit = $this->properties->requiredIntegerChoice($props, 'limit', [6, 8, 12]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->properties->requiredIntegerChoice($props, 'pageSize', [3, 4, 6]) : 6;
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $showSearch = $this->properties->requiredBoolean($props, 'showSearch');
        $showBoardFilter = $this->properties->requiredBoolean($props, 'showBoardFilter');
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($source, ['recent', 'popular'], true) || ! in_array($period, ['today', 'week', 'month', 'year'], true) || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 board archive configuration is invalid.');
        }
        $endpoint = $source === 'popular' ? "/api/modules/sirsoft-board/boards/popular?period={$period}&limit={$limit}" : "/api/modules/sirsoft-board/boards/posts/recent?limit={$limit}";
        $hidden = $audience === 'all' ? '' : ' hidden';
        $tools = ($showSearch || $showBoardFilter)
            ? '<div class="g7pb-archive__tools">'
                .($showSearch ? '<label><span class="g7pb-visually-hidden">게시글 제목 검색</span><span data-g7pb-form-control="input" data-g7pb-control-type="search" data-g7pb-control-placeholder="제목 검색" data-g7pb-control-marker="archive-search"></span></label>' : '')
                .($showBoardFilter ? '<label><span class="g7pb-visually-hidden">게시판 선택</span><span data-g7pb-form-control="select" data-g7pb-control-marker="archive-filter">전체 게시판</span></label>' : '')
                .'</div>'
            : '';

        return '<section class="g7pb-block g7pb-dynamic g7pb-board-archive '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-board-archive" data-g7pb-data-source="post-archive" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).$tools.'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">콘텐츠를 불러오는 중입니다.</p><div class="g7pb-dynamic-posts g7pb-board-archive__items" data-g7pb-data-list aria-busy="true"></div>'.$this->compilePagination('게시글').'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileG7ProductShowcase(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'limit', 'pageSize', 'audience', 'detailBasePath', 'layout', 'emptyMessage', 'appearance'], 'G7 product showcase');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->properties->requiredString($props, 'source', 16);
        $limit = $this->properties->requiredIntegerChoice($props, 'limit', [3, 4, 6, 8]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->properties->requiredIntegerChoice($props, 'pageSize', [3, 4]) : 3;
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $detailBasePath = $this->properties->requiredString($props, 'detailBasePath', 200);
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($source, ['latest', 'new', 'popular'], true) || ! in_array($audience, ['all', 'guest', 'member'], true) || ! in_array($layout, ['featured', 'rail'], true) || preg_match('#^/[A-Za-z0-9/_-]*$#', $detailBasePath) !== 1) {
            throw new DocumentCompileException('G7 product showcase configuration is invalid.');
        }
        $endpoint = match ($source) {
            'new' => "/api/modules/sirsoft-ecommerce/products/new?limit={$limit}",
            'popular' => "/api/modules/sirsoft-ecommerce/products/popular?limit={$limit}",
            default => "/api/modules/sirsoft-ecommerce/products?per_page={$limit}&sort=latest",
        };
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-product-showcase g7pb-product-showcase--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-showcase" data-g7pb-data-source="product-showcase" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-product-base="'.$this->escapeAttribute(rtrim($detailBasePath, '/')).'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-dynamic-products g7pb-product-showcase__items" data-g7pb-data-list aria-busy="true"></div>'.$this->compilePagination('상품').'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileG7PostDetail(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'boardSlug', 'postId', 'detailUrl', 'linkLabel', 'audience', 'showContent', 'emptyMessage', 'appearance'], 'G7 post detail');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $boardSlug = $this->properties->requiredString($props, 'boardSlug', 80);
        $postId = $props['postId'] ?? null;
        $detailUrl = $this->properties->requiredString($props, 'detailUrl', 2048);
        $linkLabel = $this->properties->requiredString($props, 'linkLabel', 120);
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $showContent = $this->properties->requiredBoolean($props, 'showContent');
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/D', $boardSlug) !== 1
            || ! is_int($postId) || $postId < 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 post detail configuration is invalid.');
        }
        $this->urls->assertAllowedUrl($detailUrl, 'G7 post detail');
        $endpoint = '/api/modules/sirsoft-board/boards/'.rawurlencode($boardSlug).'/posts/'.$postId;
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-post-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-post-detail" data-g7pb-data-source="post-detail" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escapeAttribute($linkLabel).'" data-g7pb-show-content="'.($showContent ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">게시글을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escapeAttribute($detailUrl).'" hidden>'.$this->escape($linkLabel).'</a></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileG7ProductDetail(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'productKey', 'detailUrl', 'buttonLabel', 'audience', 'showDescription', 'emptyMessage', 'appearance'], 'G7 product detail');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $productKey = $this->properties->requiredString($props, 'productKey', 100);
        $detailUrl = $this->properties->requiredString($props, 'detailUrl', 2048);
        $buttonLabel = $this->properties->requiredString($props, 'buttonLabel', 120);
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $showDescription = $this->properties->requiredBoolean($props, 'showDescription');
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/D', $productKey) !== 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 product detail configuration is invalid.');
        }
        $this->urls->assertAllowedUrl($detailUrl, 'G7 product detail');
        $endpoint = '/api/modules/sirsoft-ecommerce/products/'.rawurlencode($productKey);
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-product-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-detail" data-g7pb-data-source="product-detail" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escapeAttribute($buttonLabel).'" data-g7pb-show-description="'.($showDescription ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escapeAttribute($detailUrl).'" hidden>'.$this->escape($buttonLabel).'</a></div></section>';
    }

    private function compilePagination(string $label): string
    {
        return '<nav class="g7pb-dynamic-pagination" data-g7pb-pagination aria-label="'.$this->escapeAttribute($label).' 페이지" hidden><span data-g7pb-runtime-button data-g7pb-page-prev>이전</span><span data-g7pb-page-status aria-live="polite">1 / 1</span><span data-g7pb-runtime-button data-g7pb-page-next>다음</span></nav>';
    }

    private function compileSectionHeading(?string $eyebrow, string $heading): string
    {
        $eyebrowMarkup = $eyebrow === null || $eyebrow === ''
            ? ''
            : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';

        return '<header class="g7pb-section-heading">'.$eyebrowMarkup.'<h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2></header>';
    }

    private function compileCatalogImage(
        string $src,
        string $alt,
        string $className,
        string $placeholderLabel,
        string $loading = 'lazy',
    ): string {
        if ($src === '') {
            return '<span class="g7pb-media-placeholder '.$className.'" role="img" aria-label="'.$this->escapeAttribute($placeholderLabel).'"><span>'.$this->escape($placeholderLabel).'</span></span>';
        }

        if ($alt === '') {
            throw new DocumentCompileException('Image alternative text is required.');
        }

        $this->urls->assertAllowedImageUrl($src);

        return '<img class="'.$className.'" src="'.$this->escapeAttribute($src).'" alt="'.$this->escapeAttribute($alt).'" loading="'.$loading.'">';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function appearanceClasses(array $props, string $defaultSurface, string $defaultSpacing): string
    {
        $appearance = $this->properties->optionalMap($props, 'appearance') ?? [];
        $this->properties->assertOnlyKeys($appearance, ['surface', 'spacing', 'textScale', 'textAlign', 'containerWidth', 'containerAlign', 'minHeight', 'verticalAlign', 'elements'], 'Block appearance');
        $surface = $this->properties->optionalString($appearance, 'surface', 16) ?? $defaultSurface;
        $spacing = $this->properties->optionalString($appearance, 'spacing', 16) ?? $defaultSpacing;
        $textScale = $this->properties->optionalString($appearance, 'textScale', 16) ?? 'balanced';
        $textAlign = $this->properties->optionalString($appearance, 'textAlign', 16) ?? 'left';
        $containerWidth = $this->properties->optionalString($appearance, 'containerWidth', 16) ?? 'inherit';
        $containerAlign = $this->properties->optionalString($appearance, 'containerAlign', 16) ?? 'center';
        $minHeight = $this->properties->optionalString($appearance, 'minHeight', 16) ?? 'auto';
        $verticalAlign = $this->properties->optionalString($appearance, 'verticalAlign', 16) ?? 'start';

        if (! in_array($surface, ['default', 'soft', 'contrast'], true)) {
            throw new DocumentCompileException('Block appearance surface is invalid.');
        }

        if (! in_array($spacing, ['compact', 'normal', 'spacious'], true)) {
            throw new DocumentCompileException('Block appearance spacing is invalid.');
        }

        if (! in_array($textScale, ['compact', 'balanced', 'large'], true) || ! in_array($textAlign, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Block typography appearance is invalid.');
        }
        if (! in_array($containerWidth, ['inherit', 'narrow', 'standard', 'wide', 'full'], true)
            || ! in_array($containerAlign, ['left', 'center', 'right', 'stretch'], true)
            || ! in_array($minHeight, ['auto', 'compact', 'medium', 'large', 'viewport'], true)
            || ! in_array($verticalAlign, ['start', 'center', 'end'], true)) {
            throw new DocumentCompileException('Block container appearance is invalid.');
        }

        $classes = 'g7pb-surface--'.$surface.' g7pb-spacing--'.$spacing;
        if (array_key_exists('textScale', $appearance) || $textScale !== 'balanced') {
            $classes .= ' g7pb-text-scale--'.$textScale;
        }
        if (array_key_exists('textAlign', $appearance) || $textAlign !== 'left') {
            $classes .= ' g7pb-text-align--'.$textAlign;
        }
        $classes .= ' g7pb-container-width--'.$containerWidth
            .' g7pb-container-align--'.$containerAlign
            .' g7pb-container-height--'.$minHeight
            .' g7pb-container-vertical--'.$verticalAlign;

        return $classes;
    }

    /**
     * @param  array<string, mixed>  $link
     */
    private function compileActionLink(array $link, string $property, string $className): string
    {
        $this->properties->assertOnlyKeys($link, ['label', 'url'], $property);
        $label = $this->properties->requiredString($link, 'label', 120);
        $url = $this->properties->requiredString($link, 'url', 2048);
        $this->urls->assertAllowedUrl($url, $property);

        return '<a class="'.$className.'" href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a>';
    }

    private function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }

    private function formatText(string $value): string
    {
        return nl2br($this->escape($value), false);
    }

    private function catalogIconSvg(string $name, string $className): string
    {
        $resolved = match ($name) {
            'instagram' => 'camera',
            'youtube' => 'play',
            'facebook' => 'users',
            'linkedin' => 'briefcase',
            'x' => 'at-sign',
            'kakao' => 'message',
            'blog' => 'rss',
            'website' => 'external-link',
            default => $name,
        };
        $markup = self::CATALOG_ICON_MARKUP[$resolved] ?? self::CATALOG_ICON_MARKUP['check'];

        return '<span class="'.$this->escapeAttribute($className).'" data-g7pb-runtime-icon data-g7pb-icon-markup="'.$this->escapeAttribute($markup).'" aria-hidden="true"></span>';
    }

    private function embedPlaceholder(
        string $kind,
        string $src,
        string $title,
    ): string {
        return '<span data-g7pb-embed data-g7pb-embed-kind="'.$this->escapeAttribute($kind).'" data-g7pb-embed-src="'.$this->escapeAttribute($src).'" data-g7pb-embed-title="'.$this->escapeAttribute($title).'"></span>';
    }

    private function assertTemplateCompatibleMarkup(string $html, string $context): void
    {
        $pattern = '/<\s*\/?\s*('.implode('|', array_map(static fn (string $tag): string => preg_quote($tag, '/'), self::TEMPLATE_FORBIDDEN_TAGS)).')\b/i';
        if (preg_match($pattern, $html, $matches) === 1) {
            throw new DocumentCompileException(
                $context.' contains markup removed by the active G7 HtmlContent sanitizer: '.strtolower($matches[1]).'.',
                'G7PB_TEMPLATE_MARKUP_UNSUPPORTED',
            );
        }
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }

    private function escapeAttribute(string $value): string
    {
        return $this->escape($value);
    }
}
