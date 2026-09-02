<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PageDocumentWritePolicyTest extends TestCase
{
    /** @param array<string, mixed> $changes */
    #[DataProvider('invalidBlocks')]
    public function test_new_writes_reject_invalid_envelopes(array $changes): void
    {
        $data = self::document();
        $data['blocks'][0] = array_replace($data['blocks'][0], $changes);
        $this->expectException(\InvalidArgumentException::class);
        PageBuilderDocument::fromArray($data);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function invalidBlocks(): iterable
    {
        yield 'invalid UUID' => [['instance_id' => 'not-a-uuid']];
        yield 'wrong UUID type' => [['instance_id' => 5]];
        yield 'wrong type' => [['type' => true]];
        yield 'invalid type identifier' => [['type' => 'invalid type']];
        yield 'zero version' => [['block_version' => 0]];
        yield 'fractional version' => [['block_version' => 1.5]];
        yield 'string version' => [['block_version' => '1']];
        yield 'unsupported builtin version' => [['block_version' => 99]];
        yield 'list props' => [['props' => ['invalid']]];
        yield 'null props' => [['props' => null]];
        yield 'null slots' => [['slots' => null]];
        yield 'list slots' => [['slots' => [[]]]];
        yield 'map children' => [['slots' => ['content' => ['key' => self::block()]]]];
        yield 'unknown envelope field' => [['vendor_state' => []]];
    }

    public function test_root_maps_are_rejected_without_silent_reindexing(): void
    {
        $data = self::document();
        $data['blocks'] = ['lost-key' => self::block()];
        $this->expectException(\InvalidArgumentException::class);
        PageBuilderDocument::fromArray($data);
    }

    public function test_duplicate_identity_is_case_insensitive_across_slots(): void
    {
        $data = self::document();
        $block = self::block();
        $block['instance_id'] = 'aaaaaaaa-0000-4000-8000-000000000002';
        $data['blocks'] = [$block];
        $block['instance_id'] = strtoupper($block['instance_id']);
        $data['blocks'][0]['slots'] = ['content' => [$block]];
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('duplicate');
        PageBuilderDocument::fromArray($data);
    }

    /** @param array<string, mixed> $props */
    #[DataProvider('invalidLayoutProps')]
    public function test_layout_settings_use_the_published_schema(string $type, array $props): void
    {
        $data = self::document();
        $data['schema_version'] = 'g7-page-builder/v2';
        $data['blocks'][0] = array_replace(self::block(), ['type' => $type, 'props' => $props]);
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('write contract');
        PageBuilderDocument::fromArray($data);
    }

    /** @return iterable<string, array{string, array<string, mixed>}> */
    public static function invalidLayoutProps(): iterable
    {
        yield 'section width' => ['layout.section-01', ['width' => 'invalid', 'spacing' => 'normal']];
        yield 'section missing spacing' => ['layout.section-01', ['width' => 'standard']];
        yield 'section extra setting' => ['layout.section-01', ['width' => 'standard', 'spacing' => 'normal', 'rawStyle' => 'display:none']];
        yield 'columns gap' => ['layout.columns-01', ['columns' => 2, 'ratio' => '1:1', 'gap' => 'invalid']];
        yield 'stack gap' => ['layout.stack-01', ['gap' => 'invalid']];
    }

    public function test_typed_optional_root_fields_do_not_silently_default(): void
    {
        $data = self::document();
        $data['shell_mode'] = 17;
        $this->expectException(\InvalidArgumentException::class);
        PageBuilderDocument::fromArray($data);
    }

    public function test_recovery_reads_preserve_old_blocks_but_do_not_authorize_a_write(): void
    {
        $data = self::document();
        $data['blocks'][0]['instance_id'] = 'old-invalid-id';
        $stored = PageBuilderDocument::fromStoredArray($data);
        self::assertSame($data['blocks'], $stored->blocks);
        $this->expectException(\InvalidArgumentException::class);
        PageBuilderDocument::fromArray($stored->toArray());
    }

    public function test_draft_content_and_external_pack_versions_are_not_rewritten_or_judged(): void
    {
        $data = self::document();
        $data['blocks'][0]['props'] = ['title' => ''];
        $data['blocks'][0]['block_version'] = 1.0;
        $data['blocks'][] = array_replace(self::block(), [
            'instance_id' => '00000000-0000-4000-8000-000000000003',
            'type' => 'vendor.future-01', 'block_version' => 7, 'props' => ['draft' => null],
        ]);
        self::assertSame($data['blocks'], PageBuilderDocument::fromArray($data)->blocks);
    }

    /** @return array<string, mixed> */
    private static function block(): array
    {
        return ['instance_id' => '00000000-0000-4000-8000-000000000002', 'type' => 'content.hero-centered-01', 'block_version' => 1, 'props' => []];
    }

    /** @return array{schema_version: string, document_id: string, slug: string, mode: string, locale: string, blocks: list<array<string, mixed>>} */
    private static function document(): array
    {
        return ['schema_version' => 'g7-page-builder/v1', 'document_id' => '00000000-0000-4000-8000-000000000001', 'slug' => 'contract-fixture', 'mode' => 'canvas', 'locale' => 'ko', 'blocks' => [self::block()]];
    }
}
