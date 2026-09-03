<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

/** Applies typed styles to legacy built-in field paths without owning document compilation. */
final class ElementAppearanceCompiler
{
    /** @var array<string, list<string>> */
    private const ROOT_ELEMENT_FIELDS = [
        'content.heading-01' => ['eyebrow', 'heading'],
        'content.rich-text-01' => ['content'],
        'media.image-01' => ['caption'],
        'action.buttons-01' => [],
        'media.image-text-01' => ['eyebrow', 'heading', 'body', 'primaryLabel'],
        'content.icon-list-01' => ['eyebrow', 'heading'],
        'content.hero-centered-01' => ['eyebrow', 'title', 'body', 'primaryLabel'],
        'content.features-grid-01' => ['title'],
        'content.cta-split-01' => ['eyebrow', 'heading', 'body', 'primaryLabel', 'secondaryLabel'],
        'content.contact-info-01' => ['heading', 'address', 'phone', 'email', 'ctaLabel', 'mapLabel'],
        'content.hero-split-01' => ['eyebrow', 'title', 'body', 'primaryLabel'],
        'content.hero-slider-01' => [],
        'trust.logo-cloud-01' => ['heading'],
        'data.stats-icons-01' => ['eyebrow', 'heading'],
        'commerce.pricing-tiers-01' => ['eyebrow', 'heading'],
        'company.team-grid-01' => ['eyebrow', 'heading'],
        'media.gallery-grid-01' => ['eyebrow', 'heading'],
        'data.bar-chart-01' => ['eyebrow', 'heading', 'description', 'unit'],
        'g7.board-recent-posts-01' => ['eyebrow', 'heading'],
        'g7.ecommerce-product-grid-01' => ['eyebrow', 'heading'],
        'form.inquiry-01' => ['eyebrow', 'heading', 'description', 'privacyLabel', 'submitLabel'],
        'location.map-directions-01' => ['eyebrow', 'heading', 'description', 'address', 'phone', 'hours', 'parking', 'directionsLabel'],
        'trust.testimonials-01' => ['eyebrow', 'heading'],
        'content.faq-accordion-01' => ['eyebrow', 'heading'],
        'content.process-timeline-01' => ['eyebrow', 'heading'],
        'content.tabs-01' => ['eyebrow', 'heading'],
        'commerce.comparison-table-01' => ['eyebrow', 'heading'],
        'content.article-list-01' => ['eyebrow', 'heading'],
        'media.video-embed-01' => ['eyebrow', 'heading', 'caption'],
        'trust.logo-carousel-01' => ['eyebrow', 'heading'],
        'trust.testimonial-slider-01' => ['eyebrow', 'heading'],
        'content.event-schedule-01' => ['eyebrow', 'heading'],
        'content.download-resources-01' => ['eyebrow', 'heading'],
        'g7.board-content-archive-01' => ['eyebrow', 'heading'],
        'g7.ecommerce-product-showcase-01' => ['eyebrow', 'heading'],
        'g7.board-post-detail-01' => ['eyebrow', 'heading', 'linkLabel'],
        'g7.ecommerce-product-detail-01' => ['eyebrow', 'heading', 'buttonLabel'],
        'content.divider-01' => ['label'],
        'content.blockquote-01' => ['quote', 'citation', 'role'],
        'content.notice-01' => ['title', 'body', 'actionLabel'],
        'content.card-grid-01' => ['eyebrow', 'heading'],
        'navigation.breadcrumbs-01' => ['currentLabel'],
        'navigation.anchor-menu-01' => ['label'],
        'navigation.social-links-01' => ['heading'],
        'media.image-carousel-01' => ['eyebrow', 'heading'],
    ];

