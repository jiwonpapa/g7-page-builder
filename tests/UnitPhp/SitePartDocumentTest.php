<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SitePartDocumentTest extends TestCase
{
    #[DataProvider('invalidEnvelopes')]
    public function test_invalid_envelopes_are_rejected_for_writes_but_preserved_for_reads(array $block): void
    {
        $payload = $this->payload($block);
        $stored = SitePartDocument::fromStoredArray($payload);
        self::assertSame($payload, $stored->toArray());
        try {
            SitePartDocument::fromArray($payload);
            self::fail('Invalid new Site Part envelope was accepted.');
        } catch (\InvalidArgumentException) {
            self::assertSame($block, $stored->blocks[0]);
        }
        $this->expectException(DocumentCompileException::class);
        (new SitePartHtmlCompiler)->compile($stored, 1);
    }

    public function test_nested_ids_must_be_unique_and_version_one(): void
    {
        $block = self::block();
        $block['slots']['systemControls'] = [[
            'instance_id' => $block['instance_id'], 'type' => 'site.header.system-controls-01',
            'block_version' => 1, 'props' => [], 'slots' => [],
        ]];
        $this->expectException(\InvalidArgumentException::class);
        SitePartDocument::fromArray($this->payload($block));
    }

    public function test_valid_stored_and_new_documents_compile_to_identical_artifacts(): void
    {
        $payload = $this->payload(self::block());
        $compiler = new SitePartHtmlCompiler;
        self::assertEquals($compiler->compile(SitePartDocument::fromArray($payload), 1), $compiler->compile(SitePartDocument::fromStoredArray($payload), 1));
    }

    public function test_recovery_keeps_existing_kind_and_slot_validation(): void
    {
        $block = self::block();
        $block['slots'] = ['forbidden' => []];
        $this->expectException(\InvalidArgumentException::class);
        SitePartDocument::fromStoredArray($this->payload($block));
    }

    public static function invalidEnvelopes(): iterable
    {
        $block = self::block();
        yield 'bad uuid' => [[...$block, 'instance_id' => 'not-a-uuid']];
        yield 'future version' => [[...$block, 'block_version' => 999]];
        yield 'string version' => [[...$block, 'block_version' => '1']];
        yield 'vendor state' => [[...$block, 'puck' => ['id' => 'vendor']]];
        $missing = $block;
        unset($missing['instance_id']);
        yield 'missing uuid' => [$missing];
        $missing = $block;
        unset($missing['block_version']);
        yield 'missing version' => [$missing];
    }

    private static function block(): array
    {
        return ['instance_id' => '00000000-0000-4000-8000-000000000002', 'type' => 'site.header.navigation-01', 'block_version' => 1, 'props' => ['brand_name' => 'Fixture', 'home_url' => '/', 'navigation' => []], 'slots' => []];
    }

    private function payload(array $block): array
    {
        return ['schema_version' => 'g7-page-builder/site-part/v1', 'site_part_id' => '00000000-0000-4000-8000-000000000001', 'kind' => 'header', 'locale' => 'ko', 'tokens' => [], 'blocks' => [$block]];
    }
}
