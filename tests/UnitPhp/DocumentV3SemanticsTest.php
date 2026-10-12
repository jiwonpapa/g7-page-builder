<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\Presentation;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentV3SemanticsTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    /** @param list<stdClass> $tree */
    private function source(array $tree): stdClass
    {
        $document = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $sequence = 0;
        $nodes = function (array $items) use (&$nodes, &$sequence): array {
            return array_map(function (stdClass $item) use (&$nodes, &$sequence): stdClass {
                $text = $item->tag === 'text';

                return (object) ['instance_id' => sprintf('00000000-0000-4000-8000-%012d', ++$sequence),
                    'type' => $text ? 'content.text' : 'layout.container', 'block_version' => 1, 'name' => $item->tag, 'locked' => false,
                    'props' => $text ? (object) ['paragraphs' => [[(object) ['text' => '한글 <내용>']]]] : (object) ['tag' => $item->tag],
                    'slots' => $text ? new stdClass : (object) ['content' => $nodes($item->children ?? [])],
                    'style' => new stdClass, 'responsive' => new stdClass];
            }, $items);
        };
        $document->blocks = $nodes($tree);

        return $document;
    }

    public function test_shared_semantic_structure_cases_and_generated_display(): void
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        $validator = $this->validator();
        $displays = ['li' => 'list-item', 'table' => 'table', 'caption' => 'table-caption', 'thead' => 'table-header-group',
            'tbody' => 'table-row-group', 'tfoot' => 'table-footer-group', 'tr' => 'table-row', 'th' => 'table-cell', 'td' => 'table-cell'];
        foreach ($cases->semantics as $case) {
            $source = $this->source($case->tree);
            $json = json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            try {
                $document = $validator->validateJson($json);
                self::assertTrue($case->valid, $case->name.' unexpectedly passed');
                $styles = Presentation::document($document, 'base', $validator->semanticDisplays());
                $visit = function (array $nodes) use (&$visit, $styles, $displays): void {
                    foreach ($nodes as $node) {
                        self::assertSame($displays[$node->props->tag ?? ''] ?? 'block', $styles[$node->instance_id]['display']);
                        $visit($node->slots->content ?? []);
                    }
                };
                $visit($document->blocks);
            } catch (InvalidArgumentException $error) {
                self::assertFalse($case->valid, $case->name.': '.$error->getMessage());
                self::assertStringStartsWith($case->error.':', $error->getMessage(), $case->name);
            }
            self::assertSame($json, json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        }
    }
}
