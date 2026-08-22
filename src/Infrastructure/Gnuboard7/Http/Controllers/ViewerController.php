<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use App\Seo\SeoMiddleware;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Application\SiteShellService;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\RenderedPage;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShellSnapshot;
use Symfony\Component\HttpFoundation\Response;

final class ViewerController
{
    public function __construct(
        private readonly PageBuilderService $service,
        private readonly SiteShellService $siteShellService,
        private readonly SitePartService $sitePartService,
        private readonly SitePartHtmlCompiler $sitePartCompiler,
        private readonly ?SeoMiddleware $seo = null,
    ) {}

    public function manager(): Response
    {
        return response()
            ->view('g7-page-builder::manager', [
                'locale' => app()->getLocale(),
            ])
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }

    public function editor(Request $request): Response
    {
        $documentId = $request->query('document');

        if (! is_string($documentId) || preg_match('/^[0-9a-f-]{36}$/i', $documentId) !== 1) {
            $documentId = '';
        }

        return response()
            ->view('g7-page-builder::editor', [
                'documentId' => $documentId,
                'locale' => app()->getLocale(),
            ])
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }

    public function sitePartEditor(string $kind): Response
    {
        if (! in_array($kind, ['header', 'footer'], true)) {
            abort(404);
        }

        return response()
            ->view('g7-page-builder::site-part-editor', [
                'kind' => $kind,
                'locale' => app()->getLocale(),
            ])
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }

    public function preview(Request $request, string $token): Response
    {
        if ($request->query('shell') === 'template') {
            return $this->templateApp($request, true);
        }

        $page = $this->service->renderPreview($token);

        if ($page === null) {
            abort(404);
        }

        $siteShell = $this->siteShell($page);
        $siteHeader = $this->sitePart('header', $page);
        $siteFooter = $this->sitePart('footer', $page);

        return response()
            ->view('g7-page-builder::viewer', [
                'page' => $page,
                'rootTestId' => 'page-builder-preview-root',
                'canonicalUrl' => null,
                'siteShell' => $siteShell?->shell,
                'siteHeaderHtml' => $siteHeader?->html,
                'siteFooterHtml' => $siteFooter?->html,
            ])
            ->header('Cache-Control', 'no-store')
            ->header('Pragma', 'no-cache')
            ->header('X-Robots-Tag', 'noindex, nofollow')
            ->header('Content-Security-Policy', $this->contentSecurityPolicy());
    }

    public function show(Request $request, string $slug): Response
    {
        $page = $this->service->findPublished($slug);

        if ($page === null) {
            abort(404);
        }

        if ($page->shellMode === 'template') {
            return $this->templateApp($request, false, $page);
        }

        $siteShell = $this->siteShell($page);
        $siteHeader = $this->sitePart('header', $page);
        $siteFooter = $this->sitePart('footer', $page);
        $etag = '"'.$this->representationSha256($page, $siteShell, $siteHeader, $siteFooter).'"';

        if ($request->header('If-None-Match') === $etag) {
            $notModified = response('', 304)
                ->header('Cache-Control', 'public, no-cache, must-revalidate')
                ->header('ETag', $etag)
                ->header('Content-Security-Policy', $this->contentSecurityPolicy());

            return $this->withRobotsHeader($notModified, $page);
        }

        $response = response()
            ->view('g7-page-builder::viewer', [
                'page' => $page,
                'rootTestId' => 'page-builder-public-root',
                'canonicalUrl' => url('/pages/'.$page->slug),
                'siteShell' => $siteShell?->shell,
                'siteHeaderHtml' => $siteHeader?->html,
                'siteFooterHtml' => $siteFooter?->html,
            ])
            ->header('Cache-Control', 'public, no-cache, must-revalidate')
            ->header('ETag', $etag)
            ->header('Content-Security-Policy', $this->contentSecurityPolicy());

        return $this->withRobotsHeader($response, $page);
    }

    public function legacy(string $slug): RedirectResponse
    {
        if ($this->service->findPublished($slug) === null) {
            abort(404);
        }

        return new RedirectResponse(url('/pages/'.$slug), 301);
    }

    private function contentSecurityPolicy(): string
    {
        return "default-src 'none'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src https://www.openstreetmap.org https://www.google.com https://www.youtube-nocookie.com https://player.vimeo.com; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
    }

    private function siteShell(RenderedPage $page): ?SiteShellSnapshot
    {
        if (! in_array($page->shellMode, ['builder', 'global'], true)) {
            return null;
        }

        try {
            return $this->siteShellService->get($page->locale);
        } catch (\Throwable $exception) {
            Log::warning('Page Builder site shell was skipped.', ['exception' => $exception]);

            return null;
        }
    }

    private function sitePart(string $kind, RenderedPage $page): ?SitePartArtifact
    {
        if (! in_array($page->shellMode, ['builder', 'global'], true)) {
            return null;
        }

        try {
            $snapshot = $this->sitePartService->published($kind, $page->locale);

            return $snapshot === null
                ? null
                : $this->sitePartCompiler->compile($snapshot->document, $snapshot->revision);
        } catch (\Throwable $exception) {
            Log::warning('Page Builder Site Part was skipped.', [
                'kind' => $kind,
                'locale' => $page->locale,
                'exception' => $exception,
            ]);

            return null;
        }
    }

    private function representationSha256(
        RenderedPage $page,
        ?SiteShellSnapshot $siteShell,
        ?SitePartArtifact $siteHeader,
        ?SitePartArtifact $siteFooter,
    ): string {
        $shellSha256 = $siteShell instanceof SiteShellSnapshot
            ? $siteShell->shell->representationSha256()
            : '';

        return hash('sha256', implode(':', [
            $page->representationSha256(),
            $siteHeader instanceof SitePartArtifact ? $siteHeader->artifactSha256 : $shellSha256,
            $siteFooter instanceof SitePartArtifact ? $siteFooter->artifactSha256 : $shellSha256,
        ]));
    }

    private function templateApp(Request $request, bool $preview, ?RenderedPage $page = null): Response
    {
        $next = static fn (): Response => response()->view('app');
        $response = ! $preview && $this->seo instanceof SeoMiddleware
            ? $this->seo->handle($request, $next)
            : $next();

        $response->headers->set('Cache-Control', $preview ? 'no-store' : 'public, no-cache, must-revalidate');
        if ($preview) {
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        if (! $preview && $page instanceof RenderedPage && $page->seo?->robots === 'noindex') {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }

    private function withRobotsHeader(Response $response, RenderedPage $page): Response
    {
        if ($page->seo?->robots === 'noindex') {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }
}
