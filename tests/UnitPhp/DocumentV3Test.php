<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Migration;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentV3Test extends TestCase
{
    private function policy(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR), $this->policy());
    }

    private function fixture(): stdClass
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
    }

    private function encode(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function test_shared_cases_and_lossless_roundtrip(): void
    {
        $validator = $this->validator();
        $source = $this->encode($this->fixture());
        self::assertSame($source, $this->encode($validator->validateJson($source)));
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($cases->cases as $case) {
            $value = $this->fixture();
            $target = &$value;
            foreach ($case->path as $part) {
                if (is_array($target)) {
                    $target = &$target[$part];
                } else {
                    $target = &$target->{$part};
                }
            }
            $target = $case->value;
            unset($target);
            $json = $this->encode($value);
            if ($case->valid) {
                self::assertSame($json, $this->encode($validator->validateJson($json)), $case->name);
            } else {
                try {
                    $validator->validateJson($json);
                    self::fail($case->name.' was accepted');
                } catch (InvalidArgumentException $error) {
                    self::assertStringStartsWith($case->error.':', $error->getMessage(), $case->name);
                }
            }
            self::assertSame($json, $this->encode($value));
        }
        foreach ($cases->breakpoints as $case) {
            self::assertSame($case->value, $validator->viewportAt($case->width));
        }
    }

    public function test_independent_responsive_inheritance_and_reset(): void
    {
        $node = $this->fixture()->blocks[0]->slots->content[0];
        self::assertSame(0, Validator::effectiveStyle($node, 'mobile')->opacity);
        self::assertFalse(Validator::effectiveStyle($node, 'mobile')->hidden);
        unset($node->responsive->mobile->font_size);
        self::assertEquals($node->style->font_size, Validator::effectiveStyle($node, 'mobile')->font_size);
        self::assertSame(24, Validator::effectiveStyle($node, 'tablet')->font_size->value);
        unset($node->responsive->mobile->opacity);
        self::assertSame(0.9, Validator::effectiveStyle($node, 'mobile')->opacity);
    }

    public function test_fixed_node_budget_and_limits(): void
    {
        $validator = $this->validator();
        foreach ([100, 500] as $count) {
            $doc = $this->fixture();
            $leaf = $doc->blocks[0]->slots->content[0];
            $doc->blocks = [];
            for ($i = 1; $i <= $count; $i++) {
                $node = clone $leaf;
                $node->instance_id = sprintf('00000000-0000-4000-8000-%012d', $i);
                $doc->blocks[] = $node;
            }
            $start = hrtime(true);
            $validator->validateJson($this->encode($doc));
            $ms = (hrtime(true) - $start) / 1000000;
            fwrite(STDOUT, json_encode(['engine' => 'PHP', 'count' => $count, 'validation_ms' => $ms]).PHP_EOL);
            self::assertLessThan($this->policy()['performance']['validation_ms'], $ms);
        }
        $root = $this->fixture()->blocks[0];
        $root->instance_id = '00000000-0000-4000-8000-000000000999';
        $root->slots->content = $doc->blocks;
        $doc->blocks = [$root];
        $this->expectExceptionMessage('node_limit:');
        $validator->validateJson($this->encode($doc));
    }

    public function test_depth_and_byte_limits(): void
    {
        $doc = $this->fixture();
        $root = $doc->blocks[0];
        $root->slots = new stdClass;
        $last = $root;
        for ($depth = 2; $depth <= 16; $depth++) {
            $next = clone $root;
            $next->slots = new stdClass;
            $next->instance_id = sprintf('00000000-0000-4000-8000-%012d', $depth);
            $last->slots->content = [$next];
            $last = $next;
        }
        $this->validator()->validateJson($this->encode($doc));
        $last->slots->content = [$this->fixture()->blocks[0]->slots->content[0]];
        try {
            $this->validator()->validateJson($this->encode($doc));
            self::fail('Depth accepted');
        } catch (InvalidArgumentException $error) {
            self::assertStringStartsWith('depth_limit:', $error->getMessage());
        }
        $doc = $this->fixture();
        $doc->extra = str_repeat('한', 400000);
        $this->expectExceptionMessage('byte_limit:');
        $this->validator()->validateJson($this->encode($doc));
    }

    public function test_explicit_snapshot_preserves_legacy_unknowns_without_a_candidate(): void
    {
        $migration = new Migration($this->policy());
        foreach (['document-v1.fixture.json', 'document-layout-v2.fixture.json'] as $file) {
            $doc = json_decode(file_get_contents(__DIR__.'/../Contract/'.$file), flags: JSON_THROW_ON_ERROR);
            $doc->unknown_extension = (object) ['actions' => ['$x'], 'nested' => (object) ['x' => false]];
            $source = json_encode($doc, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
            $snapshot = $migration->prepare($source, 7, 7, true);
            self::assertSame($source, $snapshot['source_json']);
            self::assertSame(7, $snapshot['source_revision']);
            self::assertFalse($snapshot['publish']);
            self::assertArrayNotHasKey('candidate', $snapshot);
            foreach ([[7, 7, false, 'explicit_choice'], [7, 8, true, 'source_revision']] as [$revision, $expected, $choice, $code]) {
                try {
                    $migration->prepare($source, $revision, $expected, $choice);
                    self::fail('Migration guard bypass');
                } catch (InvalidArgumentException $error) {
                    self::assertStringStartsWith($code.':', $error->getMessage());
                }
            }
        }
        foreach (['g7-page-builder/site-part/v1', 'g7-page-builder/v99', 'g7-page-builder/v3'] as $version) {
            try {
                $migration->prepare($this->encode(['schema_version' => $version]), 1, 1, true);
                self::fail('Unsupported source');
            } catch (InvalidArgumentException $error) {
                self::assertStringStartsWith('source_schema:', $error->getMessage());
            }
        }
    }

    public function test_legacy_runtime_rejects_v3_without_conversion(): void
    {
        $payload = json_decode($this->encode($this->fixture()), true, flags: JSON_THROW_ON_ERROR);
        $before = $payload;
        try {
            PageBuilderDocument::fromArray($payload);
            self::fail('Legacy runtime accepted v3');
        } catch (InvalidArgumentException) {
            self::assertSame($before, $payload);
        }
    }
}
