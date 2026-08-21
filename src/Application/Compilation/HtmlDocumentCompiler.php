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
    public const COMPILER_VERSION = '0.7.0';

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

        if ($document->schemaVersion !== 'g7-page-builder/v1') {
            throw new DocumentCompileException('The page document schema is not supported.');
        }

        $heroCount = 0;
        $sections = [];
        $styleUrls = [];

        foreach ($document->blocks as $index => $block) {
            $type = $block['type'] ?? null;
            $version = $block['block_version'] ?? null;
            $instanceId = $block['instance_id'] ?? null;
            $props = $block['props'] ?? null;
            $slots = $block['slots'] ?? [];

            if (! is_string($instanceId) || ! $this->isUuid($instanceId)) {
                throw new DocumentCompileException("Block {$index} has an invalid instance id.");
            }

            if (! is_string($type) || ! is_int($version) || ! is_array($props) || ! is_array($slots)) {
                throw new DocumentCompileException("Block {$index} has an invalid version, props, or slots value.");
            }

            if ($slots !== []) {
                throw new DocumentCompileException("Block {$index} uses slots that are not supported by the first vertical slice.");
            }

            $definition = $this->blockRegistry->definition($type, $version);
            if ($definition === null || ! $this->blockCompilers->has($definition->compiler)) {
                throw new DocumentCompileException("Block {$index} has an unsupported type or compiler.");
            }

            if (in_array($type, [self::HERO_TYPE, self::HERO_SPLIT_TYPE, self::HERO_SLIDER_TYPE], true)) {
                $heroCount++;
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
                $compiledBlock = str_replace(
                    '__G7PB_PAGE_SLUG__',
                    rawurlencode($document->slug),
                    $this->blockCompilers->compile($definition->compiler, $props),
                );
            } catch (DocumentCompileException $exception) {
                throw $exception;
            } catch (\Throwable) {
                throw new DocumentCompileException(
                    "Block {$index} failed schema validation or compilation.",
                    'G7PB_BLOCK_RUNTIME_FAILED',
                );
            }

            $sections[] = $this->withBlockRuntime(
                $compiledBlock,
                $instanceId,
                $type,
                $block['motion'] ?? null,
            );
        }

        $styles = array_map(
            fn (string $url): string => '<link rel="stylesheet" href="'.$this->escapeAttribute($url).'">',
            array_keys($styleUrls),
        );
        $body = '<div class="'.$this->designClassName($document).'">'."\n"
            .implode("\n", $sections)."\n"
            .'</div>';
        $artifact = implode("\n", [...$styles, $body]);
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

        return implode(' ', $classes);
    }

    private function registerBuiltInCompilers(): void
    {
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
        ];

        foreach ($compilers as $key => $compiler) {
            if (! $this->blockCompilers->has($key)) {
                $this->blockCompilers->register(new CallbackBlockTypeCompiler($key, $compiler));
            }
        }
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHero(array $props): string
    {
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $title = $this->requiredString($props, 'title', 200);
        $body = $this->optionalString($props, 'body', 4000);
        $alignment = $this->optionalString($props, 'alignment', 16) ?? 'center';
        $appearance = $this->appearanceClasses($props, 'default', 'spacious');

        if (! in_array($alignment, ['left', 'center'], true)) {
            throw new DocumentCompileException('Hero alignment must be left or center.');
        }

        $cta = $this->optionalMap($props, 'primaryCta');
        $image = $this->optionalMap($props, 'image');
        $parts = [];

        if ($eyebrow !== null && $eyebrow !== '') {
            $parts[] = '<p class="g7pb-hero__eyebrow">'.$this->escape($eyebrow).'</p>';
        }

        $parts[] = '<h1 class="g7pb-hero__title">'.$this->escape($title).'</h1>';

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

        return '<section class="g7pb-block g7pb-hero g7pb-hero--'.$alignment.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero">'.implode('', $parts).'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileFeatures(array $props): string
    {
        $title = $this->requiredString($props, 'title', 200);
        $items = $props['items'] ?? null;
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (! is_array($items) || count($items) < 2 || count($items) > 6) {
            throw new DocumentCompileException('Features must contain between two and six items.');
        }

        $compiledItems = [];

        foreach (array_values($items) as $index => $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException("Feature item {$index} must be an object.");
            }

            $icon = $this->requiredString($item, 'icon', 32);
            $itemTitle = $this->requiredString($item, 'title', 160);
            $body = $this->requiredString($item, 'body', 2000);

            if (! in_array($icon, self::FEATURE_ICONS, true)) {
                throw new DocumentCompileException("Feature item {$index} uses an unsupported icon.");
            }

            $compiledItems[] = '<article class="g7pb-features__item"><span class="g7pb-features__icon g7pb-icon--'.$this->escapeAttribute($icon).'" aria-hidden="true"></span><h3>'.$this->escape($itemTitle).'</h3><p>'.$this->formatText($body).'</p></article>';
        }

        return '<section class="g7pb-block g7pb-features '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="features"><h2 class="g7pb-features__title">'.$this->escape($title).'</h2><div class="g7pb-features__grid">'.implode('', $compiledItems).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileCta(array $props): string
    {
        $this->assertOnlyKeys(
            $props,
            ['eyebrow', 'heading', 'body', 'primaryLink', 'secondaryLink', 'theme', 'appearance'],
            'CTA',
        );

        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $body = $this->optionalString($props, 'body', 2000);
        $theme = $this->requiredString($props, 'theme', 16);
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

        if (! in_array($theme, ['light', 'dark'], true)) {
            throw new DocumentCompileException('CTA theme must be light or dark.');
        }

        $copy = [];
        if ($eyebrow !== null && $eyebrow !== '') {
            $copy[] = '<p class="g7pb-cta__eyebrow">'.$this->escape($eyebrow).'</p>';
        }
        $copy[] = '<h2 class="g7pb-cta__heading">'.$this->escape($heading).'</h2>';
        if ($body !== null && $body !== '') {
            $copy[] = '<p class="g7pb-cta__body">'.$this->formatText($body).'</p>';
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

        return '<section class="g7pb-block g7pb-cta g7pb-cta--'.$theme.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="cta"><div class="g7pb-cta__copy">'.implode('', $copy).'</div>'.$actionMarkup.'</section>';
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

        $heading = $this->requiredString($props, 'heading', 200);
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

        return '<section class="g7pb-block g7pb-contact '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="contact"><div class="g7pb-contact__heading"><p class="g7pb-contact__eyebrow">Contact</p><h2>'.$this->escape($heading).'</h2></div><address class="g7pb-contact__details"><p>'.$this->formatText($address).'</p><a href="'.$this->escapeAttribute($phoneHref).'">'.$this->escape($phone).'</a><a href="'.$this->escapeAttribute('mailto:'.$email).'">'.$this->escape($email).'</a></address>'.$actionMarkup.'</section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileHeroSplit(array $props): string
    {
        $this->assertOnlyKeys(
            $props,
            ['eyebrow', 'title', 'body', 'primaryCta', 'image', 'mediaPosition', 'appearance'],
            'Split Hero',
        );

        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $title = $this->requiredString($props, 'title', 200);
        $body = $this->optionalString($props, 'body', 2000);
        $mediaPosition = $this->requiredString($props, 'mediaPosition', 16);
        $appearance = $this->appearanceClasses($props, 'default', 'spacious');

        if (! in_array($mediaPosition, ['left', 'right'], true)) {
            throw new DocumentCompileException('Split Hero media position is invalid.');
        }

        $copy = [];
        if ($eyebrow !== null && $eyebrow !== '') {
            $copy[] = '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
        }
        $copy[] = '<h1>'.$this->escape($title).'</h1>';
        if ($body !== null && $body !== '') {
            $copy[] = '<p class="g7pb-hero-split__body">'.$this->formatText($body).'</p>';
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

        return '<section class="g7pb-block g7pb-hero-split g7pb-hero-split--'.$mediaPosition.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero-split"><div class="g7pb-hero-split__copy">'.implode('', $copy).'</div>'.$media.'</section>';
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
            $title = $this->requiredString($slide, 'title', 200);
            $body = $this->optionalString($slide, 'body', 2000);
            $buttonLabel = $this->requiredString($slide, 'buttonLabel', 120);
            $buttonUrl = $this->requiredString($slide, 'buttonUrl', 2048);
            $imageSrc = $this->optionalString($slide, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($slide, 'imageAlt', 300) ?? '';
            $this->assertAllowedUrl($buttonUrl, "Slider Hero item {$index}");

            $copy = $eyebrow === null || $eyebrow === ''
                ? ''
                : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';
            $copy .= '<h2>'.$this->escape($title).'</h2>';
            if ($body !== null && $body !== '') {
                $copy .= '<p>'.$this->formatText($body).'</p>';
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

        return '<section class="g7pb-block g7pb-hero-slider '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="hero-slider" data-g7pb-slider data-g7pb-slider-autoplay="'.($autoplay ? 'true' : 'false').'" data-g7pb-slider-interval="'.$interval.'" data-g7pb-slider-loop="'.($loop ? 'true' : 'false').'" aria-label="대표 콘텐츠 슬라이더"><div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">'.implode('', $compiled).'</div></div><div class="g7pb-hero-slider__controls"><button type="button" data-g7pb-slider-prev aria-label="이전 슬라이드">←</button><div class="g7pb-hero-slider__dots" data-g7pb-slider-dots aria-label="슬라이드 선택"></div><button type="button" data-g7pb-slider-next aria-label="다음 슬라이드">→</button>'.($autoplay ? '<button type="button" data-g7pb-slider-toggle aria-label="자동 재생 일시 정지">일시 정지</button>' : '').'</div><p class="g7pb-hero-slider__status" data-g7pb-slider-status aria-live="polite"></p></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileLogoCloud(array $props): string
    {
        $this->assertOnlyKeys($props, ['heading', 'logos', 'appearance'], 'Logo Cloud');
        $heading = $this->requiredString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $appearance = $this->appearanceClasses($props, 'default', 'compact');

        if (! is_array($logos) || count($logos) < 2 || count($logos) > 12) {
            throw new DocumentCompileException('Logo Cloud must contain between two and twelve logos.');
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

        return '<section class="g7pb-block g7pb-logo-cloud '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-cloud"><h2>'.$this->escape($heading).'</h2><ul>'.implode('', $items).'</ul></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileStats(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'items', 'appearance'], 'Stats');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $items = $props['items'] ?? null;
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');
        $icons = ['trend', 'users', 'target', 'chart'];

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
            $label = $this->requiredString($item, 'label', 120);
            $detail = $this->optionalString($item, 'detail', 500) ?? '';
            $compiled[] = '<article><span class="g7pb-stats__icon g7pb-stats__icon--'.$icon.'" aria-hidden="true"></span><strong>'.$this->escape($value).'</strong><h3>'.$this->escape($label).'</h3><p>'.$this->formatText($detail).'</p></article>';
        }

        return '<section class="g7pb-block g7pb-stats '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="stats">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-stats__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compilePricing(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'plans', 'appearance'], 'Pricing');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $plans = $props['plans'] ?? null;
        $appearance = $this->appearanceClasses($props, 'default', 'spacious');

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
            $name = $this->requiredString($plan, 'name', 120);
            $price = $this->requiredString($plan, 'price', 80);
            $period = $this->optionalString($plan, 'period', 40) ?? '';
            $description = $this->optionalString($plan, 'description', 500) ?? '';
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
                if (! is_string($feature) || trim($feature) === '' || mb_strlen($feature) > 200) {
                    throw new DocumentCompileException("Pricing plan {$index} feature {$featureIndex} is invalid.");
                }
                $featureItems[] = '<li>'.$this->escape($feature).'</li>';
            }
            $featuredClass = $featured ? ' g7pb-pricing__plan--featured' : '';
            $badge = $featured ? '<span class="g7pb-pricing__badge">추천</span>' : '';
            $compiled[] = '<article class="g7pb-pricing__plan'.$featuredClass.'">'.$badge.'<h3>'.$this->escape($name).'</h3><p class="g7pb-pricing__price"><strong>'.$this->escape($price).'</strong>'.$this->escape($period).'</p><p>'.$this->formatText($description).'</p><ul>'.implode('', $featureItems).'</ul><a class="g7pb-button '.($featured ? 'g7pb-button--primary' : 'g7pb-button--secondary').'" href="'.$this->escapeAttribute($buttonUrl).'">'.$this->escape($buttonLabel).'</a></article>';
        }

        return '<section class="g7pb-block g7pb-pricing '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="pricing">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-pricing__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileTeam(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'members', 'appearance'], 'Team');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $members = $props['members'] ?? null;
        $appearance = $this->appearanceClasses($props, 'soft', 'normal');

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
            $bio = $this->optionalString($member, 'bio', 1000) ?? '';
            $imageSrc = $this->optionalString($member, 'imageSrc', 2048) ?? '';
            $imageAlt = $this->optionalString($member, 'imageAlt', 300) ?? '';
            $profileUrl = $this->optionalString($member, 'profileUrl', 2048) ?? '';
            $media = $this->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name, 'g7pb-team__image', mb_substr($name, 0, 1));
            $memberName = '<h3>'.$this->escape($name).'</h3>';
            if ($profileUrl !== '') {
                $this->assertAllowedUrl($profileUrl, "Team member {$index}");
                $memberName = '<h3><a href="'.$this->escapeAttribute($profileUrl).'">'.$this->escape($name).'</a></h3>';
            }
            $compiled[] = '<article><figure>'.$media.'</figure>'.$memberName.'<strong>'.$this->escape($role).'</strong><p>'.$this->formatText($bio).'</p></article>';
        }

        return '<section class="g7pb-block g7pb-team '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="team">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-team__grid">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileGallery(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'images', 'columns', 'appearance'], 'Gallery');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $images = $props['images'] ?? null;
        $columns = $props['columns'] ?? null;
        $appearance = $this->appearanceClasses($props, 'default', 'normal');

        if (! is_int($columns) || ! in_array($columns, [2, 3, 4], true)) {
            throw new DocumentCompileException('Gallery columns are invalid.');
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

        return '<section class="g7pb-block g7pb-gallery '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="gallery">'.$this->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-gallery__grid g7pb-gallery__grid--'.$columns.'">'.implode('', $compiled).'</div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileBarChart(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'unit', 'items', 'appearance'], 'Bar Chart');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $description = $this->optionalString($props, 'description', 1000) ?? '';
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
            $compiled[] = '<label><span>'.$this->escape($label).'<strong>'.$this->escape($formattedValue.$unit).'</strong></span><progress max="100" value="'.$this->escapeAttribute($formattedValue).'" data-tone="'.$tone.'">'.$this->escape($formattedValue).'</progress></label>';
        }

        $descriptionMarkup = $description === '' ? '' : '<p>'.$this->formatText($description).'</p>';

        return '<section class="g7pb-block g7pb-bar-chart '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="bar-chart"><figure><figcaption>'.$this->compileSectionHeading($eyebrow, $heading).$descriptionMarkup.'</figcaption><div class="g7pb-bar-chart__plot">'.implode('', $compiled).'</div></figure></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileG7RecentPosts(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'period', 'limit', 'audience', 'emptyMessage', 'appearance'], 'G7 recent posts');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $source = $this->requiredString($props, 'source', 16);
        $period = $this->requiredString($props, 'period', 16);
        $limit = $this->requiredIntegerChoice($props, 'limit', [3, 4, 6, 8, 12]);
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

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--posts '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-recent-posts" data-g7pb-data-source="posts" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">콘텐츠를 불러오는 중입니다.</p><div class="g7pb-dynamic-posts" data-g7pb-data-list aria-busy="true"></div></section>';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function compileG7ProductGrid(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'limit', 'columns', 'audience', 'detailBasePath', 'emptyMessage', 'appearance'], 'G7 product grid');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $source = $this->requiredString($props, 'source', 16);
        $limit = $this->requiredIntegerChoice($props, 'limit', [2, 3, 4, 6, 8, 12]);
        $columns = $this->requiredIntegerChoice($props, 'columns', [2, 3, 4]);
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

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--products '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-grid" data-g7pb-data-source="products" data-g7pb-endpoint="'.$this->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-product-base="'.$this->escapeAttribute(rtrim($detailBasePath, '/')).'" data-g7pb-empty-message="'.$this->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-dynamic-products g7pb-dynamic-products--'.$columns.'" data-g7pb-data-list aria-busy="true"></div></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileInquiryForm(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'formKind', 'submitLabel', 'successMessage', 'privacyLabel', 'showPhone', 'showSubject', 'appearance'], 'Inquiry form');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $description = $this->optionalString($props, 'description', 1000) ?? '';
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

        $phone = $showPhone ? '<label><span>전화번호</span><input type="tel" name="phone" maxlength="40" autocomplete="tel"></label>' : '';
        $subject = $showSubject ? '<label class="g7pb-inquiry-form__wide"><span>문의 제목</span><input type="text" name="subject" maxlength="200"></label>' : '';

        return '<section class="g7pb-block g7pb-inquiry '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="inquiry-form">'
            .'<div class="g7pb-inquiry__intro">'.$this->compileSectionHeading($eyebrow, $heading).($description === '' ? '' : '<p>'.$this->formatText($description).'</p>').'</div>'
            .'<form class="g7pb-inquiry-form" method="post" action="/pages/__G7PB_PAGE_SLUG__/inquiries" data-g7pb-inquiry-form data-g7pb-form-kind="'.$kind.'" data-g7pb-success-message="'.$this->escapeAttribute($successMessage).'">'
            .'<input type="hidden" name="form_kind" value="'.$kind.'"><input type="hidden" name="block_instance_id" value=""><input type="hidden" name="started_at" value="">'
            .'<label class="g7pb-inquiry-form__honeypot" aria-hidden="true"><span>웹사이트</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>'
            .'<label><span>이름</span><input type="text" name="name" maxlength="120" autocomplete="name" required></label>'
            .'<label><span>이메일</span><input type="email" name="email" maxlength="320" autocomplete="email" required></label>'.$phone.$subject
            .'<label class="g7pb-inquiry-form__wide"><span>문의 내용</span><textarea name="message" maxlength="5000" rows="6" required></textarea></label>'
            .'<label class="g7pb-inquiry-form__consent"><input type="checkbox" name="privacy" value="1" required><span>'.$this->escape($privacyLabel).'</span></label>'
            .'<div class="g7pb-inquiry-form__footer"><button type="submit">'.$this->escape($submitLabel).'</button><p role="status" aria-live="polite" data-g7pb-form-status></p></div>'
            .'</form></section>';
    }

    /** @param array<string, mixed> $props */
    private function compileMapDirections(array $props): string
    {
        $this->assertOnlyKeys($props, ['eyebrow', 'heading', 'description', 'address', 'latitude', 'longitude', 'zoom', 'provider', 'directionsLabel', 'directionsUrl', 'phone', 'hours', 'parking', 'appearance'], 'Map directions');
        $eyebrow = $this->optionalString($props, 'eyebrow', 120);
        $heading = $this->requiredString($props, 'heading', 200);
        $description = $this->optionalString($props, 'description', 1000) ?? '';
        $address = $this->requiredString($props, 'address', 500);
        $latitude = $this->requiredNumber($props, 'latitude', -90, 90);
        $longitude = $this->requiredNumber($props, 'longitude', -180, 180);
        $zoom = $this->requiredIntegerChoice($props, 'zoom', [12, 14, 16, 18]);
        $provider = $this->requiredString($props, 'provider', 24);
        $directionsLabel = $this->requiredString($props, 'directionsLabel', 80);
        $directionsUrl = $this->requiredString($props, 'directionsUrl', 2048);
        $phone = $this->optionalString($props, 'phone', 40) ?? '';
        $hours = $this->optionalString($props, 'hours', 300) ?? '';
        $parking = $this->optionalString($props, 'parking', 300) ?? '';
        $appearance = $this->appearanceClasses($props, 'default', 'normal');
        if (! in_array($provider, ['openstreetmap', 'google', 'none'], true)) {
            throw new DocumentCompileException('Map provider is invalid.');
        }
        $this->assertAllowedUrl($directionsUrl, 'Directions link');

        $map = '<div class="g7pb-map__placeholder" role="img" aria-label="'.$this->escapeAttribute($address).' 지도 자리"><span>지도 표시 안 함</span></div>';
        if ($provider === 'openstreetmap') {
            $delta = match ($zoom) {
                18 => 0.002, 16 => 0.008, 14 => 0.03, default => 0.12
            };
            $bbox = implode(',', [$longitude - $delta, $latitude - $delta, $longitude + $delta, $latitude + $delta]);
            $src = 'https://www.openstreetmap.org/export/embed.html?bbox='.rawurlencode($bbox).'&marker='.rawurlencode($latitude.','.$longitude);
            $map = '<iframe title="'.$this->escapeAttribute($address).' 지도" src="'.$this->escapeAttribute($src).'" loading="lazy" referrerpolicy="no-referrer"></iframe>';
        } elseif ($provider === 'google') {
            $src = 'https://www.google.com/maps?q='.rawurlencode($latitude.','.$longitude).'&z='.$zoom.'&output=embed';
            $map = '<iframe title="'.$this->escapeAttribute($address).' 지도" src="'.$this->escapeAttribute($src).'" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
        }
        $details = '<address><strong>'.$this->escape($address).'</strong>'
            .($phone === '' ? '' : '<span>'.$this->escape($phone).'</span>')
            .($hours === '' ? '' : '<span>'.$this->formatText($hours).'</span>')
            .($parking === '' ? '' : '<span>'.$this->formatText($parking).'</span>')
            .'<a class="g7pb-button g7pb-button--primary" href="'.$this->escapeAttribute($directionsUrl).'">'.$this->escape($directionsLabel).'</a></address>';

        return '<section class="g7pb-block g7pb-map '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="map-directions"><div class="g7pb-map__intro">'.$this->compileSectionHeading($eyebrow, $heading).($description === '' ? '' : '<p>'.$this->formatText($description).'</p>').$details.'</div><div class="g7pb-map__frame">'.$map.'</div></section>';
    }

    private function compileSectionHeading(?string $eyebrow, string $heading): string
    {
        $eyebrowMarkup = $eyebrow === null || $eyebrow === ''
            ? ''
            : '<p class="g7pb-section-eyebrow">'.$this->escape($eyebrow).'</p>';

        return '<header class="g7pb-section-heading">'.$eyebrowMarkup.'<h2>'.$this->escape($heading).'</h2></header>';
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

    private function withBlockRuntime(string $markup, string $instanceId, string $type, mixed $motion): string
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
            self::FEATURES_TYPE, self::LOGO_CLOUD_TYPE, self::PRICING_TYPE, self::TEAM_TYPE => ['none', 'reveal', 'stagger'],
            self::STATS_TYPE => ['none', 'reveal', 'stagger', 'counter'],
            self::GALLERY_TYPE => ['none', 'reveal', 'stagger', 'parallax-soft'],
            self::BAR_CHART_TYPE => ['none', 'reveal', 'chart-draw'],
            self::CTA_TYPE, self::CONTACT_TYPE, self::G7_RECENT_POSTS_TYPE, self::G7_PRODUCT_GRID_TYPE, self::INQUIRY_FORM_TYPE, self::MAP_DIRECTIONS_TYPE => ['none', 'reveal'],
            default => ['none'],
        };
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function appearanceClasses(array $props, string $defaultSurface, string $defaultSpacing): string
    {
        $appearance = $this->optionalMap($props, 'appearance') ?? [];
        $this->assertOnlyKeys($appearance, ['surface', 'spacing', 'textScale', 'textAlign'], 'Block appearance');
        $surface = $this->optionalString($appearance, 'surface', 16) ?? $defaultSurface;
        $spacing = $this->optionalString($appearance, 'spacing', 16) ?? $defaultSpacing;
        $textScale = $this->optionalString($appearance, 'textScale', 16) ?? 'balanced';
        $textAlign = $this->optionalString($appearance, 'textAlign', 16) ?? 'left';

        if (! in_array($surface, ['default', 'soft', 'contrast'], true)) {
            throw new DocumentCompileException('Block appearance surface is invalid.');
        }

        if (! in_array($spacing, ['compact', 'normal', 'spacious'], true)) {
            throw new DocumentCompileException('Block appearance spacing is invalid.');
        }

        if (! in_array($textScale, ['compact', 'balanced', 'large'], true) || ! in_array($textAlign, ['left', 'center', 'right'], true)) {
            throw new DocumentCompileException('Block typography appearance is invalid.');
        }

        $classes = 'g7pb-surface--'.$surface.' g7pb-spacing--'.$spacing;
        if (array_key_exists('textScale', $appearance) || $textScale !== 'balanced') {
            $classes .= ' g7pb-text-scale--'.$textScale;
        }
        if (array_key_exists('textAlign', $appearance) || $textAlign !== 'left') {
            $classes .= ' g7pb-text-align--'.$textAlign;
        }

        return $classes;
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

        if (! is_string($value) || trim($value) === '' || mb_strlen($value) > $maxLength) {
            throw new DocumentCompileException("Property {$key} is required or too long.");
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

    private function sanitizeRichText(string $html): string
    {
        if (preg_match('/<(?:script|style|iframe|object|embed|svg|math|form|input|button)\b/i', $html) === 1
            || preg_match('/\son[a-z]+\s*=/i', $html) === 1) {
            throw new DocumentCompileException('Hero body contains unsafe markup.');
        }

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
            throw new DocumentCompileException('Hero body rich text is invalid.');
        }

        $root = $document->getElementById('g7pb-richtext-root');

        if (! $root instanceof \DOMElement) {
            throw new DocumentCompileException('Hero body rich text could not be parsed.');
        }

        $this->sanitizeRichTextNode($root);
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

    private function sanitizeRichTextNode(\DOMNode $parent): void
    {
        $allowed = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'a', 'ol', 'ul', 'li', 'blockquote', 'br'];

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
                    $this->sanitizeRichTextNode($child);

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
                    if ($tag !== 'a' || $attribute !== 'href') {
                        $child->removeAttribute($attribute);
                    }
                }

                if ($tag === 'a') {
                    $href = $child->getAttribute('href');
                    $this->assertAllowedUrl($href, 'Hero body link');
                    $child->setAttribute('rel', 'noopener noreferrer');
                }

                $this->sanitizeRichTextNode($child);
            } elseif (! $child instanceof \DOMText) {
                $parent->removeChild($child);
            }

            $child = $next;
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
