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

final readonly class LogoCloudBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.logo-cloud-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['heading', 'logos', 'layout', 'appearance'], 'Logo Cloud');
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $logos = $props['logos'] ?? null;
        $layout = $this->properties->optionalString($props, 'layout', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');

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
                ? '<span>'.$this->escaper->escape($name).'</span>'
                : $this->markup->compileCatalogImage($imageSrc, $imageAlt !== '' ? $imageAlt : $name.' 로고', 'g7pb-logo-cloud__image', $name);
            if ($url !== '') {
                $this->urls->assertAllowedUrl($url, "Logo item {$index}");
                $visual = '<a href="'.$this->escaper->escapeAttribute($url).'" aria-label="'.$this->escaper->escapeAttribute($name).'">'.$visual.'</a>';
            }
            $items[] = '<li>'.$visual.'</li>';
        }

        $layoutClass = $layout === null ? '' : ' g7pb-logo-cloud--layout-'.$layout;

        return '<section class="g7pb-block g7pb-logo-cloud'.$layoutClass.' '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="logo-cloud"><h2>'.$this->richText->sanitizeInlineRichText($heading).'</h2><ul>'.implode('', $items).'</ul></section>';
    }
}
