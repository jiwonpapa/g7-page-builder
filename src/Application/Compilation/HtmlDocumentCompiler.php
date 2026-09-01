<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\CallbackBlockTypeCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

final class HtmlDocumentCompiler implements DocumentCompilerPort
{
    public const COMPILER_VERSION = '0.17.0';

    private const LAYOUT_SECTION_TYPE = 'layout.section-01';

    private const LAYOUT_COLUMNS_TYPE = 'layout.columns-01';

    /** @var list<string> */
    private const TEMPLATE_FORBIDDEN_TAGS = [
        'script', 'noscript', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal',
        'form', 'input', 'textarea', 'select', 'option', 'button', 'style', 'meta', 'base',
        'body', 'head', 'html', 'title', 'svg', 'math', 'audio', 'video', 'source', 'track', 'canvas',
        'details', 'dialog', 'plaintext', 'xmp', 'listing', 'marquee', 'noframes', 'noembed', 'template', 'slot',
    ];

    /** @var array<string, string> */
    private const DESIGN_TOKEN_DEFAULTS = [
        'design.color_mode' => 'light',
        'design.palette' => 'indigo',
        'design.font' => 'modern',
        'design.radius' => 'soft',
        'design.width' => 'standard',
        'design.scale' => 'balanced',
    ];

    /** @var array<string, list<string>> */
    private const DESIGN_TOKEN_OPTIONS = [
        'design.color_mode' => ['light', 'dark', 'system'],
        'design.palette' => ['indigo', 'blue', 'emerald', 'amber', 'rose', 'slate'],
        'design.font' => ['system', 'modern', 'serif'],
        'design.radius' => ['sharp', 'soft', 'round'],
        'design.width' => ['narrow', 'standard', 'wide'],
        'design.scale' => ['compact', 'balanced', 'large'],
    ];

    /** @var array<string, string> */
    private const CUSTOM_COLOR_TOKEN_DEFAULTS = [
        'design.custom_color_1_light' => '#2456df',
        'design.custom_color_1_dark' => '#8ba7ff',
        'design.custom_color_2_light' => '#059669',
        'design.custom_color_2_dark' => '#6ee7b7',
        'design.custom_color_3_light' => '#d97706',
        'design.custom_color_3_dark' => '#fbbf24',
        'design.custom_color_4_light' => '#e11d48',
        'design.custom_color_4_dark' => '#fda4af',
    ];

    public const TARGET_ENGINE_VERSION = 'g7-7.0.7';

    private const HERO_TYPE = 'content.hero-centered-01';

    private const FEATURES_TYPE = 'content.features-grid-01';

    private const CTA_TYPE = 'content.cta-split-01';

    private const CONTACT_TYPE = 'content.contact-info-01';

    private const HERO_SPLIT_TYPE = 'content.hero-split-01';

    private const HERO_SLIDER_TYPE = 'content.hero-slider-01';

    private const LOGO_CLOUD_TYPE = 'trust.logo-cloud-01';

    private const STATS_TYPE = 'data.stats-icons-01';

    private const PRICING_TYPE = 'commerce.pricing-tiers-01';

    private const TEAM_TYPE = 'company.team-grid-01';

    private const GALLERY_TYPE = 'media.gallery-grid-01';

    private const BAR_CHART_TYPE = 'data.bar-chart-01';

    private const G7_RECENT_POSTS_TYPE = 'g7.board-recent-posts-01';

    private const G7_PRODUCT_GRID_TYPE = 'g7.ecommerce-product-grid-01';

    private const INQUIRY_FORM_TYPE = 'form.inquiry-01';

    private const MAP_DIRECTIONS_TYPE = 'location.map-directions-01';

    private const TESTIMONIALS_TYPE = 'trust.testimonials-01';

    private const FAQ_ACCORDION_TYPE = 'content.faq-accordion-01';

    private const PROCESS_TIMELINE_TYPE = 'content.process-timeline-01';

    private const TABS_TYPE = 'content.tabs-01';

    private const COMPARISON_TABLE_TYPE = 'commerce.comparison-table-01';

    private const ARTICLE_LIST_TYPE = 'content.article-list-01';

    private const VIDEO_EMBED_TYPE = 'media.video-embed-01';

    private const LOGO_CAROUSEL_TYPE = 'trust.logo-carousel-01';

    private const TESTIMONIAL_SLIDER_TYPE = 'trust.testimonial-slider-01';

    private const EVENT_SCHEDULE_TYPE = 'content.event-schedule-01';

    private const DOWNLOAD_RESOURCES_TYPE = 'content.download-resources-01';

    private const G7_BOARD_ARCHIVE_TYPE = 'g7.board-content-archive-01';

    private const G7_PRODUCT_SHOWCASE_TYPE = 'g7.ecommerce-product-showcase-01';

    private const G7_POST_DETAIL_TYPE = 'g7.board-post-detail-01';

    private const G7_PRODUCT_DETAIL_TYPE = 'g7.ecommerce-product-detail-01';

    private const HEADING_TYPE = 'content.heading-01';

    private const RICH_TEXT_TYPE = 'content.rich-text-01';

    private const IMAGE_TYPE = 'media.image-01';

    private const BUTTONS_TYPE = 'action.buttons-01';

    private const IMAGE_TEXT_TYPE = 'media.image-text-01';

    private const ICON_LIST_TYPE = 'content.icon-list-01';

    private const DIVIDER_TYPE = 'content.divider-01';

    private const BLOCKQUOTE_TYPE = 'content.blockquote-01';

    private const NOTICE_TYPE = 'content.notice-01';

    private const CARD_GRID_TYPE = 'content.card-grid-01';

    private const BREADCRUMBS_TYPE = 'navigation.breadcrumbs-01';

    private const ANCHOR_MENU_TYPE = 'navigation.anchor-menu-01';

    private const SOCIAL_LINKS_TYPE = 'navigation.social-links-01';

    private const IMAGE_CAROUSEL_TYPE = 'media.image-carousel-01';

    /** @var array<string, list<string>> */
    private const ROOT_ELEMENT_FIELDS = [
        self::HEADING_TYPE => ['eyebrow', 'heading'],
        self::RICH_TEXT_TYPE => ['content'],
        self::IMAGE_TYPE => ['caption'],
        self::BUTTONS_TYPE => [],
        self::IMAGE_TEXT_TYPE => ['eyebrow', 'heading', 'body', 'primaryLabel'],
        self::ICON_LIST_TYPE => ['eyebrow', 'heading'],
        self::HERO_TYPE => ['eyebrow', 'title', 'body', 'primaryLabel'],
        self::FEATURES_TYPE => ['title'],
        self::CTA_TYPE => ['eyebrow', 'heading', 'body', 'primaryLabel', 'secondaryLabel'],
        self::CONTACT_TYPE => ['heading', 'address', 'phone', 'email', 'ctaLabel', 'mapLabel'],
        self::HERO_SPLIT_TYPE => ['eyebrow', 'title', 'body', 'primaryLabel'],
        self::HERO_SLIDER_TYPE => [],
        self::LOGO_CLOUD_TYPE => ['heading'],
        self::STATS_TYPE => ['eyebrow', 'heading'],
        self::PRICING_TYPE => ['eyebrow', 'heading'],
        self::TEAM_TYPE => ['eyebrow', 'heading'],
        self::GALLERY_TYPE => ['eyebrow', 'heading'],
        self::BAR_CHART_TYPE => ['eyebrow', 'heading', 'description', 'unit'],
        self::G7_RECENT_POSTS_TYPE => ['eyebrow', 'heading'],
        self::G7_PRODUCT_GRID_TYPE => ['eyebrow', 'heading'],
        self::INQUIRY_FORM_TYPE => ['eyebrow', 'heading', 'description', 'privacyLabel', 'submitLabel'],
        self::MAP_DIRECTIONS_TYPE => ['eyebrow', 'heading', 'description', 'address', 'phone', 'hours', 'parking', 'directionsLabel'],
        self::TESTIMONIALS_TYPE => ['eyebrow', 'heading'],
        self::FAQ_ACCORDION_TYPE => ['eyebrow', 'heading'],
        self::PROCESS_TIMELINE_TYPE => ['eyebrow', 'heading'],
        self::TABS_TYPE => ['eyebrow', 'heading'],
        self::COMPARISON_TABLE_TYPE => ['eyebrow', 'heading'],
        self::ARTICLE_LIST_TYPE => ['eyebrow', 'heading'],
        self::VIDEO_EMBED_TYPE => ['eyebrow', 'heading', 'caption'],
        self::LOGO_CAROUSEL_TYPE => ['eyebrow', 'heading'],
        self::TESTIMONIAL_SLIDER_TYPE => ['eyebrow', 'heading'],
        self::EVENT_SCHEDULE_TYPE => ['eyebrow', 'heading'],
        self::DOWNLOAD_RESOURCES_TYPE => ['eyebrow', 'heading'],
        self::G7_BOARD_ARCHIVE_TYPE => ['eyebrow', 'heading'],
        self::G7_PRODUCT_SHOWCASE_TYPE => ['eyebrow', 'heading'],
        self::G7_POST_DETAIL_TYPE => ['eyebrow', 'heading', 'linkLabel'],
        self::G7_PRODUCT_DETAIL_TYPE => ['eyebrow', 'heading', 'buttonLabel'],
        self::DIVIDER_TYPE => ['label'],
        self::BLOCKQUOTE_TYPE => ['quote', 'citation', 'role'],
        self::NOTICE_TYPE => ['title', 'body', 'actionLabel'],
        self::CARD_GRID_TYPE => ['eyebrow', 'heading'],
        self::BREADCRUMBS_TYPE => ['currentLabel'],
        self::ANCHOR_MENU_TYPE => ['label'],
        self::SOCIAL_LINKS_TYPE => ['heading'],
        self::IMAGE_CAROUSEL_TYPE => ['eyebrow', 'heading'],
    ];

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

