<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;

final class PublicSiteShellController
{
    public function __construct(
        private readonly SitePartService $siteParts,
        private readonly SitePartHtmlCompiler $compiler,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $locale = $request->query('locale', $request->getLocale());
        if (! is_string($locale) || preg_match('/^[a-z]{2,3}(?:-[A-Z]{2})?$/', $locale) !== 1) {
            return $this->disabled('invalid-locale');
        }

        try {
            $header = $this->siteParts->published('header', $locale);
            $footer = $this->siteParts->published('footer', $locale);
            if ($header === null || $footer === null) {
                return $this->disabled('not-published');
            }

            $headerArtifact = $this->compiler->compile($header->document, $header->revision);
            $footerArtifact = $this->compiler->compile($footer->document, $footer->revision);
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
                        'compiler_version' => SitePartHtmlCompiler::COMPILER_VERSION,
                        'header_revision' => $header->revision,
                        'footer_revision' => $footer->revision,
                    ],
                ],
            ], 200, [
                'Cache-Control' => 'public, no-cache, must-revalidate',
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
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
