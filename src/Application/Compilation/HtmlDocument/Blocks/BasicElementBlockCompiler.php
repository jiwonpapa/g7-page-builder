<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockIconCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

/** Small, static leaf elements: no routes, handlers or child slots. */
final readonly class BasicElementBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private string $kind,
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockIconCompiler $icons,
        private HtmlEscaper $escaper,
    ) {
        if (! in_array($kind, ['icon', 'list', 'badge'], true)) {
            throw new \InvalidArgumentException('Unknown basic element.');
        }
    }

    public function key(): string
    {
        return 'builtin.'.$this->kind.'-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $content = match ($this->kind) {
            'list' => $this->listMarkup($props),
            'icon' => $this->iconMarkup($props),
            default => $this->badgeMarkup($props),
        };
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'compact');

        return '<section class="g7pb-block '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="'.$this->kind.'">'.$content.'</section>';
    }

    /** @param array<string, mixed> $props */
    private function listMarkup(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['ordered', 'items', 'appearance'], 'List');
        if (! is_bool($props['ordered'] ?? null)) {
            throw new DocumentCompileException('목록 형식을 선택해야 합니다.');
        }
        $items = $props['items'] ?? null;
        if (! is_array($items) || ! array_is_list($items) || count($items) < 1 || count($items) > 20) {
            throw new DocumentCompileException('목록 항목은 1~20개여야 합니다.');
        }
        $content = '';
        foreach ($items as $item) {
            if (! is_array($item)) {
                throw new DocumentCompileException('목록 항목 형식이 잘못되었습니다.');
            }
            $this->properties->assertOnlyKeys($item, ['text'], 'List item');
            $text = $this->properties->requiredString($item, 'text', 200);
            $content .= '<li>'.$this->escaper->escape($text).'</li>';
        }
        $tag = $props['ordered'] ? 'ol' : 'ul';

        return '<'.$tag.' class="g7pb-basic-list">'.$content.'</'.$tag.'>';
    }

    /** @param array<string, mixed> $props */
    private function iconMarkup(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['icon', 'size', 'tone', 'decorative', 'label', 'appearance'], 'Icon');
        if (! is_bool($props['decorative'] ?? null)) {
            throw new DocumentCompileException('아이콘 용도를 선택해야 합니다.');
        }
        $label = $this->properties->optionalString($props, 'label', 120) ?? '';
        if (! array_key_exists('label', $props) || (! $props['decorative'] && trim($label) === '')) {
            throw new DocumentCompileException('의미를 전달하는 아이콘에는 접근성 이름이 필요합니다.');
        }
        $attributes = $props['decorative'] ? ' aria-hidden="true"' : ' role="img" aria-label="'.$this->escaper->escapeAttribute($label).'"';

        return '<span class="g7pb-basic-icon '.$this->styleClasses($props).'"'.$attributes.'>'.$this->icon($props, false).'</span>';
    }

    /** @param array<string, mixed> $props */
    private function badgeMarkup(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['label', 'icon', 'size', 'tone', 'appearance'], 'Badge');
        $label = $this->properties->requiredString($props, 'label', 40);

        return '<span class="g7pb-basic-badge '.$this->styleClasses($props).'">'.$this->icon($props, true).'<span>'.$this->escaper->escape($label).'</span></span>';
    }

    /** @param array<string, mixed> $props */
    private function icon(array $props, bool $optional): string
    {
        $icon = $props['icon'] ?? null;
        if ($optional && array_key_exists('icon', $props) && ($icon === null || $icon === '')) {
            return '';
        }
        if (! is_string($icon) || ! in_array($icon, BlockIconCompiler::FEATURE_ICONS, true)) {
            throw new DocumentCompileException('제공된 아이콘 중에서 선택해야 합니다.');
        }

        return $this->icons->catalogIconSvg($icon, 'g7pb-basic-icon-image');
    }

    /** @param array<string, mixed> $props */
    private function styleClasses(array $props): string
    {
        $size = $this->properties->requiredString($props, 'size', 16);
        $tone = $this->properties->requiredString($props, 'tone', 16);
        if (! in_array($size, ['small', 'medium', 'large'], true)
            || ! in_array($tone, ['default', 'muted', 'accent'], true)) {
            throw new DocumentCompileException('요소 크기 또는 색상 선택이 잘못되었습니다.');
        }

        return 'g7pb-basic-size--'.$size.' g7pb-basic-tone--'.$tone;
    }
}
