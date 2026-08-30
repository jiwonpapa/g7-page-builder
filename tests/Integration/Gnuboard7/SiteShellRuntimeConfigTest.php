<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Facade;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\SiteShellRuntimeConfig;
use PHPUnit\Framework\TestCase;

final class SiteShellRuntimeConfigTest extends TestCase
{
    public function test_only_public_settings_and_available_commerce_are_exposed(): void
    {
        $container = new Container;
        $container->instance('config', new Repository(['g7_settings' => [
            'core' => [
                'general' => ['site_name' => '검증 사이트', 'site_description' => '사이트 설명', 'secret' => 'must-not-leak'],
                'social' => ['github' => 'https://github.com/example', 'twitter' => 'javascript:alert(1)'],
                'auth' => ['token' => 'must-not-leak'],
            ],
            'modules' => ['sirsoft-ecommerce' => [
                'basic_info' => ['route_path' => 'store'],
                'language_currency' => ['currencies' => [['code' => 'KRW', 'symbol' => '₩', 'secret' => 'must-not-leak']], 'default_currency' => 'KRW'],
            ]],
        ]]));
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        try {
            $withoutCommerce = (new SiteShellRuntimeConfig)->snapshot();
            self::assertFalse($withoutCommerce['commerceAvailable']);
            self::assertSame([], $withoutCommerce['availableCurrencies']);
            $router = new Router(new Dispatcher($container), $container);
            $router->get('/api/modules/sirsoft-ecommerce/cart/count', static fn () => null)->name('api.modules.sirsoft-ecommerce.cart.count');
            $router->getRoutes()->refreshNameLookups();
            $container->instance('router', $router);
            $snapshot = (new SiteShellRuntimeConfig)->snapshot();
            self::assertTrue($snapshot['commerceAvailable']);
            self::assertSame('/store', $snapshot['shopBase']);
            self::assertSame([['code' => 'KRW', 'symbol' => '₩']], $snapshot['availableCurrencies']);
            self::assertSame('KRW', $snapshot['defaultCurrency']);
            $json = json_encode($snapshot, JSON_THROW_ON_ERROR);
            self::assertStringNotContainsString('must-not-leak', $json);
            self::assertStringNotContainsString('javascript:', $json);
        } finally {
            Facade::clearResolvedInstances();
            Facade::setFacadeApplication(null);
            Container::setInstance(null);
        }
    }
}
