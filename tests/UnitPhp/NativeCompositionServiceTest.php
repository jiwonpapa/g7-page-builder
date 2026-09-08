<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compositions\NativeCompositionService;
use Modules\Jiwonpapa\PageBuilder\Contracts\NativeCompositionRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compositions\NativeComposition;
use PHPUnit\Framework\TestCase;

final class NativeCompositionServiceTest extends TestCase
{
    private function payload(): string
    {
        return json_encode(['schema_version' => 'g7.editor-composition/v1', 'node' => (object) ['id' => 'kept', 'future' => (object) []],
            'templateIdentifier' => 'sirsoft-basic', 'layoutName' => 'about', 'scope' => 'template', 'signature' => str_repeat('a', 64)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    public function test_it_preserves_exact_host_json_and_uses_server_identity(): void
    {
        $repository = $this->createMock(NativeCompositionRepository::class);
        $repository->expects(self::once())->method('create')->willReturnArgument(0);
        $item = (new NativeCompositionService($repository))->create(7, NativeComposition::SCHEMA_VERSION, '  소개  ', $this->payload());
        self::assertSame($this->payload(), $item->snapshot);
        self::assertSame(7, $item->actorId);
        self::assertSame('소개', $item->title);
        self::assertMatchesRegularExpression('/^[a-f0-9-]{36}$/', $item->id);
        self::assertArrayNotHasKey('snapshot', $item->toArray());
        self::assertSame($item->snapshot, $item->toArray(true)['snapshot']);
    }

    public function test_invalid_format_version_title_or_size_never_writes(): void
    {
        $repository = $this->createMock(NativeCompositionRepository::class);
        $repository->expects(self::never())->method('create');
        $service = new NativeCompositionService($repository);
        foreach ([
            [NativeComposition::SCHEMA_VERSION, '', $this->payload()],
            ['g7-page-builder/section-pattern/v1', '조합', $this->payload()],
            [NativeComposition::SCHEMA_VERSION, str_repeat('가', 121), $this->payload()],
            [NativeComposition::SCHEMA_VERSION, '조합', '{'],
            [NativeComposition::SCHEMA_VERSION, '조합', str_repeat(' ', NativeComposition::MAX_BYTES + 1)],
            [NativeComposition::SCHEMA_VERSION, '조합', str_replace('g7.editor-composition/v1', 'g7.editor-composition/v2', $this->payload())],
            [NativeComposition::SCHEMA_VERSION, '조합', '{"section":{}}'],
        ] as [$schema, $title, $payload]) {
            try {
                $service->create(7, $schema, $title, $payload);
                self::fail('Invalid composition accepted');
            } catch (\InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_lookup_and_delete_are_actor_scoped_and_absence_is_not_disclosed(): void
    {
        $repository = $this->createMock(NativeCompositionRepository::class);
        $repository->expects(self::once())->method('findFor')->with(9, 'private')->willReturn(null);
        $repository->expects(self::once())->method('deleteFor')->with(9, 'private')->willReturn(false);
        $service = new NativeCompositionService($repository);
        foreach (['find', 'delete'] as $method) {
            try {
                $service->$method(9, 'private');
                self::fail('Foreign record accepted');
            } catch (\DomainException $error) {
                self::assertSame('조합을 찾을 수 없습니다.', $error->getMessage());
            }
        }
    }
}
