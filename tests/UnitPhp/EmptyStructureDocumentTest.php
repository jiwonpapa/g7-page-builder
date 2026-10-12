<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Documents\DocumentStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\EmptyStructureDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

final class EmptyStructureDocumentTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(
            json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR),
        );
    }

    /** @return array<string, array{kind: string, value: string}> */
    private function tokens(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), true, flags: JSON_THROW_ON_ERROR)['tokens'];
    }

    /** @return iterable<string, array{string}> */
    public static function shells(): iterable
    {
        foreach (['template', 'builder', 'none'] as $shell) {
            yield $shell => [$shell];
        }
    }

    #[DataProvider('shells')]
    public function test_empty_document_is_valid_without_any_catalog_or_builtin_block(string $shell): void
    {
        $validator = $this->validator();
        $document = (new EmptyStructureDocument($validator))->create('00000000-0000-4000-8000-000000000001', 'empty', 'ko', $this->tokens(), $shell);
        $payload = $document->toArray();
        self::assertSame('g7-page-builder/v3', $payload['schema_version']);
        self::assertSame($shell, $document->shellMode);
        self::assertSame([], $payload['blocks']);
        self::assertSame([], $payload['assets']);
        self::assertInstanceOf(stdClass::class, $payload['tokens']);
        self::assertSame($this->tokens(), json_decode(json_encode($payload['tokens'], JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR));
        $codec = new DocumentStorageCodec($validator);
        self::assertSame($document->toJson(), $codec->encodeRevision($codec->decodeStored($document->toJson())));
    }

    public function test_default_shell_and_fresh_documents_preserve_caller_identity_without_shared_state(): void
    {
        $factory = new EmptyStructureDocument($this->validator());
        $tokens = $this->tokens();
        $first = $factory->create('00000000-0000-4000-8000-000000000001', 'first', 'ko', $tokens);
        $second = $factory->create('00000000-0000-4000-8000-000000000002', 'second', 'en', $tokens);
        self::assertSame('template', $first->shellMode);
        self::assertSame('first', $first->slug);
        self::assertSame('ko', $first->locale);
        self::assertNotSame($first->documentId, $second->documentId);
        $snapshot = $first->toArray();
        $snapshot['tokens']->changed = true;
        $tokens['text']['value'] = '#000000';
        self::assertFalse(property_exists($first->toArray()['tokens'], 'changed'));
        self::assertFalse(property_exists($second->toArray()['tokens'], 'changed'));
        self::assertSame($this->tokens()['text']['value'], $first->toArray()['tokens']->text->value);
        self::assertSame($this->tokens()['text']['value'], $second->toArray()['tokens']->text->value);
    }

    /** @return iterable<string, array{string, string, string, string}> */
    public static function invalidMetadata(): iterable
    {
        $id = '00000000-0000-4000-8000-000000000001';
        yield 'invalid identity' => ['bad', 'empty', 'ko', 'template'];
        yield 'invalid slug' => [$id, '../empty', 'ko', 'template'];
        yield 'invalid locale' => [$id, 'empty', 'bad locale', 'template'];
        yield 'unsupported shell' => [$id, 'empty', 'ko', 'global'];
    }

    #[DataProvider('invalidMetadata')]
    public function test_metadata_uses_the_shared_validator_without_silent_defaults(string $id, string $slug, string $locale, string $shell): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new EmptyStructureDocument($this->validator()))->create($id, $slug, $locale, $this->tokens(), $shell);
    }

    public function test_incomplete_palette_is_rejected_not_replaced_with_hidden_catalog_defaults(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new EmptyStructureDocument($this->validator()))->create('00000000-0000-4000-8000-000000000001', 'empty', 'ko', []);
    }
}
