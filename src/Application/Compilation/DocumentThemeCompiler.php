<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDesignTokens;

/** Compiles page-level theme selections without owning block rendering. */
final class DocumentThemeCompiler
{
    public function className(PageDesignTokens $tokens): string
    {
        $classes = ['g7pb-document-theme'];
        foreach ($tokens->presets() as $token => $value) {
            $suffix = $token === 'design.color_mode' ? 'mode' : str_replace('design.', '', $token);
            $classes[] = "g7pb-theme-{$suffix}-{$value}";
        }
        if ($tokens->customPalette() !== null) {
            $classes[] = 'g7pb-theme-custom-palette';
        }

        return implode(' ', $classes);
    }

    public function customPaletteDeclarations(PageDesignTokens $tokens): string
    {
        $palette = $tokens->customPalette();
        if ($palette === null) {
            return '';
        }
        $declarations = [];
        foreach ($palette as $token => $value) {
            $suffix = str_replace(['design.custom_color_', '_'], ['', '-'], $token);
            $declarations[] = '--g7pb-custom-tone-'.$suffix.':'.$value;
        }

        return implode(';', $declarations);
    }
}
