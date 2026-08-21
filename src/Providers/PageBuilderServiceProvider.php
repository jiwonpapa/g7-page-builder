<?php

namespace Modules\Jiwonpapa\PageBuilder\Providers;

use Illuminate\Contracts\Http\Kernel as HttpKernelContract;
use Illuminate\Foundation\Http\Kernel as HttpKernel;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCatalogService;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackManager;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockPackRuntimeRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\GitHubBlockPackService;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\Store\OfficialStoreService;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockFavoritePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackProviderLoaderPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackReleaseSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackSignatureVerifierPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockUsagePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\OfficialStoreSourcePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageKitArchivePort;
use Modules\Jiwonpapa\PageBuilder\Contracts\RouteCatalogPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Contracts\SiteShellPort;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\BuiltInBlockPackLoader;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\Ed25519BlockPackSignatureVerifier;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\GitHubReleaseSourceAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\SignedBlockPackProviderLoader;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks\ZipBlockPackArchiveAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\BlockPacks\LaravelBlockPackAssetUrlAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\BlockPackAssetController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\FormSubmissionController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\CanonicalApiAccessResponse;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\PageBuilderHomeOverride;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Media\LaravelMediaAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockFavoriteAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockPackRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentBlockUsageAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentSiteShellAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7RouteCatalogAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7TemplateRouteBridge;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\LaravelOfficialStoreSourceAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Store\ZipPageKitArchiveAdapter;

