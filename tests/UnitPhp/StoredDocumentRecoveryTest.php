<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageDesignTokens;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class StoredDocumentRecoveryTest extends TestCase
{
    use CreatesBuiltInCompiler;

    #[DataProvider('historicalColorValues')]
    public function test_stored_documents_preserve_values_but_cannot_be_compiled(string $name, mixed $value): void
    {
        $payload = $this->payload();
        $payload['tokens'][$name] = $value;
        $stored = PageBuilderDocument::fromStoredArray($payload);

        self::assertSame($payload['tokens'], $stored->tokens);
        self::assertSame($payload['tokens'], $stored->toArray()['tokens']);
        self::assertSame($payload['blocks'], $stored->blocks);
        $this->expectException(DocumentCompileException::class);
        $this->expectExceptionMessage('Page design token '.$name.' is invalid.');
        $this->builtInCompiler()->compile($stored, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
    }

    #[DataProvider('historicalColorValues')]
    public function test_new_array_documents_still_reject_historical_invalid_values(string $name, mixed $value): void
    {
        $payload = $this->payload();
        $payload['tokens'][$name] = $value;
        $this->expectException(\InvalidArgumentException::class);
        PageBuilderDocument::fromArray($payload);
    }

    public function test_raw_array_constructor_remains_strict(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new PageBuilderDocument('00000000-0000-4000-8000-000000000001', 'recovery', 'canvas', 'ko', ['design.color_mode' => 'sepia'], []);
    }

    public function test_recovery_still_checks_required_document_fields_and_nested_structure(): void
    {
        $payload = $this->payload();
        $payload['tokens']['design.color_mode'] = 'sepia';
        $invalidSlug = $payload;
        $invalidSlug['slug'] = 'invalid slug';
        $duplicateNode = $payload;
        $duplicateNode['blocks'][0]['slots']['content'][0]['instance_id'] = $duplicateNode['blocks'][0]['instance_id'];
        $invalidSlots = $payload;
        $invalidSlots['blocks'][0]['slots'] = null;
        foreach ([$invalidSlug, $duplicateNode, $invalidSlots] as $invalid) {
            try {
                PageBuilderDocument::fromStoredArray($invalid);
                self::fail('Stored recovery bypassed document validation.');
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_valid_stored_documents_compile_identically_to_new_documents(): void
    {
        $payload = $this->payload();
        $compiler = $this->builtInCompiler();
        $new = $compiler->compile(PageBuilderDocument::fromArray($payload), 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
        $stored = $compiler->compile(PageBuilderDocument::fromStoredArray($payload), 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
        self::assertSame($new->artifact, $stored->artifact);
        self::assertSame($new->artifactSha256, $stored->artifactSha256);
    }

    /** @return iterable<string, array{string, mixed}> */
    public static function historicalColorValues(): iterable
    {
        yield 'color mode text' => ['design.color_mode', 'sepia'];
        yield 'color mode scalar' => ['design.color_mode', false];
        foreach (array_keys(PageDesignTokens::CUSTOM_COLOR_DEFAULTS) as $name) {
            yield $name => [$name, 'var(--historical-color)'];
        }
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        $source = file_get_contents(dirname(__DIR__).'/Contract/document-layout-v2.fixture.json');
        self::assertIsString($source);

        return json_decode($source, true, flags: JSON_THROW_ON_ERROR);
    }
}
