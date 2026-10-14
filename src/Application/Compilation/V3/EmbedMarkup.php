<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use stdClass;

/** Fixed provider URLs from validated values; no document-owned endpoint or iframe HTML. */
final class EmbedMarkup
{
    /** @return array{kind: string, src: string, video: bool}|null */
    public static function target(stdClass $source): ?array
    {
        if ($source->provider === 'none') {
            return null;
        }
        if (in_array($source->provider, ['youtube', 'vimeo'], true)) {
            return ['kind' => 'video-'.$source->provider, 'src' => $source->provider === 'youtube'
                ? 'https://www.youtube-nocookie.com/embed/'.$source->video_id.'?rel=0'
                : 'https://player.vimeo.com/video/'.$source->video_id, 'video' => true];
        }
        $coordinate = static fn (float $value): string => $value == 0 ? '0' : rtrim(rtrim(number_format($value, 6, '.', ''), '0'), '.');
        $center = rawurlencode($coordinate($source->latitude).','.$coordinate($source->longitude));
        if ($source->provider === 'google') {
            return ['kind' => 'map-google', 'src' => 'https://www.google.com/maps?q='.$center.'&z='.$source->zoom.'&output=embed', 'video' => false];
        }
        $delta = [12 => 0.12, 14 => 0.03, 16 => 0.008, 18 => 0.002][$source->zoom];
        $box = array_map($coordinate, [max(-180, $source->longitude - $delta), max(-90, $source->latitude - $delta),
            min(180, $source->longitude + $delta), min(90, $source->latitude + $delta)]);

        return ['kind' => 'map-openstreetmap', 'src' => 'https://www.openstreetmap.org/export/embed.html?bbox='.rawurlencode(implode(',', $box)).'&marker='.$center, 'video' => false];
    }

    public static function render(stdClass $props, bool $publication): string
    {
        $escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $title = $escape($props->title);
        $target = self::target($props->source);
        if ($target === null) {
            return '<span>'.$title.' · 제공자를 설정해 주세요.</span>';
        }
        $src = $escape($target['src']);
        if ($publication) {
            return '<span data-g7pb-embed="" data-g7pb-embed-kind="'.$target['kind'].'" data-g7pb-embed-src="'.$src.'" data-g7pb-embed-title="'.$title.'" data-g7pb-embed-sizing="parent"></span>';
        }

        $referrerPolicy = $target['kind'] === 'video-youtube' ? 'strict-origin-when-cross-origin' : 'no-referrer';

        return '<iframe src="'.$src.'" title="'.$title.'" loading="lazy" referrerpolicy="'.$referrerPolicy.'"'.($target['video'] ? ' allowfullscreen=""' : '')
            .' style="display:block;width:100%;height:100%;border:0;min-width:0;min-height:0;"></iframe>';
    }
}
