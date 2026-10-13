<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Documents\EmptyElementSitePart;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\EmptyStructureDocument;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\SitePartStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartValidator;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

final class SitePartStorageCodecTest extends TestCase
{
    private function schema(string $name): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../schemas/'.$name.'.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    private function validator(): ElementSitePartValidator
    {
        return new ElementSitePartValidator($this->schema('site-part-v2.schema'), $this->schema('page-builder-document-v3.schema'), $this->schema('design-policy-v3'));
    }

    private function source(): stdClass
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/site-part-v2.fixture.json'), flags: JSON_THROW_ON_ERROR)->source;
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function test_element_round_trip_preserves_exact_objects_lists_and_identity(): void
    {
        $codec = new SitePartStorageCodec($this->validator());
        $source = $this->source();
        $document = $codec->decodeStored($this->json($source));
        self::assertInstanceOf(ElementSitePartDocument::class, $document);
        $json = $codec->encodeRevision($document);
        self::assertEquals($source, json_decode($json, flags: JSON_THROW_ON_ERROR));
        self::assertSame($json, $codec->encodeRevision($codec->decodeDraft($json, $document)));
        $copy = json_decode($json, flags: JSON_THROW_ON_ERROR);
        self::assertInstanceOf(stdClass::class, $copy->content->blocks[0]->slots->content[0]->slots);
        self::assertFalse($copy->content->blocks[0]->slots->content[1]->responsive->mobile->hidden);
        self::assertSame(0, $copy->content->blocks[0]->responsive->mobile->column_gap->value);
    }

    #[DataProvider('identityChanges')]
    public function test_draft_identity_changes_are_rejected_without_mutating_original(string $field, string $value): void
    {
        $codec = new SitePartStorageCodec($this->validator());
        $source = $this->source();
        $original = $codec->decodeStored($this->json($source));
        $before = $codec->encodeRevision($original);
        if ($field === 'kind') {
            $source->kind = $value;
        } else {
            $source->content->{$field} = $value;
        }
        try {
            $codec->decodeDraft($this->json($source), $original);
            self::fail('Identity change was accepted.');
        } catch (\InvalidArgumentException $error) {
            self::assertStringContainsString('identity', $error->getMessage());
        }
        self::assertSame($before, $codec->encodeRevision($original));
    }

    public static function identityChanges(): iterable
    {
        yield ['document_id', '00000000-0000-4000-8000-000000000099'];
        yield ['kind', 'footer'];
        yield ['locale', 'en'];
        yield ['slug', 'other-site-part'];
    }

    public function test_legacy_reads_preserve_historical_payload_but_new_writes_validate(): void
    {
        $codec = new SitePartStorageCodec;
        $part = new SitePartDocument('00000000-0000-4000-8000-000000000091', 'header', 'ko', [], [[
            'instance_id' => '00000000-0000-4000-8000-000000000002',
            'type' => 'site.header.navigation-01', 'block_version' => 1, 'props' => [], 'slots' => [],
        ]]);
        $json = $codec->encodeRevision($part);
        self::assertSame($part->toArray(), $codec->decodeDraft($json, $part)->toArray());
        $historical = $part->toArray();
        $historical['blocks'][0]['block_version'] = 99;
        $read = $codec->decodeStored($this->json($historical));
        self::assertSame($historical, $read->toArray());
        $this->expectException(\InvalidArgumentException::class);
        $codec->encodeRevision($read);
    }

    public function test_normal_save_does_not_convert_either_version(): void
    {
        $codec = new SitePartStorageCodec($this->validator());
        $element = $codec->decodeStored($this->json($this->source()));
        $legacy = new SitePartDocument($element->sitePartId, 'header', 'ko', [], []);
        foreach ([[$legacy, $element], [$element, $legacy]] as [$current, $candidate]) {
            try {
                $codec->decodeDraft($codec->encodeRevision($candidate), $current);
                self::fail('Implicit conversion was accepted.');
            } catch (\InvalidArgumentException $error) {
                self::assertStringContainsString('explicit migration', $error->getMessage());
            }
        }
    }

    #[DataProvider('badJson')]
    public function test_malformed_unknown_and_collapsed_payloads_fail_closed(string $json): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new SitePartStorageCodec($this->validator()))->decodeStored($json);
    }

    public static function badJson(): iterable
    {
        yield ['{broken'];
        yield ['[]'];
        yield ['null'];
        yield ['{"schema_version":"future"}'];
        $source = json_decode(file_get_contents(__DIR__.'/../Contract/site-part-v2.fixture.json'), true, flags: JSON_THROW_ON_ERROR)['source'];
        yield [json_encode($source, JSON_THROW_ON_ERROR)];
    }

    public function test_unconfigured_element_support_fails_without_legacy_coercion(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('unavailable');
        (new SitePartStorageCodec)->decodeStored($this->json($this->source()));
    }

    public function test_empty_header_and_footer_use_the_same_page_document_factory(): void
    {
        $policy = $this->schema('design-policy-v3');
        $factory = new EmptyElementSitePart(new EmptyStructureDocument(new Validator($this->schema('page-builder-document-v3.schema'), $policy)), $this->validator());
        foreach (['header', 'footer'] as $kind) {
            $part = $factory->create('00000000-0000-4000-8000-000000000091', $kind, 'ko', $policy['default_tokens']);
            self::assertSame($kind, $part->kind);
            self::assertSame([], $part->content->toArray()['blocks']);
            self::assertSame('none', $part->content->shellMode);
            self::assertNull($part->content->seo);
            self::assertSame('site-'.$kind, $part->content->slug);
        }
    }
}