    public function __construct(
        private readonly BlockRegistry $blockRegistry,
        ?BlockCompilerRegistry $blockCompilers = null,
        private readonly ?BlockSchemaRegistry $blockSchemas = null,
        private readonly ?BlockPackAssetUrlPort $blockAssets = null,
    ) {
        $this->blockCompilers = $blockCompilers ?? new BlockCompilerRegistry;
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
        $customPaletteStyle = $this->customPaletteDeclarations($document);
        $body = '<div class="'.$this->designClassName($document).'"'.($customPaletteStyle === '' ? '' : ' style="'.$this->escapeAttribute($customPaletteStyle).'"').'>'."\n"
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

        if (in_array($type, [self::LAYOUT_SECTION_TYPE, self::LAYOUT_COLUMNS_TYPE], true)) {
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

            return $this->withBlockRuntime($compiled, $instanceId, $type, $block['motion'] ?? null, $block['visibility'] ?? null);
        }

        if ($slots !== []) {
            throw new DocumentCompileException("{$path} uses slots that are not supported by this block.");
        }

        $definition = $this->blockRegistry->definition($type, $version);
        if ($definition === null || ! $this->blockCompilers->has($definition->compiler)) {
            throw new DocumentCompileException("{$path} has an unsupported type or compiler.");
        }
        if (in_array($type, [self::HERO_TYPE, self::HERO_SPLIT_TYPE, self::HERO_SLIDER_TYPE], true)) {
            $heroCount++;
        }
        if ($type === self::HEADING_TYPE && is_string($props['anchor'] ?? null) && $props['anchor'] !== '') {
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
            $compiled = $this->applyElementAppearances($compiled, $props, $type);
            $this->assertTemplateCompatibleMarkup($compiled, $path);
        } catch (DocumentCompileException $exception) {
            throw $exception;
        } catch (\Throwable) {
            throw new DocumentCompileException("{$path} failed schema validation or compilation.", 'G7PB_BLOCK_RUNTIME_FAILED');
        }

        return $this->withBlockRuntime($compiled, $instanceId, $type, $block['motion'] ?? null, $block['visibility'] ?? null);
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

        if ($type === self::LAYOUT_SECTION_TYPE) {
            $this->assertOnlyKeys($props, ['width', 'spacing'], $path);
            $width = $this->requiredString($props, 'width', 16);
            $spacing = $this->requiredString($props, 'spacing', 16);
            if (! in_array($width, ['standard', 'wide', 'full'], true)
                || ! in_array($spacing, ['compact', 'normal', 'spacious'], true)
                || array_diff(array_keys($slots), ['content']) !== []) {
                throw new DocumentCompileException("{$path} has invalid Section properties or slots.");
            }
            $content = $this->compileLayoutSlot($slots['content'] ?? [], $path.'.content', $document, $heroCount, $headingAnchors, $styleUrls);

            return '<section class="g7pb-layout-section g7pb-layout-section--'.$width.' g7pb-layout-section--'.$spacing.'" data-testid="page-builder-rendered-layout" data-block-type="layout-section"><div class="g7pb-layout-section__inner">'.$content.'</div></section>';
        }

        $this->assertOnlyKeys($props, ['columns', 'ratio', 'gap'], $path);
        $columns = $props['columns'] ?? null;
        $ratio = $this->requiredString($props, 'ratio', 16);
        $gap = $this->requiredString($props, 'gap', 16);
        if ($columns !== 2
            || ! in_array($ratio, ['1:1', '1:2', '2:1'], true)
            || ! in_array($gap, ['compact', 'normal', 'spacious'], true)
            || array_diff(array_keys($slots), ['column1', 'column2']) !== []) {
            throw new DocumentCompileException("{$path} has invalid Columns properties or slots.");
        }
        $columnsMarkup = [];
        foreach ([1, 2] as $column) {
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

    private function designClassName(PageBuilderDocument $document): string
    {
        $classes = ['g7pb-document-theme'];

        foreach (self::DESIGN_TOKEN_DEFAULTS as $token => $default) {
            $value = $document->tokens[$token] ?? $default;
            if (! is_string($value) || ! in_array($value, self::DESIGN_TOKEN_OPTIONS[$token], true)) {
                throw new DocumentCompileException("Page design token {$token} is invalid.");
            }
            $suffix = $token === 'design.color_mode' ? 'mode' : str_replace('design.', '', $token);
            $classes[] = "g7pb-theme-{$suffix}-{$value}";
        }

        if ($this->hasCustomPalette($document)) {
            $classes[] = 'g7pb-theme-custom-palette';
        }

        return implode(' ', $classes);
    }

    private function customPaletteDeclarations(PageBuilderDocument $document): string
    {
        if (! $this->hasCustomPalette($document)) {
            return '';
        }

        $declarations = [];
        foreach (self::CUSTOM_COLOR_TOKEN_DEFAULTS as $token => $default) {
            $value = $document->tokens[$token] ?? $default;
            if (! is_string($value) || preg_match('/^#[0-9a-f]{6}$/iD', $value) !== 1) {
                throw new DocumentCompileException("Page design token {$token} is invalid.");
            }
            $suffix = str_replace(['design.custom_color_', '_'], ['', '-'], $token);
            $declarations[] = '--g7pb-custom-tone-'.$suffix.':'.strtolower($value);
        }

        return implode(';', $declarations);
    }

    private function hasCustomPalette(PageBuilderDocument $document): bool
    {
        foreach (array_keys(self::CUSTOM_COLOR_TOKEN_DEFAULTS) as $token) {
            if (array_key_exists($token, $document->tokens)) {
                return true;
            }
        }

        return false;
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'level', 'anchor', 'appearance'], 'Heading');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $level = $this->requiredIntegerChoice($props, 'level', [2, 3, 4]);
        $anchor = $this->optionalString($props, 'anchor', 80) ?? '';
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if ($anchor !== '' && preg_match('/^[a-z][a-z0-9-]{0,79}$/D', $anchor) !== 1) {
            throw new DocumentCompileException('Heading anchor is invalid.');
        }
        $eyebrowMarkup = $eyebrow === null || $eyebrow === ''
            ? ''
            : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
        $anchorAttribute = $anchor === '' ? '' : ' id="'.$this->escapeAttribute($anchor).'"';

        return '<section class="g7pb-block g7pb-heading-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="heading">'
            .$eyebrowMarkup.'<h'.$level.' class="g7pb-heading-block__heading"'.$anchorAttribute.'>'.$this->sanitizeInlineRichText($heading).'</h'.$level.'></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileRichText(array $props): string
    {
        $this->assertOnlyKeys($props, ['content', 'measure', 'appearance'], 'Rich text');
        $content = $this->requiredString($props, 'content', 20000);
        $measure = $this->requiredString($props, 'measure', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($measure, ['narrow', 'standard', 'wide'], true)) {
            throw new DocumentCompileException('Rich text measure is invalid.');
        }

        return '<section class="g7pb-block g7pb-rich-text '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="rich-text"><div class="g7pb-rich-text__content g7pb-rich-text__content--'.$measure.'">'.$this->sanitizeRichText($content).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileImage(array $props): string
    {
        $this->assertOnlyKeys($props, ['src', 'alt', 'caption', 'linkUrl', 'aspectRatio', 'appearance'], 'Image');
        $src = $this->optionalString($props, 'src', 2048) ?? '';
        $alt = $this->optionalString($props, 'alt', 300) ?? '';
        $caption = $this->optionalString($props, 'caption', 500) ?? '';
        $linkUrl = $this->optionalString($props, 'linkUrl', 2048) ?? '';
        $aspectRatio = $this->requiredString($props, 'aspectRatio', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($aspectRatio, ['auto', '16:9', '4:3', '1:1'], true)) {
            throw new DocumentCompileException('Image aspect ratio is invalid.');
        }
        $media = $this->compileCatalogImage($src, $alt, 'g7pb-image-block__image', '이미지를 선택하세요');
        if ($linkUrl !== '') {
            $this->assertAllowedUrl($linkUrl, 'Image link');
            $media = '<a class="g7pb-image-block__link" href="'.$this->escapeAttribute($linkUrl).'">'.$media.'</a>';
        }
        $captionMarkup = $caption === '' ? '' : '<figcaption>'.$this->escape($caption).'</figcaption>';

        return '<section class="g7pb-block g7pb-image-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image"><figure class="g7pb-image-block__figure g7pb-image-block__figure--'.str_replace(':', '-', $aspectRatio).'">'.$media.$captionMarkup.'</figure></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileButtons(array $props): string
    {
        $this->assertOnlyKeys($props, ['items', 'alignment', 'appearance'], 'Buttons');
        $items = $props['items'] ?? null;
        $alignment = $this->requiredString($props, 'alignment', 16);
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
            $this->assertOnlyKeys($item, ['label', 'url', 'variant'], "Button item {$index}");
            $label = $this->requiredString($item, 'label', 120);
            $url = $this->requiredString($item, 'url', 2048);
            $variant = $this->requiredString($item, 'variant', 16);
            if (! in_array($variant, ['primary', 'secondary', 'text'], true)) {
                throw new DocumentCompileException("Button item {$index} variant is invalid.");
            }
            $this->assertAllowedUrl($url, "Button item {$index}");
            $compiled[] = '<a class="g7pb-button g7pb-button--'.$variant.'" href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a>';
        }

        return '<section class="g7pb-block g7pb-buttons '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="buttons"><div class="g7pb-buttons__items g7pb-buttons__items--'.$alignment.'" role="group" aria-label="페이지 행동">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileImageText(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'body', 'image', 'mediaPosition', 'primaryLink', 'appearance'], 'Image text');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $body = $this->optionalString($props, 'body', 10000) ?? '';
        $image = $this->optionalMap($props, 'image');
        $mediaPosition = $this->requiredString($props, 'mediaPosition', 16);
        $primaryLink = $this->optionalMap($props, 'primaryLink');
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if ($image === null) {
            throw new DocumentCompileException('Image text image is required.');
        }
        $this->assertOnlyKeys($image, ['src', 'alt'], 'Image text image');
        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Image text media position is invalid.');
        }
        $src = $this->optionalString($image, 'src', 2048) ?? '';
        $alt = $this->optionalString($image, 'alt', 300) ?? '';
        $media = '<figure class="g7pb-image-text__media">'.$this->compileCatalogImage($src, $alt, 'g7pb-image-text__image', '대표 이미지를 선택하세요').'</figure>';
        $copy = '<div class="g7pb-image-text__copy">'.($eyebrow === null || $eyebrow === '' ? '' : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>')
            .'<h2>'.$this->sanitizeInlineRichText($heading).'</h2>'.($body === '' ? '' : '<div class="g7pb-image-text__body">'.$this->sanitizeRichText($body).'</div>')
            .($primaryLink === null ? '' : $this->compileActionLink($primaryLink, 'Image text primary link', 'g7pb-button g7pb-button--primary')).'</div>';
        $content = $media.$copy;

        return '<section class="g7pb-block g7pb-image-text g7pb-image-text--'.$mediaPosition.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-text">'.$content.'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileIconList(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Icon list');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->requiredString($props, 'layout', 24);
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
            $this->assertOnlyKeys($item, ['icon', 'title', 'body'], "Icon list item {$index}");
            $icon = $this->requiredString($item, 'icon', 32);
            $title = $this->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->optionalRichTextString($item, 'body', 2000) ?? '';
            if (! in_array($icon, self::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Icon list item {$index} uses an unsupported icon.");
            }
            $bodyMarkup = $this->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-icon-list__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $compiled[] = '<li class="g7pb-icon-list__item">'.$this->catalogIconSvg($icon, 'g7pb-icon-list__icon g7pb-icon--'.$icon).'<div><h3>'.$this->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.'</div></li>';
        }

        return '<section class="g7pb-block g7pb-icon-list g7pb-icon-list--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="icon-list">'.$this->compileSectionHeading($eyebrow, $heading).'<ul class="g7pb-icon-list__items">'.implode('', $compiled).'</ul></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileDivider(array $props): string
    {
        $this->assertOnlyKeys($props, ['variant', 'width', 'label', 'appearance'], 'Divider');
        $variant = $this->requiredString($props, 'variant', 16);
        $width = $this->requiredString($props, 'width', 16);
        $label = $this->optionalString($props, 'label', 120) ?? '';
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
        $this->assertOnlyKeys($props, ['quote', 'citation', 'role', 'alignment', 'variant', 'appearance'], 'Blockquote');
        $quote = $this->requiredString($props, 'quote', 2000);
        $citation = $this->requiredString($props, 'citation', 120);
        $role = $this->optionalString($props, 'role', 160) ?? '';
        $alignment = $this->requiredString($props, 'alignment', 16);
        $variant = $this->requiredString($props, 'variant', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($alignment, ['left', 'center'], true) || ! in_array($variant, ['line', 'mark'], true)) {
            throw new DocumentCompileException('Blockquote alignment or variant is invalid.');
        }
        $roleMarkup = $role === '' ? '' : '<span class="g7pb-blockquote__role">'.$this->escape($role).'</span>';

        $quoteMarkup = $this->hasRichTextMarkup($quote)
            ? '<div class="g7pb-blockquote__quote">'.$this->sanitizeRichText($quote).'</div>'
            : '<p class="g7pb-blockquote__quote">'.$this->formatText($quote).'</p>';

        return '<section class="g7pb-block g7pb-blockquote g7pb-blockquote--'.$alignment.' g7pb-blockquote--'.$variant.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="blockquote"><blockquote>'.$quoteMarkup.'<footer><cite>'.$this->escape($citation).'</cite>'.$roleMarkup.'</footer></blockquote></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileNotice(array $props): string
    {
        $this->assertOnlyKeys($props, ['tone', 'title', 'body', 'actionLabel', 'actionUrl', 'appearance'], 'Notice');
        $tone = $this->requiredString($props, 'tone', 16);
        $title = $this->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->requiredString($props, 'body', 2000);
        $actionLabel = $this->optionalString($props, 'actionLabel', 120) ?? '';
        $actionUrl = $this->optionalString($props, 'actionUrl', 2048) ?? '';
        $appearance = $this->appearanceClasses($props, 'soft', 'compact');
        if (! in_array($tone, ['info', 'success', 'warning', 'critical'], true)) {
            throw new DocumentCompileException('Notice tone is invalid.');
        }
        if (($actionLabel === '') !== ($actionUrl === '')) {
            throw new DocumentCompileException('Notice action label and URL must be provided together.');
        }
        $action = '';
        if ($actionLabel !== '') {
            $this->assertAllowedUrl($actionUrl, 'Notice action');
            $action = '<a class="g7pb-content-notice__action" href="'.$this->escapeAttribute($actionUrl).'">'.$this->escape($actionLabel).'<span aria-hidden="true"> →</span></a>';
        }
        $role = $tone === 'critical' ? 'alert' : 'note';

        $bodyMarkup = $this->hasRichTextMarkup($body)
            ? '<div class="g7pb-content-notice__body">'.$this->sanitizeRichText($body).'</div>'
            : '<p class="g7pb-content-notice__body">'.$this->formatText($body).'</p>';

        return '<section class="g7pb-block g7pb-content-notice g7pb-content-notice--'.$tone.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="notice" role="'.$role.'"><span class="g7pb-content-notice__icon" aria-hidden="true"></span><div><h2 class="g7pb-content-notice__title">'.$this->sanitizePromotedInlineRichText($title).'</h2>'.$bodyMarkup.'</div>'.$action.'</section>';
    }

    /** @param array<string, mixed> $props */
    private function compileCardGrid(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'columns', 'variant', 'layout', 'appearance'], 'Card grid');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $columns = $this->requiredIntegerChoice($props, 'columns', [2, 3]);
        $variant = $this->requiredString($props, 'variant', 16);
        $layout = $this->optionalString($props, 'layout', 16);
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
            $this->assertOnlyKeys($item, ['kicker', 'title', 'body', 'linkLabel', 'linkUrl'], "Card grid item {$index}");
            $kicker = $this->optionalString($item, 'kicker', 80) ?? '';
            $title = $this->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->optionalString($item, 'body', 1000) ?? '';
            $linkLabel = $this->optionalString($item, 'linkLabel', 120) ?? '';
            $linkUrl = $this->optionalString($item, 'linkUrl', 2048) ?? '';
            if (($linkLabel === '') !== ($linkUrl === '')) {
                throw new DocumentCompileException("Card grid item {$index} link label and URL must be provided together.");
            }
            $link = '';
            if ($linkLabel !== '') {
                $this->assertAllowedUrl($linkUrl, "Card grid item {$index}");
                $link = '<a href="'.$this->escapeAttribute($linkUrl).'">'.$this->escape($linkLabel).'<span aria-hidden="true"> →</span></a>';
            }
            $bodyMarkup = $body === '' ? '' : ($this->hasRichTextMarkup($body)
                ? '<div class="g7pb-card-grid__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-card-grid__body">'.$this->formatText($body).'</p>');
            $compiled[] = '<article class="g7pb-card-grid__item">'.($kicker === '' ? '' : '<p class="g7pb-card-grid__kicker">'.$this->escape($kicker).'</p>').'<h3>'.$this->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-card-grid--layout-'.$layout;

        return '<section class="g7pb-block g7pb-card-grid g7pb-card-grid--'.$columns.' g7pb-card-grid--'.$variant.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="card-grid">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-card-grid__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileBreadcrumbs(array $props): string
    {
        $this->assertOnlyKeys($props, ['items', 'currentLabel', 'appearance'], 'Breadcrumbs');
        $items = $props['items'] ?? null;
        $currentLabel = $this->requiredString($props, 'currentLabel', 160);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! is_array($items) || count($items) < 1 || count($items) > 6) {
            throw new DocumentCompileException('Breadcrumbs must contain between one and six parent items.');
        }
        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Breadcrumb item {$index} must be an object.");
            }
            $this->assertOnlyKeys($item, ['label', 'url'], "Breadcrumb item {$index}");
            $label = $this->requiredString($item, 'label', 120);
            $url = $this->requiredString($item, 'url', 2048);
            $this->assertPageOrHttpsUrl($url, "Breadcrumb item {$index}");
            $compiled[] = '<li><a href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a></li>';
        }
        $compiled[] = '<li aria-current="page">'.$this->escape($currentLabel).'</li>';

