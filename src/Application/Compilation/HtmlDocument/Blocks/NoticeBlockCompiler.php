<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class NoticeBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
        private RichTextSanitizer $richText,
    ) {}

    public function key(): string
    {
        return 'builtin.notice-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
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
}
