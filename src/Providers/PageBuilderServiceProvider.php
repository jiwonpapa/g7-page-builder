<?php

namespace Modules\Jiwonpapa\PageBuilder\Providers;

use Illuminate\Contracts\Http\Kernel as HttpKernelContract;
use Illuminate\Foundation\Http\Kernel as HttpKernel;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\MediaPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\PageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\CanonicalApiAccessResponse;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware\PageBuilderHomeOverride;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Media\LaravelMediaAdapter;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;

final class PageBuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PageBuilderRepository::class, EloquentPageBuilderRepository::class);
        $this->app->singleton(DocumentCompilerPort::class, HtmlDocumentCompiler::class);
        $this->app->bind(MediaPort::class, LaravelMediaAdapter::class);
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

        $router = $this->app->make(Router::class);
        $router->prependMiddlewareToGroup('web', PageBuilderHomeOverride::class);

        Route::middleware('web')
            ->get('pages/{slug}', [ViewerController::class, 'show'])
            ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
            ->name('web.page-builder.public');

        // G7 7.0.7의 user SPA catch-all보다 먼저 독립 Web viewer를 등록해야 합니다.
        Route::prefix('modules/jiwonpapa-page_builder')
            ->name('web.modules.jiwonpapa-page_builder.')
            ->middleware('web')
            ->group($moduleRoot.'/src/routes/module-web.php');
    }
}