        return '<section class="g7pb-block g7pb-breadcrumbs '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="breadcrumbs"><nav aria-label="경로"><ol>'.implode('', $compiled).'</ol></nav></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileAnchorMenu(array $props): string
    {
        $this->assertOnlyKeys($props, ['label', 'items', 'sticky', 'alignment', 'appearance'], 'Anchor menu');
        $label = $this->requiredString($props, 'label', 120);
        $items = $props['items'] ?? null;
        $sticky = $this->requiredBoolean($props, 'sticky');
        $alignment = $this->requiredString($props, 'alignment', 16);
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
            $this->assertOnlyKeys($item, ['label', 'anchor'], "Anchor menu item {$index}");
            $itemLabel = $this->requiredString($item, 'label', 120);
            $anchor = $this->requiredString($item, 'anchor', 80);
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
        $this->assertOnlyKeys($props, ['heading', 'items', 'variant', 'alignment', 'appearance'], 'Social links');
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $variant = $this->requiredString($props, 'variant', 16);
        $alignment = $this->requiredString($props, 'alignment', 16);
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
            $this->assertOnlyKeys($item, ['network', 'label', 'url'], "Social link item {$index}");
            $network = $this->requiredString($item, 'network', 16);
            $label = $this->requiredString($item, 'label', 120);
            $url = $this->requiredString($item, 'url', 2048);
            if (! in_array($network, $networks, true)) {
                throw new DocumentCompileException("Social link item {$index} network is invalid.");
            }
            $this->assertPageOrHttpsUrl($url, "Social link item {$index}");
            $compiled[] = '<li><a class="g7pb-social-links__link g7pb-social-links__link--'.$network.'" href="'.$this->escapeAttribute($url).'" rel="noopener noreferrer"><span class="g7pb-social-links__icon" aria-hidden="true">'.$this->catalogIconSvg($network, 'g7pb-social-links__glyph').'</span><span>'.$this->escape($label).'</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-social-links g7pb-social-links--'.$variant.' g7pb-social-links--'.$alignment.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="social-links"><nav aria-label="'.$this->escapeAttribute($this->inlinePlainText($heading)).'"><h2>'.$this->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $compiled).'</ul></nav></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileImageCarousel(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'autoplay', 'interval', 'controls', 'aspectRatio', 'appearance'], 'Image carousel');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $autoplay = $this->requiredBoolean($props, 'autoplay');
        $interval = $this->requiredIntegerChoice($props, 'interval', [3000, 5000, 7000]);
        $controls = $this->requiredString($props, 'controls', 16);
        $aspectRatio = $this->requiredString($props, 'aspectRatio', 16);
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
            $this->assertOnlyKeys($item, ['src', 'alt', 'caption'], "Image carousel item {$index}");
            $src = $this->optionalString($item, 'src', 2048) ?? '';
            $alt = $this->requiredString($item, 'alt', 300);
            $caption = $this->optionalString($item, 'caption', 300) ?? '';
            $media = $this->compileCatalogImage($src, $alt, 'g7pb-image-carousel__image', ($index + 1).'번 이미지를 선택하세요', $index === 0 ? 'eager' : 'lazy');
            $slides[] = '<figure class="g7pb-hero-slider__slide g7pb-image-carousel__slide">'.$media.($caption === '' ? '' : '<figcaption>'.$this->escape($caption).'</figcaption>').'</figure>';
        }

        return '<section class="g7pb-block g7pb-hero-slider g7pb-image-carousel g7pb-image-carousel--'.str_replace(':', '-', $aspectRatio).' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="image-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" data-g7pb-slider-controls="'.$controls.'" aria-label="'.$this->escapeAttribute($this->inlinePlainText($heading)).'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHero(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'alignment', 'mediaPosition', 'layout', 'appearance'], 'Hero');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $title = $this->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->optionalString($props, 'body', 4000);
        $alignment = $this->optionalString($props, 'alignment', 16) ?? 'center';
        $layout = $this->optionalString($props, 'layout', 16);
        $mediaPosition = $this->optionalString($props, 'mediaPosition', 16) ?? 'right';
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

        $cta = $this->optionalMap($props, 'primaryCta');
        $image = $this->optionalMap($props, 'image');

        if ($layout !== null && in_array($layout, $splitLayouts, true)) {
            $copy = [];
            if ($eyebrow !== null && $eyebrow !== '') {
                $copy[] = '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
            }
            $copy[] = '<h1>'.$this->sanitizeInlineRichText($title).'</h1>';
            if ($body !== null && $body !== '') {
                $copy[] = $this->hasCanonicalRichTextMarkup($body)
                    ? '<div class="g7pb-hero-split__body">'.$this->sanitizeRichText($body).'</div>'
                    : '<p class="g7pb-hero-split__body">'.$this->formatText($body).'</p>';
            }
            if ($cta !== null) {
                $copy[] = $this->compileActionLink($cta, 'Hero CTA', 'g7pb-button g7pb-button--primary');
            }
            if ($image !== null) {
                $this->assertOnlyKeys($image, ['src', 'alt'], 'Hero image');
            }
            $src = $image === null ? '' : $this->requiredString($image, 'src', 2048);
            $alt = $image === null ? '대표 이미지' : $this->requiredString($image, 'alt', 300);
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

        $parts[] = '<h1 class="g7pb-hero__title">'.$this->sanitizeInlineRichText($title).'</h1>';

        if ($body !== null && $body !== '') {
            $parts[] = '<div class="g7pb-hero__body">'.$this->sanitizeRichText($body).'</div>';
        }

        if ($cta !== null) {
            $label = $this->requiredString($cta, 'label', 120);
            $url = $this->requiredString($cta, 'url', 2048);
            $this->assertAllowedUrl($url, 'Hero CTA');
            $parts[] = '<a class="g7pb-button g7pb-button--primary" href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a>';
        }

        if ($image !== null) {
            $src = $this->requiredString($image, 'src', 2048);
            $alt = $this->optionalString($image, 'alt', 300) ?? '';
            $this->assertAllowedImageUrl($src);
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
        $title = $this->requiredInlineRichTextString($props, 'title', 200);
        $items = $props['items'] ?? null;
        $layout = $this->optionalString($props, 'layout', 16);
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

            $icon = $this->requiredString($item, 'icon', 32);
            $itemTitle = $this->requiredInlineRichTextString($item, 'title', 160);
            $body = $this->requiredRichTextString($item, 'body', 2000);

            if (! in_array($icon, self::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Feature item {$index} uses an unsupported icon.");
            }

            $bodyMarkup = $this->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-features__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $compiledItems[] = '<article class="g7pb-features__item">'.$this->catalogIconSvg($icon, 'g7pb-features__icon g7pb-icon--'.$icon).'<h3>'.$this->sanitizePromotedInlineRichText($itemTitle).'</h3>'.$bodyMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-features--layout-'.$layout;

        return '<section class="g7pb-block g7pb-features'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="features"><h2 class="g7pb-features__title">'.$this->sanitizeInlineRichText($title).'</h2><div class="g7pb-features__grid">'.implode('', $compiledItems).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileCta(array $props): string
    {
        $this->assertOnlyKeys(
            $props,
            ['eyebrow', 'heading', 'body', 'primaryLink', 'secondaryLink', 'theme', 'layout', 'appearance'],
            'CTA',
        );

        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $body = $this->optionalRichTextString($props, 'body', 2000);
        $theme = $this->requiredString($props, 'theme', 16);
        $layout = $this->optionalString($props, 'layout', 16);
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
        $copy[] = '<h2 class="g7pb-cta__heading">'.$this->sanitizeInlineRichText($heading).'</h2>';
        if ($body !== null && $body !== '') {
            $copy[] = $this->hasCanonicalRichTextMarkup($body)
                ? '<div class="g7pb-cta__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-cta__body">'.$this->formatText($body).'</p>';
        }

        $actions = [];
        $primaryLink = $this->optionalMap($props, 'primaryLink');
        if ($primaryLink !== null) {
            $actions[] = $this->compileActionLink($primaryLink, 'CTA primary link', 'g7pb-button g7pb-button--primary');
        }
        $secondaryLink = $this->optionalMap($props, 'secondaryLink');
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
        $this->assertOnlyKeys(
            $props,
            ['heading', 'address', 'phone', 'email', 'cta', 'mapLink', 'appearance'],
            'Contact',
        );

        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $address = $this->requiredString($props, 'address', 1000);
        $phone = $this->requiredString($props, 'phone', 40);
        $email = $this->requiredString($props, 'email', 320);
        $phoneHref = $this->phoneHref($phone);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new DocumentCompileException('Contact email is invalid.');
        }

        $actions = [];
        $cta = $this->optionalMap($props, 'cta');
        if ($cta !== null) {
            $actions[] = $this->compileActionLink($cta, 'Contact CTA', 'g7pb-button g7pb-button--primary');
        }
        $mapLink = $this->optionalMap($props, 'mapLink');
        if ($mapLink !== null) {
            $actions[] = $this->compileActionLink($mapLink, 'Contact map link', 'g7pb-button g7pb-button--secondary');
        }

        $actionMarkup = $actions === []
            ? ''
            : '<div class="g7pb-contact__actions">'.implode('', $actions).'</div>';

        return '<section class="g7pb-block g7pb-contact '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="contact"><div class="g7pb-contact__heading"><p class="g7pb-contact__eyebrow">Contact</p><h2>'.$this->sanitizeInlineRichText($heading).'</h2></div><address class="g7pb-contact__details"><p>'.$this->formatText($address).'</p><a href="'.$this->escapeAttribute($phoneHref).'">'.$this->escape($phone).'</a><a href="'.$this->escapeAttribute('mailto:'.$email).'">'.$this->escape($email).'</a></address>'.$actionMarkup.'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHeroSplit(array $props): string
    {
        $this->assertOnlyKeys(
            $props,
            ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'mediaPosition', 'layout', 'appearance'],
            'Split Hero',
        );

        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $title = $this->requiredInlineRichTextString($props, 'title', 200);
        $body = $this->optionalString($props, 'body', 2000);
        $mediaPosition = $this->requiredString($props, 'mediaPosition', 16);
        $layout = $this->optionalString($props, 'layout', 16);
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
        $copy[] = '<h1>'.$this->sanitizeInlineRichText($title).'</h1>';
        if ($body !== null && $body !== '') {
            $copy[] = $this->hasRichTextMarkup($body)
                ? '<div class="g7pb-hero-split__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p class="g7pb-hero-split__body">'.$this->formatText($body).'</p>';
        }

        $cta = $this->optionalMap($props, 'primaryCta');
        if ($cta !== null) {
            $copy[] = $this->compileActionLink($cta, 'Split Hero CTA', 'g7pb-button g7pb-button--primary');
        }

        $image = $this->optionalMap($props, 'image');
        $src = $image === null ? '' : $this->requiredString($image, 'src', 2048);
        $alt = $image === null ? '대표 이미지' : $this->requiredString($image, 'alt', 300);
        if ($image !== null) {
            $this->assertOnlyKeys($image, ['src', 'alt'], 'Split Hero image');
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
        $this->assertOnlyKeys($props, ['slides', 'autoplay', 'interval', 'loop', 'appearance'], 'Slider Hero');
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
            $this->assertOnlyKeys(
                $slide,
                ['eyebrow', 'title', 'body', 'buttonLabel', 'buttonUrl', 'imageSrc', 'imageAlt'],
                "Slider Hero item {$index}",
            );
            $eyebrow = $this->optionalString($slide, 'eyebrow', 120);
            $title = $this->requiredInlineRichTextString($slide, 'title', 200);
            $body = $this->optionalString($slide, 'body', 2000);
            $buttonLabel = $this->requiredString($slide, 'buttonLabel', 120);
            $buttonUrl = $this->requiredString($slide, 'buttonUrl', 2048);
            $imageSrc = $this->optionalString($slide, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($slide, 'imageAlt', 300) ?? '';
            $this->assertAllowedUrl($buttonUrl, "Slider Hero item {$index}");

            $copy = $eyebrow === null || $eyebrow === ''
                ? ''
                : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
            $copy .= '<h2>'.$this->sanitizePromotedInlineRichText($title).'</h2>';
            if ($body !== null && $body !== '') {
                $copy .= $this->hasRichTextMarkup($body)
                    ? '<div class="g7pb-hero-slider__body">'.$this->sanitizeRichText($body).'</div>'
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
        $this->assertOnlyKeys($props, ['heading', 'logos', 'layout', 'appearance'], 'Logo Cloud');
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $layout = $this->optionalString($props, 'layout', 16);
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
            $this->assertOnlyKeys($logo, ['name', 'imageSrc', 'imageAlt', 'url'], "Logo item {$index}");
            $name = $this->requiredString($logo, 'name', 120);
            $imageSrc = $this->optionalString($logo, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($logo, 'imageAlt', 300) ?? '';
            $url = $this->optionalString($logo, 'url', 2048) ?? '';
            $visual = $imageSrc === ''
                ? '<span>'.$this->escape($name).'</span>'
                : $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name.' 로고', 'g7pb-logo-cloud__image', $name);
            if ($url !== '') {
                $this->assertAllowedUrl($url, "Logo item {$index}");
                $visual = '<a href="'.$this->escapeAttribute($url).'" aria-label="'.$this->escapeAttribute($name).'">'.$visual.'</a>';
            }
            $items[] = '<li>'.$visual.'</li>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-logo-cloud--layout-'.$layout;

        return '<section class="g7pb-block g7pb-logo-cloud'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-cloud"><h2>'.$this->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $items).'</ul></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileStats(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Stats');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->optionalString($props, 'layout', 16);
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
            $this->assertOnlyKeys($item, ['icon', 'value', 'label', 'detail'], "Stats item {$index}");
            $icon = $this->requiredString($item, 'icon', 32);
            if (! in_array($icon, $icons, true)) {
                throw new DocumentCompileException("Stats item {$index} icon is invalid.");
            }
            $value = $this->requiredString($item, 'value', 80);
            $label = $this->requiredInlineRichTextString($item, 'label', 120);
            $detail = $this->optionalRichTextString($item, 'detail', 500) ?? '';
            $detailMarkup = $this->hasCanonicalRichTextMarkup($detail)
                ? '<div class="g7pb-stats__detail">'.$this->sanitizeRichText($detail).'</div>'
                : '<p>'.$this->formatText($detail).'</p>';
            $compiled[] = '<article>'.$this->catalogIconSvg($icon, 'g7pb-stats__icon g7pb-stats__icon--'.$icon).'<strong>'.$this->escape($value).'</strong><h3>'.$this->sanitizePromotedInlineRichText($label).'</h3>'.$detailMarkup.'</article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-stats--layout-'.$layout;

        return '<section class="g7pb-block g7pb-stats'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="stats">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-stats__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compilePricing(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'plans', 'layout', 'appearance'], 'Pricing');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $plans = $props['plans'] ?? null;
        $layout = $this->optionalString($props, 'layout', 16);
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
            $this->assertOnlyKeys(
                $plan,
                ['name', 'price', 'period', 'description', 'features', 'buttonLabel', 'buttonUrl', 'featured'],
                "Pricing plan {$index}",
            );
            $name = $this->requiredInlineRichTextString($plan, 'name', 120);
            $price = $this->requiredString($plan, 'price', 80);
            $period = $this->optionalString($plan, 'period', 40) ?? '';
            $description = $this->optionalRichTextString($plan, 'description', 500) ?? '';
            $buttonLabel = $this->requiredString($plan, 'buttonLabel', 120);
            $buttonUrl = $this->requiredString($plan, 'buttonUrl', 2048);
            $featured = $this->requiredBoolean($plan, 'featured');
            $features = $plan['features'] ?? null;
            $this->assertAllowedUrl($buttonUrl, "Pricing plan {$index}");

            if (! is_array($features) || count($features) < 1 || count($features) > 12) {
                throw new DocumentCompileException("Pricing plan {$index} features are invalid.");
            }
            $featureItems = [];
            foreach (array_values($features) as $featureIndex => $feature) {
                $feature = $this->requiredInlineRichTextValue(
                    $feature,
                    "Pricing plan {$index} feature {$featureIndex}",
                    200,
                );
                $featureItems[] = '<li>'.$this->sanitizePromotedInlineRichText($feature).'</li>';
            }
            $featuredClass = $featured ? ' g7pb-pricing__plan--featured' : '';
            $badge = $featured ? '<span class="g7pb-pricing__badge">추천</span>' : '';
            $descriptionMarkup = $this->hasCanonicalRichTextMarkup($description)
                ? '<div class="g7pb-pricing__description">'.$this->sanitizeRichText($description).'</div>'
                : '<p>'.$this->formatText($description).'</p>';
            $compiled[] = '<article class="g7pb-pricing__plan'.$featuredClass.'">'.$badge.'<h3>'.$this->sanitizePromotedInlineRichText($name).'</h3><p class="g7pb-pricing__price"><strong>'.$this->escape($price).'</strong><span>'.$this->escape($period).'</span></p>'.$descriptionMarkup.'<ul>'.implode('', $featureItems).'</ul><a class="g7pb-button '.($featured ? 'g7pb-button--primary' : 'g7pb-button--secondary').'" href="'.$this->escapeAttribute($buttonUrl).'">'.$this->escape($buttonLabel).'</a></article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-pricing--layout-'.$layout;

        return '<section class="g7pb-block g7pb-pricing'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="pricing">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-pricing__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileTeam(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'members', 'layout', 'appearance'], 'Team');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $members = $props['members'] ?? null;
        $layout = $this->optionalString($props, 'layout', 16);
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
            $this->assertOnlyKeys($member, ['name', 'role', 'bio', 'imageSrc', 'imageAlt', 'profileUrl'], "Team member {$index}");
            $name = $this->requiredString($member, 'name', 120);
            $role = $this->requiredString($member, 'role', 160);
            $bio = $this->optionalRichTextString($member, 'bio', 1000) ?? '';
            $imageSrc = $this->optionalString($member, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($member, 'imageAlt', 300) ?? '';
            $profileUrl = $this->optionalString($member, 'profileUrl', 2048) ?? '';
            $media = $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name, 'g7pb-team__image', mb_substr($name, 0, 1));
            $memberName = '<h3>'.$this->escape($name).'</h3>';
            if ($profileUrl !== '') {
                $this->assertAllowedUrl($profileUrl, "Team member {$index}");
                $memberName = '<h3><a href="'.$this->escapeAttribute($profileUrl).'">'.$this->escape($name).'</a></h3>';
            }
            $bioMarkup = $this->hasCanonicalRichTextMarkup($bio)
                ? '<div class="g7pb-team__bio">'.$this->sanitizeRichText($bio).'</div>'
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'columns', 'layout', 'appearance'], 'Gallery');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $columns = $props['columns'] ?? null;
        $layout = $this->optionalString($props, 'layout', 16);
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
            $this->assertOnlyKeys($image, ['src', 'alt', 'caption'], "Gallery image {$index}");
            $src = $this->optionalString($image, 'src', 2048) ?? '';
            $alt = $this->requiredString($image, 'alt', 300);
            $caption = $this->optionalString($image, 'caption', 300) ?? '';
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'unit', 'items', 'appearance'], 'Bar Chart');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->optionalRichTextString($props, 'description', 1000) ?? '';
        $unit = $this->optionalString($props, 'unit', 20) ?? '';
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
            $this->assertOnlyKeys($item, ['label', 'value', 'tone'], "Bar Chart item {$index}");
            $label = $this->requiredString($item, 'label', 120);
            $value = $this->requiredNumber($item, 'value', 0, 100);
            $tone = $this->requiredString($item, 'tone', 16);
            if (! in_array($tone, $tones, true)) {
                throw new DocumentCompileException("Bar Chart item {$index} tone is invalid.");
            }
            $formattedValue = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
            $compiled[] = '<label><span><span>'.$this->escape($label).'</span><strong>'.$this->escape($formattedValue).'<span class="g7pb-bar-chart__unit">'.$this->escape($unit).'</span></strong></span><progress max="100" value="'.$this->escapeAttribute($formattedValue).'" data-tone="'.$tone.'">'.$this->escape($formattedValue).'</progress></label>';
        }

        $descriptionMarkup = $description === '' ? '' : ($this->hasCanonicalRichTextMarkup($description)
            ? '<div class="g7pb-bar-chart__description">'.$this->sanitizeRichText($description).'</div>'
            : '<p>'.$this->formatText($description).'</p>');

        return '<section class="g7pb-block g7pb-bar-chart '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="bar-chart"><figure><figcaption>'.$this->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.'</figcaption><div class="g7pb-bar-chart__plot">'.implode('', $compiled).'</div></figure></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileG7RecentPosts(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'period', 'limit', 'pageSize', 'audience', 'emptyMessage', 'appearance'], 'G7 recent posts');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->requiredString($props, 'source', 16);
        $period = $this->requiredString($props, 'period', 16);
        $limit = $this->requiredIntegerChoice($props, 'limit', [3, 4, 6, 8, 12]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->requiredIntegerChoice($props, 'pageSize', [3, 4, 6]) : 3;
        $audience = $this->requiredString($props, 'audience', 16);
        $emptyMessage = $this->requiredString($props, 'emptyMessage', 300);
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'limit', 'columns', 'pageSize', 'audience', 'detailBasePath', 'emptyMessage', 'appearance'], 'G7 product grid');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->requiredString($props, 'source', 16);
        $limit = $this->requiredIntegerChoice($props, 'limit', [2, 3, 4, 6, 8, 12]);
        $columns = $this->requiredIntegerChoice($props, 'columns', [2, 3, 4]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->requiredIntegerChoice($props, 'pageSize', [2, 3, 4, 6]) : 4;
        $audience = $this->requiredString($props, 'audience', 16);
        $detailBasePath = $this->requiredString($props, 'detailBasePath', 200);
        $emptyMessage = $this->requiredString($props, 'emptyMessage', 300);
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'formKind', 'submitLabel', 'successMessage', 'privacyLabel', 'showPhone', 'showSubject', 'appearance'], 'Inquiry form');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->optionalRichTextString($props, 'description', 1000) ?? '';
        $kind = $this->requiredString($props, 'formKind', 24);
        $submitLabel = $this->requiredString($props, 'submitLabel', 80);
        $successMessage = $this->requiredString($props, 'successMessage', 300);
        $privacyLabel = $this->requiredString($props, 'privacyLabel', 300);
        $showPhone = $this->requiredBoolean($props, 'showPhone');
        $showSubject = $this->requiredBoolean($props, 'showSubject');
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! in_array($kind, ['inquiry', 'quote', 'reservation', 'application', 'newsletter'], true)) {
            throw new DocumentCompileException('Inquiry form kind is invalid.');
        }

        $phone = $showPhone ? '<label><span>전화번호</span><span data-g7pb-form-control="input" data-g7pb-control-type="tel" data-g7pb-control-name="phone" data-g7pb-control-maxlength="40" data-g7pb-control-autocomplete="tel"></span></label>' : '';
        $subject = $showSubject ? '<label class="g7pb-inquiry-form__wide"><span>문의 제목</span><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="subject" data-g7pb-control-maxlength="200"></span></label>' : '';

        return '<section class="g7pb-block g7pb-inquiry '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="inquiry-form">'
            .'<div class="g7pb-inquiry__intro">'.$this->compileSectionHeading($eyebrow, $heading).($description === '' ? '' : ($this->hasCanonicalRichTextMarkup($description) ? '<div class="g7pb-inquiry__description">'.$this->sanitizeRichText($description).'</div>' : '<p>'.$this->formatText($description).'</p>')).'</div>'
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'address', 'latitude', 'longitude', 'zoom', 'provider', 'mapImageSrc', 'mapImageAlt', 'directionsLabel', 'directionsUrl', 'phone', 'hours', 'parking', 'appearance'], 'Map directions');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $description = $this->optionalRichTextString($props, 'description', 1000) ?? '';
        $address = $this->requiredString($props, 'address', 500);
        $latitude = $this->requiredNumber($props, 'latitude', -90, 90);
        $longitude = $this->requiredNumber($props, 'longitude', -180, 180);
        $zoom = $this->requiredIntegerChoice($props, 'zoom', [12, 14, 16, 18]);
        $provider = $this->requiredString($props, 'provider', 24);
        $mapImageSrc = $this->optionalString($props, 'mapImageSrc', 2048) ?? '';
        $mapImageAlt = $this->optionalString($props, 'mapImageAlt', 300) ?? '';
        $directionsLabel = $this->requiredString($props, 'directionsLabel', 80);
        $directionsUrl = $this->requiredString($props, 'directionsUrl', 2048);
        $phone = $this->optionalString($props, 'phone', 40) ?? '';
        $hours = $this->optionalString($props, 'hours', 300) ?? '';
        $parking = $this->optionalString($props, 'parking', 300) ?? '';
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($provider, ['image', 'openstreetmap', 'google', 'none'], true)) {
            throw new DocumentCompileException('Map provider is invalid.');
        }
        $this->assertAllowedUrl($directionsUrl, 'Directions link');

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

        $descriptionMarkup = $description === '' ? '' : ($this->hasCanonicalRichTextMarkup($description)
            ? '<div class="g7pb-map__description">'.$this->sanitizeRichText($description).'</div>'
            : '<p>'.$this->formatText($description).'</p>');

        return '<section class="g7pb-block g7pb-map '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="map-directions"><div class="g7pb-map__intro">'.$this->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.$details.'</div><div class="g7pb-map__frame">'.$map.'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTestimonials(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Testimonials');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->requiredString($props, 'layout', 16);
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
            $this->assertOnlyKeys($item, ['quote', 'name', 'role', 'company', 'avatarSrc', 'avatarAlt', 'rating'], "Testimonial item {$index}");
            $quote = $this->requiredString($item, 'quote', 1200);
            $name = $this->requiredString($item, 'name', 120);
            $role = $this->optionalString($item, 'role', 120) ?? '';
            $company = $this->optionalString($item, 'company', 120) ?? '';
            $avatarSrc = $this->optionalString($item, 'avatarSrc', 2048) ?? '';
            $avatarAlt = $this->optionalString($item, 'avatarAlt', 300) ?? '';
            $rating = $this->requiredIntegerChoice($item, 'rating', [1, 2, 3, 4, 5]);
            $avatar = $this->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonials__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escape($company).'</span>');
            $compiled[] = '<blockquote><p class="g7pb-testimonials__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p><div class="g7pb-testimonials__quote">'.$this->sanitizeRichText($quote).'</div><footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonials g7pb-testimonials--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonials">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-testimonials__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileFaqAccordion(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'behavior', 'openFirst', 'appearance'], 'FAQ accordion');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $behavior = $this->requiredString($props, 'behavior', 16);
        $openFirst = $this->requiredBoolean($props, 'openFirst');
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
            $this->assertOnlyKeys($item, ['question', 'answer'], "FAQ item {$index}");
            $question = $this->requiredInlineRichTextString($item, 'question', 300);
            $answer = $this->requiredString($item, 'answer', 4000);
            $open = $openFirst && $index === 0;
            $compiled[] = '<div class="g7pb-faq__item" data-g7pb-accordion-item data-g7pb-open="'.($open ? 'true' : 'false').'">'
                .'<div class="g7pb-faq__trigger" role="button" tabindex="0" data-g7pb-accordion-trigger aria-expanded="'.($open ? 'true' : 'false').'"><span>'.$this->sanitizePromotedInlineRichText($question).'</span><i aria-hidden="true">+</i></div>'
                .'<div class="g7pb-faq__answer" data-g7pb-accordion-panel>'.$this->sanitizeRichText($answer).'</div></div>';
        }

        return '<section class="g7pb-block g7pb-faq '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="faq-accordion" data-g7pb-accordion data-g7pb-accordion-behavior="'.$behavior.'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-faq__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileProcessTimeline(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Process timeline');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->requiredString($props, 'layout', 16);
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
            $this->assertOnlyKeys($item, ['title', 'body', 'linkLabel', 'linkUrl'], "Process step {$index}");
            $title = $this->requiredInlineRichTextString($item, 'title', 200);
            $body = $this->requiredString($item, 'body', 1500);
            $linkLabel = $this->optionalString($item, 'linkLabel', 120) ?? '';
            $linkUrl = $this->optionalString($item, 'linkUrl', 2048) ?? '';
            if (($linkLabel === '') !== ($linkUrl === '')) {
                throw new DocumentCompileException("Process step {$index} link requires both a label and URL.");
            }
            $link = '';
            if ($linkUrl !== '') {
                $this->assertAllowedUrl($linkUrl, "Process step {$index}");
                $link = '<a href="'.$this->escapeAttribute($linkUrl).'">'.$this->escape($linkLabel).' <span aria-hidden="true">→</span></a>';
            }
            $bodyMarkup = $this->hasRichTextMarkup($body)
                ? '<div class="g7pb-process__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $compiled[] = '<li><span class="g7pb-process__number">'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT).'</span><h3>'.$this->sanitizePromotedInlineRichText($title).'</h3>'.$bodyMarkup.$link.'</li>';
        }

        return '<section class="g7pb-block g7pb-process g7pb-process--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="process-timeline">'.$this->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTabs(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'initialTab', 'style', 'appearance'], 'Tabs');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $initialTab = $props['initialTab'] ?? null;
        $style = $this->requiredString($props, 'style', 16);
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
            $this->assertOnlyKeys($item, ['label', 'heading', 'body'], "Tab item {$index}");
            $label = $this->requiredString($item, 'label', 80);
            $itemHeading = $this->requiredInlineRichTextString($item, 'heading', 200);
            $body = $this->requiredString($item, 'body', 4000);
            $selected = $initialTab === $index;
            $buttons[] = '<span data-g7pb-runtime-button role="tab" data-g7pb-tab="'.$index.'" aria-selected="'.($selected ? 'true' : 'false').'" tabindex="'.($selected ? '0' : '-1').'">'.$this->escape($label).'</span>';
            $bodyMarkup = $this->hasRichTextMarkup($body)
                ? '<div class="g7pb-tabs__body">'.$this->sanitizeRichText($body).'</div>'
                : '<p>'.$this->formatText($body).'</p>';
            $panels[] = '<article role="tabpanel" data-g7pb-tab-panel="'.$index.'" tabindex="0"'.($selected ? '' : ' hidden').'><h3>'.$this->sanitizePromotedInlineRichText($itemHeading).'</h3>'.$bodyMarkup.'</article>';
        }

        return '<section class="g7pb-block g7pb-tabs g7pb-tabs--'.$style.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="tabs" data-g7pb-tabs data-g7pb-tabs-initial="'.$initialTab.'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-tabs__list" role="tablist" aria-label="'.$this->escapeAttribute($this->inlinePlainText($heading)).'">'.implode('', $buttons).'</div><div class="g7pb-tabs__panels">'.implode('', $panels).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileComparisonTable(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'columns', 'rows', 'highlightColumn', 'appearance'], 'Comparison table');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
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
            $this->assertOnlyKeys($column, ['title', 'description'], "Comparison column {$index}");
            $title = $this->requiredInlineRichTextString($column, 'title', 120);
            $description = $this->optionalInlineRichTextString($column, 'description', 300) ?? '';
            $headings[] = '<th scope="col"'.($highlight === $index ? ' class="is-highlighted"' : '').'><strong>'.$this->sanitizePromotedInlineRichText($title).'</strong>'.($description === '' ? '' : '<span>'.$this->sanitizePromotedInlineRichText($description).'</span>').'</th>';
        }

        $compiledRows = [];
        foreach (array_values($rows) as $rowIndex => $row) {
            if (! is_array($row)) {
                throw new DocumentCompileException("Comparison row {$rowIndex} must be an object.");
            }
            $this->assertOnlyKeys($row, ['feature', 'values'], "Comparison row {$rowIndex}");
            $feature = $this->requiredInlineRichTextString($row, 'feature', 200);
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
            $compiledRows[] = '<tr><th scope="row">'.$this->sanitizePromotedInlineRichText($feature).'</th>'.implode('', $cells).'</tr>';
        }

        return '<section class="g7pb-block g7pb-comparison '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="comparison-table">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-comparison__scroll" role="region" aria-label="'.$this->escapeAttribute($this->inlinePlainText($heading)).' 비교표" tabindex="0"><table><caption class="g7pb-visually-hidden">'.$this->escape($this->inlinePlainText($heading)).'</caption><thead><tr><th scope="col">항목</th>'.implode('', $headings).'</tr></thead><tbody>'.implode('', $compiledRows).'</tbody></table></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileArticleList(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Article list');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->requiredString($props, 'layout', 16);
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
            $this->assertOnlyKeys($item, ['category', 'title', 'summary', 'date', 'imageSrc', 'imageAlt', 'url'], "Article item {$index}");
            $category = $this->optionalString($item, 'category', 80) ?? '';
            $title = $this->requiredInlineRichTextString($item, 'title', 240, allowLinks: false);
            $summary = $this->requiredString($item, 'summary', 1200);
            $date = $this->optionalString($item, 'date', 40) ?? '';
            if ($date !== '') {
                $parsedDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
                if ($parsedDate === false || $parsedDate->format('Y-m-d') !== $date) {
                    throw new DocumentCompileException("Article item {$index} 날짜는 날짜 선택기로 입력해 주세요.");
                }
            }
            $imageSrc = $this->optionalString($item, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($item, 'imageAlt', 300) ?? '';
            $url = $this->requiredString($item, 'url', 2048);
            $this->assertAllowedUrl($url, "Article item {$index}");
            $plainTitle = $this->promotedInlinePlainText($title, allowLinks: false);
            $media = $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $plainTitle, 'g7pb-articles__image', str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT));
            $meta = array_filter([
                $category === '' ? '' : '<span>'.$this->escape($category).'</span>',
                $date === '' ? '' : '<time datetime="'.$this->escapeAttribute($date).'">'.$this->escape($date).'</time>',
            ]);
            $summaryMarkup = $this->hasRichTextMarkup($summary)
                ? '<div class="g7pb-articles__summary">'.$this->sanitizeRichText($summary).'</div>'
                : '<p>'.$this->formatText($summary).'</p>';
            $compiled[] = '<article><figure>'.$media.'</figure><div>'.($meta === [] ? '' : '<p class="g7pb-articles__meta">'.implode('<i>·</i>', $meta).'</p>').'<h3><a href="'.$this->escapeAttribute($url).'">'.$this->sanitizePromotedInlineRichText($title, allowLinks: false).'</a></h3>'.$summaryMarkup.'<a class="g7pb-articles__link" href="'.$this->escapeAttribute($url).'">읽어보기 <span aria-hidden="true">→</span></a></div></article>';
        }

        return '<section class="g7pb-block g7pb-articles g7pb-articles--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="article-list">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-articles__items">'.implode('', $compiled).'</div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileVideoEmbed(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'caption', 'provider', 'videoId', 'ratio', 'appearance'], 'Video embed');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $caption = $this->optionalRichTextString($props, 'caption', 1000) ?? '';
        $provider = $this->requiredString($props, 'provider', 16);
        $videoId = $this->requiredString($props, 'videoId', 32);
        $ratio = $this->requiredString($props, 'ratio', 8);
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

        $captionMarkup = $caption === '' ? '' : '<figcaption>'.($this->hasCanonicalRichTextMarkup($caption) ? $this->sanitizeRichText($caption) : $this->formatText($caption)).'</figcaption>';

        $embed = $this->embedPlaceholder('video-'.$provider, $src, $this->inlinePlainText($heading));

        return '<section class="g7pb-block g7pb-video '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="video-embed">'.$this->compileSectionHeading($eyebrow, $heading).'<figure><div class="g7pb-video__frame" data-ratio="'.$this->escapeAttribute($ratio).'">'.$embed.'</div>'.$captionMarkup.'</figure></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileLogoCarousel(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'logos', 'autoplay', 'interval', 'appearance'], 'Logo carousel');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $autoplay = $this->requiredBoolean($props, 'autoplay');
        $interval = $this->requiredIntegerChoice($props, 'interval', [3000, 5000, 7000]);
        $appearance = $this->appearanceClasses($props, 'default', 'compact');
        if (! is_array($logos) || count($logos) < 3 || count($logos) > 12) {
            throw new DocumentCompileException('Logo carousel must contain between three and twelve logos.');
        }

        $slides = [];
        foreach (array_values($logos) as $index => $logo) {
            if (! is_array($logo)) {
                throw new DocumentCompileException("Logo carousel item {$index} must be an object.");
            }
            $this->assertOnlyKeys($logo, ['name', 'imageSrc', 'imageAlt', 'url'], "Logo carousel item {$index}");
            $name = $this->requiredString($logo, 'name', 120);
            $imageSrc = $this->optionalString($logo, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($logo, 'imageAlt', 300) ?? '';
            $url = $this->optionalString($logo, 'url', 2048) ?? '';
            $visual = $imageSrc === ''
                ? '<span>'.$this->escape($name).'</span>'
                : $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name.' 로고', 'g7pb-logo-carousel__image', $name);
            if ($url !== '') {
                $this->assertAllowedUrl($url, "Logo carousel item {$index}");
                $visual = '<a href="'.$this->escapeAttribute($url).'" aria-label="'.$this->escapeAttribute($name).'">'.$visual.'</a>';
            }
            $slides[] = '<div class="g7pb-hero-slider__slide g7pb-logo-carousel__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($logos).'">'.$visual.'</div>';
        }

        return '<section class="g7pb-block g7pb-logo-carousel g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-carousel" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" aria-label="'.$this->escapeAttribute($this->inlinePlainText($heading)).'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileTestimonialSlider(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'autoplay', 'interval', 'appearance'], 'Testimonial slider');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $autoplay = $this->requiredBoolean($props, 'autoplay');
        $interval = $this->requiredIntegerChoice($props, 'interval', [5000, 7000, 9000]);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        if (! is_array($items) || count($items) < 2 || count($items) > 8) {
            throw new DocumentCompileException('Testimonial slider must contain between two and eight items.');
        }

        $slides = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Testimonial slider item {$index} must be an object.");
            }
            $this->assertOnlyKeys($item, ['quote', 'name', 'role', 'company', 'avatarSrc', 'avatarAlt', 'rating'], "Testimonial slider item {$index}");
            $quote = $this->requiredString($item, 'quote', 1200);
            $name = $this->requiredString($item, 'name', 120);
            $role = $this->optionalString($item, 'role', 120) ?? '';
            $company = $this->optionalString($item, 'company', 120) ?? '';
            $avatarSrc = $this->optionalString($item, 'avatarSrc', 2048) ?? '';
            $avatarAlt = $this->optionalString($item, 'avatarAlt', 300) ?? '';
            $rating = $this->requiredIntegerChoice($item, 'rating', [1, 2, 3, 4, 5]);
            $avatar = $this->compileCatalogImage($avatarSrc, $avatarAlt !== '' ? $avatarAlt : $name, 'g7pb-testimonial-slider__avatar', mb_substr($name, 0, 1));
            $meta = ($role === '' ? '' : '<span class="g7pb-testimonial-role">'.$this->escape($role).'</span>')
                .($role !== '' && $company !== '' ? '<i aria-hidden="true"> · </i>' : '')
                .($company === '' ? '' : '<span class="g7pb-testimonial-company">'.$this->escape($company).'</span>');
            $quoteMarkup = $this->hasRichTextMarkup($quote)
                ? '<div class="g7pb-testimonial-slider__quote">'.$this->sanitizeRichText($quote).'</div>'
                : '<p class="g7pb-testimonial-slider__quote">'.$this->formatText($quote).'</p>';
            $slides[] = '<blockquote class="g7pb-hero-slider__slide g7pb-testimonial-slider__slide" role="group" aria-roledescription="slide" aria-label="'.($index + 1).' / '.count($items).'"><p class="g7pb-testimonial-slider__rating" aria-label="5점 만점에 '.$rating.'점">'.str_repeat('★', $rating).'</p>'.$quoteMarkup.'<footer><figure>'.$avatar.'</figure><cite><strong>'.$this->escape($name).'</strong>'.$meta.'</cite></footer></blockquote>';
        }

        return '<section class="g7pb-block g7pb-testimonial-slider g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="testimonial-slider" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="true" aria-label="'.$this->escapeAttribute($this->inlinePlainText($heading)).'">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $slides).'</div></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileEventSchedule(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'layout', 'appearance'], 'Event schedule');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $layout = $this->requiredString($props, 'layout', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($layout, ['agenda', 'timeline'], true) || ! is_array($items) || count($items) < 1 || count($items) > 12) {
            throw new DocumentCompileException('Event schedule configuration is invalid.');
        }

        $compiled = [];
        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Event item {$index} must be an object.");
            }
            $this->assertOnlyKeys($item, ['date', 'time', 'title', 'location', 'description', 'buttonLabel', 'buttonUrl'], "Event item {$index}");
            $date = $this->requiredString($item, 'date', 40);
            $time = $this->optionalString($item, 'time', 40) ?? '';
            $title = $this->requiredInlineRichTextString($item, 'title', 240);
            $location = $this->optionalString($item, 'location', 240) ?? '';
            $description = $this->requiredString($item, 'description', 1500);
            $buttonLabel = $this->optionalString($item, 'buttonLabel', 120) ?? '';
            $buttonUrl = $this->optionalString($item, 'buttonUrl', 2048) ?? '';
            if (($buttonLabel === '') !== ($buttonUrl === '')) {
                throw new DocumentCompileException("Event item {$index} link requires both a label and URL.");
            }
            $action = '';
            if ($buttonUrl !== '') {
                $this->assertAllowedUrl($buttonUrl, "Event item {$index}");
                $action = '<a href="'.$this->escapeAttribute($buttonUrl).'">'.$this->escape($buttonLabel).' <span aria-hidden="true">→</span></a>';
            }
            $descriptionMarkup = $this->hasRichTextMarkup($description)
                ? '<div class="g7pb-events__description">'.$this->sanitizeRichText($description).'</div>'
                : '<p>'.$this->formatText($description).'</p>';
            $compiled[] = '<li><time datetime="'.$this->escapeAttribute($date.($time === '' ? '' : 'T'.$time)).'"><strong>'.$this->escape($date).'</strong>'.($time === '' ? '' : '<span>'.$this->escape($time).'</span>').'</time><article>'.($location === '' ? '' : '<p class="g7pb-events__location">'.$this->escape($location).'</p>').'<h3>'.$this->sanitizePromotedInlineRichText($title).'</h3>'.$descriptionMarkup.$action.'</article></li>';
        }

        return '<section class="g7pb-block g7pb-events g7pb-events--'.$layout.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="event-schedule">'.$this->compileSectionHeading($eyebrow, $heading).'<ol>'.implode('', $compiled).'</ol></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileDownloadResources(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'appearance'], 'Download resources');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
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
            $this->assertOnlyKeys($item, ['title', 'description', 'fileType', 'fileSize', 'buttonLabel', 'url'], "Download resource {$index}");
            $title = $this->requiredInlineRichTextString($item, 'title', 240);
            $description = $this->optionalString($item, 'description', 1200) ?? '';
            $fileType = $this->requiredString($item, 'fileType', 20);
            $fileSize = $this->optionalString($item, 'fileSize', 40) ?? '';
            $buttonLabel = $this->requiredString($item, 'buttonLabel', 120);
            $url = $this->requiredString($item, 'url', 2048);
            $this->assertAllowedUrl($url, "Download resource {$index}");
            $fileMeta = '<span class="g7pb-downloads__file-type">'.$this->escape($fileType).'</span>'
                .($fileSize === '' ? '' : '<i aria-hidden="true"> · </i><span class="g7pb-downloads__file-size">'.$this->escape($fileSize).'</span>');
            $descriptionMarkup = $description === '' ? '' : ($this->hasRichTextMarkup($description)
                ? '<div class="g7pb-downloads__description">'.$this->sanitizeRichText($description).'</div>'
                : '<p>'.$this->formatText($description).'</p>');
            $compiled[] = '<li><span class="g7pb-downloads__type">'.$this->escape(mb_strtoupper($fileType)).'</span><div><h3>'.$this->sanitizePromotedInlineRichText($title).'</h3>'.$descriptionMarkup.'<small>'.$fileMeta.'</small></div><a href="'.$this->escapeAttribute($url).'" download>'.$this->escape($buttonLabel).' <span aria-hidden="true">↓</span></a></li>';
        }

        return '<section class="g7pb-block g7pb-downloads '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="download-resources">'.$this->compileSectionHeading($eyebrow, $heading).'<ul>'.implode('', $compiled).'</ul></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileG7BoardArchive(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'period', 'limit', 'pageSize', 'audience', 'showSearch', 'showBoardFilter', 'emptyMessage', 'appearance'], 'G7 board archive');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->requiredString($props, 'source', 16);
        $period = $this->requiredString($props, 'period', 16);
        $limit = $this->requiredIntegerChoice($props, 'limit', [6, 8, 12]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->requiredIntegerChoice($props, 'pageSize', [3, 4, 6]) : 6;
        $audience = $this->requiredString($props, 'audience', 16);
        $showSearch = $this->requiredBoolean($props, 'showSearch');
        $showBoardFilter = $this->requiredBoolean($props, 'showBoardFilter');
        $emptyMessage = $this->requiredString($props, 'emptyMessage', 300);
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'limit', 'pageSize', 'audience', 'detailBasePath', 'layout', 'emptyMessage', 'appearance'], 'G7 product showcase');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->requiredString($props, 'source', 16);
        $limit = $this->requiredIntegerChoice($props, 'limit', [3, 4, 6, 8]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->requiredIntegerChoice($props, 'pageSize', [3, 4]) : 3;
        $audience = $this->requiredString($props, 'audience', 16);
        $detailBasePath = $this->requiredString($props, 'detailBasePath', 200);
        $layout = $this->requiredString($props, 'layout', 16);
        $emptyMessage = $this->requiredString($props, 'emptyMessage', 300);
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
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'boardSlug', 'postId', 'detailUrl', 'linkLabel', 'audience', 'showContent', 'emptyMessage', 'appearance'], 'G7 post detail');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $boardSlug = $this->requiredString($props, 'boardSlug', 80);
        $postId = $props['postId'] ?? null;
        $detailUrl = $this->requiredString($props, 'detailUrl', 2048);
        $linkLabel = $this->requiredString($props, 'linkLabel', 120);
        $audience = $this->requiredString($props, 'audience', 16);
        $showContent = $this->requiredBoolean($props, 'showContent');
        $emptyMessage = $this->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/D', $boardSlug) !== 1
            || ! is_int($postId) || $postId < 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 post detail configuration is invalid.');
        }
        $this->assertAllowedUrl($detailUrl, 'G7 post detail');
        $endpoint = '/api/modules/sirsoft-board/boards/'.rawurlencode($boardSlug).'/posts/'.$postId;
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-post-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-post-detail" data-g7pb-data-source="post-detail" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escapeAttribute($linkLabel).'" data-g7pb-show-content="'.($showContent ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">게시글을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escapeAttribute($detailUrl).'" hidden>'.$this->escape($linkLabel).'</a></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileG7ProductDetail(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'productKey', 'detailUrl', 'buttonLabel', 'audience', 'showDescription', 'emptyMessage', 'appearance'], 'G7 product detail');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredInlineRichTextString($props, 'heading', 200);
        $productKey = $this->requiredString($props, 'productKey', 100);
        $detailUrl = $this->requiredString($props, 'detailUrl', 2048);
        $buttonLabel = $this->requiredString($props, 'buttonLabel', 120);
        $audience = $this->requiredString($props, 'audience', 16);
        $showDescription = $this->requiredBoolean($props, 'showDescription');
        $emptyMessage = $this->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/D', $productKey) !== 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 product detail configuration is invalid.');
        }
        $this->assertAllowedUrl($detailUrl, 'G7 product detail');
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

        return '<header class="g7pb-section-heading">'.$eyebrowMarkup.'<h2>'.$this->sanitizeInlineRichText($heading).'</h2></header>';
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

        $this->assertAllowedImageUrl($src);

        return '<img class="'.$className.'" src="'.$this->escapeAttribute($src).'" alt="'.$this->escapeAttribute($alt).'" loading="'.$loading.'">';
    }

    private function withBlockRuntime(string $markup, string $instanceId, string $type, mixed $motion, mixed $visibility): string
    {
        $attributes = 'data-block-id="'.$this->escapeAttribute($instanceId).'"';

        if ($motion !== null) {
            if (! is_array($motion)) {
                throw new DocumentCompileException('Block motion must be an object.');
            }

            $this->assertOnlyKeys($motion, ['preset', 'intensity', 'trigger', 'stagger_ms'], 'Block motion');
            $preset = $this->requiredString($motion, 'preset', 32);
            $intensity = $this->requiredString($motion, 'intensity', 16);
            $trigger = $this->requiredString($motion, 'trigger', 16);
            $stagger = $motion['stagger_ms'] ?? null;

            if (! in_array($preset, $this->allowedMotionPresets($type), true)) {
                throw new DocumentCompileException('Block motion preset is not supported for this block type.');
            }
            if (! in_array($intensity, ['subtle', 'normal', 'strong'], true)) {
                throw new DocumentCompileException('Block motion intensity is invalid.');
            }
            if (! in_array($trigger, ['once', 'repeat'], true)) {
                throw new DocumentCompileException('Block motion trigger is invalid.');
            }
            if (! is_int($stagger) || ! in_array($stagger, [60, 100, 160], true)) {
                throw new DocumentCompileException('Block motion stagger interval is invalid.');
            }

            if ($preset !== 'none') {
                $attributes .= ' data-g7pb-motion="'.$this->escapeAttribute($preset).'"';
                $attributes .= ' data-g7pb-motion-intensity="'.$this->escapeAttribute($intensity).'"';
                $attributes .= ' data-g7pb-motion-trigger="'.$this->escapeAttribute($trigger).'"';
                $attributes .= ' data-g7pb-motion-stagger="'.$stagger.'"';
            }
        }

        if ($visibility !== null) {
            if (! is_array($visibility)) {
                throw new DocumentCompileException('Block visibility must be an object.');
            }
            $this->assertOnlyKeys($visibility, ['audience'], 'Block visibility');
            $audience = $this->requiredString($visibility, 'audience', 16);
            if (! in_array($audience, ['all', 'guest', 'member'], true)) {
                throw new DocumentCompileException('Block visibility audience is invalid.');
            }
            $attributes .= ' data-g7pb-visibility-audience="'.$this->escapeAttribute($audience).'"';
            if ($audience !== 'all' && preg_match('/^<section\b[^>]*\shidden(?:\s|>)/', $markup) !== 1) {
                $attributes .= ' hidden';
            }
        }

        $compiled = preg_replace('/^<section /', '<section '.$attributes.' ', $markup, 1);
        if (! is_string($compiled) || $compiled === $markup) {
            throw new DocumentCompileException('Compiled block markup has no section root.');
        }

        return $compiled;
    }

    /**
     * @return list<string>
     */
    private function allowedMotionPresets(string $type): array
    {
        return match ($type) {
            self::HERO_TYPE, self::HERO_SPLIT_TYPE, self::HERO_SLIDER_TYPE => ['none', 'reveal', 'parallax-soft'],
            self::FEATURES_TYPE, self::LOGO_CLOUD_TYPE, self::PRICING_TYPE, self::TEAM_TYPE, self::TESTIMONIALS_TYPE, self::PROCESS_TIMELINE_TYPE, self::ARTICLE_LIST_TYPE, self::G7_RECENT_POSTS_TYPE, self::G7_PRODUCT_GRID_TYPE, self::EVENT_SCHEDULE_TYPE, self::DOWNLOAD_RESOURCES_TYPE, self::G7_BOARD_ARCHIVE_TYPE, self::G7_PRODUCT_SHOWCASE_TYPE, self::ICON_LIST_TYPE, self::CARD_GRID_TYPE, self::SOCIAL_LINKS_TYPE => ['none', 'reveal', 'stagger'],
            self::STATS_TYPE => ['none', 'reveal', 'stagger', 'counter'],
            self::GALLERY_TYPE, self::IMAGE_CAROUSEL_TYPE => ['none', 'reveal', 'stagger', 'parallax-soft'],
            self::BAR_CHART_TYPE => ['none', 'reveal', 'chart-draw'],
            self::CTA_TYPE, self::CONTACT_TYPE, self::INQUIRY_FORM_TYPE, self::MAP_DIRECTIONS_TYPE, self::FAQ_ACCORDION_TYPE, self::TABS_TYPE, self::COMPARISON_TABLE_TYPE, self::VIDEO_EMBED_TYPE, self::LOGO_CAROUSEL_TYPE, self::TESTIMONIAL_SLIDER_TYPE, self::HEADING_TYPE, self::RICH_TEXT_TYPE, self::IMAGE_TYPE, self::BUTTONS_TYPE, self::IMAGE_TEXT_TYPE, self::G7_POST_DETAIL_TYPE, self::G7_PRODUCT_DETAIL_TYPE, self::DIVIDER_TYPE, self::BLOCKQUOTE_TYPE, self::NOTICE_TYPE, self::BREADCRUMBS_TYPE, self::ANCHOR_MENU_TYPE => ['none', 'reveal'],
            default => ['none'],
        };
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function appearanceClasses(array $props, string $defaultSurface, string $defaultSpacing): string
    {
        $appearance = $this->optionalMap($props, 'appearance') ?? [];
        $this->assertOnlyKeys($appearance, ['surface', 'spacing', 'textScale', 'textAlign', 'containerWidth', 'containerAlign', 'minHeight', 'verticalAlign', 'elements'], 'Block appearance');
        $surface = $this->optionalString($appearance, 'surface', 16) ?? $defaultSurface;
        $spacing = $this->optionalString($appearance, 'spacing', 16) ?? $defaultSpacing;
        $textScale = $this->optionalString($appearance, 'textScale', 16) ?? 'balanced';
        $textAlign = $this->optionalString($appearance, 'textAlign', 16) ?? 'left';
        $containerWidth = $this->optionalString($appearance, 'containerWidth', 16) ?? 'inherit';
        $containerAlign = $this->optionalString($appearance, 'containerAlign', 16) ?? 'center';
        $minHeight = $this->optionalString($appearance, 'minHeight', 16) ?? 'auto';
        $verticalAlign = $this->optionalString($appearance, 'verticalAlign', 16) ?? 'start';

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
     * @param  array<string, mixed>  $props
     */
    private function applyElementAppearances(string $markup, array $props, string $type): string
    {
        $appearance = $this->optionalMap($props, 'appearance') ?? [];
        $elements = $appearance['elements'] ?? [];
        if ($elements === []) {
            return $markup;
        }
        if (! is_array($elements) || count($elements) > 100) {
            throw new DocumentCompileException('Element appearance map is invalid.');
        }

        $document = new \DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadHTML(
            '<?xml encoding="UTF-8"><div data-g7pb-compile-root>'.$markup.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (! $loaded) {
            throw new DocumentCompileException('Compiled block could not be decorated.');
        }

        $rootNodes = (new \DOMXPath($document))->query('//*[@data-g7pb-compile-root]');
        $root = $rootNodes instanceof \DOMNodeList ? $rootNodes->item(0) : null;
        if (! $root instanceof \DOMElement) {
            throw new DocumentCompileException('Compiled block decoration root is missing.');
        }
        $xpath = new \DOMXPath($document);
        foreach ($elements as $fieldPath => $style) {
            if (! is_string($fieldPath) || preg_match('/^[A-Za-z][A-Za-z0-9]*(?:\.\d+)?(?:\.[A-Za-z][A-Za-z0-9]*)?$/D', $fieldPath) !== 1 || ! is_array($style)) {
                throw new DocumentCompileException('Element appearance field path is invalid.');
            }
            $selector = $this->elementAppearanceXPath($type, $fieldPath);
            $targets = $selector === null ? false : $xpath->query($selector, $root);
            if (! $targets instanceof \DOMNodeList || $targets->length === 0) {
                if ($this->isEmptyOptionalAppearanceTarget($type, $props, $fieldPath)) {
                    continue;
                }
                throw new DocumentCompileException("Element appearance target {$fieldPath} is not supported by block {$type}.");
            }
            $classes = $this->elementAppearanceClasses($style);
            foreach ($targets as $target) {
                if ($target instanceof \DOMElement) {
                    $target->setAttribute('class', trim($target->getAttribute('class').' '.$classes));
                }
            }
        }

        $compiled = '';
        foreach ($root->childNodes as $child) {
            $compiled .= $document->saveHTML($child);
        }

        return $compiled;
    }

    /** @param array<string, mixed> $style */
    private function elementAppearanceClasses(array $style): string
    {
        $this->assertOnlyKeys($style, ['font', 'fontSizeRem', 'size', 'weight', 'align', 'tone'], 'Element appearance');
        if ($style === []) {
            throw new DocumentCompileException('Element appearance cannot be empty.');
        }
        $font = $this->optionalString($style, 'font', 16);
        $fontSizeRem = $style['fontSizeRem'] ?? null;
        $size = $this->optionalString($style, 'size', 16);
        $weight = $this->optionalString($style, 'weight', 16);
        $align = $this->optionalString($style, 'align', 16);
        $tone = $this->optionalString($style, 'tone', 16);
        if ($font !== null && ! in_array($font, ['inherit', 'system', 'modern', 'serif', 'mono'], true)) {
            throw new DocumentCompileException('Element appearance font is invalid.');
        }
        if ($size !== null && ! in_array($size, ['small', 'base', 'large', 'xlarge'], true)) {
            throw new DocumentCompileException('Element appearance size is invalid.');
        }
        if ($fontSizeRem !== null && (! is_int($fontSizeRem) && ! is_float($fontSizeRem))) {
            throw new DocumentCompileException('Element appearance font size is invalid.');
        }
        $fontSizeIndex = $fontSizeRem === null ? false : array_search(
            (float) $fontSizeRem,
            [0.75, 0.875, 1.0, 1.125, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0],
            true,
        );
        if ($fontSizeRem !== null && $fontSizeIndex === false) {
            throw new DocumentCompileException('Element appearance font size is invalid.');
        }
        if ($fontSizeRem !== null && $size !== null) {
            throw new DocumentCompileException('Element appearance cannot combine legacy and explicit font sizes.');
        }
        if ($weight !== null && ! in_array($weight, ['regular', 'medium', 'semibold', 'bold'], true)) {
            throw new DocumentCompileException('Element appearance weight is invalid.');
        }
        if ($align !== null && ! in_array($align, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Element appearance alignment is invalid.');
        }
        if ($tone !== null && ! in_array($tone, ['default', 'muted', 'accent', 'contrast'], true)) {
            throw new DocumentCompileException('Element appearance tone is invalid.');
        }

        return implode(' ', array_filter([
            $font === null ? null : 'g7pb-element-font--'.$font,
            $fontSizeIndex === false ? null : 'g7pb-element-font-size--'.[12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96][$fontSizeIndex],
            $size === null ? null : 'g7pb-element-size--'.$size,
            $weight === null ? null : 'g7pb-element-weight--'.$weight,
            $align === null ? null : 'g7pb-element-align--'.$align,
            $tone === null ? null : 'g7pb-element-tone--'.$tone,
        ]));
    }

    private function elementAppearanceXPath(string $type, string $fieldPath): ?string
    {
        if (! str_contains($fieldPath, '.') && ! in_array($fieldPath, self::ROOT_ELEMENT_FIELDS[$type] ?? [], true)) {
            return null;
        }

        $hasClass = static fn (string $class): string => "contains(concat(' ', normalize-space(@class), ' '), ' {$class} ')";

        $root = match ($fieldPath) {
            'eyebrow' => '(.//*['.$hasClass('g7pb-section-eyebrow').' or '.$hasClass('g7pb-hero__eyebrow').' or '.$hasClass('g7pb-cta__eyebrow').'])[1]',
            'heading' => match ($type) {
                self::LOGO_CLOUD_TYPE => '(.//h2)[1]',
                self::CTA_TYPE => '(.//*['.$hasClass('g7pb-cta__heading').'])[1]',
                self::HEADING_TYPE => '(.//*['.$hasClass('g7pb-heading-block__heading').'])[1]',
                self::IMAGE_TEXT_TYPE => '(.//*['.$hasClass('g7pb-image-text__copy').']/h2)[1]',
                self::SOCIAL_LINKS_TYPE => '(.//h2)[1]',
                default => '(.//*['.$hasClass('g7pb-section-heading').']/h2 | .//*['.$hasClass('g7pb-contact__heading').']/h2)[1]',
            },
            'title' => match ($type) {
                self::HERO_TYPE => '(.//*['.$hasClass('g7pb-hero__title').'])[1]',
                self::FEATURES_TYPE => '(.//*['.$hasClass('g7pb-features__title').'])[1]',
                self::HERO_SPLIT_TYPE => '(.//*['.$hasClass('g7pb-hero-split__copy').']/h1)[1]',
                self::NOTICE_TYPE => '(.//*['.$hasClass('g7pb-content-notice__title').'])[1]',
                default => null,
            },
            'body' => match ($type) {
                self::HERO_TYPE => '(.//*['.$hasClass('g7pb-hero__body').'])[1]',
                self::CTA_TYPE => '(.//*['.$hasClass('g7pb-cta__body').'])[1]',
                self::HERO_SPLIT_TYPE => '(.//*['.$hasClass('g7pb-hero-split__body').'])[1]',
                self::IMAGE_TEXT_TYPE => '(.//*['.$hasClass('g7pb-image-text__body').'])[1]',
                self::NOTICE_TYPE => '(.//*['.$hasClass('g7pb-content-notice__body').'])[1]',
                default => null,
            },
            'content' => $type === self::RICH_TEXT_TYPE ? '(.//*['.$hasClass('g7pb-rich-text__content').'])[1]' : null,
            'primaryLabel' => '(.//a['.$hasClass('g7pb-button--primary').'])[1]',
            'secondaryLabel' => '(.//a['.$hasClass('g7pb-button--secondary').'])[1]',
            'linkLabel' => $type === self::G7_POST_DETAIL_TYPE ? '(.//a['.$hasClass('g7pb-data-detail__action').'])[1]' : null,
            'buttonLabel' => $type === self::G7_PRODUCT_DETAIL_TYPE ? '(.//a['.$hasClass('g7pb-data-detail__action').'])[1]' : null,
            'ctaLabel' => $type === self::CONTACT_TYPE ? '(.//a['.$hasClass('g7pb-button--primary').'])[1]' : null,
            'mapLabel' => $type === self::CONTACT_TYPE ? '(.//a['.$hasClass('g7pb-button--secondary').'])[1]' : null,
            'address' => match ($type) {
                self::CONTACT_TYPE => '(.//*['.$hasClass('g7pb-contact__details').']/p)[1]',
                self::MAP_DIRECTIONS_TYPE => '(.//*['.$hasClass('g7pb-map__intro').']//address/strong)[1]',
                default => null,
            },
            'phone' => match ($type) {
                self::CONTACT_TYPE => '(.//*['.$hasClass('g7pb-contact__details').']/a[starts-with(@href, "tel:")])[1]',
                self::MAP_DIRECTIONS_TYPE => '(.//*['.$hasClass('g7pb-map__phone').'])[1]',
                default => null,
            },
            'email' => $type === self::CONTACT_TYPE ? '(.//*['.$hasClass('g7pb-contact__details').']/a[starts-with(@href, "mailto:")])[1]' : null,
            'description' => match ($type) {
                self::BAR_CHART_TYPE => '(.//figcaption/*[('.$hasClass('g7pb-bar-chart__description').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))])[1]',
                self::INQUIRY_FORM_TYPE => '(.//*['.$hasClass('g7pb-inquiry__intro').']/*[('.$hasClass('g7pb-inquiry__description').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))])[1]',
                self::MAP_DIRECTIONS_TYPE => '(.//*['.$hasClass('g7pb-map__intro').']/*[('.$hasClass('g7pb-map__description').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))])[1]',
                default => null,
            },
            'privacyLabel' => $type === self::INQUIRY_FORM_TYPE ? '(.//*['.$hasClass('g7pb-inquiry-form__consent').']/span)[1]' : null,
            'submitLabel' => $type === self::INQUIRY_FORM_TYPE ? '(.//*[@data-g7pb-submit-copy])[1]' : null,
            'directionsLabel' => $type === self::MAP_DIRECTIONS_TYPE ? '(.//*['.$hasClass('g7pb-map__intro').']//address/a)[1]' : null,
            'hours' => $type === self::MAP_DIRECTIONS_TYPE ? '(.//*['.$hasClass('g7pb-map__hours').'])[1]' : null,
            'parking' => $type === self::MAP_DIRECTIONS_TYPE ? '(.//*['.$hasClass('g7pb-map__parking').'])[1]' : null,
            'caption' => in_array($type, [self::IMAGE_TYPE, self::VIDEO_EMBED_TYPE], true) ? '(.//figcaption)[1]' : null,
            'unit' => $type === self::BAR_CHART_TYPE ? './/*['.$hasClass('g7pb-bar-chart__unit').']' : null,
            'label' => match ($type) {
                self::DIVIDER_TYPE => '(.//*['.$hasClass('g7pb-divider__label').'])[1]',
                self::ANCHOR_MENU_TYPE => '(.//nav/strong)[1]',
                default => null,
            },
            'quote' => $type === self::BLOCKQUOTE_TYPE ? '(.//*['.$hasClass('g7pb-blockquote__quote').'])[1]' : null,
            'citation' => $type === self::BLOCKQUOTE_TYPE ? '(.//cite)[1]' : null,
            'role' => $type === self::BLOCKQUOTE_TYPE ? '(.//*['.$hasClass('g7pb-blockquote__role').'])[1]' : null,
            'actionLabel' => $type === self::NOTICE_TYPE ? '(.//*['.$hasClass('g7pb-content-notice__action').'])[1]' : null,
            'currentLabel' => $type === self::BREADCRUMBS_TYPE ? '(.//li[@aria-current="page"])[1]' : null,
            default => null,
        };
        if ($root !== null) {
            return $root;
        }

        if (preg_match('/^([A-Za-z]+)\.(\d+)\.([A-Za-z]+)$/D', $fieldPath, $match) !== 1) {
            return null;
        }
        [, $collection, $zeroIndex, $leaf] = $match;
        $index = ((int) $zeroIndex) + 1;

        return match ($type) {
            self::BUTTONS_TYPE => $collection === 'items' && $leaf === 'label' ? '(.//*['.$hasClass('g7pb-buttons__items').']/a)['.$index.']' : null,
            self::ICON_LIST_TYPE => $collection === 'items' ? match ($leaf) {
                'title' => '(.//*['.$hasClass('g7pb-icon-list__item').'])['.$index.']//h3',
                'body' => '(.//*['.$hasClass('g7pb-icon-list__item').'])['.$index.']//*[('.$hasClass('g7pb-icon-list__body').') or self::p][1]',
                default => null,
            } : null,
            self::FEATURES_TYPE => $collection === 'items' ? match ($leaf) {
                'title' => '(.//*['.$hasClass('g7pb-features__item').'])['.$index.']/h3',
                'body' => '(.//*['.$hasClass('g7pb-features__item').'])['.$index.']/*[('.$hasClass('g7pb-features__body').') or self::p][1]',
                default => null,
            } : null,
            self::HERO_SLIDER_TYPE => $collection === 'slides' ? match ($leaf) {
                'eyebrow' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//*['.$hasClass('g7pb-section-eyebrow').']',
                'title' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//h2',
                'body' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//*['.$hasClass('g7pb-hero-slider__copy').']/*[('.$hasClass('g7pb-hero-slider__body').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))]',
                'buttonLabel' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//a',
                default => null,
            } : null,
            self::LOGO_CLOUD_TYPE => $collection === 'logos' && $leaf === 'name' ? '(.//ul/li)['.$index.']//*[self::span][1]' : null,
            self::LOGO_CAROUSEL_TYPE => $collection === 'logos' && $leaf === 'name' ? '(.//*['.$hasClass('g7pb-logo-carousel__slide').'])['.$index.']//*[self::span][1]' : null,
            self::STATS_TYPE => $collection === 'items' ? match ($leaf) {
                'value' => '(.//*['.$hasClass('g7pb-stats__grid').']/article)['.$index.']/strong',
                'label' => '(.//*['.$hasClass('g7pb-stats__grid').']/article)['.$index.']/h3',
                'detail' => '(.//*['.$hasClass('g7pb-stats__grid').']/article)['.$index.']/*[('.$hasClass('g7pb-stats__detail').') or self::p][1]',
                default => null,
            } : null,
            self::PRICING_TYPE => $collection === 'plans' ? match ($leaf) {
                'name' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']/h3',
                'price' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']//*['.$hasClass('g7pb-pricing__price').']/strong',
                'period' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']//*['.$hasClass('g7pb-pricing__price').']/span',
                'description' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']/*[('.$hasClass('g7pb-pricing__description').') or (self::p and not('.$hasClass('g7pb-pricing__price').'))][1]',
                'buttonLabel' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']/a',
                default => null,
            } : null,
            self::TEAM_TYPE => $collection === 'members' ? match ($leaf) {
                'name' => '(.//*['.$hasClass('g7pb-team__grid').']/article)['.$index.']/h3',
                'role' => '(.//*['.$hasClass('g7pb-team__grid').']/article)['.$index.']/strong',
                'bio' => '(.//*['.$hasClass('g7pb-team__grid').']/article)['.$index.']/*[('.$hasClass('g7pb-team__bio').') or self::p][1]',
                default => null,
            } : null,
            self::GALLERY_TYPE => $collection === 'images' && $leaf === 'caption' ? '(.//*['.$hasClass('g7pb-gallery__grid').']/figure)['.$index.']/figcaption' : null,
            self::BAR_CHART_TYPE => $collection === 'items' && $leaf === 'label' ? '(.//*['.$hasClass('g7pb-bar-chart__plot').']/label)['.$index.']/span/span' : null,
            self::TESTIMONIALS_TYPE => $collection === 'items' ? $this->testimonialElementXPath('g7pb-testimonials__items', 'blockquote', $index, $leaf, $hasClass) : null,
            self::TESTIMONIAL_SLIDER_TYPE => $collection === 'items' ? $this->testimonialElementXPath('g7pb-hero-slider__track', 'blockquote', $index, $leaf, $hasClass) : null,
            self::FAQ_ACCORDION_TYPE => $collection === 'items' ? match ($leaf) {
                'question' => '(.//*['.$hasClass('g7pb-faq__items').']/*['.$hasClass('g7pb-faq__item').'])['.$index.']/*['.$hasClass('g7pb-faq__trigger').']/span',
                'answer' => '(.//*['.$hasClass('g7pb-faq__items').']/*['.$hasClass('g7pb-faq__item').'])['.$index.']/*['.$hasClass('g7pb-faq__answer').']',
                default => null,
            } : null,
            self::PROCESS_TIMELINE_TYPE => $collection === 'items' ? match ($leaf) {
                'title' => '(.//ol/li)['.$index.']/h3',
                'body' => '(.//ol/li)['.$index.']/*[('.$hasClass('g7pb-process__body').') or self::p]',
                'linkLabel' => '(.//ol/li)['.$index.']/a',
                default => null,
            } : null,
            self::TABS_TYPE => $collection === 'items' ? match ($leaf) {
                'label' => '(.//*['.$hasClass('g7pb-tabs__list').']/*[@data-g7pb-tab])['.$index.']',
                'heading' => '(.//*['.$hasClass('g7pb-tabs__panels').']/article)['.$index.']/h3',
                'body' => '(.//*['.$hasClass('g7pb-tabs__panels').']/article)['.$index.']/*[('.$hasClass('g7pb-tabs__body').') or self::p]',
                default => null,
            } : null,
            self::COMPARISON_TABLE_TYPE => match ($collection) {
                'columns' => match ($leaf) {
                    'title' => '(.//thead/tr/th[position() > 1])['.$index.']/strong',
                    'description' => '(.//thead/tr/th[position() > 1])['.$index.']/span',
                    default => null,
                },
                'rows' => $leaf === 'feature' ? '(.//tbody/tr)['.$index.']/th' : null,
                default => null,
            },
            self::ARTICLE_LIST_TYPE => $collection === 'items' ? match ($leaf) {
                'category' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//*['.$hasClass('g7pb-articles__meta').']/span',
                'date' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//*['.$hasClass('g7pb-articles__meta').']/time',
                'title' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//h3',
                'summary' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//h3/following-sibling::*[1][('.$hasClass('g7pb-articles__summary').') or self::p]',
                default => null,
            } : null,
            self::EVENT_SCHEDULE_TYPE => $collection === 'items' ? match ($leaf) {
                'date' => '(.//ol/li)['.$index.']/time/strong',
                'time' => '(.//ol/li)['.$index.']/time/span',
                'location' => '(.//ol/li)['.$index.']//*['.$hasClass('g7pb-events__location').']',
                'title' => '(.//ol/li)['.$index.']//h3',
                'description' => '(.//ol/li)['.$index.']//article/*[('.$hasClass('g7pb-events__description').') or (self::p and not('.$hasClass('g7pb-events__location').'))]',
                'buttonLabel' => '(.//ol/li)['.$index.']//article/a',
                default => null,
            } : null,
            self::DOWNLOAD_RESOURCES_TYPE => $collection === 'items' ? match ($leaf) {
                'title' => '(.//ul/li)['.$index.']//h3',
                'description' => '(.//ul/li)['.$index.']//h3/following-sibling::*[1][('.$hasClass('g7pb-downloads__description').') or self::p]',
                'fileType' => '(.//ul/li)['.$index.']//*['.$hasClass('g7pb-downloads__file-type').']',
                'fileSize' => '(.//ul/li)['.$index.']//*['.$hasClass('g7pb-downloads__file-size').']',
                'buttonLabel' => '(.//ul/li)['.$index.']/a',
                default => null,
            } : null,
            self::CARD_GRID_TYPE => $collection === 'items' ? match ($leaf) {
                'kicker' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']//*['.$hasClass('g7pb-card-grid__kicker').']',
                'title' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']/h3',
                'body' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']//*['.$hasClass('g7pb-card-grid__body').']',
                'linkLabel' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']/a',
                default => null,
            } : null,
            self::BREADCRUMBS_TYPE => $collection === 'items' && $leaf === 'label' ? '(.//ol/li/a)['.$index.']' : null,
            self::ANCHOR_MENU_TYPE => $collection === 'items' && $leaf === 'label' ? '(.//nav/ul/li/a)['.$index.']' : null,
            self::SOCIAL_LINKS_TYPE => $collection === 'items' && $leaf === 'label' ? '(.//nav/ul/li/a/span[last()])['.$index.']' : null,
            self::IMAGE_CAROUSEL_TYPE => $collection === 'images' && $leaf === 'caption' ? '(.//*['.$hasClass('g7pb-image-carousel__slide').'])['.$index.']/figcaption' : null,
            default => null,
        };
    }

    /** @param array<string, mixed> $props */
    private function isEmptyOptionalAppearanceTarget(string $type, array $props, string $fieldPath): bool
    {
        return match ([$type, $fieldPath]) {
            [self::HEADING_TYPE, 'eyebrow'],
            [self::IMAGE_TYPE, 'caption'],
            [self::IMAGE_TEXT_TYPE, 'eyebrow'],
            [self::IMAGE_TEXT_TYPE, 'body'],
            [self::ICON_LIST_TYPE, 'eyebrow'] => ($props[$fieldPath] ?? '') === '',
            [self::DIVIDER_TYPE, 'label'],
            [self::BLOCKQUOTE_TYPE, 'role'] => ($props[$fieldPath] ?? '') === '',
            [self::NOTICE_TYPE, 'actionLabel'] => ($props['actionLabel'] ?? '') === '',
            [self::IMAGE_TEXT_TYPE, 'primaryLabel'] => ! is_array($props['primaryLink'] ?? null),
            default => false,
        };
    }

    /** @param callable(string): string $hasClass */
    private function testimonialElementXPath(string $containerClass, string $itemTag, int $index, string $leaf, callable $hasClass): ?string
    {
        $base = '(.//*['.$hasClass($containerClass).']/'.$itemTag.')['.$index.']';

        return match ($leaf) {
            'quote' => $base.'/*['.$hasClass(str_contains($containerClass, 'slider') ? 'g7pb-testimonial-slider__quote' : 'g7pb-testimonials__quote').']',
            'name' => $base.'//cite/strong',
            'role' => $base.'//cite/*['.$hasClass('g7pb-testimonial-role').']',
            'company' => $base.'//cite/*['.$hasClass('g7pb-testimonial-company').']',
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $link
     */
    private function compileActionLink(array $link, string $property, string $className): string
    {
        $this->assertOnlyKeys($link, ['label', 'url'], $property);
        $label = $this->requiredString($link, 'label', 120);
        $url = $this->requiredString($link, 'url', 2048);
        $this->assertAllowedUrl($url, $property);

        return '<a class="'.$className.'" href="'.$this->escapeAttribute($url).'">'.$this->escape($label).'</a>';
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function requiredString(array $values, string $key, int $maxLength): string
    {
        $value = $values[$key] ?? null;

        if (! is_string($value) || trim($value) === '') {
            throw new DocumentCompileException($this->requiredFieldMessage($key));
        }
        if (mb_strlen($value) > $maxLength) {
            throw new DocumentCompileException($this->fieldLengthMessage($key, $maxLength));
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function optionalString(array $values, string $key, int $maxLength): ?string
    {
        $value = $values[$key] ?? null;

        if ($value === null) {
            return null;
        }

        if (! is_string($value) || mb_strlen($value) > $maxLength) {
            throw new DocumentCompileException("Property {$key} must be a string within its length limit.");
        }

        return $value;
    }

    /** @param array<string, mixed> $values */
    private function requiredInlineRichTextString(
        array $values,
        string $key,
        int $maxLength,
        bool $allowLinks = true,
    ): string {
        return $this->requiredInlineRichTextValue(
            $values[$key] ?? null,
            "Property {$key}",
            $maxLength,
            $allowLinks,
        );
    }

    /** @param array<string, mixed> $values */
    private function optionalInlineRichTextString(
        array $values,
        string $key,
        int $maxLength,
        bool $allowLinks = true,
    ): ?string {
        $value = $values[$key] ?? null;
        if ($value === null) {
            return null;
        }
        if (! is_string($value)) {
            throw new DocumentCompileException("Property {$key} must be a string within its length limit.");
        }

        $this->assertPromotedRichTextLength($value, $maxLength, inline: true, allowLinks: $allowLinks);

        return $value;
    }

    /** @param array<string, mixed> $values */
    private function requiredRichTextString(array $values, string $key, int $maxLength): string
    {
        $value = $values[$key] ?? null;
        if (! is_string($value)) {
            throw new DocumentCompileException($this->requiredFieldMessage($key));
        }

        $this->assertPromotedRichTextLength($value, $maxLength, required: true, property: $key);

        return $value;
    }

    /** @param array<string, mixed> $values */
    private function optionalRichTextString(array $values, string $key, int $maxLength): ?string
    {
        $value = $values[$key] ?? null;
        if ($value === null) {
            return null;
        }
        if (! is_string($value)) {
            throw new DocumentCompileException("Property {$key} must be a string within its length limit.");
        }

        $this->assertPromotedRichTextLength($value, $maxLength);

        return $value;
    }

    private function requiredInlineRichTextValue(
        mixed $value,
        string $property,
        int $maxLength,
        bool $allowLinks = true,
    ): string {
        if (! is_string($value)) {
            throw new DocumentCompileException("{$property} is invalid.");
        }

        $this->assertPromotedRichTextLength(
            $value,
            $maxLength,
            required: true,
            inline: true,
            allowLinks: $allowLinks,
        );

        return $value;
    }

    private function assertPromotedRichTextLength(
        string $value,
        int $maxLength,
        bool $required = false,
        bool $inline = false,
        bool $allowLinks = true,
        ?string $property = null,
    ): void {
        $plainText = $this->promotedRichTextPlainText($value, $inline, $allowLinks);
        if ($required && trim($plainText) === '') {
            throw new DocumentCompileException($this->requiredFieldMessage($property ?? 'content'));
        }
        if (mb_strlen($plainText) > $maxLength) {
            throw new DocumentCompileException($this->fieldLengthMessage($property ?? 'content', $maxLength));
        }
    }

    private function requiredFieldMessage(string $key): string
    {
        return '필수 항목 “'.$this->fieldLabel($key).'”를 입력해야 합니다.';
    }

    private function fieldLengthMessage(string $key, int $maxLength): string
    {
        return '“'.$this->fieldLabel($key).'” 입력은 '.$maxLength.'자 이내여야 합니다.';
    }

    private function fieldLabel(string $key): string
    {
        return match ($key) {
            'alt', 'imageAlt', 'avatarAlt' => '이미지 대체 텍스트',
            'title', 'heading' => '제목',
            'content', 'body', 'answer', 'description', 'summary' => '본문',
            'label', 'buttonLabel', 'submitLabel', 'directionsLabel', 'linkLabel', 'currentLabel' => '표시 문구',
            'url', 'buttonUrl', 'directionsUrl', 'detailUrl', 'detailBasePath' => '연결 주소',
            'src' => '이미지',
            'address' => '주소',
            'phone' => '전화번호',
            'email' => '이메일',
            'date' => '날짜',
            'name' => '이름',
            'role' => '역할',
            'quote' => '인용문',
            'citation' => '출처',
            'videoId' => '영상 ID',
            'productKey' => '상품 식별자',
            'boardSlug' => '게시판 식별자',
            default => $key,
        };
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function requiredBoolean(array $values, string $key): bool
    {
        $value = $values[$key] ?? null;

        if (! is_bool($value)) {
            throw new DocumentCompileException("Property {$key} must be a boolean.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function requiredNumber(array $values, string $key, float $minimum, float $maximum): float
    {
        $value = $values[$key] ?? null;

        if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value)) {
            throw new DocumentCompileException("Property {$key} must be a finite number.");
        }

        $number = (float) $value;
        if ($number < $minimum || $number > $maximum) {
            throw new DocumentCompileException("Property {$key} is outside the allowed range.");
        }

        return $number;
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  list<int>  $choices
     */
    private function requiredIntegerChoice(array $values, string $key, array $choices): int
    {
        $value = $values[$key] ?? null;
        if (! is_int($value) || ! in_array($value, $choices, true)) {
            throw new DocumentCompileException("Property {$key} is invalid.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>|null
     */
    private function optionalMap(array $values, string $key): ?array
    {
        $value = $values[$key] ?? null;

        if ($value === null) {
            return null;
        }

        if (! is_array($value)) {
            throw new DocumentCompileException("Property {$key} must be an object.");
        }

        return $value;
    }

    /**
     * @param  array<array-key, mixed>  $values
     * @param  list<string>  $allowedKeys
     */
    private function assertOnlyKeys(array $values, array $allowedKeys, string $property): void
    {
        foreach (array_keys($values) as $key) {
            if (! is_string($key) || ! in_array($key, $allowedKeys, true)) {
                throw new DocumentCompileException("{$property} contains an unsupported property.");
            }
        }
    }

    private function assertAllowedUrl(string $url, string $property): void
    {
        if ($url === '#g7-action-logout' || $this->isRelativeUrl($url) || $this->isHttpsUrl($url) || $this->isMailtoUrl($url) || $this->isTelUrl($url)) {
            return;
        }

        throw new DocumentCompileException("{$property} URL is not allowed.");
    }

    private function assertAllowedImageUrl(string $url): void
    {
        if ($this->isRelativeUrl($url) || $this->isHttpsUrl($url)) {
            return;
        }

        throw new DocumentCompileException('Image URL is not allowed.');
    }

    private function assertPageOrHttpsUrl(string $url, string $property): void
    {
        if ($this->isRelativeUrl($url) || $this->isHttpsUrl($url)) {
            return;
        }

        throw new DocumentCompileException("{$property} URL is not allowed.");
    }

    private function isRelativeUrl(string $url): bool
    {
        return str_starts_with($url, '/')
            && ! str_starts_with($url, '//')
            && ! str_contains($url, '\\')
            && preg_match('/[\x00-\x20\x7f]/', $url) !== 1;
    }

    private function isHttpsUrl(string $url): bool
    {
        if (preg_match('/[\x00-\x20\x7f]/', $url) === 1 || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        return strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https'
            && is_string(parse_url($url, PHP_URL_HOST))
            && parse_url($url, PHP_URL_HOST) !== '';
    }

    private function isMailtoUrl(string $url): bool
    {
        if (! str_starts_with(strtolower($url), 'mailto:')) {
            return false;
        }

        $email = substr($url, 7);

        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    private function isTelUrl(string $url): bool
    {
        return preg_match('/^tel:\+?[0-9][0-9.-]{2,39}$/i', $url) === 1;
    }

    private function phoneHref(string $phone): string
    {
        if (preg_match('/^\+?[0-9][0-9 .()\-]{2,39}$/', $phone) !== 1) {
            throw new DocumentCompileException('Contact phone is invalid.');
        }

        $normalized = preg_replace('/[ .()\-]/', '', $phone);
        $href = 'tel:'.($normalized ?? '');

        if (! $this->isTelUrl($href)) {
            throw new DocumentCompileException('Contact phone is invalid.');
        }

        return $href;
    }

    private function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }

    private function formatText(string $value): string
    {
        return nl2br($this->escape($value), false);
    }

    private function hasRichTextMarkup(string $value): bool
    {
        return preg_match('/<\/?[a-z][^>]*>/i', $value) === 1;
    }

    private function hasCanonicalInlineRichTextMarkup(string $value): bool
    {
        return preg_match('/^\s*<p\b[^>]*>.*<\/p>\s*$/is', $value) === 1;
    }

    private function hasCanonicalRichTextMarkup(string $value): bool
    {
        return preg_match('/^\s*<(?:p|h[2-4]|ol|ul|blockquote)\b/i', $value) === 1;
    }

    private function sanitizePromotedInlineRichText(string $value, bool $allowLinks = true): string
    {
        return $this->hasCanonicalInlineRichTextMarkup($value)
            ? $this->sanitizeInlineRichText($value, $allowLinks)
            : $this->escape($value);
    }

    private function promotedRichTextPlainText(string $value, bool $inline, bool $allowLinks): string
    {
        if ($inline) {
            return $this->hasCanonicalInlineRichTextMarkup($value)
                ? $this->inlinePlainText($value, $allowLinks)
                : $value;
        }
        if (! $this->hasCanonicalRichTextMarkup($value)) {
            return $value;
        }

        $sanitized = $this->sanitizeRichText($value, $allowLinks);
        $withBreaks = preg_replace(
            '/<br\s*\/?\s*>|<\/(?:p|h[2-4]|li|blockquote)>/i',
            ' ',
            $sanitized,
        );
        $plainText = html_entity_decode(strip_tags((string) $withBreaks), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim((string) preg_replace('/\s+/u', ' ', $plainText));
    }

    private function promotedInlinePlainText(string $value, bool $allowLinks = true): string
    {
        return $this->hasCanonicalInlineRichTextMarkup($value)
            ? $this->inlinePlainText($value, $allowLinks)
            : trim($value);
    }

    private function sanitizeRichText(string $html, bool $allowLinks = true): string
    {
        if (preg_match('/<(?:script|style|iframe|object|embed|svg|math|form|input|button)\b/i', $html) === 1
            || preg_match('/\son[a-z]+\s*=/i', $html) === 1) {
            throw new DocumentCompileException('Rich text contains unsafe markup.');
        }
        $this->assertRichTextLinkNesting($html, $allowLinks);

        $document = new \DOMDocument('1.0', 'UTF-8');
        $previousErrors = libxml_use_internal_errors(true);

        try {
            $loaded = $document->loadHTML(
                '<?xml encoding="utf-8" ?><div id="g7pb-richtext-root">'.$html.'</div>',
                LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousErrors);
        }

        if (! $loaded) {
            throw new DocumentCompileException('Rich text is invalid.');
        }

        $root = $document->getElementById('g7pb-richtext-root');

        if (! $root instanceof \DOMElement) {
            throw new DocumentCompileException('Rich text could not be parsed.');
        }

        $this->sanitizeRichTextNode($root, $allowLinks);
        $parts = [];

        foreach ($root->childNodes as $child) {
            $parts[] = $document->saveHTML($child);
        }

        $sanitized = implode('', $parts);

        if ($sanitized === '') {
            return '';
        }

        if (preg_match('/^<(?:p|h[2-4]|ol|ul|blockquote)\b/i', ltrim($sanitized)) !== 1) {
            return '<p>'.$sanitized.'</p>';
        }

        return $sanitized;
    }

    private function sanitizeRichTextNode(\DOMNode $parent, bool $allowLinks): void
    {
        $allowed = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'span', 'a', 'ol', 'ul', 'li', 'blockquote', 'br'];

        for ($child = $parent->firstChild; $child !== null;) {
            $next = $child->nextSibling;

            if ($child instanceof \DOMComment) {
                $parent->removeChild($child);
                $child = $next;

                continue;
            }

            if ($child instanceof \DOMElement) {
                $tag = strtolower($child->tagName);

                if (! in_array($tag, $allowed, true)) {
                    $this->sanitizeRichTextNode($child, $allowLinks);

                    while ($child->firstChild !== null) {
                        $parent->insertBefore($child->firstChild, $child);
                    }

                    $parent->removeChild($child);
                    $child = $next;

                    continue;
                }

                $attributes = [];
                foreach ($child->attributes as $attribute) {
                    $attributes[] = $attribute->name;
                }

                foreach ($attributes as $attribute) {
                    $isLinkHref = $tag === 'a' && $attribute === 'href';
                    $isTypedTextMark = $tag === 'span'
                        && in_array($attribute, ['data-g7pb-font', 'data-g7pb-font-size-rem', 'data-g7pb-size', 'data-g7pb-weight', 'data-g7pb-tone'], true);
                    if (! $isLinkHref && ! $isTypedTextMark) {
                        $child->removeAttribute($attribute);
                    }
                }

                if ($tag === 'span') {
                    $allowedValues = [
                        'data-g7pb-font' => ['modern', 'serif', 'mono'],
                        'data-g7pb-font-size-rem' => ['0.75', '0.875', '1', '1.125', '1.25', '1.5', '1.75', '2', '2.25', '2.5', '3', '3.5', '4', '4.5', '5', '6'],
                        'data-g7pb-size' => ['small', 'large', 'xlarge'],
                        'data-g7pb-weight' => ['medium', 'semibold', 'bold'],
                        'data-g7pb-tone' => ['muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'],
                    ];
                    foreach ($allowedValues as $attribute => $values) {
                        if ($child->hasAttribute($attribute)
                            && ! in_array($child->getAttribute($attribute), $values, true)) {
                            throw new DocumentCompileException('Rich text contains an unsupported typed mark.');
                        }
                    }
                }

                if ($tag === 'a') {
                    $href = $child->getAttribute('href');
                    $this->assertAllowedUrl($href, 'Rich text link');
                    $child->setAttribute('rel', 'noopener noreferrer');
                }

                $this->sanitizeRichTextNode($child, $allowLinks);
            } elseif (! $child instanceof \DOMText) {
                $parent->removeChild($child);
            }

            $child = $next;
        }
    }

    private function sanitizeInlineRichText(string $html, bool $allowLinks = true): string
    {
        $this->assertRichTextLinkNesting($html, $allowLinks);
        if (! preg_match('/<(?:p|strong|em|u|span|a|br)\b/i', $html)) {
            return $this->escape($html);
        }

        $sanitized = $this->sanitizeRichText($html, $allowLinks);
        $document = new \DOMDocument('1.0', 'UTF-8');
        $previousErrors = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadHTML(
                '<?xml encoding="utf-8" ?><div id="g7pb-inline-root">'.$sanitized.'</div>',
                LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousErrors);
        }
        $root = $loaded ? $document->getElementById('g7pb-inline-root') : null;
        if (! $root instanceof \DOMElement) {
            throw new DocumentCompileException('Inline rich text could not be parsed.');
        }

        $parts = [];
        foreach ($root->childNodes as $child) {
            if ($child instanceof \DOMText && trim($child->textContent) === '') {
                continue;
            }
            if (! $child instanceof \DOMElement || strtolower($child->tagName) !== 'p') {
                throw new DocumentCompileException('Inline rich text only supports paragraphs.');
            }
            if ($parts !== []) {
                $parts[] = '<br>';
            }
            foreach ($child->childNodes as $inlineChild) {
                $parts[] = $document->saveHTML($inlineChild);
            }
        }

        return implode('', $parts);
    }

    private function inlinePlainText(string $html, bool $allowLinks = true): string
    {
        $sanitized = preg_replace('/<br\s*\/?\s*>/i', ' ', $this->sanitizeInlineRichText($html, $allowLinks));

        return trim(html_entity_decode(strip_tags((string) $sanitized), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    private function assertRichTextLinkNesting(string $html, bool $allowLinks): void
    {
        if (! $allowLinks && preg_match('/<\s*a\b/i', $html) === 1) {
            throw new DocumentCompileException('Rich text links are not allowed in this field.');
        }

        preg_match_all('/<\s*(\/?)\s*a\b[^>]*>/i', $html, $matches, PREG_SET_ORDER);
        $depth = 0;
        foreach ($matches as $match) {
            if ($match[1] === '/') {
                if ($depth === 0) {
                    throw new DocumentCompileException('Rich text link markup is invalid.');
                }
                $depth--;

                continue;
            }
            if ($depth > 0) {
                throw new DocumentCompileException('Rich text links cannot be nested.');
            }
            $depth++;
        }
        if ($depth !== 0) {
            throw new DocumentCompileException('Rich text link markup is invalid.');
        }
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
