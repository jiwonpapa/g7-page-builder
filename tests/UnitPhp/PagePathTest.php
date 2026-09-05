<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Routing\PagePath;
use PHPUnit\Framework\TestCase;

final class PagePathTest extends TestCase
{
    public function test_normalization_and_conflicts_include_native_parameter_routes(): void
    {
        self::assertSame('/company/about', PagePath::normalize(' /Company/About/ '));
        foreach (['/about', '*/about', '/:slug', '*/:slug', '/ab*'] as $pattern) {
            self::assertTrue(PagePath::conflicts('/about', [['path' => $pattern]]), $pattern);
        }
        self::assertTrue(PagePath::conflicts('/board/news', [['path' => '*/board/:slug']]));
        self::assertFalse(PagePath::conflicts('/about', [['path' => '*/board/:slug'], ['path' => '/about-us']]));
    }

    public function test_unsafe_and_system_paths_are_rejected_before_persistence(): void
    {
        foreach (['/', '/Admin/test', '/api/anything', '/administrator', '/apiculture', '/plugins-custom', '/pages/x', '//evil.test', '/x?y=1', '/x#y', '/%61dmin', '/x//y', '/x/../y', '/회사소개', str_repeat('a', 241)] as $path) {
            try {
                PagePath::normalize($path);
                self::fail('Accepted invalid path: '.$path);
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }
}
