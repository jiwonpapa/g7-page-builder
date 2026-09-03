<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class RichTextBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.rich-text-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['content', 'measure', 'appearance'], 'Rich text');
        $content = $this->properties->requiredString($props, 'content', 20000);
        $measure = $this->properties->requiredString($props, 'measure', 16);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');
        if (! in_array($measure, ['narrow', 'standard', 'wide'], true)) {
            throw new DocumentCompileException('Rich text measure is invalid.');
        }

        return '<section class="g7pb-block g7pb-rich-text '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="rich-text"><div class="g7pb-rich-text__content g7pb-rich-text__content--'.$measure.'">'.$this->richText->sanitizeRichText($content).'</div></section>';
    }
}
