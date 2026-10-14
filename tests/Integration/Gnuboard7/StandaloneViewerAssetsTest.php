<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\UrlGenerator as UrlGeneratorContract;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Routing\RouteCollection;
use Illuminate\Routing\UrlGenerator;
use Illuminate\View\Compilers\BladeCompiler;
use PHPUnit\Framework\TestCase;

final class StandaloneViewerAssetsTest extends TestCase
{
    private Container $previousContainer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousContainer = Container::getInstance();
        $container = new Container;
        Container::setInstance($container);
        $container->instance(UrlGeneratorContract::class, new UrlGenerator(new RouteCollection, Request::create('https://g7pb.test')));
        $container->instance('session', new class
        {
            public function token(): string
            {
                return 'owned-viewer-test-token';
            }
        });
    }

    protected function tearDown(): void
    {
        Container::setInstance($this->previousContainer);
        parent::tearDown();
    }

    public function test_system_only_artifacts_load_one_fixed_runtime_in_preview_and_public_views(): void
    {
        foreach (['account', 'search', 'cart', 'notifications', 'theme', 'locale', 'currency'] as $kind) {
            $artifact = '<div data-v3-system="'.$kind.'" data-g7pb-system-controls=""></div>';
            foreach (['page-builder-preview-root', 'page-builder-public-root'] as $root) {
                $html = $this->render($artifact, $root);
                self::assertSame(1, substr_count($html, '/dist/js/page-effects.iife.js'));
                self::assertStringContainsString($artifact, $html);
                self::assertStringContainsString('data-testid="'.$root.'"', $html);
            }
        }
    }

    public function test_static_artifacts_do_not_start_an_unneeded_runtime(): void
    {
        $html = $this->render('<p>Static content</p><img src="/owned.webp" alt="Image">');
        self::assertStringNotContainsString('/dist/js/page-effects.iife.js', $html);
        self::assertStringContainsString('Static content', $html);
    }

    public function test_existing_interactive_markers_still_load_the_runtime_once(): void
    {
        foreach (['data-g7pb-motion="fade"', 'data-g7pb-slider', 'data-g7pb-data-source="posts"',
            'data-g7pb-visibility-audience="member"', 'data-g7pb-inquiry-form', 'data-g7pb-accordion',
            'data-g7pb-tabs', 'data-g7pb-runtime-icon', 'data-g7pb-embed', 'data-g7pb-form-control',
            'data-g7pb-runtime-button'] as $marker) {
            self::assertSame(1, substr_count($this->render('<div '.$marker.'></div>'), '/dist/js/page-effects.iife.js'));
        }
    }

    private function render(string $artifact, string $rootTestId = 'page-builder-preview-root'): string
    {
        $source = file_get_contents(__DIR__.'/../../../resources/views/viewer.blade.php');
        self::assertIsString($source);
        $compiled = (new BladeCompiler(new Filesystem, sys_get_temp_dir()))->compileString($source);
        $render = static function () use ($compiled, $artifact, $rootTestId): void {
            $page = (object) ['locale' => 'ko', 'title' => 'Viewer fixture', 'seo' => null,
                'artifact' => $artifact, 'artifactSha256' => hash('sha256', $artifact)];
            $canonicalUrl = '';
            $siteShell = null;
            $siteHeaderHtml = '';
            $siteFooterHtml = '';
            $siteRuntimeConfig = ['commerceAvailable' => false];
            eval('?>'.$compiled);
        };
        ob_start();
        try {
            $render();

            return (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }
    }
}
