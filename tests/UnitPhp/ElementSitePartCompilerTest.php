<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\HtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartValidator;
use PHPUnit\Framework\TestCase;

final class ElementSitePartCompilerTest extends TestCase
{
    private function schema(string $name): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../schemas/'.$name.'.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    private function document(string $kind): ElementSitePartDocument
    {
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/site-part-v2.fixture.json'), flags: JSON_THROW_ON_ERROR)->source;
        $source->kind = $kind;

        return ElementSitePartDocument::fromJson(json_encode($source, JSON_THROW_ON_ERROR), new ElementSitePartValidator(
            $this->schema('site-part-v2.schema'), $this->schema('page-builder-document-v3.schema'), $this->schema('design-policy-v3'),
        ));
    }

    public function test_both_parts_wrap_the_identical_generic_page_compilation_with_valid_digests(): void
    {
        $pageCompiler = new HtmlCompiler(new Validator($this->schema('page-builder-document-v3.schema'), $this->schema('design-policy-v3')));
        $compiler = new SitePartHtmlCompiler($pageCompiler);
        foreach (['header', 'footer'] as $kind) {
            $document = $this->document($kind);
            $source = $document->toJson();
            $page = $pageCompiler->compile($document->content, 3, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
            $part = $compiler->compile($document, 3);
            self::assertSame('<'.$kind.' data-g7pb-element-site-part="'.$kind.'">'.$page->artifact.'</'.$kind.'>', $part->html);
            self::assertSame($page->compilerVersion, $part->compilerVersion);
            self::assertSame(hash('sha256', $part->compilerVersion."\n".$part->html), $part->artifactSha256);
            self::assertSame(3, $part->sourceRevision);
            self::assertSame($source, $document->toJson());
            self::assertStringContainsString('data-g7pb', $part->html);
        }
    }

    public function test_missing_element_compiler_does_not_fall_back_to_a_legacy_block_renderer(): void
    {
        $this->expectException(DocumentCompileException::class);
        $this->expectExceptionMessage('unavailable');
        (new SitePartHtmlCompiler)->compile($this->document('header'), 1);
    }
}
