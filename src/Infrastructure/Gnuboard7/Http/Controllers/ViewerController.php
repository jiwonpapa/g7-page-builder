<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;

final class ViewerController
{
    public function __construct(private readonly PageBuilderService $service) {}

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

    public function preview(string $token): Response
    {
        $page = $this->service->renderPreview($token);

        if ($page === null) {
            abort(404);
        }

        return response()
            ->view('g7-page-builder::viewer', [
                'page' => $page,
                'rootTestId' => 'page-builder-preview-root',
                'canonicalUrl' => null,
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

        $etag = '"'.$page->representationSha256().'"';

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
                'canonicalUrl' => url('/pages/'.$page->slug),
            ])
            ->header('Cache-Control', 'public, no-cache, must-revalidate')
            ->header('ETag', $etag)
            ->header('Content-Security-Policy', $this->contentSecurityPolicy());
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
        return "default-src 'none'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
    }
}
