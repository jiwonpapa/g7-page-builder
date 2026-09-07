<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\TestCase;

final class BasicElementNullableInputTest extends TestCase
{
    use CreatesBuiltInCompiler;

    private function document(): array
    {
        $payload = json_decode((string) file_get_contents(dirname(__DIR__).'/Contract/document-basic-elements-v2.fixture.json'), true, flags: JSON_THROW_ON_ERROR);
        $leaves = &$payload['blocks'][0]['slots']['content'][0]['slots']['column1'][0]['slots']['content'];
        $leaves[0]['props']['decorative'] = true;
        $leaves[0]['props']['label'] = null;
        $leaves[2]['props']['icon'] = null;

        return $payload;
    }

    public function test_request_normalized_optional_values_compile_after_reentry(): void
    {
        $document = PageBuilderDocument::fromArray($this->document());
        $html = (string) $this->builtInCompiler()->compile($document, 1, 'html', 'g7-7.0.7')->artifact;
        self::assertStringContainsString('aria-hidden="true"', $html);
        self::assertStringNotContainsString('role="img"', $html);
        self::assertStringContainsString('<span>새 소식</span></span>', $html);
        self::assertSame(1, substr_count($html, 'data-g7pb-runtime-icon'));
    }

    public function test_meaningful_icon_still_requires_a_nonempty_accessible_name(): void
    {
        $payload = $this->document();
        $payload['blocks'][0]['slots']['content'][0]['slots']['column1'][0]['slots']['content'][0]['props']['decorative'] = false;
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }

    public function test_missing_optional_value_field_is_not_silently_accepted(): void
    {
        $payload = $this->document();
        unset($payload['blocks'][0]['slots']['content'][0]['slots']['column1'][0]['slots']['content'][2]['props']['icon']);
        $this->expectException(DocumentCompileException::class);
        $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($payload), 1, 'html', 'g7-7.0.7');
    }
}
