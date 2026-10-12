<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

final class ValidatedDocumentV3Test extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(
            json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR),
        );
    }

    private function source(): stdClass
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
    }

    private function encode(stdClass $source): string
    {
        return json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function test_canonical_value_preserves_the_existing_document_without_a_second_grammar(): void
    {
        $source = $this->source();
        $value = ValidatedDocument::fromJson($this->encode($source), $this->validator());
        self::assertSame($source->document_id, $value->documentId);
        self::assertSame($source->slug, $value->slug);
        self::assertSame($source->locale, $value->locale);
        self::assertSame($source->shell_mode, $value->shellMode);
        self::assertSame($this->encode($source), $value->toJson());
        self::assertSame($value->toJson(), json_encode($value->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION));
        self::assertEquals($source, $this->validator()->validateJson($value->toJson()));
        self::assertSame($value->toJson(), ValidatedDocument::fromJson($value->toJson(), $this->validator())->toJson());
    }

    public function test_empty_maps_lists_false_and_zero_keep_their_distinct_meaning(): void
    {
        $source = $this->source();
        $value = ValidatedDocument::fromJson($this->encode($source), $this->validator());
        $payload = $value->toArray();
        $heading = $payload['blocks'][0]->slots->content[0];
        self::assertInstanceOf(stdClass::class, $heading->slots);
        self::assertSame([], get_object_vars($heading->slots));
        self::assertFalse($heading->responsive->mobile->hidden);
        self::assertSame(0, $heading->responsive->mobile->opacity);
        $source->blocks = [];
        $source->assets = [];
        $empty = ValidatedDocument::fromJson($this->encode($source), $this->validator())->toArray();
        self::assertSame([], $empty['blocks']);
        self::assertSame([], $empty['assets']);
        self::assertInstanceOf(stdClass::class, $empty['tokens']);
    }

    public function test_transport_snapshots_cannot_mutate_the_validated_source_or_each_other(): void
    {
        $value = ValidatedDocument::fromJson($this->encode($this->source()), $this->validator());
        $before = $value->toJson();
        $first = $value->toArray();
        $second = $value->toArray();
        $first['document_id'] = 'not-an-id';
        $first['tokens']->primary->value = '#000000';
        $first['assets'][0]->url = 'javascript:bad';
        $first['blocks'][0]->slots->content[0]->responsive->mobile->hidden = true;
        self::assertSame($before, $value->toJson());
        self::assertEquals($second, $value->toArray());
        self::assertNotSame($first['tokens'], $second['tokens']);
        self::assertSame('00000000-0000-4000-8000-000000000099', $value->documentId);
    }

    public function test_common_behavior_references_survive_without_block_registration(): void
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach (['tabs', 'disclosure', 'carousel', 'nested'] as $kind) {
            $source = $this->source();
            $source->blocks = $cases->behavior_fixtures->{$kind};
            $source->blocks[0]->name = '등록하지 않은 구성 '.$kind;
            $json = $this->encode($source);
            $value = ValidatedDocument::fromJson($json, $this->validator());
            self::assertSame($json, $value->toJson());
            self::assertEquals($source->blocks[0]->behavior, $value->toArray()['blocks'][0]->behavior);
        }
    }

    /** @return iterable<string, array{string}> */
    public static function rejectedInputs(): iterable
    {
        yield 'malformed JSON' => ['{'];
        yield 'null' => ['null'];
        yield 'list instead of document' => ['[]'];
        yield 'missing fields' => ['{}'];
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->blocks[0]->slots = [];
        yield 'empty list is not a slots object' => [json_encode($source, JSON_THROW_ON_ERROR)];
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $source->schema_version = 'g7-page-builder/v2';
        yield 'no implicit legacy conversion' => [json_encode($source, JSON_THROW_ON_ERROR)];
        $source->schema_version = 'g7-page-builder/v3';
        $source->unrecognized = 'must not be discarded';
        yield 'unknown fields are not stripped' => [json_encode($source, JSON_THROW_ON_ERROR)];
        unset($source->unrecognized);
        $source->assets[0]->url = 'javascript:alert(1)';
        yield 'invalid asset URL is not repaired' => [json_encode($source, JSON_THROW_ON_ERROR)];
    }

    #[DataProvider('rejectedInputs')]
    public function test_invalid_input_is_rejected_before_constructing_a_value(string $json): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ValidatedDocument::fromJson($json, $this->validator());
    }
}
