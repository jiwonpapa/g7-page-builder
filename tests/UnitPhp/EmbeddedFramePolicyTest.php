<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\EmbeddedFramePolicy;
use PHPUnit\Framework\TestCase;

final class EmbeddedFramePolicyTest extends TestCase
{
    public function test_only_supported_map_and_video_origins_are_allowed(): void
    {
        self::assertSame(
            'frame-src https://www.openstreetmap.org https://www.google.com https://www.youtube-nocookie.com https://player.vimeo.com',
            EmbeddedFramePolicy::directive(),
        );
        self::assertStringNotContainsString('*', EmbeddedFramePolicy::directive());
    }
}
