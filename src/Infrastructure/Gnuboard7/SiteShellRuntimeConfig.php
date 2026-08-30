<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7;

use Illuminate\Support\Facades\Route;

/** Public allowlist only. Never serializes a member, token, or full settings tree. */
final class SiteShellRuntimeConfig
{
    /** @return array<string, mixed> */
    public function snapshot(): array
    {
        $general = [];
        foreach (['site_name', 'site_description'] as $key) {
            $value = config('g7_settings.core.general.'.$key, '');
            $general[$key] = is_string($value) ? $value : '';
        }
        $social = [];
        foreach (['github', 'twitter', 'discord', 'facebook', 'instagram', 'youtube'] as $key) {
            $value = config('g7_settings.core.social.'.$key, '');
            $social[$key] = is_string($value) && str_starts_with($value, 'https://') ? $value : '';
        }
        $commerce = app()->bound('router') && Route::has('api.modules.sirsoft-ecommerce.cart.count');
        $base = config('g7_settings.modules.sirsoft-ecommerce.basic_info', []);
        $base = is_array($base) ? $base : [];
        $route = $base['route_path'] ?? 'shop';
        $route = is_string($route) && preg_match('/^[a-z0-9-]+$/', $route) === 1 ? $route : 'shop';
        $currencies = config('g7_settings.modules.sirsoft-ecommerce.language_currency.currencies', []);

        return [
            'settings' => ['general' => $general, 'social' => $social],
            'commerceAvailable' => $commerce,
            'shopBase' => ($base['no_route'] ?? false) === true ? '' : '/'.$route,
            'availableCurrencies' => $commerce && is_array($currencies) ? array_values(array_map(
                static fn (mixed $currency): array => is_array($currency)
                    ? array_intersect_key($currency, array_flip(['code', 'symbol'])) : [],
                $currencies,
            )) : [],
            'defaultCurrency' => $commerce ? config('g7_settings.modules.sirsoft-ecommerce.language_currency.default_currency', '') : '',
        ];
    }
}
