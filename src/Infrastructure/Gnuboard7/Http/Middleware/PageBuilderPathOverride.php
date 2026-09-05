<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Domain\Routing\PagePath;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\ViewerController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing\G7PageRouteRegistry;
use Symfony\Component\HttpFoundation\Response;

final class PageBuilderPathOverride
{
    public function __construct(private readonly G7PageRouteRegistry $paths, private readonly ViewerController $viewer) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('GET') && ! $request->isMethod('HEAD')) {
            return $next($request);
        }
        try {
            $path = PagePath::normalize($request->getPathInfo());
            if ($path !== $request->getPathInfo()) {
                return $next($request);
            }
        } catch (\InvalidArgumentException) {
            return $next($request);
        }
        try {
            $slug = $this->paths->publishedSlug($path);
        } catch (\Throwable $exception) {
            Log::warning('Page Builder custom path was skipped.', ['exception' => $exception]);

            return $next($request);
        }

        return $slug === null ? $next($request) : $this->viewer->show($request, $slug);
    }
}
