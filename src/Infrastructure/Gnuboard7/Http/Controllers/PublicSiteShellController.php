<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;

final class PublicSiteShellController
{
    public function __construct(
        private readonly SitePartService $siteParts,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $explicitLocale = $request->query->has('locale');
        $locale = $explicitLocale ? $request->query('locale') : app()->getLocale();
        if (! is_string($locale) || preg_match('/^[a-z]{2,3}(?:-[A-Z]{2})?$/', $locale) !== 1) {
            return $this->disabled('invalid-locale');
        }

        try {
            $published = $this->siteParts->publishedSet($locale);
            if ($published === null || $published->header === null || $published->footer === null) {
                return $this->disabled('not-published');
            }

            $headerArtifact = $published->header;
            $footerArtifact = $published->footer;
            $representation = hash('sha256', implode(':', [
                $locale,
                $headerArtifact->artifactSha256,
                $footerArtifact->artifactSha256,
            ]));

            return response()->json([
                'success' => true,
                'message' => '발행된 공통 Site Shell을 조회했습니다.',
                'data' => [
                    'shell' => [
                        'enabled' => true,
                        'locale' => $locale,
                        'header_html' => $headerArtifact->html,
                        'footer_html' => $footerArtifact->html,
                        'artifact_sha256' => $representation,
                        'compiler_version' => $headerArtifact->compilerVersion,
                        'footer_compiler_version' => $footerArtifact->compilerVersion,
                        'header_revision' => $headerArtifact->sourceRevision,
                        'footer_revision' => $footerArtifact->sourceRevision,
                    ],
                ],
            ], 200, [
                // G7 may negotiate locale from an authenticated user's preference.
                // Only an explicit locale URL is safe for shared cache reuse.
                'Cache-Control' => $explicitLocale ? 'public, max-age=30, stale-while-revalidate=300' : 'no-store',
                'Vary' => 'Accept-Language',
                'ETag' => '"'.$representation.'"',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\Throwable $exception) {
            Log::warning('Page Builder public Site Shell fell back to the native template shell.', [
                'locale' => $locale,
                'exception' => $exception,
            ]);

            return $this->disabled('unavailable');
        }
    }

    private function disabled(string $reason): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => '활성 공통 Site Shell이 없어 기본 템플릿 셸을 사용합니다.',
            'data' => [
                'shell' => [
                    'enabled' => false,
                    'header_html' => '',
                    'footer_html' => '',
                    'reason' => $reason,
                ],
            ],
        ], 200, [
            'Cache-Control' => 'no-store',
            'Vary' => 'Accept-Language',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
