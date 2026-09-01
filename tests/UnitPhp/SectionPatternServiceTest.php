<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Patterns\SectionPatternService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SectionPatternRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Patterns\SectionPattern;
use PHPUnit\Framework\TestCase;

final class SectionPatternServiceTest extends TestCase
{
    public function test_it_saves_only_a_valid_v2_section_with_derived_references(): void
    {
        $repository = $this->createMock(SectionPatternRepository::class);
        $repository->expects(self::once())->method('create')->willReturnArgument(0);
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::once())->method('compile')->willReturnCallback(
            static fn (PageBuilderDocument $document): CompileResult => new CompileResult(
                'test', $document->documentId, 1, 'html', 'g7-html-v1', '<section></section>', hash('sha256', '<section></section>'),
            ),
        );
        $service = new SectionPatternService($repository, $compiler, new BlockRegistry);

        $pattern = $service->create(7, ' 두 열 소개 ', 'custom', 'g7-page-builder/v2', $this->section());

        self::assertSame('두 열 소개', $pattern->title);
        self::assertSame(['content.heading-01@1', 'layout.section-01@1'], $pattern->requiredBlocks);
        self::assertSame(['/media/intro.webp'], $pattern->assetReferences);
        self::assertSame(['kind' => 'section-summary', 'block_count' => 2], $pattern->preview);
    }

    public function test_it_rejects_legacy_or_non_section_roots_before_persistence(): void
    {
        $repository = $this->createMock(SectionPatternRepository::class);
        $repository->expects(self::never())->method('create');
        $service = new SectionPatternService($repository, $this->createStub(DocumentCompilerPort::class), new BlockRegistry);

        foreach ([
            ['g7-page-builder/v1', $this->section()],
            ['g7-page-builder/v2', $this->section()['slots']['content'][0]],
        ] as [$schema, $section]) {
            try {
                $service->create(7, '패턴', 'custom', $schema, $section);
                self::fail('Invalid pattern was accepted.');
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_it_marks_missing_block_capabilities_without_deleting_the_pattern(): void
    {
        $now = new \DateTimeImmutable;
        $pattern = new SectionPattern(
            '123e4567-e89b-42d3-a456-426614174088', 7, '보존 패턴', 'custom', 'g7-page-builder/v2',
            $this->section(), ['content.heading-01@1', 'layout.section-01@1'], [],
            ['kind' => 'section-summary', 'block_count' => 2], $now, $now,
        );
        $repository = $this->createMock(SectionPatternRepository::class);
        $repository->expects(self::once())->method('allFor')->with(7)->willReturn([$pattern]);
        $service = new SectionPatternService($repository, $this->createStub(DocumentCompilerPort::class), new BlockRegistry);

        $listed = $service->all(7);

        self::assertFalse($listed[0]['compatible']);
        self::assertStringContainsString('content.heading-01@1', $listed[0]['compatibility_error']);
        self::assertSame($pattern->section, $listed[0]['section']);
    }

    /** @return array<string, mixed> */
    private function section(): array
    {
        return [
            'instance_id' => '00000000-0000-4000-8000-000000000001',
            'type' => 'layout.section-01',
            'block_version' => 1,
            'props' => ['width' => 'standard', 'spacing' => 'normal'],
            'slots' => ['content' => [[
                'instance_id' => '00000000-0000-4000-8000-000000000002',
                'type' => 'content.heading-01',
                'block_version' => 1,
                'props' => ['heading' => '회사 소개', 'imageSrc' => '/media/intro.webp'],
                'slots' => [],
            ]]],
        ];
    }
}
