<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;

final class HtmlDocumentCompiler implements DocumentCompilerPort
{
    public const COMPILER_VERSION = '0.1.0';

    public const TARGET_ENGINE_VERSION = 'g7-7.0.7';

    private const HERO_TYPE = 'content.hero-centered-01';

    private const FEATURES_TYPE = 'content.features-grid-01';

    private const CTA_TYPE = 'content.cta-split-01';

    private const CONTACT_TYPE = 'content.contact-info-01';

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

        foreach ($document->blocks as $index => $block) {
            $type = $block['type'] ?? null;
            $version = $block['block_version'] ?? null;
            $instanceId = $block['instance_id'] ?? null;
            $props = $block['props'] ?? null;
            $slots = $block['slots'] ?? [];

            if (! is_string($instanceId) || ! $this->isUuid($instanceId)) {
                throw new DocumentCompileException("Block {$index} has an invalid instance id.");
            }

            if ($version !== 1 || ! is_array($props) || ! is_array($slots)) {
                throw new DocumentCompileException("Block {$index} has an invalid version, props, or slots value.");
            }

            if ($slots !== []) {
                throw new DocumentCompileException("Block {$index} uses slots that are not supported by the first vertical slice.");
            }

            if ($type === self::HERO_TYPE) {
                $heroCount++;
                $sections[] = $this->compileHero($props);

                continue;
            }

            if ($type === self::FEATURES_TYPE) {
                $sections[] = $this->compileFeatures($props);

                continue;
            }

            if ($type === self::CTA_TYPE) {
                $sections[] = $this->compileCta($props);

                continue;
            }

            if ($type === self::CONTACT_TYPE) {
                $sections[] = $this->compileContact($props);

                continue;
            }

            throw new DocumentCompileException("Block {$index} has an unsupported type.");
        }

        if ($heroCount > 1) {
            throw new DocumentCompileException('A page may contain only one Hero block.');
        }

        $artifact = implode("\n", $sections);

        return new CompileResult(
            compilerVersion: self::COMPILER_VERSION,
            documentId: $document->documentId,
            sourceRevision: $sourceRevision,
            targetFormat: 'html',
            targetEngineVersion: self::TARGET_ENGINE_VERSION,
            artifact: $artifact,
            artifactSha256: hash('sha256', $artifact),
        );
    }

    public function supports(string $targetFormat, string $targetEngineVersion): bool
    {
        return $targetFormat === 'html' && $targetEngineVersion === self::TARGET_ENGINE_VERSION;
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
            $alt = $this->requiredString($image, 'alt', 300);
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
    private function appearanceClasses(array $props, string $defaultSurface, string $defaultSpacing): string
    {
        $appearance = $this->optionalMap($props, 'appearance') ?? [];
        $this->assertOnlyKeys($appearance, ['surface', 'spacing'], 'Block appearance');
        $surface = $this->optionalString($appearance, 'surface', 16) ?? $defaultSurface;
        $spacing = $this->optionalString($appearance, 'spacing', 16) ?? $defaultSpacing;

        if (! in_array($surface, ['default', 'soft', 'contrast'], true)) {
            throw new DocumentCompileException('Block appearance surface is invalid.');
        }

        if (! in_array($spacing, ['compact', 'normal', 'spacious'], true)) {
            throw new DocumentCompileException('Block appearance spacing is invalid.');
        }

        return 'g7pb-surface--'.$surface.' g7pb-spacing--'.$spacing;
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
        if ($this->isRelativeUrl($url) || $this->isHttpsUrl($url) || $this->isMailtoUrl($url) || $this->isTelUrl($url)) {
            return;
        }

        throw new DocumentCompileException("{$property} URL is not allowed.");
    }

    private function assertAllowedImageUrl(string $url): void
    {
        if ($this->isRelativeUrl($url) || $this->isHttpsUrl($url)) {
            return;
        }

        throw new DocumentCompileException('Hero image URL is not allowed.');
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
