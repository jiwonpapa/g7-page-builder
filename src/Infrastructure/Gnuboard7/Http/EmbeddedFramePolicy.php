<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http;

final class EmbeddedFramePolicy
{
    /** @var list<string> */
    private const ORIGINS = [
        'https://www.openstreetmap.org',
        'https://www.google.com',
        'https://www.youtube-nocookie.com',
        'https://player.vimeo.com',
    ];

    public static function directive(): string
    {
        return 'frame-src '.implode(' ', self::ORIGINS);
    }
}
