<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Tests\Support\CreatesBuiltInCompiler;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class G7BoardSourceCompilationTest extends TestCase
{
    use CreatesBuiltInCompiler;

    /** @param array<string, mixed> $props */
    private function compile(array $props): string
    {
        $contents = file_get_contents(dirname(__DIR__).'/Contract/document-v1.fixture.json');
        self::assertIsString($contents);
        $data = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        $data['blocks'][0]['type'] = 'g7.board-recent-posts-01';
        $data['blocks'][0]['props'] = array_replace([
            'eyebrow' => '', 'heading' => '공지사항', 'source' => 'recent', 'period' => 'week',
            'limit' => 6, 'pageSize' => 3, 'audience' => 'all', 'emptyMessage' => '새 소식을 기다려 주세요.',
        ], $props);

        return (string) $this->builtInCompiler()->compile(PageBuilderDocument::fromArray($data), 1, 'html', 'g7-7.0.7')->artifact;
    }

    public function test_compiles_a_fixed_permission_checked_board_endpoint(): void
    {
        $html = $this->compile(['source' => 'board', 'boardSlug' => 'company-notice']);
        self::assertStringContainsString('/boards/company-notice/posts?per_page=6&amp;sort_by=id&amp;sort_order=desc', $html);
        self::assertStringContainsString('data-g7pb-data-limit="6"', $html);
        self::assertStringContainsString('공지사항', $html);
    }

    public function test_keeps_legacy_endpoints_and_markup_without_a_board(): void
    {
        $recent = $this->compile([]);
        self::assertStringContainsString('/boards/posts/recent?limit=6', $recent);
        self::assertStringNotContainsString('data-g7pb-data-limit', $recent);
        self::assertSame($recent, $this->compile(['boardSlug' => 'notice']));
        self::assertStringContainsString('/boards/popular?period=week&amp;limit=6', $this->compile(['source' => 'popular']));
    }

    /** @return iterable<string, array{string}> */
    public static function invalidBoards(): iterable
    {
        foreach (['', '../admin', 'notice?limit=0', 'notice/other', 'notice%2fother', "notice\n", str_repeat('x', 81)] as $index => $slug) {
            yield 'case-'.$index => [$slug];
        }
    }

    #[DataProvider('invalidBoards')]
    public function test_rejects_missing_or_unsafe_board_selection(string $slug): void
    {
        $this->expectException(DocumentCompileException::class);
        $this->compile(['source' => 'board', 'boardSlug' => $slug]);
    }
}
