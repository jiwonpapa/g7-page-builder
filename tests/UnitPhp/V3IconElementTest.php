<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\DraftRenderer;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\ElementMarkup;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\Presentation;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class V3IconElementTest extends TestCase
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
        $node->type = 'media.icon';
        $node->props = $props;
        $node->slots = $node->style = $node->responsive = new stdClass;
        $document->blocks = [$node];

        return $document;
    }

    public function test_shared_icon_contract_rejects_unknown_fields_without_mutation(): void
    {
        $validator = $this->validator();
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        foreach ($cases->icons as $case) {
            $document = $this->source($case->props);
            $json = json_encode($document, JSON_THROW_ON_ERROR);
            if ($case->valid) {
                self::assertEquals($document, $validator->validateJson($json), $case->name);
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

    public function test_every_known_icon_renders_in_draft_and_publication_with_escaped_accessible_meaning(): void
    {
        $schema = json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR);
        $rule = array_find($schema['$defs']['node']['properties']['props']['anyOf'], fn ($rule) => isset($rule['properties']['icon']));
        self::assertCount(23, $rule['properties']['icon']['enum']);
        $validator = $this->validator();
        foreach ($rule['properties']['icon']['enum'] as $name) {
            $document = $this->source((object) ['icon' => $name, 'label' => '안내 <문자> "설명"', 'decorative' => false]);
            $source = json_encode($document, JSON_THROW_ON_ERROR);
            $validated = $validator->validateJson($source);
            $styles = Presentation::document($validated, 'base', $validator->semanticDisplays());
            self::assertSame('24px', $styles[$document->blocks[0]->instance_id]['width']);
            foreach ([(new DraftRenderer($validator))->render($source), (new ElementMarkup(true))->render($validated, $styles, [])] as $html) {
                self::assertStringContainsString('role="img" aria-label="안내 &lt;문자&gt; &quot;설명&quot;"', $html);
                self::assertStringContainsString('data-g7pb-icon-sizing="parent"', $html);
                self::assertStringContainsString('width="100%" height="100%"', $html);
                self::assertSame(1, substr_count($html, '<svg '));
                self::assertMatchesRegularExpression('/<(path|circle|rect) /', $html);
                self::assertStringNotContainsString('<script', $html);
            }
            self::assertSame($source, json_encode($document, JSON_THROW_ON_ERROR));
        }
    }

    public function test_decorative_icon_and_authored_responsive_size_preserve_the_source(): void
    {
        $document = $this->source((object) ['icon' => 'star', 'label' => '보존할 설명', 'decorative' => true]);
        $node = $document->blocks[0];
        $node->style = (object) ['width' => (object) ['value' => 48, 'unit' => 'px'], 'height' => (object) ['value' => 32, 'unit' => 'px']];
        $node->responsive = (object) ['mobile' => (object) ['width' => (object) ['value' => 20, 'unit' => 'px']]];
        $source = json_encode($document, JSON_THROW_ON_ERROR);
        $renderer = new DraftRenderer($this->validator());
        $base = $renderer->render($source);
        self::assertStringContainsString('width:48px', $base);
        self::assertStringContainsString('height:32px', $base);
        self::assertStringNotContainsString('role="img"', $base);
        self::assertStringNotContainsString('aria-label=', $base);
        self::assertStringContainsString('width:20px', $renderer->render($source, 'mobile'));
        self::assertSame($source, json_encode($document, JSON_THROW_ON_ERROR));
    }
}
