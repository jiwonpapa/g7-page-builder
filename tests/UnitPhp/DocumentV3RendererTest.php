<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use InvalidArgumentException;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\DraftRenderer;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DocumentV3RendererTest extends TestCase
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

    public function test_six_semantic_nodes_with_escaped_text_and_stable_identity(): void
    {
        $doc = $this->fixture();
        $section = $doc->blocks[0];
        $heading = $section->slots->content[0];
        $heading->props->runs[0]->text = '<script>안전한 문자</script>';
        $image = $section->slots->content[1];
        $image->props->alt = '"><svg onload="bad">';
        $section->slots->content[3]->props->label = '<b>문자</b>';
        $container = clone $section;
        $container->type = 'layout.container';
        $container->instance_id = '00000000-0000-4000-8000-000000000006';
        $container->props = (object) ['tag' => 'article'];
        $container->slots = new stdClass;
        $section->slots->content[] = $container;
        $json = $this->encode($doc);
        $html = (new DraftRenderer($this->validator()))->render($json);
        self::assertSame($json, $this->encode($doc));
        self::assertSame(6, substr_count($html, 'data-v3-node='));
        self::assertStringContainsString('<h1 id="node-'.$heading->instance_id.'"', $html);
        self::assertStringContainsString('<article id="node-'.$container->instance_id.'"', $html);
        self::assertStringContainsString('&lt;script&gt;안전한 문자&lt;/script&gt;', $html);
        self::assertStringNotContainsString('<script>', $html);
        self::assertStringContainsString('alt="&quot;&gt;&lt;svg onload=&quot;bad&quot;&gt;"', $html);
        self::assertStringContainsString('&lt;b&gt;문자&lt;/b&gt;', $html);
        self::assertStringContainsString('target="_blank" rel="noopener noreferrer"', $html);
        self::assertStringContainsString('href="#details"', $html);
        self::assertStringContainsString('grid-template-columns:minmax(120px,1fr) 2fr;', $html);
    }

    public function test_hidden_and_empty_content_with_responsive_styles(): void
    {
        $doc = $this->fixture();
        $heading = $doc->blocks[0]->slots->content[0];
        $heading->style->hidden = true;
        $renderer = new DraftRenderer($this->validator());
        self::assertStringNotContainsString('data-v3-node="'.$heading->instance_id.'"', $renderer->render($this->encode($doc)));
        $mobile = $renderer->render($this->encode($doc), 'mobile');
        self::assertStringContainsString('data-v3-node="'.$heading->instance_id.'"', $mobile);
        self::assertStringContainsString('font-size:18px;', $mobile);
        self::assertStringContainsString('opacity:0;', $mobile);
        $doc->blocks = [];
        self::assertStringNotContainsString('data-v3-node=', $renderer->render($this->encode($doc)));
        $this->expectException(InvalidArgumentException::class);
        $renderer->render($this->encode($doc), 'invalid');
    }

    public function test_unsafe_input_fails_before_any_fragment_is_returned(): void
    {
        $doc = $this->fixture();
        $doc->blocks[0]->slots->content[3]->props->link->url = 'javascript:alert(1)';
        $this->expectException(InvalidArgumentException::class);
        (new DraftRenderer($this->validator()))->render($this->encode($doc));
    }

    public function test_semantic_table_groups_retain_their_html_and_default_display(): void
    {
        $document = $this->fixture();
        $sequence = 100;
        $node = function (string $tag, array $children = []) use (&$sequence): stdClass {
            return (object) ['instance_id' => sprintf('00000000-0000-4000-8000-%012d', ++$sequence),
                'type' => 'layout.container', 'block_version' => 1, 'name' => $tag, 'locked' => false,
                'props' => (object) ['tag' => $tag], 'slots' => (object) ['content' => $children],
                'style' => new stdClass, 'responsive' => new stdClass];
        };
        $document->blocks = [$node('table', [$node('caption'), $node('thead', [$node('tr', [$node('th')])]),
            $node('tbody', [$node('tr', [$node('td')])]), $node('tfoot', [$node('tr', [$node('td')])])]),
            $node('ul', [$node('li')]), $node('figure', [$node('blockquote'), $node('figcaption')])];
        $source = $this->encode($document);
        $html = (new DraftRenderer($this->validator()))->render($source);
        foreach (['table' => 'table', 'caption' => 'table-caption', 'thead' => 'table-header-group', 'tbody' => 'table-row-group',
            'tfoot' => 'table-footer-group', 'tr' => 'table-row', 'th' => 'table-cell', 'td' => 'table-cell', 'li' => 'list-item'] as $tag => $display) {
            self::assertMatchesRegularExpression('/<'.$tag.' [^>]*display:'.$display.';/', $html);
        }
        self::assertSame($source, $this->encode($document));
        $document->blocks[0]->slots->content = [$node('tr')];
        $this->expectExceptionMessage('semantic_parent:');
        (new DraftRenderer($this->validator()))->render($this->encode($document));
    }
}
