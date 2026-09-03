<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\ElementAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ElementAppearanceCompilerTest extends TestCase
{
    #[DataProvider('customTones')]
    public function test_document_compilation_applies_each_custom_tone_only_to_its_target(int $slot): void
    {
        $document = new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000100',
            slug: 'custom-tone-contract', mode: 'canvas', locale: 'ko',
            tokens: ["design.custom_color_{$slot}_light" => '#123456'],
            blocks: [
                $this->heading(1, '<strong>Styled &amp; safe</strong>', [
                    'elements' => ['heading' => ['tone' => 'custom'.$slot, 'weight' => 'regular']],
                ]),
                $this->heading(2, 'Unstyled sibling', []),
            ],
        );
        $before = $document->toArray();

        $result = (new HtmlDocumentCompiler($this->registry()))->compile($document, 17, 'html', 'g7-7.0.7');

        $dom = new \DOMDocument;
        self::assertTrue($dom->loadHTML($result->artifact, LIBXML_NOERROR | LIBXML_NOWARNING));
        $headings = $dom->getElementsByTagName('h2');
        self::assertSame(2, $headings->length);
        $styled = $headings->item(0);
        $sibling = $headings->item(1);
        self::assertInstanceOf(\DOMElement::class, $styled);
        self::assertInstanceOf(\DOMElement::class, $sibling);
        self::assertSame('g7pb-heading-block__heading g7pb-element-weight--regular g7pb-element-tone--custom'.$slot, $styled->getAttribute('class'));
        self::assertSame('Styled & safe', $styled->textContent);
        self::assertSame(1, $styled->getElementsByTagName('strong')->length);
        self::assertSame('g7pb-heading-block__heading', $sibling->getAttribute('class'));
        self::assertSame('Unstyled sibling', $sibling->textContent);
        self::assertStringContainsString("--g7pb-custom-tone-{$slot}-light:#123456", $result->artifact);
        self::assertSame(hash('sha256', $result->artifact), $result->artifactSha256);
        self::assertSame($before, $document->toArray());
    }

    /** @return iterable<string, array{int}> */
    public static function customTones(): iterable
    {
        foreach ([1, 2, 3, 4] as $slot) {
            yield 'custom'.$slot => [$slot];
        }
    }

    /** @param array<string, mixed> $style */
    #[DataProvider('invalidStyles')]
    public function test_custom_tones_do_not_allow_arbitrary_values_or_style_properties(array $style): void
    {
        $this->expectException(DocumentCompileException::class);

        (new ElementAppearanceCompiler)->apply(
            '<section><h2 class="g7pb-heading-block__heading">Target</h2></section>',
            ['appearance' => ['elements' => ['heading' => $style]]],
            'content.heading-01',
        );
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function invalidStyles(): iterable
    {
        yield 'unregistered slot' => [['tone' => 'custom5']];
        yield 'literal color' => [['tone' => '#123456']];
        yield 'CSS declaration' => [['tone' => 'custom1;color:red']];
        yield 'non-string scalar' => [['tone' => 1]];
        yield 'nested value' => [['tone' => ['custom1']]];
        yield 'raw style property' => [['tone' => 'custom1', 'style' => 'color:red']];
    }

    /**
     * @param  array<string, mixed>  $appearance
     * @return array<string, mixed>
     */
    private function heading(int $id, string $content, array $appearance): array
    {
        return [
            'instance_id' => sprintf('00000000-0000-4000-8000-%012d', $id),
            'type' => 'content.heading-01', 'block_version' => 1,
            'props' => ['heading' => $content, 'level' => 2, 'appearance' => $appearance],
        ];
    }

    private function registry(): BlockRegistry
    {
        $registry = new BlockRegistry;
        $registry->register(BlockPackManifest::fromArray([
            'manifest_version' => 'g7pb-block-pack/v1', 'pack_id' => 'jiwonpapa/builtin-core', 'pack_version' => '1.0.0',
            'kind' => 'code', 'publisher' => ['id' => 'jiwonpapa', 'name' => 'Fixture publisher'],
            'compatibility' => ['page_builder' => '>=0.6.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
            'blocks' => [[
                'block_id' => 'content.heading-01', 'block_version' => 1, 'category' => 'content',
                'label' => ['ko' => '합성 제목'], 'description' => ['ko' => '요소 색상 컴파일 계약'],
                'thumbnail' => 'assets/fixture.webp', 'schema_ref' => 'fixture:tone',
                'editor_component' => 'FixtureHeading', 'compiler' => 'builtin.heading-01', 'capabilities' => [],
            ]],
            'presets' => [], 'files' => [],
            'runtime' => ['provider' => 'fixture.provider', 'editor' => 'dist/editor.js', 'styles' => []],
        ]), enabled: true);

        return $registry;
    }
}
