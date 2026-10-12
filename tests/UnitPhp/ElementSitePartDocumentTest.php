<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\HtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartValidator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class ElementSitePartDocumentTest extends TestCase
{
    private function schema(string $name): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../schemas/'.$name.'.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    private function validator(): ElementSitePartValidator
    {
        return new ElementSitePartValidator($this->schema('site-part-v2.schema'), $this->schema('page-builder-document-v3.schema'), $this->schema('design-policy-v3'));
    }

    private function documents(): Validator
    {
        return new Validator($this->schema('page-builder-document-v3.schema'), $this->schema('design-policy-v3'));
    }

    private function fixture(): stdClass
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/site-part-v2.fixture.json'), flags: JSON_THROW_ON_ERROR);
    }

    private function encode(mixed $source): string
    {
        return json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function test_shared_cases_preserve_or_reject_without_mutating_the_source(): void
    {
        foreach ($this->fixture()->cases as $case) {
            $source = $this->fixture()->source;
            $target = &$source;
            foreach ($case->path as $key) {
                if (is_array($target)) {
                    $target = &$target[$key];
                } else {
                    $target = &$target->{$key};
                }
            }
            $target = $case->value;
            unset($target);
            $json = $this->encode($source);
            if ($case->valid) {
                self::assertSame($json, ElementSitePartDocument::fromJson($json, $this->validator())->toJson(), $case->name);
            } else {
                try {
                    ElementSitePartDocument::fromJson($json, $this->validator());
                    self::fail($case->name.' was accepted');
                } catch (InvalidArgumentException $error) {
                    self::assertStringStartsWith($case->error.':', $error->getMessage(), $case->name);
                }
            }
            self::assertSame($json, $this->encode($source));
        }
    }

    public function test_ownership_and_transport_are_immutable_and_preserve_objects_false_and_zero(): void
    {
        $source = $this->fixture()->source;
        $part = ElementSitePartDocument::fromJson($this->encode($source), $this->validator());
        $before = $part->toJson();
        self::assertSame($source->content->document_id, $part->sitePartId);
        self::assertSame($source->content->locale, $part->locale);
        self::assertSame($source->schema_version, $part->schemaVersion);
        $copy = $part->toArray();
        self::assertInstanceOf(stdClass::class, $copy['content']->blocks[0]->slots->content[0]->slots);
        self::assertFalse($copy['content']->blocks[0]->slots->content[1]->responsive->mobile->hidden);
        self::assertSame(0, $copy['content']->blocks[0]->responsive->mobile->column_gap->value);
        $copy['content']->blocks[0]->name = 'changed';
        $copy['content']->tokens->primary->value = '#000000';
        self::assertSame($before, $part->toJson());
        self::assertEquals($source, (object) $part->toArray());
        self::assertSame($before, ElementSitePartDocument::fromJson($before, $this->validator())->toJson());
    }

    public function test_both_kinds_reuse_the_page_compiler_with_no_catalog_or_primitive_mapping(): void
    {
        foreach (['header', 'footer'] as $kind) {
            $source = $this->fixture()->source;
            $source->kind = $kind;
            $part = ElementSitePartDocument::fromJson($this->encode($source), $this->validator());
            $compiler = new HtmlCompiler($this->documents());
            $expected = $compiler->compile(ValidatedDocument::fromJson($this->encode($source->content), $this->documents()), 2, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
            $actual = $compiler->compile($part->content, 2, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
            self::assertEquals($expected, $actual);
            self::assertSame(3, substr_count($actual->artifact, 'data-v3-node='));
            self::assertStringContainsString('href="/"', $actual->artifact);
            self::assertStringContainsString('alt=""', $actual->artifact);
        }
    }

    public function test_edit_roundtrip_and_original_revision_restore_use_the_same_content(): void
    {
        $part = ElementSitePartDocument::fromJson($this->encode($this->fixture()->source), $this->validator());
        $before = $part->toJson();
        $edited = $part->content->toArray();
        $edited['blocks'][0]->slots->content[1]->props->label = '고객 지원';
        $content = ValidatedDocument::fromJson($this->encode($edited), $this->documents());
        $changed = $part->withContent($content, $this->validator());
        self::assertNotSame($before, $changed->toJson());
        self::assertSame($before, $part->toJson());
        self::assertSame($before, $changed->withContent($part->content, $this->validator())->toJson());
        foreach (['document_id' => '00000000-0000-4000-8000-000000000099', 'locale' => 'en', 'slug' => 'other-part'] as $field => $value) {
            $foreign = $edited;
            $foreign[$field] = $value;
            try {
                $part->withContent(ValidatedDocument::fromJson($this->encode($foreign), $this->documents()), $this->validator());
                self::fail('Foreign owner was accepted: '.$field);
            } catch (InvalidArgumentException $error) {
                self::assertStringStartsWith('site_part_identity:', $error->getMessage());
            }
            self::assertSame($before, $part->toJson());
        }
        $edited['shell_mode'] = 'builder';
        $this->expectExceptionMessage('site_part_shell:');
        $part->withContent(ValidatedDocument::fromJson($this->encode($edited), $this->documents()), $this->validator());
    }

    public function test_invalid_json_envelopes_and_byte_limit_are_rejected(): void
    {
        foreach (['{', 'null', '[]', '{}', '{"schema_version":"g7-page-builder/site-part/v2","kind":"header"}'] as $json) {
            try {
                ElementSitePartDocument::fromJson($json, $this->validator());
                self::fail('Invalid envelope was accepted');
            } catch (InvalidArgumentException $error) {
                self::assertNotSame('', $error->getMessage());
            }
        }
        $source = $this->fixture()->source;
        $source->extra = str_repeat('a', $this->schema('design-policy-v3')['limits']['utf8_bytes']);
        $this->expectExceptionMessage('byte_limit:');
        ElementSitePartDocument::fromJson($this->encode($source), $this->validator());
    }

    public function test_only_the_pinned_local_document_reference_is_resolved(): void
    {
        $schema = $this->schema('site-part-v2.schema');
        $schema['properties']['content']['$ref'] = 'https://untrusted.invalid/schema';
        $this->expectExceptionMessage('schema:');
        new ElementSitePartValidator($schema, $this->schema('page-builder-document-v3.schema'), $this->schema('design-policy-v3'));
    }

    public function test_shared_behaviors_and_node_limits_keep_the_page_contract(): void
    {
        $fixtures = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach (get_object_vars($fixtures->behavior_fixtures) as $nodes) {
            $source = $this->fixture()->source;
            $source->content->blocks = $nodes;
            $json = $this->encode($source);
            self::assertSame($json, ElementSitePartDocument::fromJson($json, $this->validator())->toJson());
        }
        $source = $this->fixture()->source;
        $node = $source->content->blocks[0]->slots->content[1];
        $source->content->blocks = [];
        for ($i = 1; $i <= 500; $i++) {
            $next = clone $node;
            $next->instance_id = sprintf('00000000-0000-4000-8000-%012d', $i);
            $source->content->blocks[] = $next;
        }
        self::assertSame(500, ElementSitePartDocument::fromJson($this->encode($source), $this->validator())->content->rootCount());
        $source->content->blocks[] = $node;
        $this->expectException(InvalidArgumentException::class);
        ElementSitePartDocument::fromJson($this->encode($source), $this->validator());
    }
}
