<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\DocumentCompilerRouter;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\HtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\ResponsiveStyles;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentV3CompilerTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    private function fixture(): stdClass
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
    }

    private function source(stdClass $document): ValidatedDocument
    {
        return ValidatedDocument::fromJson(json_encode($document, JSON_THROW_ON_ERROR), $this->validator());
    }

    public function test_canonical_source_compiles_deterministically_without_a_catalog_for_every_shell(): void
    {
        $compiler = new HtmlCompiler($this->validator());
        foreach (['none', 'builder', 'template'] as $mode) {
            $fixture = $this->fixture();
            $fixture->shell_mode = $mode;
            $fixture->blocks[0]->name = '등록한 적 없는 구성';
            $fixture->blocks[0]->slots->content[0]->style->hidden = true;
            $source = $this->source($fixture);
            $json = $source->toJson();
            $result = $compiler->compile($source, 7, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
            self::assertSame(7, $result->sourceRevision);
            self::assertSame('1.0.0', $result->compilerVersion);
            self::assertSame($json, $source->toJson());
            self::assertIsString($result->artifact);
            self::assertSame(hash('sha256', $result->artifact), $result->artifactSha256);
            self::assertSame($result->artifact, $compiler->compile($source, 7, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION)->artifact);
            self::assertSame(5, substr_count($result->artifact, 'data-v3-node='));
            self::assertStringContainsString('--g7pb-v3-base-display:none;', $result->artifact);
            self::assertStringContainsString('--g7pb-v3-mobile-display:block;', $result->artifact);
            self::assertStringContainsString('--g7pb-v3-mobile-opacity:0;', $result->artifact);
            self::assertStringNotContainsString('<style', $result->artifact);
            self::assertStringNotContainsString('<script', $result->artifact);
            $fixture->blocks = [];
            self::assertStringNotContainsString('data-v3-node=', $compiler->compile($this->source($fixture), 8, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION)->artifact);
        }
    }

    public function test_common_behaviors_preserve_identity_and_use_existing_safe_button_markers(): void
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach (['tabs', 'disclosure', 'carousel', 'nested'] as $kind) {
            $fixture = $this->fixture();
            $fixture->blocks = $cases->behavior_fixtures->{$kind};
            $result = (new HtmlCompiler($this->validator()))->compile($this->source($fixture), 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
            self::assertStringContainsString('data-g7pb-control-ids="stable"', $result->artifact);
            self::assertStringContainsString('data-g7pb-runtime-button=""', $result->artifact);
            self::assertStringNotContainsString('<button', $result->artifact);
            self::assertStringContainsString('aria-controls="node-', $result->artifact);
        }
    }

    public function test_every_generated_property_has_static_breakpoint_transport(): void
    {
        $css = file_get_contents(__DIR__.'/../../resources/css/page-builder-v3-public.css');
        $cases = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3-presentation.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($cases as $case) {
            $fixture = $this->fixture();
            $target = $fixture->blocks[0]->slots->content[0];
            $fixture->blocks[0]->slots->content = [$target];
            $fixture->blocks[0]->style = $case->parent ?? new stdClass;
            $fixture->blocks[0]->responsive = new stdClass;
            $target->style = $case->style;
            $target->responsive = new stdClass;
            $valid = $this->validator()->validateJson($this->source($fixture)->toJson());
            $projection = ResponsiveStyles::document($valid, $this->validator());
            foreach ($projection['attributes'] as $attrs) {
                foreach (explode(' ', $attrs['data-g7pb-v3-style']) as $key) {
                    foreach (['base', 'tablet', 'mobile'] as $viewport) {
                        self::assertStringContainsString('--g7pb-v3-current-'.$key.': var(--g7pb-v3-'.$viewport.'-'.$key.')', $css, $case->name);
                    }
                }
            }
        }
    }

    public function test_shorthand_switches_do_not_erase_gradients_or_borders(): void
    {
        $styles = ResponsiveStyles::longhands(['border-width' => '0', 'border-left' => '3px solid #112233',
            'background' => 'linear-gradient(90deg,#112233 0%,#ffffff 100%)']);
        self::assertSame('3px', $styles['border-left-width']);
        self::assertSame('solid', $styles['border-left-style']);
        self::assertSame('0', $styles['border-right-width']);
        self::assertSame('transparent', $styles['background-color']);
        self::assertSame('linear-gradient(90deg,#112233 0%,#ffffff 100%)', $styles['background-image']);
        self::assertSame('none', ResponsiveStyles::longhands(['background' => '#ffffff'])['background-image']);
    }

    public function test_schema_router_preserves_legacy_output_and_selects_elements_without_conversion(): void
    {
        $legacy = new HtmlDocumentCompiler(new BlockRegistry);
        $elements = new HtmlCompiler($this->validator());
        $router = new DocumentCompilerRouter($legacy, $elements);
        $source = PageBuilderDocument::fromArray(json_decode(file_get_contents(__DIR__.'/../Contract/document-v1.fixture.json'), true, flags: JSON_THROW_ON_ERROR));
        $empty = new PageBuilderDocument($source->documentId, $source->slug, $source->mode, $source->locale, $source->tokens, []);
        self::assertEquals($legacy->compile($empty, 2, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION),
            $router->compile($empty, 2, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION));
        $v3 = $this->source($this->fixture());
        self::assertEquals($elements->compile($v3, 3, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION),
            $router->compile($v3, 3, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION));
        self::assertTrue($router->supports('html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION));
        self::assertFalse($router->supports('html', 'unsupported'));
        self::assertFalse($router->supports('g7-json-ui', HtmlDocumentCompiler::TARGET_ENGINE_VERSION));
        $this->expectException(DocumentCompileException::class);
        $elements->compile($empty, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
    }

    public function test_unknown_target_fails_before_returning_an_artifact(): void
    {
        $this->expectException(DocumentCompileException::class);
        (new HtmlCompiler($this->validator()))->compile($this->source($this->fixture()), 1, 'html', 'unsupported');
    }

    public function test_generic_publication_never_resolves_an_unavailable_legacy_catalog(): void
    {
        $router = new DocumentCompilerRouter(static function () {
            throw new \RuntimeException('Optional block pack unavailable');
        }, new HtmlCompiler($this->validator()));
        self::assertTrue($router->supports('html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION));
        $source = $this->source($this->fixture());
        self::assertStringContainsString('data-g7pb-v3-public', $router->compile($source, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION)->artifact);
    }
}