final class PageBuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(dirname(__DIR__, 2).'/config/block-packs.php', 'g7-page-builder.block-packs');
        $this->mergeConfigFrom(dirname(__DIR__, 2).'/config/official-store.php', 'g7-page-builder.official-store');
        $this->mergeConfigFrom(dirname(__DIR__, 2).'/config/forms.php', 'g7-page-builder.forms');
        $this->app->bind(PageBuilderRepository::class, EloquentPageBuilderRepository::class);
        $this->app->bind(RouteCatalogPort::class, G7RouteCatalogAdapter::class);
        $this->app->singleton(G7TemplateRouteBridge::class);
        $this->app->bind(BlockFavoritePort::class, EloquentBlockFavoriteAdapter::class);
        $this->app->bind(BlockPackRepository::class, EloquentBlockPackRepository::class);
        $this->app->singleton(
            BlockPackReleaseSourcePort::class,
            fn (): GitHubReleaseSourceAdapter => new GitHubReleaseSourceAdapter,
        );
        $this->app->bind(BlockUsagePort::class, EloquentBlockUsageAdapter::class);
        $this->app->bind(BlockPackAssetUrlPort::class, LaravelBlockPackAssetUrlAdapter::class);
        $this->app->singleton(BlockCompilerRegistry::class);
        $this->app->singleton(BlockSchemaRegistry::class);
        $this->app->singleton(BlockPackProviderLoaderPort::class, SignedBlockPackProviderLoader::class);
        $this->app->singleton(
            BlockPackArchivePort::class,
            fn (): ZipBlockPackArchiveAdapter => new ZipBlockPackArchiveAdapter(
                storage_path('app/g7-page-builder/block-packs'),
                $this->app->make(BlockPackSignatureVerifierPort::class),
            ),
        );
        $this->app->singleton(
            BlockPackSignatureVerifierPort::class,
            function (): Ed25519BlockPackSignatureVerifier {
                $keys = config('g7-page-builder.block-packs.trusted_publishers', []);

                return new Ed25519BlockPackSignatureVerifier($keys);
            },
        );
        $this->app->bind(BlockCatalogService::class);
        $this->app->singleton(BlockRegistry::class, function (): BlockRegistry {
            $registry = new BlockRegistry;
            $registry->register(
                (new BuiltInBlockPackLoader)->load(dirname(__DIR__, 2)),
                enabled: true,
            );
            $installations = $this->app->make(BlockPackRepository::class)->all();
            foreach ($installations as $installation) {
                if (in_array($installation->state->value, ['retired', 'quarantined'], true)) {
                    continue;
                }
                $registry->register($installation->manifest);
            }
            foreach ($installations as $installation) {
                if ($installation->state->value === 'enabled') {
                    $registry->enable($installation->manifest->packId, $installation->manifest->packVersion);
                }
            }
            foreach ($installations as $installation) {
                if ($installation->state->value === 'disabled'
                    && $registry->resolvedVersion($installation->manifest->packId) === null) {
                    $registry->retain($installation->manifest->packId, $installation->manifest->packVersion);
                }
            }

            return $registry;
        });
        $this->app->singleton(BlockPackManager::class, fn (): BlockPackManager => new BlockPackManager(
            packs: $this->app->make(BlockPackRepository::class),
            archives: $this->app->make(BlockPackArchivePort::class),
            usage: $this->app->make(BlockUsagePort::class),
            registry: $this->app->make(BlockRegistry::class),
            pageBuilderVersion: $this->moduleVersion(),
            g7Version: '7.0.7',
            runtimes: $this->app->make(BlockPackRuntimeRegistry::class),
        ));
        $this->app->singleton(BlockPackRuntimeRegistry::class, function (): BlockPackRuntimeRegistry {
            $runtimes = new BlockPackRuntimeRegistry(
                $this->app->make(BlockPackProviderLoaderPort::class),
                $this->app->make(BlockCompilerRegistry::class),
                $this->app->make(BlockSchemaRegistry::class),
            );
            foreach ($this->app->make(BlockPackRepository::class)->all() as $installation) {
                if ($installation->manifest->kind === 'code'
                    && $this->app->make(BlockRegistry::class)->resolvedVersion($installation->manifest->packId)
                        === $installation->manifest->packVersion) {
                    $runtimes->activate($installation);
                }
            }

            return $runtimes;
        });
        $this->app->bind(GitHubBlockPackService::class);
        $this->app->singleton(
            DocumentCompilerPort::class,
            function (): HtmlDocumentCompiler {
                $this->app->make(BlockPackRuntimeRegistry::class);

                return new HtmlDocumentCompiler(
                    $this->app->make(BlockRegistry::class),
                    $this->app->make(BlockCompilerRegistry::class),
                    $this->app->make(BlockSchemaRegistry::class),
                    $this->app->make(BlockPackAssetUrlPort::class),
                );
            },
        );
        $this->app->bind(MediaPort::class, LaravelMediaAdapter::class);
        $this->app->bind(OfficialStoreSourcePort::class, LaravelOfficialStoreSourceAdapter::class);
        $this->app->singleton(PageKitArchivePort::class, ZipPageKitArchiveAdapter::class);
        $this->app->singleton(OfficialStoreService::class, function (): OfficialStoreService {
            return new OfficialStoreService(
                source: $this->app->make(OfficialStoreSourcePort::class),
                pageKits: $this->app->make(PageKitArchivePort::class),
                blockPacks: $this->app->make(BlockPackManager::class),
                blocks: $this->app->make(BlockRegistry::class),
                pages: $this->app->make(PageBuilderService::class),
                media: $this->app->make(MediaPort::class),
                routes: $this->app->make(RouteCatalogPort::class),
                pageBuilderVersion: $this->moduleVersion(),
                g7Version: '7.0.7',
            );
        });
        $this->app->bind(SitePartRepository::class, EloquentSitePartRepository::class);
        $this->app->bind(SiteShellPort::class, EloquentSiteShellAdapter::class);
    }

    public function boot(): void
    {
        $moduleRoot = dirname(__DIR__, 2);
        $kernel = $this->app->make(HttpKernelContract::class);

        if ($kernel instanceof HttpKernel) {
            // auth:sanctum/permission 응답을 모듈 canonical envelope로 감싸야 합니다.
            $kernel->prependToMiddlewarePriority(CanonicalApiAccessResponse::class);
        }

        $this->loadViewsFrom($moduleRoot.'/resources/views', 'g7-page-builder');
        $this->app->make(G7TemplateRouteBridge::class)->register();

        $router = $this->app->make(Router::class);
        $router->prependMiddlewareToGroup('web', PageBuilderHomeOverride::class);

        Route::middleware('web')
            ->get('pages/{slug}', [ViewerController::class, 'show'])
            ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
            ->name('web.page-builder.public');

        Route::middleware(['web', 'throttle:10,1'])
            ->post('pages/{slug}/inquiries', [FormSubmissionController::class, 'store'])
            ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
            ->name('web.page-builder.inquiries.store');

        Route::middleware('web')
            ->get('modules/jiwonpapa-page_builder/block-packs/{publisher}/{pack}/{version}/{path}', [BlockPackAssetController::class, 'show'])
            ->where([
                'publisher' => '[A-Za-z0-9][A-Za-z0-9._-]{0,99}',
                'pack' => '[A-Za-z0-9][A-Za-z0-9._-]{0,99}',
                'version' => '[0-9A-Za-z.+-]+',
                'path' => '.*',
            ])
            ->name('web.page-builder.block-pack-asset');

        // G7 7.0.7의 user SPA catch-all보다 먼저 독립 Web viewer를 등록해야 합니다.
        Route::prefix('modules/jiwonpapa-page_builder')
            ->name('web.modules.jiwonpapa-page_builder.')
            ->middleware('web')
            ->group($moduleRoot.'/src/routes/module-web.php');
    }

    private function moduleVersion(): string
    {
        $module = json_decode((string) file_get_contents(dirname(__DIR__, 2).'/module.json'), true);

        return is_array($module) && is_string($module['version'] ?? null)
            ? $module['version']
            : '0.0.0';
    }
}