    /**
     * @param  array<string, mixed>  $props
     */
    public function apply(string $markup, array $props, string $type): string
    {
        $appearance = $props['appearance'] ?? [];
        if (! is_array($appearance)) {
            throw new DocumentCompileException('Property appearance must be an object.');
        }
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
        if ($tone !== null && ! in_array($tone, ['default', 'muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'], true)) {
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
                'trust.logo-cloud-01' => '(.//h2)[1]',
                'content.cta-split-01' => '(.//*['.$hasClass('g7pb-cta__heading').'])[1]',
                'content.heading-01' => '(.//*['.$hasClass('g7pb-heading-block__heading').'])[1]',
                'media.image-text-01' => '(.//*['.$hasClass('g7pb-image-text__copy').']/h2)[1]',
                'navigation.social-links-01' => '(.//h2)[1]',
                default => '(.//*['.$hasClass('g7pb-section-heading').']/h2 | .//*['.$hasClass('g7pb-contact__heading').']/h2)[1]',
            },
            'title' => match ($type) {
                'content.hero-centered-01' => '(.//*['.$hasClass('g7pb-hero__title').'])[1]',
                'content.features-grid-01' => '(.//*['.$hasClass('g7pb-features__title').'])[1]',
                'content.hero-split-01' => '(.//*['.$hasClass('g7pb-hero-split__copy').']/h1)[1]',
                'content.notice-01' => '(.//*['.$hasClass('g7pb-content-notice__title').'])[1]',
                default => null,
            },
            'body' => match ($type) {
                'content.hero-centered-01' => '(.//*['.$hasClass('g7pb-hero__body').'])[1]',
                'content.cta-split-01' => '(.//*['.$hasClass('g7pb-cta__body').'])[1]',
                'content.hero-split-01' => '(.//*['.$hasClass('g7pb-hero-split__body').'])[1]',
                'media.image-text-01' => '(.//*['.$hasClass('g7pb-image-text__body').'])[1]',
                'content.notice-01' => '(.//*['.$hasClass('g7pb-content-notice__body').'])[1]',
                default => null,
            },
            'content' => $type === 'content.rich-text-01' ? '(.//*['.$hasClass('g7pb-rich-text__content').'])[1]' : null,
            'primaryLabel' => '(.//a['.$hasClass('g7pb-button--primary').'])[1]',
            'secondaryLabel' => '(.//a['.$hasClass('g7pb-button--secondary').'])[1]',
            'linkLabel' => $type === 'g7.board-post-detail-01' ? '(.//a['.$hasClass('g7pb-data-detail__action').'])[1]' : null,
            'buttonLabel' => $type === 'g7.ecommerce-product-detail-01' ? '(.//a['.$hasClass('g7pb-data-detail__action').'])[1]' : null,
            'ctaLabel' => $type === 'content.contact-info-01' ? '(.//a['.$hasClass('g7pb-button--primary').'])[1]' : null,
            'mapLabel' => $type === 'content.contact-info-01' ? '(.//a['.$hasClass('g7pb-button--secondary').'])[1]' : null,
            'address' => match ($type) {
                'content.contact-info-01' => '(.//*['.$hasClass('g7pb-contact__details').']/p)[1]',
                'location.map-directions-01' => '(.//*['.$hasClass('g7pb-map__intro').']//address/strong)[1]',
                default => null,
            },
            'phone' => match ($type) {
                'content.contact-info-01' => '(.//*['.$hasClass('g7pb-contact__details').']/a[starts-with(@href, "tel:")])[1]',
                'location.map-directions-01' => '(.//*['.$hasClass('g7pb-map__phone').'])[1]',
                default => null,
            },
            'email' => $type === 'content.contact-info-01' ? '(.//*['.$hasClass('g7pb-contact__details').']/a[starts-with(@href, "mailto:")])[1]' : null,
            'description' => match ($type) {
                'data.bar-chart-01' => '(.//figcaption/*[('.$hasClass('g7pb-bar-chart__description').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))])[1]',
                'form.inquiry-01' => '(.//*['.$hasClass('g7pb-inquiry__intro').']/*[('.$hasClass('g7pb-inquiry__description').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))])[1]',
                'location.map-directions-01' => '(.//*['.$hasClass('g7pb-map__intro').']/*[('.$hasClass('g7pb-map__description').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))])[1]',
                default => null,
            },
            'privacyLabel' => $type === 'form.inquiry-01' ? '(.//*['.$hasClass('g7pb-inquiry-form__consent').']/span)[1]' : null,
            'submitLabel' => $type === 'form.inquiry-01' ? '(.//*[@data-g7pb-submit-copy])[1]' : null,
            'directionsLabel' => $type === 'location.map-directions-01' ? '(.//*['.$hasClass('g7pb-map__intro').']//address/a)[1]' : null,
            'hours' => $type === 'location.map-directions-01' ? '(.//*['.$hasClass('g7pb-map__hours').'])[1]' : null,
            'parking' => $type === 'location.map-directions-01' ? '(.//*['.$hasClass('g7pb-map__parking').'])[1]' : null,
            'caption' => in_array($type, ['media.image-01', 'media.video-embed-01'], true) ? '(.//figcaption)[1]' : null,
            'unit' => $type === 'data.bar-chart-01' ? './/*['.$hasClass('g7pb-bar-chart__unit').']' : null,
            'label' => match ($type) {
                'content.divider-01' => '(.//*['.$hasClass('g7pb-divider__label').'])[1]',
                'navigation.anchor-menu-01' => '(.//nav/strong)[1]',
                default => null,
            },
            'quote' => $type === 'content.blockquote-01' ? '(.//*['.$hasClass('g7pb-blockquote__quote').'])[1]' : null,
            'citation' => $type === 'content.blockquote-01' ? '(.//cite)[1]' : null,
            'role' => $type === 'content.blockquote-01' ? '(.//*['.$hasClass('g7pb-blockquote__role').'])[1]' : null,
            'actionLabel' => $type === 'content.notice-01' ? '(.//*['.$hasClass('g7pb-content-notice__action').'])[1]' : null,
            'currentLabel' => $type === 'navigation.breadcrumbs-01' ? '(.//li[@aria-current="page"])[1]' : null,
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
            'action.buttons-01' => $collection === 'items' && $leaf === 'label' ? '(.//*['.$hasClass('g7pb-buttons__items').']/a)['.$index.']' : null,
            'content.icon-list-01' => $collection === 'items' ? match ($leaf) {
                'title' => '(.//*['.$hasClass('g7pb-icon-list__item').'])['.$index.']//h3',
                'body' => '(.//*['.$hasClass('g7pb-icon-list__item').'])['.$index.']//*[('.$hasClass('g7pb-icon-list__body').') or self::p][1]',
                default => null,
            } : null,
            'content.features-grid-01' => $collection === 'items' ? match ($leaf) {
                'title' => '(.//*['.$hasClass('g7pb-features__item').'])['.$index.']/h3',
                'body' => '(.//*['.$hasClass('g7pb-features__item').'])['.$index.']/*[('.$hasClass('g7pb-features__body').') or self::p][1]',
                default => null,
            } : null,
            'content.hero-slider-01' => $collection === 'slides' ? match ($leaf) {
                'eyebrow' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//*['.$hasClass('g7pb-section-eyebrow').']',
                'title' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//h2',
                'body' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//*['.$hasClass('g7pb-hero-slider__copy').']/*[('.$hasClass('g7pb-hero-slider__body').') or (self::p and not('.$hasClass('g7pb-section-eyebrow').'))]',
                'buttonLabel' => '(.//*['.$hasClass('g7pb-hero-slider__slide').'])['.$index.']//a',
                default => null,
            } : null,
            'trust.logo-cloud-01' => $collection === 'logos' && $leaf === 'name' ? '(.//ul/li)['.$index.']//*[self::span][1]' : null,
            'trust.logo-carousel-01' => $collection === 'logos' && $leaf === 'name' ? '(.//*['.$hasClass('g7pb-logo-carousel__slide').'])['.$index.']//*[self::span][1]' : null,
            'data.stats-icons-01' => $collection === 'items' ? match ($leaf) {
                'value' => '(.//*['.$hasClass('g7pb-stats__grid').']/article)['.$index.']/strong',
                'label' => '(.//*['.$hasClass('g7pb-stats__grid').']/article)['.$index.']/h3',
                'detail' => '(.//*['.$hasClass('g7pb-stats__grid').']/article)['.$index.']/*[('.$hasClass('g7pb-stats__detail').') or self::p][1]',
                default => null,
            } : null,
            'commerce.pricing-tiers-01' => $collection === 'plans' ? match ($leaf) {
                'name' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']/h3',
                'price' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']//*['.$hasClass('g7pb-pricing__price').']/strong',
                'period' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']//*['.$hasClass('g7pb-pricing__price').']/span',
                'description' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']/*[('.$hasClass('g7pb-pricing__description').') or (self::p and not('.$hasClass('g7pb-pricing__price').'))][1]',
                'buttonLabel' => '(.//*['.$hasClass('g7pb-pricing__plan').'])['.$index.']/a',
                default => null,
            } : null,
            'company.team-grid-01' => $collection === 'members' ? match ($leaf) {
                'name' => '(.//*['.$hasClass('g7pb-team__grid').']/article)['.$index.']/h3',
                'role' => '(.//*['.$hasClass('g7pb-team__grid').']/article)['.$index.']/strong',
                'bio' => '(.//*['.$hasClass('g7pb-team__grid').']/article)['.$index.']/*[('.$hasClass('g7pb-team__bio').') or self::p][1]',
                default => null,
            } : null,
            'media.gallery-grid-01' => $collection === 'images' && $leaf === 'caption' ? '(.//*['.$hasClass('g7pb-gallery__grid').']/figure)['.$index.']/figcaption' : null,
            'data.bar-chart-01' => $collection === 'items' && $leaf === 'label' ? '(.//*['.$hasClass('g7pb-bar-chart__plot').']/label)['.$index.']/span/span' : null,
            'trust.testimonials-01' => $collection === 'items' ? $this->testimonialElementXPath('g7pb-testimonials__items', 'blockquote', $index, $leaf, $hasClass) : null,
            'trust.testimonial-slider-01' => $collection === 'items' ? $this->testimonialElementXPath('g7pb-hero-slider__track', 'blockquote', $index, $leaf, $hasClass) : null,
            'content.faq-accordion-01' => $collection === 'items' ? match ($leaf) {
                'question' => '(.//*['.$hasClass('g7pb-faq__items').']/*['.$hasClass('g7pb-faq__item').'])['.$index.']/*['.$hasClass('g7pb-faq__trigger').']/span',
                'answer' => '(.//*['.$hasClass('g7pb-faq__items').']/*['.$hasClass('g7pb-faq__item').'])['.$index.']/*['.$hasClass('g7pb-faq__answer').']',
                default => null,
            } : null,
            'content.process-timeline-01' => $collection === 'items' ? match ($leaf) {
                'title' => '(.//ol/li)['.$index.']/h3',
                'body' => '(.//ol/li)['.$index.']/*[('.$hasClass('g7pb-process__body').') or self::p]',
                'linkLabel' => '(.//ol/li)['.$index.']/a',
                default => null,
            } : null,
            'content.tabs-01' => $collection === 'items' ? match ($leaf) {
                'label' => '(.//*['.$hasClass('g7pb-tabs__list').']/*[@data-g7pb-tab])['.$index.']',
                'heading' => '(.//*['.$hasClass('g7pb-tabs__panels').']/article)['.$index.']/h3',
                'body' => '(.//*['.$hasClass('g7pb-tabs__panels').']/article)['.$index.']/*[('.$hasClass('g7pb-tabs__body').') or self::p]',
                default => null,
            } : null,
            'commerce.comparison-table-01' => match ($collection) {
                'columns' => match ($leaf) {
                    'title' => '(.//thead/tr/th[position() > 1])['.$index.']/strong',
                    'description' => '(.//thead/tr/th[position() > 1])['.$index.']/span',
                    default => null,
                },
                'rows' => $leaf === 'feature' ? '(.//tbody/tr)['.$index.']/th' : null,
                default => null,
            },
            'content.article-list-01' => $collection === 'items' ? match ($leaf) {
                'category' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//*['.$hasClass('g7pb-articles__meta').']/span',
                'date' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//*['.$hasClass('g7pb-articles__meta').']/time',
                'title' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//h3',
                'summary' => '(.//*['.$hasClass('g7pb-articles__items').']/article)['.$index.']//h3/following-sibling::*[1][('.$hasClass('g7pb-articles__summary').') or self::p]',
                default => null,
            } : null,
            'content.event-schedule-01' => $collection === 'items' ? match ($leaf) {
                'date' => '(.//ol/li)['.$index.']/time/strong',
                'time' => '(.//ol/li)['.$index.']/time/span',
                'location' => '(.//ol/li)['.$index.']//*['.$hasClass('g7pb-events__location').']',
                'title' => '(.//ol/li)['.$index.']//h3',
                'description' => '(.//ol/li)['.$index.']//article/*[('.$hasClass('g7pb-events__description').') or (self::p and not('.$hasClass('g7pb-events__location').'))]',
                'buttonLabel' => '(.//ol/li)['.$index.']//article/a',
                default => null,
            } : null,
            'content.download-resources-01' => $collection === 'items' ? match ($leaf) {
                'title' => '(.//ul/li)['.$index.']//h3',
                'description' => '(.//ul/li)['.$index.']//h3/following-sibling::*[1][('.$hasClass('g7pb-downloads__description').') or self::p]',
                'fileType' => '(.//ul/li)['.$index.']//*['.$hasClass('g7pb-downloads__file-type').']',
                'fileSize' => '(.//ul/li)['.$index.']//*['.$hasClass('g7pb-downloads__file-size').']',
                'buttonLabel' => '(.//ul/li)['.$index.']/a',
                default => null,
            } : null,
            'content.card-grid-01' => $collection === 'items' ? match ($leaf) {
                'kicker' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']//*['.$hasClass('g7pb-card-grid__kicker').']',
                'title' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']/h3',
                'body' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']//*['.$hasClass('g7pb-card-grid__body').']',
                'linkLabel' => '(.//*['.$hasClass('g7pb-card-grid__item').'])['.$index.']/a',
                default => null,
            } : null,
            'navigation.breadcrumbs-01' => $collection === 'items' && $leaf === 'label' ? '(.//ol/li/a)['.$index.']' : null,
            'navigation.anchor-menu-01' => $collection === 'items' && $leaf === 'label' ? '(.//nav/ul/li/a)['.$index.']' : null,
            'navigation.social-links-01' => $collection === 'items' && $leaf === 'label' ? '(.//nav/ul/li/a/span[last()])['.$index.']' : null,
            'media.image-carousel-01' => $collection === 'images' && $leaf === 'caption' ? '(.//*['.$hasClass('g7pb-image-carousel__slide').'])['.$index.']/figcaption' : null,
            default => null,
        };
    }

    /** @param array<string, mixed> $props */
    private function isEmptyOptionalAppearanceTarget(string $type, array $props, string $fieldPath): bool
    {
        return match ([$type, $fieldPath]) {
            ['content.heading-01', 'eyebrow'],
            ['media.image-01', 'caption'],
            ['media.image-text-01', 'eyebrow'],
            ['media.image-text-01', 'body'],
            ['content.icon-list-01', 'eyebrow'] => ($props[$fieldPath] ?? '') === '',
            ['content.divider-01', 'label'],
            ['content.blockquote-01', 'role'] => ($props[$fieldPath] ?? '') === '',
            ['content.notice-01', 'actionLabel'] => ($props['actionLabel'] ?? '') === '',
            ['media.image-text-01', 'primaryLabel'] => ! is_array($props['primaryLink'] ?? null),
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
}
