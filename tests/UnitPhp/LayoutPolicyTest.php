<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\LayoutPolicy;
use PHPUnit\Framework\TestCase;

final class LayoutPolicyTest extends TestCase
{
    public function test_shared_valid_document_and_invalid_mutations(): void
    {
        $policy = $this->policy();
        $fixture = $this->fixture();
        $policy->validate($fixture['valid']);
        foreach ($fixture['cases'] as $case) {
            $document = $fixture['valid'];
            $target = &$document;
            foreach ($case['path'] as $part) {
                $target = &$target[$part];
            }
            $target = $case['value'];
            unset($target);
            try {
                $policy->validate($document);
                self::fail($case['name'].' was accepted');
            } catch (InvalidArgumentException $error) {
                self::assertStringStartsWith($case['error'].':', $error->getMessage(), $case['name']);
            }
        }
    }

    public function test_compact_utf8_bytes_match_the_typescript_fixture(): void
    {
        foreach ($this->fixture()['byte_cases'] as $case) {
            self::assertSame($case['bytes'], LayoutPolicy::compactJsonBytes($case['value']));
        }
    }

    public function test_every_parent_type_matches_the_declared_grammar(): void
    {
        $policy = $this->policy();
        $source = json_decode(file_get_contents(__DIR__.'/../../schemas/layout-policy-v1.json'), true, flags: JSON_THROW_ON_ERROR);
        $layouts = $source['layouts'];
        foreach ([...$source['root_types'], ...array_values($layouts)] as $type) {
            $leaf = in_array($type, $source['leaf_types'], true);
            self::assertSame(in_array($type, $source['root_types'], true) || $type === $layouts['section'], $policy->allowsChild(null, $type));
            self::assertSame($leaf || in_array($type, [$layouts['columns'], $layouts['stack']], true), $policy->allowsChild($layouts['section'], $type));
            self::assertSame($leaf || $type === $layouts['stack'], $policy->allowsChild($layouts['columns'], $type));
            self::assertSame($leaf, $policy->allowsChild($layouts['stack'], $type));
            self::assertFalse($policy->allowsChild('content.heading-01', $type));
        }
    }

    public function test_total_node_and_slot_limits_accept_exact_boundary(): void
    {
        $policy = $this->policy();
        $nodes = array_map(fn (int $n): array => $this->leaf($n), range(1, 500));
        $policy->validate(['blocks' => $nodes]);
        $this->assertRejected($policy, ['blocks' => [...$nodes, $this->leaf(501)]], 'node_limit');
        $section = $this->fixture()['valid']['blocks'][0];
        $section['slots']['content'] = array_map(fn (int $n): array => $this->leaf($n), range(10, 209));
        $policy->validate(['blocks' => [$section]]);
        $section['slots']['content'][] = $this->leaf(210);
        $this->assertRejected($policy, ['blocks' => [$section]], 'slot_limit');
    }

    public function test_compact_document_byte_limit_is_not_character_count(): void
    {
        $policy = $this->policy();
        $document = ['blocks' => [], 'note' => "한글😀/\n"];
        $document['note'] .= str_repeat('x', 1048576 - LayoutPolicy::compactJsonBytes($document));
        $policy->validate($document);
        $document['note'] .= 'x';
        $this->assertRejected($policy, $document, 'byte_limit');
    }

    public function test_rejects_unserializable_input(): void
    {
        $this->assertRejected($this->policy(), ['blocks' => [], 'note' => INF], 'json');
    }

    public function test_json_integer_values_do_not_depend_on_decimal_spelling(): void
    {
        $document = $this->fixture()['valid'];
        $document['blocks'][0]['block_version'] = 1.0;
        $document['blocks'][0]['slots']['content'][0]['props']['columns'] = 2.0;
        $this->policy()->validate($document);
        self::assertSame(1.0, $document['blocks'][0]['block_version']);
    }

    private function assertRejected(LayoutPolicy $policy, array $document, string $code): void
    {
        try {
            $policy->validate($document);
            self::fail('Invalid layout accepted');
        } catch (InvalidArgumentException $error) {
            self::assertStringStartsWith($code.':', $error->getMessage());
        }
    }

    private function policy(): LayoutPolicy
    {
        return new LayoutPolicy(json_decode(file_get_contents(__DIR__.'/../../schemas/layout-policy-v1.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    private function fixture(): array
    {
        // Preserve JSON objects versus lists for shape-error cases; canonical PHP
        // inputs use arrays, so only the mutation values retain stdClass markers.
        $fixture = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), true, flags: JSON_THROW_ON_ERROR);
        $raw = json_decode(file_get_contents(__DIR__.'/../Fixtures/layout-policy-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($raw->cases as $index => $case) {
            if ($case->value instanceof \stdClass) {
                $fixture['cases'][$index]['value'] = $case->value;
            }
        }

        return $fixture;
    }

    private function leaf(int $n): array
    {
        return ['instance_id' => sprintf('00000000-0000-4000-8000-%012d', $n), 'type' => 'content.heading-01', 'block_version' => 1, 'props' => ['heading' => '제목']];
    }
}
