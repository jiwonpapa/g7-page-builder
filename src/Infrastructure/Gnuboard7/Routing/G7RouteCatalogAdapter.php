<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing;

use App\Services\ModuleSettingsService;
use App\Services\TemplateService;
use Modules\Jiwonpapa\PageBuilder\Application\Routing\RouteCatalogNormalizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\RouteCatalogPort;

final class G7RouteCatalogAdapter implements RouteCatalogPort
{
    public function __construct(
        private readonly TemplateService $templates,
        private readonly ModuleSettingsService $settings,
        private readonly RouteCatalogNormalizer $normalizer,
    ) {}

    public function catalog(): array
    {
        $identifier = $this->templates->getActiveTemplateIdentifier('user');
        $result = $this->templates->getRoutesDataWithModules($identifier);
        $routes = $result['data']['routes'] ?? null;

        if ($result['success'] !== true || ! is_array($routes)) {
            throw new \RuntimeException('The active G7 user template route catalog is unavailable.');
        }

        $routePath = $this->settings->get('sirsoft-ecommerce', 'basic_info.route_path', 'shop');
        $noRoute = $this->settings->get('sirsoft-ecommerce', 'basic_info.no_route', false);

        return $this->normalizer->normalize(
            $identifier,
            array_values(array_filter($routes, 'is_array')),
            is_string($routePath) && $routePath !== '' ? $routePath : 'shop',
            (bool) $noRoute,
        );
    }
}
