<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockCompilerRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockSchemaRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Blocks\CallbackBlockTypeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\DocumentThemeCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\ElementAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackAssetUrlPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockSchemaValidatorPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class HtmlCompilerCompositionTest extends TestCase
{
    public function test_constructor_keeps_caller_builtin_compiler_and_registers_missing_defaults(): void
    {
        $compilers = new BlockCompilerRegistry;
        $props = ['title' => 'Caller content'];
        $override = $this->createMock(BlockTypeCompilerPort::class);
        $override->method('key')->willReturn('builtin.hero-centered-01');
        $override->expects(self::once())->method('compile')->with($props)
            ->willReturn('<section class="caller-renderer"><h1>Caller result</h1></section>');
        $compilers->register($override);
        $urls = new CompilationUrlPolicy;
        $compiler = new HtmlDocumentCompiler(
            blockRegistry: $this->registry(),
            blockCompilers: $compilers,
            blockSchemas: null,
            blockAssets: null,
            theme: new DocumentThemeCompiler,
            urls: $urls,
            elementAppearances: new ElementAppearanceCompiler,
            richText: new RichTextSanitizer($urls),
        );
        $document = $this->document([
            $this->block(1, 'content.hero-centered-01', $props),
            $this->section(2, [$this->heading(3, 'nested')]),
        ]);

        $result = $compiler->compile($document, 17, 'html', 'g7-7.0.7');

        self::assertStringContainsString('class="caller-renderer"', $result->artifact);
        self::assertStringContainsString('<h1>Caller result</h1>', $result->artifact);
        self::assertStringNotContainsString('Caller content', $result->artifact);
        self::assertStringContainsString('id="nested"><strong>Heading</strong></h2>', $result->artifact);
        self::assertTrue($compilers->has('builtin.heading-01'));
        $this->assertResultContract($result, $document, 17, []);
    }

    public function test_external_style_order_and_compile_context_reset_on_v1_success_and_failure(): void
    {
        $compilers = new BlockCompilerRegistry;
        $schemas = new BlockSchemaRegistry;
        foreach (['alpha', 'beta'] as $name) {
            $compilers->register(new CallbackBlockTypeCompiler(
                'vendor.'.$name,
                static fn (array $props): string => '<section class="external"><p>'.$name.'</p></section>',
            ));
            $validator = $this->createStub(BlockSchemaValidatorPort::class);
            $validator->method('schemaRef')->willReturn('vendor:'.$name);
            $schemas->register($validator);
        }
        $assets = $this->createStub(BlockPackAssetUrlPort::class);
        $assets->method('styleUrls')->willReturnMap([
            ['vendor/beta', '1.0.0', ['/styles/beta.css', '/styles/shared.css']],
            ['vendor/alpha', '1.0.0', ['/styles/shared.css', '/styles/alpha.css?one=1&two=2']],
        ]);
        $compiler = new HtmlDocumentCompiler($this->registry(), $compilers, $schemas, $assets);
        $blocks = [
            $this->heading(1, 'root'),
            $this->block(2, 'content.hero-centered-01', ['title' => 'Root hero']),
            $this->block(3, 'vendor.beta', []),
            $this->block(4, 'content.hero-centered-01', ['title' => 'Second hero']),
            $this->block(5, 'vendor.alpha', []),
            $this->block(6, 'vendor.beta', []),
            $this->heading(7, 'second'),
        ];
        // External IDs are supported by v1; v2 has a structural type allowlist.
        $document = $this->document($blocks, 'g7-page-builder/v1');
        $result = $compiler->compile($document, 3, 'html', 'g7-7.0.7');
        $this->assertResultContract($result, $document, 3, [
            'Hero 계열 블록이 2개 있습니다. 첫 화면 집중도가 낮아질 수 있습니다.',
        ]);
        preg_match_all('/<link rel="stylesheet" href="([^"]+)">/', $result->artifact, $styles);
        self::assertSame([
            '/styles/beta.css', '/styles/shared.css', '/styles/alpha.css?one=1&amp;two=2',
        ], $styles[1]);
        self::assertStringStartsWith(implode("\n", $styles[0])."\n<div ", $result->artifact);

        $blocks[6] = $this->heading(7, 'root');
        try {
            $compiler->compile($this->document($blocks, 'g7-page-builder/v1'), 4, 'html', 'g7-7.0.7');
            self::fail('A heading reused an earlier anchor.');
        } catch (DocumentCompileException $exception) {
            self::assertSame('G7PB_COMPILE_FAILED', $exception->errorCode);
            self::assertSame('Heading anchor root is duplicated.', $exception->getMessage());
        }

        // The failed compile had already accumulated two heroes and both packs.
        $clean = $this->document([
            $this->heading(1, 'root'),
            $this->block(2, 'content.hero-centered-01', ['title' => 'Only hero']),
        ], 'g7-page-builder/v1');
        $cleanResult = $compiler->compile($clean, 5, 'html', 'g7-7.0.7');
        $this->assertResultContract($cleanResult, $clean, 5, []);
        self::assertStringNotContainsString('<link ', $cleanResult->artifact);
        self::assertStringNotContainsString('Second hero', $cleanResult->artifact);
        self::assertStringContainsString('id="root"', $cleanResult->artifact);

        $repeated = $compiler->compile($document, 6, 'html', 'g7-7.0.7');
        self::assertSame($result->artifact, $repeated->artifact);
        self::assertSame($result->artifactSha256, $repeated->artifactSha256);
        self::assertSame($result->warnings, $repeated->warnings);
    }

    public function test_root_heroes_and_nested_headings_keep_document_context_without_leaking_it(): void
    {
        $compiler = new HtmlDocumentCompiler($this->registry());
        $blocks = [
            $this->heading(1, 'root'),
            $this->block(2, 'content.hero-centered-01', ['title' => 'Root hero']),
            $this->block(3, 'content.hero-centered-01', ['title' => 'Second hero']),
            $this->section(4, [
                $this->heading(5, 'nested'),
            ]),
        ];
        $document = $this->document($blocks);
        $result = $compiler->compile($document, 7, 'html', 'g7-7.0.7');
        $this->assertResultContract($result, $document, 7, [
            'Hero 계열 블록이 2개 있습니다. 첫 화면 집중도가 낮아질 수 있습니다.',
        ]);
        self::assertStringContainsString('Second hero', $result->artifact);
        self::assertStringContainsString('id="nested"', $result->artifact);

        $blocks[3]['slots']['content'][0] = $this->heading(5, 'root');
        try {
            $compiler->compile($this->document($blocks), 8, 'html', 'g7-7.0.7');
            self::fail('A nested heading reused a root anchor.');
        } catch (DocumentCompileException $exception) {
            self::assertSame('G7PB_COMPILE_FAILED', $exception->errorCode);
            self::assertSame('Heading anchor root is duplicated.', $exception->getMessage());
        }
        $clean = $this->document([
            $this->heading(1, 'root'),
            $this->block(2, 'content.hero-centered-01', ['title' => 'Only hero']),
        ]);
        $this->assertResultContract($compiler->compile($clean, 9, 'html', 'g7-7.0.7'), $clean, 9, []);
    }

    #[DataProvider('externalFailureCases')]
    public function test_external_throwable_is_mapped_to_the_exact_v1_root_path(string $stage, \Throwable $failure): void
    {
        $compiler = $this->failingExternalCompiler($stage, $failure);

        try {
            $compiler->compile($this->externalDocument(), 9, 'html', 'g7-7.0.7');
            self::fail('An external schema or renderer error was swallowed.');
        } catch (DocumentCompileException $exception) {
            self::assertSame('G7PB_BLOCK_RUNTIME_FAILED', $exception->errorCode);
            self::assertSame(
                'Block 1 failed schema validation or compilation.',
                $exception->getMessage(),
            );
            self::assertNotSame($failure, $exception);
        }
    }

    /** @return iterable<string, array{string, \Throwable}> */
    public static function externalFailureCases(): iterable
    {
        yield 'schema exception' => ['schema', new \InvalidArgumentException('Private schema details')];
        yield 'schema error' => ['schema', new \Error('Private schema error')];
        yield 'runtime exception' => ['runtime', new \RuntimeException('Private runtime details')];
        yield 'runtime error' => ['runtime', new \Error('Private runtime error')];
    }

    #[DataProvider('externalStages')]
    public function test_existing_document_compile_exception_is_preserved_by_identity(string $stage): void
    {
        $failure = new DocumentCompileException('External semantic diagnostic.', 'VENDOR_COMPILE_FAILED');
        $compiler = $this->failingExternalCompiler($stage, $failure);

        try {
            $compiler->compile($this->externalDocument(), 10, 'html', 'g7-7.0.7');
            self::fail('An existing compile diagnostic was swallowed.');
        } catch (DocumentCompileException $exception) {
            self::assertSame($failure, $exception);
            self::assertSame('External semantic diagnostic.', $exception->getMessage());
            self::assertSame('VENDOR_COMPILE_FAILED', $exception->errorCode);
        }
    }

    /** @return iterable<string, array{string}> */
    public static function externalStages(): iterable
    {
        yield 'schema' => ['schema'];
        yield 'runtime' => ['runtime'];
    }

    #[DataProvider('nestedFailureCases')]
    public function test_nested_builtin_callback_keeps_exact_path_or_existing_diagnostic(\Throwable $failure): void
    {
        $compilers = new BlockCompilerRegistry;
        $runtime = $this->createMock(BlockTypeCompilerPort::class);
        $runtime->method('key')->willReturn('builtin.rich-text-01');
        $runtime->expects(self::once())->method('compile')->with(['content' => 'Nested failure'])->willThrowException($failure);
        $compilers->register($runtime);
        $compiler = new HtmlDocumentCompiler($this->registry(), $compilers);

        try {
            $compiler->compile($this->nestedDocument(), 11, 'html', 'g7-7.0.7');
            self::fail('A nested compiler error was swallowed.');
        } catch (DocumentCompileException $exception) {
            if ($failure instanceof DocumentCompileException) {
                self::assertSame($failure, $exception);
                self::assertSame('NESTED_DIAGNOSTIC', $exception->errorCode);
                self::assertSame('Nested semantic diagnostic.', $exception->getMessage());
            } else {
                self::assertSame('G7PB_BLOCK_RUNTIME_FAILED', $exception->errorCode);
                self::assertSame(
                    'Block 1.content.0.column2.0.content.0 failed schema validation or compilation.',
                    $exception->getMessage(),
                );
            }
        }

        $clean = $this->document([$this->heading(1, 'root'), $this->heading(2, 'nested')]);
        $this->assertResultContract($compiler->compile($clean, 12, 'html', 'g7-7.0.7'), $clean, 12, []);
    }

    /** @return iterable<string, array{\Throwable}> */
    public static function nestedFailureCases(): iterable
    {
        yield 'exception' => [new \RuntimeException('Private nested details')];
        yield 'error' => [new \Error('Private nested error')];
        yield 'compile diagnostic' => [new DocumentCompileException('Nested semantic diagnostic.', 'NESTED_DIAGNOSTIC')];
    }

    private function failingExternalCompiler(string $stage, \Throwable $failure): HtmlDocumentCompiler
    {
        $schemas = new BlockSchemaRegistry;
        $validator = $this->createMock(BlockSchemaValidatorPort::class);
        $validator->method('schemaRef')->willReturn('vendor:alpha');
        $validation = $validator->expects(self::once())->method('validate')->with(['value' => 'fixture']);
        if ($stage === 'schema') {
            $validation->willThrowException($failure);
        }
        $schemas->register($validator);
        $compilers = new BlockCompilerRegistry;
        $runtime = $this->createMock(BlockTypeCompilerPort::class);
        $runtime->method('key')->willReturn('vendor.alpha');
        if ($stage === 'runtime') {
            $runtime->expects(self::once())->method('compile')->with(['value' => 'fixture'])->willThrowException($failure);
        } else {
            $runtime->expects(self::never())->method('compile');
        }
        $compilers->register($runtime);

        return new HtmlDocumentCompiler($this->registry(), $compilers, $schemas);
    }

    private function externalDocument(): PageBuilderDocument
    {
        return $this->document([
            $this->heading(1, 'root'),
            $this->block(2, 'vendor.alpha', ['value' => 'fixture']),
        ], 'g7-page-builder/v1');
    }

    private function nestedDocument(): PageBuilderDocument
    {
        return $this->document([
            $this->heading(1, 'root'),
            $this->section(2, [
                $this->block(3, 'layout.columns-01', ['columns' => 2, 'ratio' => '1:1', 'gap' => 'normal'], [
                    'column1' => [$this->heading(4, 'nested')],
                    'column2' => [
                        $this->block(5, 'layout.stack-01', ['gap' => 'compact'], [
                            'content' => [$this->block(6, 'content.rich-text-01', ['content' => 'Nested failure'])],
                        ]),
                    ],
                ]),
            ]),
        ]);
    }

    /** @param list<string> $warnings */
    private function assertResultContract(CompileResult $result, PageBuilderDocument $document, int $revision, array $warnings): void
    {
        self::assertIsString($result->artifact);
        self::assertSame(hash('sha256', $result->artifact), $result->artifactSha256);
        self::assertSame('g7-page-builder-compile-result/v1', $result->schemaVersion);
        self::assertSame('0.19.0', $result->compilerVersion);
        self::assertSame($document->documentId, $result->documentId);
        self::assertSame($revision, $result->sourceRevision);
        self::assertSame('html', $result->targetFormat);
        self::assertSame('g7-7.0.7', $result->targetEngineVersion);
        self::assertSame($warnings, $result->warnings);
    }

    /** @param list<array<string, mixed>> $blocks */
    private function document(array $blocks, string $schema = 'g7-page-builder/v2'): PageBuilderDocument
    {
        return new PageBuilderDocument(
            documentId: '00000000-0000-4000-8000-000000000100',
            slug: 'compiler-contract',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: $blocks,
            schemaVersion: $schema,
        );
    }

    /** @return array<string, mixed> */
    private function heading(int $id, string $anchor): array
    {
        return $this->block($id, 'content.heading-01', [
            'heading' => '<p><strong>Heading</strong></p>', 'level' => 2, 'anchor' => $anchor,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $children
     * @return array<string, mixed>
     */
    private function section(int $id, array $children): array
    {
        return $this->block($id, 'layout.section-01', ['width' => 'wide', 'spacing' => 'normal'], ['content' => $children]);
    }

    /**
     * @param  array<string, mixed>  $props
     * @param  array<string, list<array<string, mixed>>>  $slots
     * @return array<string, mixed>
     */
    private function block(int $id, string $type, array $props, array $slots = []): array
    {
        return [
            'instance_id' => sprintf('00000000-0000-4000-8000-%012d', $id),
            'type' => $type, 'block_version' => 1, 'props' => $props, 'slots' => $slots,
        ];
    }

    private function registry(): BlockRegistry
    {
        // Only synthetic definitions: no installed Pack, preset or content manifest is loaded.
        $registry = new BlockRegistry;
        foreach ([
            'jiwonpapa/builtin-core' => [
                'content.heading-01' => 'builtin.heading-01',
                'content.hero-centered-01' => 'builtin.hero-centered-01',
                'content.rich-text-01' => 'builtin.rich-text-01',
            ],
            'vendor/alpha' => ['vendor.alpha' => 'vendor.alpha'],
            'vendor/beta' => ['vendor.beta' => 'vendor.beta'],
        ] as $packId => $definitions) {
            [$publisher, $name] = explode('/', $packId);
            $blocks = [];
            foreach ($definitions as $type => $compiler) {
                $blocks[] = [
                    'block_id' => $type, 'block_version' => 1, 'category' => 'content',
                    'label' => ['ko' => '합성 계약'], 'description' => ['ko' => '컴파일 연결 계약'],
                    'thumbnail' => 'assets/fixture.webp', 'schema_ref' => $publisher.':'.$name,
                    'editor_component' => 'FixtureBlock', 'compiler' => $compiler, 'capabilities' => [],
                ];
            }
            $registry->register(BlockPackManifest::fromArray([
                'manifest_version' => 'g7pb-block-pack/v1', 'pack_id' => $packId, 'pack_version' => '1.0.0',
                'kind' => 'code', 'publisher' => ['id' => $publisher, 'name' => 'Fixture publisher'],
                'compatibility' => ['page_builder' => '>=0.6.0', 'php' => '>=8.5', 'g7' => '>=7.0.7'],
                'blocks' => $blocks, 'presets' => [], 'files' => [],
                'runtime' => ['provider' => 'fixture.provider', 'editor' => 'dist/editor.js', 'styles' => []],
            ]), enabled: true);
        }

        return $registry;
    }
}
