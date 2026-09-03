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
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\BarChartBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ButtonsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ContactBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\CtaBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\DownloadResourcesBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\EventScheduleBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\FeaturesBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\GalleryBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeadingBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroSliderBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\HeroSplitBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\IconListBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\ImageTextBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\LogoCarouselBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\LogoCloudBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\PricingBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\RichTextBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\StatsBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TeamBlockCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks\TestimonialSliderBlockCompiler;
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
            'builtin.logo-carousel-01' => new LogoCarouselBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.testimonial-slider-01' => new TestimonialSliderBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.event-schedule-01' => new EventScheduleBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.download-resources-01' => new DownloadResourcesBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper, $this->richText),
            'builtin.g7-board-content-archive-01' => fn (array $props): string => $this->compileG7BoardArchive($props),
            'builtin.g7-ecommerce-product-showcase-01' => fn (array $props): string => $this->compileG7ProductShowcase($props),
            'builtin.g7-board-post-detail-01' => fn (array $props): string => $this->compileG7PostDetail($props),
            'builtin.g7-ecommerce-product-detail-01' => fn (array $props): string => $this->compileG7ProductDetail($props),
            'builtin.heading-01' => new HeadingBlockCompiler($this->properties, $this->appearance, $this->escaper, $this->richText),
            'builtin.rich-text-01' => new RichTextBlockCompiler($this->properties, $this->appearance, $this->richText),
            'builtin.image-01' => new ImageBlockCompiler($this->properties, $this->appearance, $this->markup, $this->urls, $this->escaper),
            'builtin.buttons-01' => new ButtonsBlockCompiler($this->properties, $this->appearance, $this->urls, $this->escaper),
            'builtin.image-text-01' => new ImageTextBlockCompiler($this->properties, $this->appearance, $this->markup, $this->escaper, $this->richText),
            'builtin.icon-list-01' => new IconListBlockCompiler($this->properties, $this->appearance, $this->markup, $this->icons, $this->escaper, $this->richText),
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
                $this->blockCompilers->register($compiler instanceof BlockTypeCompilerPort ? $compiler : new CallbackBlockTypeCompiler($key, $compiler));
            }
        }
    }

    /** @param array<string, mixed> $props */
    private function compileDivider(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['variant', 'width', 'label', 'appearance'], 'Divider');
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $width = $this->properties->requiredString($props, 'width', 16);
        $label = $this->properties->optionalString($props, 'label', 120) ?? '';
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
        if (! in_array($variant, ['solid', 'dashed', 'gradient'], true)) {
            throw new DocumentCompileException('Divider variant is invalid.');
        }
        if (! in_array($width, ['narrow', 'standard', 'full'], true)) {
            throw new DocumentCompileException('Divider width is invalid.');
        }
        $labelMarkup = $label === '' ? '' : '<span class="g7pb-divider__label">'.$this->escaper->escape($label).'</span>';

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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($alignment, ['left', 'center'], true) || ! in_array($variant, ['line', 'mark'], true)) {
            throw new DocumentCompileException('Blockquote alignment or variant is invalid.');
        }
        $roleMarkup = $role === '' ? '' : '<span class="g7pb-blockquote__role">'.$this->escaper->escape($role).'</span>';

        $quoteMarkup = $this->richText->hasRichTextMarkup($quote)
            ? '<div class="g7pb-blockquote__quote">'.$this->richText->sanitizeRichText($quote).'</div>'
            : '<p class="g7pb-blockquote__quote">'.$this->escaper->formatText($quote).'</p>';

        return '<section class="g7pb-block g7pb-blockquote g7pb-blockquote--'.$alignment.' g7pb-blockquote--'.$variant.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="blockquote"><blockquote>'.$quoteMarkup.'<footer><cite>'.$this->escaper->escape($citation).'</cite>'.$roleMarkup.'</footer></blockquote></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'compact');
        if (! in_array($tone, ['info', 'success', 'warning', 'critical'], true)) {
            throw new DocumentCompileException('Notice tone is invalid.');
        }
        if (($actionLabel === '') !== ($actionUrl === '')) {
            throw new DocumentCompileException('Notice action label and URL must be provided together.');
        }
        $action = '';
        if ($actionLabel !== '') {
            $this->urls->assertAllowedUrl($actionUrl, 'Notice action');
            $action = '<a class="g7pb-content-notice__action" href="'.$this->escaper->escapeAttribute($actionUrl).'">'.$this->escaper->escape($actionLabel).'<span aria-hidden="true"> →</span></a>';
        }
        $role = $tone === 'critical' ? 'alert' : 'note';

        $bodyMarkup = $this->richText->hasRichTextMarkup($body)
            ? '<div class="g7pb-content-notice__body">'.$this->richText->sanitizeRichText($body).'</div>'
            : '<p class="g7pb-content-notice__body">'.$this->escaper->formatText($body).'</p>';

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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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
                $link = '<a href="'.$this->escaper->escapeAttribute($linkUrl).'">'.$this->escaper->escape($linkLabel).'<span aria-hidden="true"> →</span></a>';
            }
            $bodyMarkup = $body === '' ? '' : ($this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-card-grid__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-card-grid__body">'.$this->escaper->formatText($body).'</p>');
            $compiled[] = '<article class="g7pb-card-grid__item">'.($kicker === '' ? '' : '<p class="g7pb-card-grid__kicker">'.$this->escaper->escape($kicker).'</p>').'<h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-card-grid--layout-'.$layout;

        return '<section class="g7pb-block g7pb-card-grid g7pb-card-grid--'.$columns.' g7pb-card-grid--'.$variant.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="card-grid">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-card-grid__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileBreadcrumbs(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['items', 'currentLabel', 'appearance'], 'Breadcrumbs');
        $items = $props['items'] ?? null;
        $currentLabel = $this->properties->requiredString($props, 'currentLabel', 160);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
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
            $compiled[] = '<li><a href="'.$this->escaper->escapeAttribute($url).'">'.$this->escaper->escape($label).'</a></li>';
        }
        $compiled[] = '<li aria-current="page">'.$this->escaper->escape($currentLabel).'</li>';

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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
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
            $compiled[] = '<li><a href="#'.$this->escaper->escapeAttribute($anchor).'">'.$this->escaper->escape($itemLabel).'</a></li>';
        }
        $stickyClass = $sticky ? ' g7pb-anchor-menu--sticky' : '';

        return '<section class="g7pb-block g7pb-anchor-menu g7pb-anchor-menu--'.$alignment.$stickyClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="anchor-menu"><nav aria-label="'.$this->escaper->escapeAttribute($label).'"><strong>'.$this->escaper->escape($label).'</strong><ul>'.implode('', $compiled).'</ul></nav></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileSocialLinks(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['heading', 'items', 'variant', 'alignment', 'appearance'], 'Social links');
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $variant = $this->properties->requiredString($props, 'variant', 16);
        $alignment = $this->properties->requiredString($props, 'alignment', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');
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
            $compiled[] = '<li><a class="g7pb-social-links__link g7pb-social-links__link--'.$network.'" href="'.$this->escaper->escapeAttribute($url).'" rel="noopener noreferrer"><span class="g7pb-social-links__icon" aria-hidden="true">'.$this->icons->catalogIconSvg($network, 'g7pb-social-links__glyph').'</span><span>'.$this->escaper->escape($label).'</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-social-links g7pb-social-links--'.$variant.' g7pb-social-links--'.$alignment.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="social-links"><nav aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'"><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $compiled).'</ul></nav></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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
            $media = $this->markup->compileCatalogImage($src, $alt, 'g7pb-image-carousel__image', ($index + 1).'번 이미지를 선택하세요', $index === 0 ? 'eager' : 'lazy');
            $slides[] = '<figure class="g7pb-hero-slider__slide g7pb-image-carousel__slide">'.$media.($caption === '' ? '' : '<figcaption>'.$this->escaper->escape($caption).'</figcaption>').'</figure>';
        }

        return '<section class="g7pb-block g7pb-hero-slider g7pb-image-carousel g7pb-image-carousel--'.str_replace(':', '-', $aspectRatio).' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" data-g7pb-slider-controls="'.$controls.'" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');

        if (! in_array($source, ['recent', 'popular'], true)
            || ! in_array($period, ['today', 'week', 'month', 'year'], true)
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 recent posts configuration is invalid.');
        }

        $endpoint = $source === 'popular'
            ? "/api/modules/sirsoft-board/boards/popular?period={$period}&limit={$limit}"
            : "/api/modules/sirsoft-board/boards/posts/recent?limit={$limit}";
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--posts '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-recent-posts" data-g7pb-data-source="posts" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">콘텐츠를 불러오는 중입니다.</p><div class="g7pb-dynamic-posts" data-g7pb-data-list aria-busy="true"></div>'.$this->markup->compilePagination('게시글').'</section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');

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

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--products '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-grid" data-g7pb-data-source="products" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-product-base="'.$this->escaper->escapeAttribute(rtrim($detailBasePath, '/')).'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-dynamic-products g7pb-dynamic-products--'.$columns.'" data-g7pb-data-list aria-busy="true"></div>'.$this->markup->compilePagination('상품').'</section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($kind, ['inquiry', 'quote', 'reservation', 'application', 'newsletter'], true)) {
            throw new DocumentCompileException('Inquiry form kind is invalid.');
        }

        $phone = $showPhone ? '<label><span>전화번호</span><span data-g7pb-form-control="input" data-g7pb-control-type="tel" data-g7pb-control-name="phone" data-g7pb-control-maxlength="40" data-g7pb-control-autocomplete="tel"></span></label>' : '';
        $subject = $showSubject ? '<label class="g7pb-inquiry-form__wide"><span>문의 제목</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="subject" data-g7pb-control-maxlength="200"></span></label>' : '';

        return '<section class="g7pb-block g7pb-inquiry '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="inquiry-form">'
            .'<div class="g7pb-inquiry__intro">'.$this->markup->compileSectionHeading($eyebrow, $heading).($description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description) ? '<div class="g7pb-inquiry__description">'.$this->richText->sanitizeRichText($description).'</div>' : '<p>'.$this->escaper->formatText($description).'</p>')).'</div>'
            .'<div class="g7pb-inquiry-form" data-g7pb-inquiry-host data-g7pb-inquiry-form data-g7pb-form-action="/pages/__G7PB_PAGE_SLUG__/inquiries" data-g7pb-form-kind="'.$kind.'" data-g7pb-success-message="'.$this->escaper->escapeAttribute($successMessage).'" data-g7pb-privacy-label="'.$this->escaper->escapeAttribute($privacyLabel).'" data-g7pb-submit-label="'.$this->escaper->escapeAttribute($submitLabel).'" data-g7pb-show-phone="'.($showPhone ? 'true' : 'false').'" data-g7pb-show-subject="'.($showSubject ? 'true' : 'false').'">'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="form_kind" data-g7pb-control-value="'.$kind.'"></span>'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="block_instance_id"></span>'
            .'<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="started_at"></span>'
            .'<label class="g7pb-inquiry-form__honeypot" aria-hidden="true"><span>웹사이트</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="website" data-g7pb-control-tabindex="-1" data-g7pb-control-autocomplete="off"></span></label>'
            .'<label><span>이름</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="name" data-g7pb-control-maxlength="120" data-g7pb-control-autocomplete="name" data-g7pb-control-required="true"></span></label>'
            .'<label><span>이메일</span><span data-g7pb-form-control="input" data-g7pb-control-type="email" data-g7pb-control-name="email" data-g7pb-control-maxlength="320" data-g7pb-control-autocomplete="email" data-g7pb-control-required="true"></span></label>'.$phone.$subject
            .'<label class="g7pb-inquiry-form__wide"><span>문의 내용</span><span data-g7pb-form-control="textarea" data-g7pb-control-name="message" data-g7pb-control-maxlength="5000" data-g7pb-control-rows="6" data-g7pb-control-required="true"></span></label>'
            .'<label class="g7pb-inquiry-form__consent"><span data-g7pb-form-control="input" data-g7pb-control-type="checkbox" data-g7pb-control-name="privacy" data-g7pb-control-value="1" data-g7pb-control-required="true"></span><span data-g7pb-privacy-copy>'.$this->escaper->escape($privacyLabel).'</span></label>'
            .'<div class="g7pb-inquiry-form__footer"><span data-g7pb-form-control="button" data-g7pb-control-type="submit" data-g7pb-submit-copy>'.$this->escaper->escape($submitLabel).'</span><p role="status" aria-live="polite" data-g7pb-form-status></p></div></div>'
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($provider, ['image', 'openstreetmap', 'google', 'none'], true)) {
            throw new DocumentCompileException('Map provider is invalid.');
        }
        $this->urls->assertAllowedUrl($directionsUrl, 'Directions link');

        $map = '<div class="g7pb-map__placeholder" role="img" aria-label="'.$this->escaper->escapeAttribute($address).' 지도 자리"><span>지도 표시 안 함</span></div>';
        if ($provider === 'image') {
            $map = $this->markup->compileCatalogImage($mapImageSrc, $mapImageAlt, 'g7pb-map__image', '지도 이미지를 등록하세요');
        } elseif ($provider === 'openstreetmap') {
            $delta = match ($zoom) {
                18 => 0.002, 16 => 0.008, 14 => 0.03, default => 0.12
            };
            $bbox = implode(',', [$longitude - $delta, $latitude - $delta, $longitude + $delta, $latitude + $delta]);
            $src = 'https://www.openstreetmap.org/export/embed.html?bbox='.rawurlencode($bbox).'&marker='.rawurlencode($latitude.','.$longitude);
            $map = $this->markup->embedPlaceholder('map-openstreetmap', $src, $address.' 지도');
        } elseif ($provider === 'google') {
            $src = 'https://www.google.com/maps?q='.rawurlencode($latitude.','.$longitude).'&z='.$zoom.'&output=embed';
            $map = $this->markup->embedPlaceholder('map-google', $src, $address.' 지도');
        }
        $details = '<address><strong>'.$this->escaper->escape($address).'</strong>'
            .($phone === '' ? '' : '<span class="g7pb-map__phone">'.$this->escaper->escape($phone).'</span>')
            .($hours === '' ? '' : '<span class="g7pb-map__hours">'.$this->escaper->formatText($hours).'</span>')
            .($parking === '' ? '' : '<span class="g7pb-map__parking">'.$this->escaper->formatText($parking).'</span>')
            .'<a class="g7pb-button g7pb-button--primary" href="'.$this->escaper->escapeAttribute($directionsUrl).'">'.$this->escaper->escape($directionsLabel).'</a></address>';

        $descriptionMarkup = $description === '' ? '' : ($this->richText->hasCanonicalRichTextMarkup($description)
            ? '<div class="g7pb-map__description">'.$this->richText->sanitizeRichText($description).'</div>'
            : '<p>'.$this->escaper->formatText($description).'</p>');

        return '<section class="g7pb-block g7pb-map '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="map-directions"><div class="g7pb-map__intro">'.$this->markup->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.$details.'</div><div class="g7pb-map__frame">'.$map.'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTestimonials(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Testimonials');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
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
            $avatar = $this->markup->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonials__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escaper->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escaper->escape($company).'</span>');
            $compiled[] = '<blockquote><p class="g7pb-testimonials__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p><div class="g7pb-testimonials__quote">'.$this->richText->sanitizeRichText($quote).'</div><footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escaper->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonials g7pb-testimonials--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonials">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-testimonials__items">'.implode('', $compiled).'</div></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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

        return '<section class="g7pb-block g7pb-faq '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="faq-accordion" data-g7pb-accordion data-g7pb-accordion-behavior="'.$behavior.'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-faq__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileProcessTimeline(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Process timeline');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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
                $link = '<a href="'.$this->escaper->escapeAttribute($linkUrl).'">'.$this->escaper->escape($linkLabel).' <span aria-hidden="true">→</span></a>';
            }
            $bodyMarkup = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-process__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->escaper->formatText($body).'</p>';
            $compiled[] = '<li><span class="g7pb-process__number">'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT).'</span><h3>'.$this->richText->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</li>';
        }

        return '<section class="g7pb-block g7pb-process g7pb-process--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="process-timeline">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
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
            $buttons[] = '<span data-g7pb-runtime-button role="tab" data-g7pb-tab="'.$index.'" aria-selected="'.($selected ? 'true' : 'false').'" tabindex="'.($selected ? '0' : '-1').'">'.$this->escaper->escape($label).'</span>';
            $bodyMarkup = $this->richText->hasRichTextMarkup($body)
                ? '<div class="g7pb-tabs__body">'.$this->richText->sanitizeRichText($body).'</div>'
                : '<p>'.$this->escaper->formatText($body).'</p>';
            $panels[] = '<article role="tabpanel" data-g7pb-tab-panel="'.$index.'" tabindex="0"'.($selected ? '' : ' hidden').'><h3>'.$this->richText->sanitizePromotedInlineRichText($itemHeading).'</h3>'.$bodyMarkup.'</article>';
        }

        return '<section class="g7pb-block g7pb-tabs g7pb-tabs--'.$style.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="tabs" data-g7pb-tabs data-g7pb-tabs-initial="'.$initialTab.'">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-tabs__list" role="tablist" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).'">'.implode('', $buttons).'</div><div class="g7pb-tabs__panels">'.implode('', $panels).'</div></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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
                $cells[] = '<td'.($highlight === $columnIndex ? ' class="is-highlighted"' : '').'>'.$this->escaper->formatText($value).'</td>';
            }
            $compiledRows[] = '<tr><th scope="row">'.$this->richText->sanitizePromotedInlineRichText($feature).'</th>'.implode('', $cells).'</tr>';
        }

        return '<section class="g7pb-block g7pb-comparison '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="comparison-table">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-comparison__scroll" role="region" aria-label="'.$this->escaper->escapeAttribute($this->richText->inlinePlainText($heading)).' 비교표" tabindex="0"><table><caption class="g7pb-visually-hidden">'.$this->escaper->escape($this->richText->inlinePlainText($heading)).'</caption><thead><tr><th scope="col">항목</th>'.implode('', $headings).'</tr></thead><tbody>'.implode('', $compiledRows).'</tbody></table></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileArticleList(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Article list');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->properties->requiredString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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
            $media = $this->markup->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $plainTitle, 'g7pb-articles__image', str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT));
            $meta = array_filter([
                $category === '' ? '' : '<span>'.$this->escaper->escape($category).'</span>',
                $date === '' ? '' : '<time datetime="'.$this->escaper->escapeAttribute($date).'">'.$this->escaper->escape($date).'</time>',
            ]);
            $summaryMarkup = $this->richText->hasRichTextMarkup($summary)
                ? '<div class="g7pb-articles__summary">'.$this->richText->sanitizeRichText($summary).'</div>'
                : '<p>'.$this->escaper->formatText($summary).'</p>';
            $compiled[] = '<article><figure>'.$media.'</figure><div>'.($meta === [] ? '' : '<p class="g7pb-articles__meta">'.implode('<i>·</i>', $meta).'</p>').'<h3><a href="'.$this->escaper->escapeAttribute($url).'">'.$this->richText->sanitizePromotedInlineRichText($title, allowLinks: false).'</a></h3>'.$summaryMarkup.'<a class="g7pb-articles__link" href="'.$this->escaper->escapeAttribute($url).'">읽어보기 <span aria-hidden="true">→</span></a></div></article>';
        }

        return '<section class="g7pb-block g7pb-articles g7pb-articles--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="article-list">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-articles__items">'.implode('', $compiled).'</div></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'contrast', 'normal');
        if (! in_array($provider, ['youtube', 'vimeo'], true) || preg_match('/^[A-Za-z0-9_-]{6,32}$/D', $videoId) !== 1) {
            throw new DocumentCompileException('Video provider or identifier is invalid.');
        }
        if (! in_array($ratio, ['16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Video ratio is invalid.');
        }
        $src = $provider === 'youtube'
            ? 'https://www.youtube-nocookie.com/embed/'.$videoId.'?rel=0'
            : 'https://player.vimeo.com/video/'.$videoId;

        $captionMarkup = $caption === '' ? '' : '<figcaption>'.($this->richText->hasCanonicalRichTextMarkup($caption) ? $this->richText->sanitizeRichText($caption) : $this->escaper->formatText($caption)).'</figcaption>';

        $embed = $this->markup->embedPlaceholder('video-'.$provider, $src, $this->richText->inlinePlainText($heading));

        return '<section class="g7pb-block g7pb-video '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="video-embed">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<figure><div class="g7pb-video__frame" data-ratio="'.$this->escaper->escapeAttribute($ratio).'">'.$embed.'</div>'.$captionMarkup.'</figure></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
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

        return '<section class="g7pb-block g7pb-dynamic g7pb-board-archive '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-board-archive" data-g7pb-data-source="post-archive" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).$tools.'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">콘텐츠를 불러오는 중입니다.</p><div class="g7pb-dynamic-posts g7pb-board-archive__items" data-g7pb-data-list aria-busy="true"></div>'.$this->markup->compilePagination('게시글').'</section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($source, ['latest', 'new', 'popular'], true) || ! in_array($audience, ['all', 'guest', 'member'], true) || ! in_array($layout, ['featured', 'rail'], true) || preg_match('#^/[A-Za-z0-9/_-]*$#', $detailBasePath) !== 1) {
            throw new DocumentCompileException('G7 product showcase configuration is invalid.');
        }
        $endpoint = match ($source) {
            'new' => "/api/modules/sirsoft-ecommerce/products/new?limit={$limit}",
            'popular' => "/api/modules/sirsoft-ecommerce/products/popular?limit={$limit}",
            default => "/api/modules/sirsoft-ecommerce/products?per_page={$limit}&sort=latest",
        };
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-product-showcase g7pb-product-showcase--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-showcase" data-g7pb-data-source="product-showcase" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-product-base="'.$this->escaper->escapeAttribute(rtrim($detailBasePath, '/')).'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-dynamic-products g7pb-product-showcase__items" data-g7pb-data-list aria-busy="true"></div>'.$this->markup->compilePagination('상품').'</section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');

        if (preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/D', $boardSlug) !== 1
            || ! is_int($postId) || $postId < 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 post detail configuration is invalid.');
        }
        $this->urls->assertAllowedUrl($detailUrl, 'G7 post detail');
        $endpoint = '/api/modules/sirsoft-board/boards/'.rawurlencode($boardSlug).'/posts/'.$postId;
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-post-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-post-detail" data-g7pb-data-source="post-detail" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escaper->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escaper->escapeAttribute($linkLabel).'" data-g7pb-show-content="'.($showContent ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">게시글을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escaper->escapeAttribute($detailUrl).'" hidden>'.$this->escaper->escape($linkLabel).'</a></div></section>';
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
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/D', $productKey) !== 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 product detail configuration is invalid.');
        }
        $this->urls->assertAllowedUrl($detailUrl, 'G7 product detail');
        $endpoint = '/api/modules/sirsoft-ecommerce/products/'.rawurlencode($productKey);
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-product-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-detail" data-g7pb-data-source="product-detail" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escaper->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escaper->escapeAttribute($buttonLabel).'" data-g7pb-show-description="'.($showDescription ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escaper->escapeAttribute($detailUrl).'" hidden>'.$this->escaper->escape($buttonLabel).'</a></div></section>';
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
