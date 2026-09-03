<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\CallbackBlockTypeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockRuntimeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\AnchorMenuBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ArticleListBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BarChartBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BlockquoteBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BreadcrumbsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ButtonsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\CardGridBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ComparisonTableBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ContactBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\CtaBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\DividerBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\DownloadResourcesBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\EventScheduleBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\FaqAccordionBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\FeaturesBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7BoardArchiveBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7PostDetailBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7ProductDetailBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7ProductGridBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7ProductShowcaseBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\G7RecentPostsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\GalleryBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeadingBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroSliderBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroSplitBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\IconListBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageCarouselBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageTextBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\InquiryFormBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\LogoCarouselBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\LogoCloudBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\MapDirectionsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\NoticeBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\PricingBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ProcessTimelineBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\RichTextBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\SocialLinksBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\StatsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TabsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TeamBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TestimonialsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TestimonialSliderBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\VideoEmbedBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BuiltInBlockTypes;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
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

    private BlockCompilerRegistry $blockCompilers;

    private readonly RichTextSanitizer $richText;

    private readonly BlockPropertyReader $properties;

    private readonly BlockRuntimeCompiler $runtime;

    private readonly BlockAppearanceCompiler $appearance;

    private readonly BlockMarkupCompiler $markup;

    private readonly BlockIconCompiler $icons;

    private readonly HtmlEscaper $escaper;

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
        $this->escaper = new HtmlEscaper;
        $this->appearance = new BlockAppearanceCompiler($this->properties);
        $this->markup = new BlockMarkupCompiler($this->properties, $this->urls, $this->richText, $this->escaper);
        $this->icons = new BlockIconCompiler($this->escaper);
        $this->runtime = new BlockRuntimeCompiler($this->properties, $this->escaper);
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
            fn (string $url): string => '<link rel="stylesheet" href="'.$this->escaper->escapeAttribute($url).'">',
            array_keys($styleUrls),
        );
        $customPaletteStyle = $this->theme->customPaletteDeclarations($design);
        $body = '<div class="'.$this->theme->className($design).'"'.($customPaletteStyle === '' ? '' : ' style="'.$this->escaper->escapeAttribute($customPaletteStyle).'"').'>'."\n"
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
        /** @var array<string, BlockTypeCompilerPort|(\Closure(array<string, mixed>): string)> $compilers */
        $compilers = [
            'builtin.hero-centered-01' => new HeroBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.features-grid-01' => new FeaturesBlockCompiler($this->properties, $this->appearance, $this->icons, $this->escaper, $this->richText),
            'builtin.cta-split-01' => new CtaBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.contact-info-01' => new ContactBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.hero-split-01' => new HeroSplitBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.hero-slider-01' => new HeroSliderBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.logo-cloud-01' => new LogoCloudBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.stats-icons-01' => new StatsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->icons, $this->escaper, $this->richText),
            'builtin.pricing-tiers-01' => new PricingBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.team-grid-01' => new TeamBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.gallery-grid-01' => new GalleryBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.bar-chart-01' => new BarChartBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.g7-board-recent-posts-01' => new G7RecentPostsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.g7-ecommerce-product-grid-01' => new G7ProductGridBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.inquiry-form-01' => new InquiryFormBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.map-directions-01' => new MapDirectionsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.testimonials-01' => new TestimonialsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.faq-accordion-01' => new FaqAccordionBlockCompiler($this->properties, $this->appearance, $this->markup, $this->richText),
            'builtin.process-timeline-01' => new ProcessTimelineBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.tabs-01' => new TabsBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.comparison-table-01' => new ComparisonTableBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.article-list-01' => new ArticleListBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.video-embed-01' => new VideoEmbedBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.logo-carousel-01' => new LogoCarouselBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.testimonial-slider-01' => new TestimonialSliderBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.event-schedule-01' => new EventScheduleBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.download-resources-01' => new DownloadResourcesBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.g7-board-content-archive-01' => new G7BoardArchiveBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.g7-ecommerce-product-showcase-01' => new G7ProductShowcaseBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper),
            'builtin.g7-board-post-detail-01' => new G7PostDetailBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.g7-ecommerce-product-detail-01' => new G7ProductDetailBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.heading-01' => new HeadingBlockCompiler($this->properties, $this->appearance, $this->escaper, $this->richText),
            'builtin.rich-text-01' => new RichTextBlockCompiler($this->properties, $this->appearance, $this->richText),
            'builtin.image-01' => new ImageBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.buttons-01' => new ButtonsBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper),
            'builtin.image-text-01' => new ImageTextBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.icon-list-01' => new IconListBlockCompiler($this->properties, $this->appearance, $this->markup, $this->icons, $this->escaper, $this->richText),
            'builtin.divider-01' => new DividerBlockCompiler($this->properties, $this->appearance, $this->escaper),
            'builtin.blockquote-01' => new BlockquoteBlockCompiler($this->properties, $this->appearance, $this->escaper, $this->richText),
            'builtin.notice-01' => new NoticeBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper, $this->richText),
            'builtin.card-grid-01' => new CardGridBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.breadcrumbs-01' => new BreadcrumbsBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper),
            'builtin.anchor-menu-01' => new AnchorMenuBlockCompiler($this->properties, $this->appearance, $this->escaper),
            'builtin.social-links-01' => new SocialLinksBlockCompiler($this->properties, $this->appearance, $this->urls, $this->icons, $this->escaper, $this->richText),
            'builtin.image-carousel-01' => new ImageCarouselBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
        ];

        foreach ($compilers as $key => $compiler) {
            if (! $this->blockCompilers->has($key)) {
                $this->blockCompilers->register($compiler instanceof BlockTypeCompilerPort ? $compiler : new CallbackBlockTypeCompiler($key, $compiler));
            }
        }
    }

    private function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
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
}
