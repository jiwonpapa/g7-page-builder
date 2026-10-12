<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\BehaviorPresentation;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\DraftRenderer;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\Presentation;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentV3BehaviorsRendererTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    private function document(string $kind): stdClass
    {
        $document = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/document-v3-cases.json'), flags: JSON_THROW_ON_ERROR);
        $document->blocks = $cases->behavior_fixtures->{$kind};

        return $document;
    }

    private function encode(stdClass $document): string
    {
        return json_encode($document, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function test_stable_native_controls_and_attributes_for_all_common_behaviors(): void
    {
        $validator = $this->validator();
        $renderer = new DraftRenderer($validator);
        foreach (['tabs', 'disclosure', 'carousel', 'nested'] as $kind) {
            $document = $this->document($kind);
            $json = $this->encode($document);
            $validator->validateJson($json);
            foreach (['base', 'tablet', 'mobile'] as $viewport) {
                $projection = BehaviorPresentation::apply($document, Presentation::document($document, $viewport, $validator->semanticDisplays()), $viewport);
                $html = $renderer->render($json, $viewport);
                self::assertStringContainsString('data-g7pb-control-ids="stable"', $html);
                self::assertStringContainsString('type="button"', $html);
                foreach ($projection['attributes'] as $id => $attributes) {
                    self::assertMatchesRegularExpression('/<[^>]+id="node-'.preg_quote($id, '/').'"[^>]*>/', $html);
                    foreach ($attributes as $key => $value) {
                        self::assertStringContainsString($key.'="'.htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'"', $html);
                    }
                }
            }
            self::assertSame($json, $this->encode($document));
        }
        $tabs = $renderer->render($this->encode($this->document('tabs')));
        self::assertStringContainsString('role="tablist" aria-label="임의 구성 선택" aria-orientation="horizontal"', $tabs);
        self::assertStringContainsString('aria-controls="node-00000000-0000-4000-8000-000000000104" aria-selected="true" tabindex="0"', $tabs);
        self::assertStringContainsString('role="tabpanel" aria-labelledby="node-00000000-0000-4000-8000-000000000102"', $tabs);
    }

    public function test_authored_values_and_hidden_override_carousel_defaults(): void
    {
        $document = $this->document('carousel');
        $viewport = $document->blocks[0]->slots->content[3];
        $track = $viewport->slots->content[0];
        $slide = $track->slots->content[0];
        $validator = $this->validator();
        $project = fn (string $screen): array => BehaviorPresentation::apply($document, Presentation::document($document, $screen, $validator->semanticDisplays()), $screen)['styles'];
        $styles = $project('base');
        self::assertSame('hidden', $styles[$viewport->instance_id]['overflow']);
        self::assertSame('flex', $styles[$track->instance_id]['display']);
        self::assertSame('100%', $styles[$slide->instance_id]['flex-basis']);
        $track->style->display = 'grid';
        $track->responsive->mobile = (object) ['hidden' => true];
        $slide->style->basis = (object) ['value' => 80, 'unit' => '%'];
        self::assertSame('grid', $project('base')[$track->instance_id]['display']);
        self::assertSame('80%', $project('base')[$slide->instance_id]['flex-basis']);
        self::assertSame('none', $project('mobile')[$track->instance_id]['display']);
    }

    public function test_button_typography_inherits_unless_explicitly_authored(): void
    {
        $document = $this->document('tabs');
        $button = $document->blocks[0]->slots->content[0]->slots->content[0];
        $validator = $this->validator();
        $project = fn (string $screen): array => BehaviorPresentation::apply($document, Presentation::document($document, $screen, $validator->semanticDisplays()), $screen)['styles'][$button->instance_id];
        foreach (['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color'] as $property) {
            self::assertSame('inherit', $project('base')[$property]);
        }
        $button->style->font_size = (object) ['value' => 22, 'unit' => 'px'];
        $button->responsive->mobile = (object) ['font_size' => (object) ['value' => 18, 'unit' => 'px']];
        self::assertSame('22px', $project('base')['font-size']);
        self::assertSame('18px', $project('mobile')['font-size']);
    }

    public function test_button_and_group_labels_are_escaped_without_executable_markup(): void
    {
        $document = $this->document('tabs');
        $document->blocks[0]->slots->content[0]->slots->content[0]->props->label = '<script>실행 금지</script>';
        $document->blocks[0]->behavior->label = '" onmouseover="bad';
        $html = (new DraftRenderer($this->validator()))->render($this->encode($document));
        self::assertStringContainsString('&lt;script&gt;실행 금지&lt;/script&gt;', $html);
        self::assertStringContainsString('aria-label="&quot; onmouseover=&quot;bad"', $html);
        self::assertStringNotContainsString('<script>', $html);
        self::assertStringNotContainsString('aria-label="" onmouseover=', $html);
    }
}
