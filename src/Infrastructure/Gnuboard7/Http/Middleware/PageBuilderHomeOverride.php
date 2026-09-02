<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware;

use App\Seo\SeoMiddleware;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\EmbeddedFramePolicy;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\SiteShellRuntimeConfig;
use Symfony\Component\HttpFoundation\Response;

final class PageBuilderHomeOverride
{
    public function __construct(
        private readonly PageBuilderService $service,
        private readonly SiteShellService $siteShellService,
        private readonly ?SeoMiddleware $seo = null,
        private readonly ?SitePartService $sitePartService = null,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('GET') && ! $request->isMethod('HEAD')) {
            return $next($request);
        }

        if ($request->path() !== '/') {
            return $next($request);
        }

        try {
            $page = $this->service->findPublishedHome();
        } catch (\Throwable $exception) {
            // 모듈 업데이트 중에도 G7 기본 홈은 중단하지 않습니다.
            Log::warning('Page Builder home override was skipped.', [
                'exception' => $exception,
            ]);

            return $next($request);
        }
        if ($page === null) {
            return $next($request);
        }

        if ($page->shellMode === 'template') {
            $response = $this->seo instanceof SeoMiddleware
                ? $this->seo->handle($request, static fn (): Response => response()->view('app'))
                : response()->view('app');
            $response->headers->set('Cache-Control', 'public, no-cache, must-revalidate');

            return $response;
        }

        $siteShell = null;
        if (in_array($page->shellMode, ['builder', 'global'], true)) {
            try {
                $siteShell = $this->siteShellService->get($page->locale);
            } catch (\Throwable $exception) {
                Log::warning('Page Builder home site shell was skipped.', ['exception' => $exception]);
            }
        }
        $siteHeaderHtml = null;
        $siteFooterHtml = null;
        if (in_array($page->shellMode, ['builder', 'global'], true) && $this->sitePartService !== null) {
            try {
                $published = $this->sitePartService->publishedSet($page->locale);
                $siteHeaderHtml = $published?->header?->html;
                $siteFooterHtml = $published?->footer?->html;
            } catch (\Throwable $exception) {
                Log::warning('Page Builder home Site Parts were skipped.', ['exception' => $exception]);
            }
        }
        $runtimeConfig = (new SiteShellRuntimeConfig)->snapshot();
        $representation = ($siteShell === null
            ? $page->representationSha256()
            : hash('sha256', $page->representationSha256().$siteShell->shell->representationSha256()));
        $etag = '"'.hash('sha256', $representation.($siteHeaderHtml ?? '').($siteFooterHtml ?? '').json_encode($runtimeConfig, JSON_THROW_ON_ERROR)).'"';
        if ($request->header('If-None-Match') === $etag) {
            return response('', 304)
                ->header('Cache-Control', 'public, no-cache, must-revalidate')
                ->header('ETag', $etag)
                ->header('Content-Security-Policy', $this->contentSecurityPolicy());
        }

        return response()
            ->view('g7-page-builder::viewer', [
                'page' => $page,
                'rootTestId' => 'page-builder-public-root',
                'canonicalUrl' => url('/'),
                'siteShell' => $siteShell?->shell,
                'siteHeaderHtml' => $siteHeaderHtml,
                'siteFooterHtml' => $siteFooterHtml,
                'siteRuntimeConfig' => $runtimeConfig,
            ])
            ->header('Cache-Control', 'public, no-cache, must-revalidate')
            ->header('ETag', $etag)
            ->header('Content-Security-Policy', $this->contentSecurityPolicy());
    }

    private function contentSecurityPolicy(): string
    {
        return "default-src 'none'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; ".EmbeddedFramePolicy::directive()."; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
    }
}
