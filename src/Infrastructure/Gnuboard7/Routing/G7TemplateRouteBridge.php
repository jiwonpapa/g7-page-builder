<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing;

use App\Contracts\Extension\CacheInterface;
use App\Extension\HookManager;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;

final class G7TemplateRouteBridge
{
    private bool $registered = false;

    public function __construct(
        private readonly PageBuilderService $pages,
        private readonly CacheInterface $cache,
    ) {}

    public function register(): void
    {
        if ($this->registered) {
            return;
        }

        HookManager::addFilter(
            'core.routes.filter_merged',
            fn (array $routes, string $templateType, string $identifier): array => $this->filterHomeRoute($routes, $templateType),
            20,
        );
        $this->registered = true;
    }

    public function invalidate(): void
    {
        try {
            $current = (int) $this->cache->get('ext.cache_version', 0);
            $this->cache->put('ext.cache_version', max(time(), $current + 1));
        } catch (\Throwable $exception) {
            Log::warning('Page Builder could not invalidate the G7 template route cache.', [
                'exception' => $exception,
            ]);
        }
    }

    /**
     * @param  array<array-key, mixed>  $routes
     * @return list<array<string, mixed>>
     */
    public function filterHomeRoute(array $routes, string $templateType): array
    {
        $routes = array_values(array_filter($routes, 'is_array'));

        if ($templateType !== 'user') {
            return $routes;
        }

        try {
            $home = $this->pages->findPublishedHome();
        } catch (\Throwable $exception) {
            Log::warning('Page Builder home route bridge was skipped.', ['exception' => $exception]);

            return $routes;
        }

        if ($home === null || $home->shellMode !== 'template') {
            return $routes;
        }

        $routes = array_values(array_filter(
            $routes,
            static fn (array $route): bool => ($route['path'] ?? null) !== '/',
        ));
        array_unshift($routes, [
            'path' => '/',
            'layout' => 'jiwonpapa-page_builder.page_builder_home',
            'auth_required' => false,
            'meta' => ['title' => $home->title],
            'source' => ['kind' => 'module', 'identifier' => 'jiwonpapa-page_builder'],
        ]);

        return $routes;
    }
}
