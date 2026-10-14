<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\DraftRenderer;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\EmbedMarkup;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\HtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class V3EmbedElementTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    private function source(mixed $props): stdClass
    {
        $document = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $node = $document->blocks[0]->slots->content[0];
        $node->type = 'media.embed';
        $node->props = $props;
        $node->slots = $node->style = $node->responsive = new stdClass;
        $document->blocks = [$node];

        return $document;
    }

    public function test_shared_contract_and_urls_match_typescript_without_mutation(): void
    {
        $validator = $this->validator();
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($cases->embeds as $case) {
            $document = $this->source($case->props);
            $json = json_encode($document, JSON_THROW_ON_ERROR);
            if ($case->valid) {
                self::assertEquals($document, $validator->validateJson($json), $case->name);
                self::assertEquals($case->target === null ? null : (array) $case->target, EmbedMarkup::target($case->props->source), $case->name);
            } else {
                try {
                    $validator->validateJson($json);
                    self::fail($case->name.' was accepted');
                } catch (InvalidArgumentException $error) {
                    self::assertStringStartsWith($case->error.':', $error->getMessage(), $case->name);
                }
            }
            self::assertSame($json, json_encode($document, JSON_THROW_ON_ERROR));
        }
    }

    public function test_draft_and_all_public_shells_preserve_typed_size_title_and_existing_markup_policy(): void
    {
        $validator = $this->validator();
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($cases->embeds as $case) {
            if (! $case->valid) {
                continue;
            }
            foreach (['none', 'template', 'builder'] as $shell) {
                $document = $this->source($case->props);
                $document->shell_mode = $shell;
                $node = $document->blocks[0];
                $node->style = (object) ['width' => (object) ['value' => 480, 'unit' => 'px'], 'height' => (object) ['value' => 270, 'unit' => 'px']];
                $node->responsive = (object) ['mobile' => (object) ['width' => (object) ['value' => 100, 'unit' => '%']]];
                $source = ValidatedDocument::fromJson(json_encode($document, JSON_THROW_ON_ERROR), $validator);
                $before = $source->toJson();
                $draft = (new DraftRenderer($validator))->render($before);
                $mobile = (new DraftRenderer($validator))->render($before, 'mobile');
                $result = (new HtmlCompiler($validator))->compile($source, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
                self::assertIsString($result->artifact);
                self::assertStringNotContainsString('<iframe', $result->artifact);
                self::assertStringContainsString('width:480px', $draft);
                self::assertStringContainsString('height:270px', $draft);
                self::assertStringContainsString('width:100%', $mobile);
                $title = htmlspecialchars($case->props->title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                if ($case->target === null) {
                    self::assertStringNotContainsString('<iframe', $draft);
                    self::assertStringNotContainsString('data-g7pb-embed=', $result->artifact);
                    self::assertStringContainsString('제공자를 설정', $draft);
                } else {
                    self::assertStringContainsString('title="'.$title.'"', $draft);
                    self::assertStringContainsString('data-g7pb-embed-title="'.$title.'"', $result->artifact);
                    self::assertStringContainsString('data-g7pb-embed-sizing="parent"', $result->artifact);
                    self::assertSame($case->target->video ? 1 : 0, substr_count($draft, 'allowfullscreen'));
                    $src = htmlspecialchars($case->target->src, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                    self::assertStringContainsString('src="'.$src.'"', $draft);
                    $referrerPolicy = $case->target->kind === 'video-youtube' ? 'strict-origin-when-cross-origin' : 'no-referrer';
                    self::assertStringContainsString('referrerpolicy="'.$referrerPolicy.'"', $draft);
                    self::assertStringContainsString('referrerpolicy="'.$referrerPolicy.'"', $mobile);
                    self::assertStringContainsString('data-g7pb-embed-src="'.$src.'"', $result->artifact);
                }
                self::assertSame($before, $source->toJson());
            }
        }
    }
}
