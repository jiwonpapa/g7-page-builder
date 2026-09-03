<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BlockRuntimeCompiler
{
    public function __construct(
        private BlockPropertyReader $properties,
        private HtmlEscaper $escaper = new HtmlEscaper,
    ) {}

    public function compile(
        string $markup,
        string $instanceId,
        string $type,
        mixed $motion,
        mixed $visibility,
        mixed $responsive,
        string $rootTag = 'section',
    ): string {
        if (! in_array($rootTag, ['section', 'div'], true)) {
            throw new DocumentCompileException('Compiled block root tag is invalid.');
        }
        $attributes = 'data-block-id="'.$this->escaper->escapeAttribute($instanceId).'"';

        $responsiveClasses = $this->responsiveClasses($responsive, $type);
        if ($responsiveClasses !== '') {
            $decorated = preg_replace(
                '/^<'.preg_quote($rootTag, '/').' class="/',
                '<'.$rootTag.' class="'.$responsiveClasses.' ',
                $markup,
                1,
            );
            if (! is_string($decorated) || $decorated === $markup) {
                throw new DocumentCompileException('Compiled block responsive root is missing.');
            }
            $markup = $decorated;
        }

        if ($motion !== null) {
            if (! is_array($motion)) {
                throw new DocumentCompileException('Block motion must be an object.');
            }

            $this->properties->assertOnlyKeys($motion, ['preset', 'intensity', 'trigger', 'stagger_ms'], 'Block motion');
            $preset = $this->properties->requiredString($motion, 'preset', 32);
            $intensity = $this->properties->requiredString($motion, 'intensity', 16);
            $trigger = $this->properties->requiredString($motion, 'trigger', 16);
            $stagger = $motion['stagger_ms'] ?? null;

            if (! in_array($preset, $this->allowedMotionPresets($type), true)) {
                throw new DocumentCompileException('Block motion preset is not supported for this block type.');
            }
            if (! in_array($intensity, ['subtle', 'normal', 'strong'], true)) {
                throw new DocumentCompileException('Block motion intensity is invalid.');
            }
            if (! in_array($trigger, ['once', 'repeat'], true)) {
                throw new DocumentCompileException('Block motion trigger is invalid.');
            }
            if (! is_int($stagger) || ! in_array($stagger, [60, 100, 160], true)) {
                throw new DocumentCompileException('Block motion stagger interval is invalid.');
            }

            if ($preset !== 'none') {
                $attributes .= ' data-g7pb-motion="'.$this->escaper->escapeAttribute($preset).'"';
                $attributes .= ' data-g7pb-motion-intensity="'.$this->escaper->escapeAttribute($intensity).'"';
                $attributes .= ' data-g7pb-motion-trigger="'.$this->escaper->escapeAttribute($trigger).'"';
                $attributes .= ' data-g7pb-motion-stagger="'.$stagger.'"';
            }
        }

        if ($visibility !== null) {
            if (! is_array($visibility)) {
                throw new DocumentCompileException('Block visibility must be an object.');
            }
            $this->properties->assertOnlyKeys($visibility, ['audience'], 'Block visibility');
            $audience = $this->properties->requiredString($visibility, 'audience', 16);
            if (! in_array($audience, ['all', 'guest', 'member'], true)) {
                throw new DocumentCompileException('Block visibility audience is invalid.');
            }
            $attributes .= ' data-g7pb-visibility-audience="'.$this->escaper->escapeAttribute($audience).'"';
            if ($audience !== 'all' && preg_match('/^<'.preg_quote($rootTag, '/').'\b[^>]*\shidden(?:\s|>)/', $markup) !== 1) {
                $attributes .= ' hidden';
            }
        }

        $compiled = preg_replace('/^<'.preg_quote($rootTag, '/').' /', '<'.$rootTag.' '.$attributes.' ', $markup, 1);
        if (! is_string($compiled) || $compiled === $markup) {
            throw new DocumentCompileException('Compiled block markup has no supported root.');
        }

        return $compiled;
    }

    private function responsiveClasses(mixed $value, string $type): string
    {
        if ($value === null) {
            return '';
        }
        if (! is_array($value) || $value === [] || array_is_list($value)) {
            throw new DocumentCompileException('Block responsive override must be a non-empty object.');
        }
        $this->properties->assertOnlyKeys($value, ['tablet', 'mobile'], 'Block responsive');
        $classes = [];
        foreach (['tablet', 'mobile'] as $viewport) {
            if (! array_key_exists($viewport, $value)) {
                continue;
            }
            $override = $value[$viewport];
            if (! is_array($override) || $override === [] || array_is_list($override)) {
                throw new DocumentCompileException("Block {$viewport} override must be a non-empty object.");
            }
            $this->properties->assertOnlyKeys($override, ['appearance', 'layout'], "Block {$viewport}");
            if (array_key_exists('appearance', $override)) {
                $appearance = $override['appearance'];
                if (! is_array($appearance) || $appearance === [] || array_is_list($appearance)) {
                    throw new DocumentCompileException("Block {$viewport} appearance must be a non-empty object.");
                }
                $this->properties->assertOnlyKeys($appearance, ['surface', 'spacing', 'textScale', 'textAlign', 'containerWidth', 'containerAlign', 'minHeight', 'verticalAlign'], "Block {$viewport} appearance");
                $options = [
                    'surface' => ['default', 'soft', 'contrast'],
                    'spacing' => ['compact', 'normal', 'spacious'],
                    'textScale' => ['compact', 'balanced', 'large'],
                    'textAlign' => ['left', 'center', 'right'],
                    'containerWidth' => ['inherit', 'narrow', 'standard', 'wide', 'full'],
                    'containerAlign' => ['left', 'center', 'right', 'stretch'],
                    'minHeight' => ['auto', 'compact', 'medium', 'large', 'viewport'],
                    'verticalAlign' => ['start', 'center', 'end'],
                ];
                $cssKeys = [
                    'surface' => 'surface', 'spacing' => 'spacing', 'textScale' => 'text-scale', 'textAlign' => 'text-align',
                    'containerWidth' => 'container-width', 'containerAlign' => 'container-align', 'minHeight' => 'min-height',
                    'verticalAlign' => 'vertical-align',
                ];
                foreach ($appearance as $key => $item) {
                    if (! is_string($key) || ! isset($options[$key], $cssKeys[$key]) || ! is_string($item) || ! in_array($item, $options[$key], true)) {
                        throw new DocumentCompileException("Block {$viewport} appearance {$key} is invalid.");
                    }
                    $classes[] = "g7pb-{$viewport}-appearance-{$cssKeys[$key]}--{$item}";
                }
            }
            if (! array_key_exists('layout', $override)) {
                continue;
            }
            $layout = $override['layout'];
            if (! is_array($layout) || $layout === [] || array_is_list($layout)) {
                throw new DocumentCompileException("Block {$viewport} layout must be a non-empty object.");
            }
            $allowed = match ($type) {
                BuiltInBlockTypes::LAYOUT_SECTION_TYPE => ['width', 'spacing'],
                BuiltInBlockTypes::LAYOUT_COLUMNS_TYPE => ['columns', 'gap'],
                BuiltInBlockTypes::LAYOUT_STACK_TYPE => ['gap'],
                default => [],
            };
            if ($allowed === [] || array_diff(array_keys($layout), $allowed) !== []) {
                throw new DocumentCompileException("Block {$viewport} layout is not supported for {$type}.");
            }
            foreach ($layout as $key => $item) {
                if (! is_string($key)) {
                    throw new DocumentCompileException("Block {$viewport} layout key is invalid.");
                }
                if ($key === 'columns') {
                    $valid = $viewport === 'mobile' ? $item === 1 : in_array($item, [1, 2], true);
                } elseif ($key === 'width') {
                    $valid = is_string($item) && in_array($item, ['standard', 'wide', 'full'], true);
                } elseif ($key === 'spacing') {
                    $valid = is_string($item) && in_array($item, ['compact', 'normal', 'spacious'], true);
                } else {
                    $valid = is_string($item) && in_array($item, ['none', 'compact', 'normal', 'spacious'], true);
                }
                if (! $valid) {
                    throw new DocumentCompileException("Block {$viewport} layout {$key} is invalid.");
                }
                $classes[] = "g7pb-{$viewport}-layout-{$key}--{$item}";
            }
        }

        if ($classes === []) {
            throw new DocumentCompileException('Block responsive override cannot be empty.');
        }

        return implode(' ', $classes);
    }

    /**
     * @return list<string>
     */
    private function allowedMotionPresets(string $type): array
    {
        return match ($type) {
            BuiltInBlockTypes::HERO_TYPE, BuiltInBlockTypes::HERO_SPLIT_TYPE, BuiltInBlockTypes::HERO_SLIDER_TYPE => ['none', 'reveal', 'parallax-soft'],
            BuiltInBlockTypes::FEATURES_TYPE, BuiltInBlockTypes::LOGO_CLOUD_TYPE, BuiltInBlockTypes::PRICING_TYPE, BuiltInBlockTypes::TEAM_TYPE, BuiltInBlockTypes::TESTIMONIALS_TYPE, BuiltInBlockTypes::PROCESS_TIMELINE_TYPE, BuiltInBlockTypes::ARTICLE_LIST_TYPE, BuiltInBlockTypes::G7_RECENT_POSTS_TYPE, BuiltInBlockTypes::G7_PRODUCT_GRID_TYPE, BuiltInBlockTypes::EVENT_SCHEDULE_TYPE, BuiltInBlockTypes::DOWNLOAD_RESOURCES_TYPE, BuiltInBlockTypes::G7_BOARD_ARCHIVE_TYPE, BuiltInBlockTypes::G7_PRODUCT_SHOWCASE_TYPE, BuiltInBlockTypes::ICON_LIST_TYPE, BuiltInBlockTypes::CARD_GRID_TYPE, BuiltInBlockTypes::SOCIAL_LINKS_TYPE => ['none', 'reveal', 'stagger'],
            BuiltInBlockTypes::STATS_TYPE => ['none', 'reveal', 'stagger', 'counter'],
            BuiltInBlockTypes::GALLERY_TYPE, BuiltInBlockTypes::IMAGE_CAROUSEL_TYPE => ['none', 'reveal', 'stagger', 'parallax-soft'],
            BuiltInBlockTypes::BAR_CHART_TYPE => ['none', 'reveal', 'chart-draw'],
            BuiltInBlockTypes::CTA_TYPE, BuiltInBlockTypes::CONTACT_TYPE, BuiltInBlockTypes::INQUIRY_FORM_TYPE, BuiltInBlockTypes::MAP_DIRECTIONS_TYPE, BuiltInBlockTypes::FAQ_ACCORDION_TYPE, BuiltInBlockTypes::TABS_TYPE, BuiltInBlockTypes::COMPARISON_TABLE_TYPE, BuiltInBlockTypes::VIDEO_EMBED_TYPE, BuiltInBlockTypes::LOGO_CAROUSEL_TYPE, BuiltInBlockTypes::TESTIMONIAL_SLIDER_TYPE, BuiltInBlockTypes::HEADING_TYPE, BuiltInBlockTypes::RICH_TEXT_TYPE, BuiltInBlockTypes::IMAGE_TYPE, BuiltInBlockTypes::BUTTONS_TYPE, BuiltInBlockTypes::IMAGE_TEXT_TYPE, BuiltInBlockTypes::G7_POST_DETAIL_TYPE, BuiltInBlockTypes::G7_PRODUCT_DETAIL_TYPE, BuiltInBlockTypes::DIVIDER_TYPE, BuiltInBlockTypes::BLOCKQUOTE_TYPE, BuiltInBlockTypes::NOTICE_TYPE, BuiltInBlockTypes::BREADCRUMBS_TYPE, BuiltInBlockTypes::ANCHOR_MENU_TYPE => ['none', 'reveal'],
            default => ['none'],
        };
    }
}
