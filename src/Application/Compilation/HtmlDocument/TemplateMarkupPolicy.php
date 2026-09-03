<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final class TemplateMarkupPolicy
{
    /** @var list<string> */
    private const TEMPLATE_FORBIDDEN_TAGS = [
        'script', 'noscript', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal',
        'form', 'input', 'textarea', 'select', 'option', 'button', 'style', 'meta', 'base',
        'body', 'head', 'html', 'title', 'svg', 'math', 'audio', 'video', 'source', 'track', 'canvas',
        'details', 'dialog', 'plaintext', 'xmp', 'listing', 'marquee', 'noframes', 'noembed', 'template', 'slot',
    ];

    public function assertTemplateCompatibleMarkup(string $html, string $context): void
    {
        $pattern = '/<\s*\/?\s*('.implode('|', array_map(static fn (string $tag): string => preg_quote($tag, '/'), self::TEMPLATE_FORBIDDEN_TAGS)).')\b/i';
        if (preg_match($pattern, $html, $matches) === 1) {
            throw new DocumentCompileException(
                $context.' contains markup removed by the active G7 HtmlContent sanitizer: '.strtolower($matches[1]).'.',
                'G7PB_TEMPLATE_MARKUP_UNSUPPORTED',
            );
        }
    }
}
