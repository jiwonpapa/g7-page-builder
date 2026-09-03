<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

final readonly class HtmlEscaper
{
    public function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }

    public function escapeAttribute(string $value): string
    {
        return $this->escape($value);
    }

    public function formatText(string $value): string
    {
        return nl2br($this->escape($value), false);
    }
}
