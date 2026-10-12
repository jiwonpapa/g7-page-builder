<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Three projections of one tree; no duplicated DOM or client-side compilation. */
final class ResponsiveStyles
{
    /** @return array{styles: array<string, array<string, string>>, attributes: array<string, array<string, string>>} */
    public static function document(stdClass $document, Validator $validator): array
    {
        $screens = [];
        $attributes = [];
        foreach (['base', 'tablet', 'mobile'] as $viewport) {
            $projection = BehaviorPresentation::apply($document,
                Presentation::document($document, $viewport, $validator->semanticDisplays()), $viewport);
            $screens[$viewport] = array_map(self::longhands(...), $projection['styles']);
            $attributes = $projection['attributes'];
        }
        $styles = [];
        foreach ($screens['base'] as $id => $base) {
            $keys = array_keys(array_replace($base, $screens['tablet'][$id], $screens['mobile'][$id]));
            $attributes[$id]['data-g7pb-v3-style'] = implode(' ', $keys);
            $out = [];
            foreach ($keys as $key) {
                $fallback = 'revert';
                foreach ($screens as $viewport => $nodes) {
                    $value = $nodes[$id][$key] ?? null;
                    // Missing values invalidate this node's variable, preventing
                    // inherited parent variables from leaking across breakpoints.
                    // Button typography is explicitly inherited in every
                    // unauthored viewport. CSS-wide keywords cannot be stored
                    // as custom-property values; use the final property fallback.
                    if ($value === 'inherit') {
                        $fallback = 'inherit';
                    }
                    $out['--g7pb-v3-'.$viewport.'-'.$key] = $value === null || $value === 'inherit' ? 'initial' : $value;
                }
                $out[$key] = 'var(--g7pb-v3-current-'.$key.', '.$fallback.')';
            }
            $styles[$id] = $out;
        }

        return ['styles' => $styles, 'attributes' => $attributes];
    }

    /** Expand overlapping shorthands before independently switching properties.
     * Otherwise a missing background-image could erase an authored gradient.
     *
     * @param  array<string, string>  $styles
     * @return array<string, string>
     */
    public static function longhands(array $styles): array
    {
        $out = [];
        foreach ($styles as $key => $value) {
            if (in_array($key, ['margin', 'padding', 'border-width'], true)) {
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $out[$key === 'border-width' ? 'border-'.$side.'-width' : $key.'-'.$side] = $value;
                }
            } elseif (in_array($key, ['border-top', 'border-right', 'border-bottom', 'border-left'], true)) {
                [$width, $style, $color] = explode(' ', $value, 3);
                $out[$key.'-width'] = $width;
                $out[$key.'-style'] = $style;
                $out[$key.'-color'] = $color;
            } elseif ($key === 'background') {
                $gradient = str_starts_with($value, 'linear-gradient(');
                $out = array_replace($out, ['background-color' => $gradient ? 'transparent' : $value,
                    'background-image' => $gradient ? $value : 'none', 'background-position' => '0% 0%',
                    'background-size' => 'auto', 'background-repeat' => 'repeat']);
            } else {
                $out[$key] = $value;
            }
        }

        return $out;
    }
}
