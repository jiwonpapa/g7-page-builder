<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Routing\RouteCatalogNormalizer;
use PHPUnit\Framework\TestCase;

final class RouteCatalogNormalizerTest extends TestCase
{
    public function test_it_names_groups_and_resolves_current_g7_service_routes(): void
    {
        $catalog = (new RouteCatalogNormalizer)->normalize(
            'sirsoft-basic',
            [
                [
                    'path' => '/',
                    'layout' => 'home',
                    'auth_required' => false,
                    'source' => ['kind' => 'template', 'identifier' => null],
                ],
                [
                    'path' => '/login',
                    'layout' => 'auth/login',
                    'guest_only' => true,
                    'source' => ['kind' => 'template', 'identifier' => null],
                ],
                [
                    'path' => "/{{_global.modules?.['sirsoft-ecommerce']?.basic_info?.no_route ? '' : (_global.modules?.['sirsoft-ecommerce']?.basic_info?.route_path ?? 'shop')}}/products/:product_code",
                    'layout' => 'shop/show',
                    'source' => ['kind' => 'template', 'identifier' => null],
                ],
                [
                    'path' => '*/pages/:slug',
                    'layout' => 'jiwonpapa-page_builder.page_builder_public',
                    'source' => ['kind' => 'module', 'identifier' => 'jiwonpapa-page_builder'],
                ],
            ],
            'store',
            false,
        );

        self::assertSame('sirsoft-basic', $catalog['active_template']);
        self::assertSame(
            ['site.home', 'auth.login', 'shop.product', 'page-builder.page', 'auth.logout'],
            array_column($catalog['routes'], 'id'),
        );
        self::assertSame('/store/products/:product_code', $catalog['routes'][2]['path']);
        self::assertSame(['product_code'], $catalog['routes'][2]['parameters']);
        self::assertSame(['product_code' => 'product'], $catalog['routes'][2]['parameter_sources']);
        self::assertSame('#g7-action-logout', $catalog['routes'][4]['path']);
        self::assertSame('logout', $catalog['routes'][4]['action']);
    }

    public function test_it_removes_the_shop_prefix_when_no_route_is_enabled(): void
    {
        $catalog = (new RouteCatalogNormalizer)->normalize(
            'sirsoft-basic',
            [[
                'path' => "/{{_global.modules?.['sirsoft-ecommerce']?.basic_info?.no_route ? '' : (_global.modules?.['sirsoft-ecommerce']?.basic_info?.route_path ?? 'shop')}}/cart",
                'layout' => 'shop/cart',
            ]],
            'store',
            true,
        );

        self::assertSame('/cart', $catalog['routes'][0]['path']);
    }

    public function test_it_skips_unresolvable_or_non_public_paths_fail_closed(): void
    {
        $catalog = (new RouteCatalogNormalizer)->normalize('sirsoft-basic', [
            ['path' => '*/admin/secret', 'layout' => 'admin/secret'],
            ['path' => '/broken/{{unknown.expression}}', 'layout' => 'broken'],
            ['path' => '/about-us', 'layout' => 'about', 'meta' => ['title' => '회사 소개']],
        ]);

        self::assertCount(2, $catalog['routes']);
        self::assertSame('/about-us', $catalog['routes'][0]['path']);
        self::assertSame('회사 소개', $catalog['routes'][0]['label']);
        self::assertSame('auth.logout', $catalog['routes'][1]['id']);
    }
}
