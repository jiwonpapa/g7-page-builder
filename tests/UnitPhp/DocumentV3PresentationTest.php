<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\Presentation;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentV3PresentationTest extends TestCase
{
    private function validator(): Validator
    {
        return new Validator(json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(__DIR__.'/../../schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
    }

    private function fixture(): stdClass
    {
        return json_decode(file_get_contents(__DIR__.'/../Contract/document-v3.fixture.json'), flags: JSON_THROW_ON_ERROR);
    }

    private function encode(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function test_shared_presentation_cases_cover_every_style_property(): void
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../Contract/document-v3-presentation.json'), flags: JSON_THROW_ON_ERROR);
        $keys = [];
        foreach ($cases as $case) {
            $doc = $this->fixture();
            $target = $doc->blocks[0]->slots->content[0];
            $doc->blocks[0]->slots->content = [$target];
            $doc->blocks[0]->style = $case->parent ?? new stdClass;
            $doc->blocks[0]->responsive = new stdClass;
            $target->style = $case->style;
            $target->responsive = new stdClass;
            $json = $this->encode($doc);
            $valid = $this->validator()->validateJson($json);
            $styles = Presentation::document($valid)[$target->instance_id];
            foreach (get_object_vars($case->expected) as $key => $expected) {
                self::assertSame($expected, $styles[$key], $case->name.':'.$key);
            }
            self::assertSame($json, $this->encode($valid));
            $keys = array_merge($keys, array_keys(get_object_vars($case->style)));
        }
        $schema = json_decode(file_get_contents(__DIR__.'/../../schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame([], array_values(array_diff(array_keys($schema['$defs']['style']['properties']), $keys)));
        self::assertSame('border-box', Presentation::SURFACE['box-sizing']);
        self::assertSame('0', Presentation::PARAGRAPH['margin']);
    }

    public function test_breakpoint_zero_false_and_inline_marks_are_preserved(): void
    {
        $doc = $this->validator()->validateJson($this->encode($this->fixture()));
        $id = $doc->blocks[0]->slots->content[0]->instance_id;
        self::assertSame('2rem', Presentation::document($doc)[$id]['font-size']);
        self::assertSame('24px', Presentation::document($doc, 'tablet')[$id]['font-size']);
        self::assertSame('18px', Presentation::document($doc, 'mobile')[$id]['font-size']);
        self::assertSame('0', Presentation::document($doc, 'mobile')[$id]['opacity']);
        self::assertSame('block', Presentation::document($doc, 'mobile')[$id]['display']);
        self::assertSame(['font-weight' => '400', 'font-style' => 'normal', 'text-decoration' => 'none'],
            Presentation::run((object) ['text' => 'x', 'bold' => false, 'italic' => false, 'underline' => false, 'strike' => false], $doc));
        self::assertSame(['color' => '#112233', 'font-size' => '2rem', 'font-weight' => '700', 'font-style' => 'italic', 'text-decoration' => 'underline line-through'],
            Presentation::run(json_decode('{"text":"x","bold":true,"italic":true,"underline":true,"strike":true,"color":{"kind":"token","value":"text"},"font_size":{"value":2,"unit":"rem"}}'), $doc));
        self::assertSame([], Presentation::run((object) ['text' => 'x'], $doc));
    }

    public function test_default_fill_axis_flow_and_object_position(): void
    {
        $doc = $this->fixture();
        $target = $doc->blocks[0]->slots->content[0];
        $doc->blocks[0]->slots->content = [$target];
        $doc->blocks[0]->style = (object) ['display' => 'flex'];
        $doc->blocks[0]->responsive = new stdClass;
        $target->style = (object) ['height' => 'fill', 'position' => 'flow', 'object_x' => 0];
        $target->responsive = new stdClass;
        $styles = Presentation::document($this->validator()->validateJson($this->encode($doc)))[$target->instance_id];
        self::assertSame('auto', $styles['height']);
        self::assertSame('stretch', $styles['align-self']);
        self::assertSame('static', $styles['position']);
        self::assertSame('0% 50%', $styles['object-position']);
    }
}
