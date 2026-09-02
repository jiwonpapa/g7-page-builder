<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

/** Canonical rich-text markup, typed marks and safe plain-text projection. */
final class RichTextSanitizer
{
    public function __construct(private readonly CompilationUrlPolicy $urls = new CompilationUrlPolicy) {}

    public function hasRichTextMarkup(string $value): bool
    {
        return preg_match('/<\/?[a-z][^>]*>/i', $value) === 1;
    }

    private function hasCanonicalInlineRichTextMarkup(string $value): bool
    {
        return preg_match('/^\s*<p\b[^>]*>.*<\/p>\s*$/is', $value) === 1;
    }

    public function hasCanonicalRichTextMarkup(string $value): bool
    {
        return preg_match('/^\s*<(?:p|h[2-4]|ol|ul|blockquote)\b/i', $value) === 1;
    }

    public function sanitizePromotedInlineRichText(string $value, bool $allowLinks = true): string
    {
        return $this->hasCanonicalInlineRichTextMarkup($value)
            ? $this->sanitizeInlineRichText($value, $allowLinks)
            : $this->escape($value);
    }

    public function promotedRichTextPlainText(string $value, bool $inline, bool $allowLinks): string
    {
        if ($inline) {
            return $this->hasCanonicalInlineRichTextMarkup($value)
                ? $this->inlinePlainText($value, $allowLinks)
                : $value;
        }
        if (! $this->hasCanonicalRichTextMarkup($value)) {
            return $value;
        }

        $sanitized = $this->sanitizeRichText($value, $allowLinks);
        $withBreaks = preg_replace(
            '/<br\s*\/?\s*>|<\/(?:p|h[2-4]|li|blockquote)>/i',
            ' ',
            $sanitized,
        );
        $plainText = html_entity_decode(strip_tags((string) $withBreaks), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim((string) preg_replace('/\s+/u', ' ', $plainText));
    }

    public function promotedInlinePlainText(string $value, bool $allowLinks = true): string
    {
        return $this->hasCanonicalInlineRichTextMarkup($value)
            ? $this->inlinePlainText($value, $allowLinks)
            : trim($value);
    }

    public function sanitizeRichText(string $html, bool $allowLinks = true): string
    {
        if (preg_match('/<(?:script|style|iframe|object|embed|svg|math|form|input|button)\b/i', $html) === 1
            || preg_match('/\son[a-z]+\s*=/i', $html) === 1) {
            throw new DocumentCompileException('Rich text contains unsafe markup.');
        }
        $this->assertRichTextLinkNesting($html, $allowLinks);

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
            throw new DocumentCompileException('Rich text is invalid.');
        }

        $root = $document->getElementById('g7pb-richtext-root');

        if (! $root instanceof \DOMElement) {
            throw new DocumentCompileException('Rich text could not be parsed.');
        }

        $this->sanitizeRichTextNode($root, $allowLinks);
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

    private function sanitizeRichTextNode(\DOMNode $parent, bool $allowLinks): void
    {
        $allowed = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'span', 'a', 'ol', 'ul', 'li', 'blockquote', 'br'];

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
                    $this->sanitizeRichTextNode($child, $allowLinks);

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
                    $isLinkHref = $tag === 'a' && $attribute === 'href';
                    $isTypedTextMark = $tag === 'span'
                        && in_array($attribute, ['data-g7pb-font', 'data-g7pb-font-size-rem', 'data-g7pb-size', 'data-g7pb-weight', 'data-g7pb-tone'], true);
                    if (! $isLinkHref && ! $isTypedTextMark) {
                        $child->removeAttribute($attribute);
                    }
                }

                if ($tag === 'span') {
                    $allowedValues = [
                        'data-g7pb-font' => ['modern', 'serif', 'mono'],
                        'data-g7pb-font-size-rem' => ['0.75', '0.875', '1', '1.125', '1.25', '1.5', '1.75', '2', '2.25', '2.5', '3', '3.5', '4', '4.5', '5', '6'],
                        'data-g7pb-size' => ['small', 'large', 'xlarge'],
                        'data-g7pb-weight' => ['medium', 'semibold', 'bold'],
                        'data-g7pb-tone' => ['muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'],
                    ];
                    foreach ($allowedValues as $attribute => $values) {
                        if ($child->hasAttribute($attribute)
                            && ! in_array($child->getAttribute($attribute), $values, true)) {
                            throw new DocumentCompileException('Rich text contains an unsupported typed mark.');
                        }
                    }
                }

                if ($tag === 'a') {
                    $href = $child->getAttribute('href');
                    $this->urls->assertAllowedUrl($href, 'Rich text link');
                    $child->setAttribute('rel', 'noopener noreferrer');
                }

                $this->sanitizeRichTextNode($child, $allowLinks);
            } elseif (! $child instanceof \DOMText) {
                $parent->removeChild($child);
            }

            $child = $next;
        }
    }

    public function sanitizeInlineRichText(string $html, bool $allowLinks = true): string
    {
        $this->assertRichTextLinkNesting($html, $allowLinks);
        if (! preg_match('/<(?:p|strong|em|u|span|a|br)\b/i', $html)) {
            return $this->escape($html);
        }

        $sanitized = $this->sanitizeRichText($html, $allowLinks);
        $document = new \DOMDocument('1.0', 'UTF-8');
        $previousErrors = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadHTML(
                '<?xml encoding="utf-8" ?><div id="g7pb-inline-root">'.$sanitized.'</div>',
                LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousErrors);
        }
        $root = $loaded ? $document->getElementById('g7pb-inline-root') : null;
        if (! $root instanceof \DOMElement) {
            throw new DocumentCompileException('Inline rich text could not be parsed.');
        }

        $parts = [];
        foreach ($root->childNodes as $child) {
            if ($child instanceof \DOMText && trim($child->textContent) === '') {
                continue;
            }
            if (! $child instanceof \DOMElement || strtolower($child->tagName) !== 'p') {
                throw new DocumentCompileException('Inline rich text only supports paragraphs.');
            }
            if ($parts !== []) {
                $parts[] = '<br>';
            }
            foreach ($child->childNodes as $inlineChild) {
                $parts[] = $document->saveHTML($inlineChild);
            }
        }

        return implode('', $parts);
    }

    public function inlinePlainText(string $html, bool $allowLinks = true): string
    {
        $sanitized = preg_replace('/<br\s*\/?\s*>/i', ' ', $this->sanitizeInlineRichText($html, $allowLinks));

        return trim(html_entity_decode(strip_tags((string) $sanitized), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    private function assertRichTextLinkNesting(string $html, bool $allowLinks): void
    {
        if (! $allowLinks && preg_match('/<\s*a\b/i', $html) === 1) {
            throw new DocumentCompileException('Rich text links are not allowed in this field.');
        }

        preg_match_all('/<\s*(\/?)\s*a\b[^>]*>/i', $html, $matches, PREG_SET_ORDER);
        $depth = 0;
        foreach ($matches as $match) {
            if ($match[1] === '/') {
                if ($depth === 0) {
                    throw new DocumentCompileException('Rich text link markup is invalid.');
                }
                $depth--;

                continue;
            }
            if ($depth > 0) {
                throw new DocumentCompileException('Rich text links cannot be nested.');
            }
            $depth++;
        }
        if ($depth !== 0) {
            throw new DocumentCompileException('Rich text link markup is invalid.');
        }
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }
}
