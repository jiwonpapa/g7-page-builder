<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class PricingBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.pricing-tiers-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'plans', 'layout', 'appearance'], 'Pricing');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $plans = $props['plans'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'spacious');
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
                : '<p>'.$this->escaper->formatText($description).'</p>';
            $compiled[] = '<article class="g7pb-pricing__plan'.$featuredClass.'">'.$badge.'<h3>'.$this->richText->sanitizePromotedInlineRichText($name).'</h3><p class="g7pb-pricing__price"><strong>'.$this->escaper->escape($price).'</strong><span>'.$this->escaper->escape($period).'</span></p>'.$descriptionMarkup.'<ul>'.implode('', $featureItems).'</ul><a class="g7pb-button '.($featured ? 'g7pb-button--primary' : 'g7pb-button--secondary').'" href="'.$this->escaper->escapeAttribute($buttonUrl).'">'.$this->escaper->escape($buttonLabel).'</a></article>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-pricing--layout-'.$layout;

        return '<section class="g7pb-block g7pb-pricing'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="pricing">'.$this->markup->compileSectionHeading($eyebrow, $heading).'<div class="g7pb-pricing__grid">'.implode('', $compiled).'</div></section>';
    }
}
