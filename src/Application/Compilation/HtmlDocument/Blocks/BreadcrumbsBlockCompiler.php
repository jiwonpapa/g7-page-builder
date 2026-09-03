<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BreadcrumbsBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.breadcrumbs-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
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
}
