<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Documents\DocumentStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentStorageCodecTest extends TestCase
{
    private function codec(): DocumentStorageCodec
    {
        return new DocumentStorageCodec(new Validator(
            json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR),
        ));
    }

    private function fixture(string $name): string
    {
        $json = file_get_contents(__DIR__.'/../Contract/'.$name.'.fixture.json');
        self::assertIsString($json);

        return $json;
    }

    /** @return iterable<string, array{string}> */
    public static function legacyFixtures(): iterable
    {
        yield 'v1' => ['document-v1'];
        yield 'v2' => ['document-layout-v2'];
    }

    #[DataProvider('legacyFixtures')]
    public function test_legacy_documents_keep_their_existing_format_and_validation(string $fixture): void
    {
        $codec = $this->codec();
        $json = $this->fixture($fixture);
        $original = PageBuilderDocument::fromStoredArray(json_decode($json, true, flags: JSON_THROW_ON_ERROR));
        $stored = $codec->decodeStored($json);
        self::assertInstanceOf(PageBuilderDocument::class, $stored);
        self::assertSame($original->toArray(), $stored->toArray());
        $encoded = $codec->encodeRevision($stored);
        $draft = $codec->decodeDraft($encoded, $stored->documentId);
        self::assertInstanceOf(PageBuilderDocument::class, $draft);
        self::assertSame($original->toArray(), $draft->toArray());
        self::assertSame($original->toArray(), $codec->decodeStored($encoded)->toArray());
    }

    public function test_v3_round_trip_preserves_empty_objects_lists_and_responsive_values(): void
    {
        $codec = $this->codec();
        $source = json_decode($this->fixture('document-v3'), flags: JSON_THROW_ON_ERROR);
        $stored = $codec->decodeStored(json_encode($source, JSON_THROW_ON_ERROR));
        self::assertInstanceOf(ValidatedDocument::class, $stored);
        $encoded = $codec->encodeRevision($stored);
        self::assertEquals($source, json_decode($encoded, flags: JSON_THROW_ON_ERROR));
        $draft = $codec->decodeDraft($encoded, $stored->documentId);
        self::assertInstanceOf(ValidatedDocument::class, $draft);
        self::assertSame($encoded, $codec->encodeRevision($draft));
        $heading = $draft->toArray()['blocks'][0]->slots->content[0];
        self::assertInstanceOf(stdClass::class, $heading->slots);
        self::assertFalse($heading->responsive->mobile->hidden);
        self::assertSame(0, $heading->responsive->mobile->opacity);
    }

    public function test_unknown_composition_names_and_common_behaviors_need_no_storage_registration(): void
    {
        $codec = $this->codec();
        $source = json_decode($this->fixture('document-v3'), flags: JSON_THROW_ON_ERROR);
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach (['tabs', 'disclosure', 'carousel', 'nested'] as $kind) {
            $source->blocks = $cases->behavior_fixtures->{$kind};
            $source->blocks[0]->name = '서버가 모르는 새 구성 '.$kind;
            $draft = $codec->decodeDraft(json_encode($source, JSON_THROW_ON_ERROR), $source->document_id);
            self::assertEquals($source, json_decode($codec->encodeRevision($draft), flags: JSON_THROW_ON_ERROR));
        }
    }

    #[DataProvider('identities')]
    public function test_metadata_changes_preserve_the_original_body_and_version(string $fixture): void
    {
        $codec = $this->codec();
        $original = $codec->decodeStored($this->fixture($fixture));
        $before = $codec->encodeRevision($original);
        $seo = new PageSeoMetadata('검색 제목', '설명', '/storage/cover.webp', 'noindex');
        $changed = $codec->withMetadata($original, '00000000-0000-4000-8000-000000000777', 'renamed', 'en', 'builder', $seo);
        self::assertSame($original->schemaVersion, $changed->schemaVersion);
        self::assertSame('00000000-0000-4000-8000-000000000777', $changed->documentId);
        self::assertSame('renamed', $changed->slug);
        self::assertSame('en', $changed->locale);
        self::assertSame('builder', $changed->shellMode);
        self::assertSame($seo->toArray(), $changed->seo->toArray());
        foreach (['blocks', 'tokens', 'assets'] as $key) {
            if (array_key_exists($key, $original->toArray())) {
                self::assertEquals($original->toArray()[$key], $changed->toArray()[$key]);
            }
        }
        self::assertSame($before, $codec->encodeRevision($original));
        $retained = $codec->withMetadata($changed, $changed->documentId, 'again', 'ko', 'none', null);
        self::assertSame($seo->toArray(), $retained->seo->toArray());
    }

    #[DataProvider('identities')]
    public function test_invalid_metadata_does_not_mutate_the_source(string $fixture): void
    {
        $codec = $this->codec();
        $original = $codec->decodeStored($this->fixture($fixture));
        $before = $codec->encodeRevision($original);
        try {
            $codec->withMetadata($original, $original->documentId, 'bad/slug', 'ko', 'none', null);
            self::fail('Invalid metadata was accepted.');
        } catch (\InvalidArgumentException) {
            self::assertSame($before, $codec->encodeRevision($original));
        }
    }

    public function test_historical_legacy_values_are_readable_without_becoming_writable(): void
    {
        $codec = $this->codec();
        $source = json_decode($this->fixture('document-layout-v2'), true, flags: JSON_THROW_ON_ERROR);
        $source['tokens']['design.color_mode'] = 'sepia';
        $stored = $codec->decodeStored(json_encode($source, JSON_THROW_ON_ERROR));
        self::assertSame('sepia', $stored->toArray()['tokens']['design.color_mode']);
        $this->expectException(\InvalidArgumentException::class);
        $codec->encodeRevision($stored);
    }

    public function test_draft_does_not_use_the_legacy_recovery_policy(): void
    {
        $source = json_decode($this->fixture('document-layout-v2'), true, flags: JSON_THROW_ON_ERROR);
        $source['tokens']['design.color_mode'] = 'sepia';
        $this->expectException(\InvalidArgumentException::class);
        $this->codec()->decodeDraft(json_encode($source, JSON_THROW_ON_ERROR), $source['document_id']);
    }

    /** @return iterable<string, array{string}> */
    public static function identities(): iterable
    {
        yield 'legacy' => ['document-v1'];
        yield 'structure' => ['document-v3'];
    }

    #[DataProvider('identities')]
    public function test_draft_identity_is_rejected_not_silently_replaced(string $fixture): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('identity does not match');
        $this->codec()->decodeDraft($this->fixture($fixture), '00000000-0000-4000-8000-000000000777');
    }

    /** @return iterable<string, array{string}> */
    public static function invalidSources(): iterable
    {
        yield 'invalid JSON' => ['{'];
        yield 'null' => ['null'];
        yield 'list' => ['[]'];
        yield 'missing version' => ['{}'];
        yield 'unknown version' => ['{"schema_version":"g7-page-builder/v4"}'];
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->tokens = [];
        yield 'v3 map replaced by list' => [json_encode($source, JSON_THROW_ON_ERROR)];
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->unknown = true;
        yield 'v3 unknown field' => [json_encode($source, JSON_THROW_ON_ERROR)];
    }

    #[DataProvider('invalidSources')]
    public function test_invalid_stored_documents_are_not_repaired_or_migrated(string $json): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->codec()->decodeStored($json);
    }
}
