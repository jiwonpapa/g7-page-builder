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

final readonly class MapDirectionsBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.map-directions-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
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
}
