<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class G7RecentPostsBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.g7-board-recent-posts-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'boardSlug', 'period', 'limit', 'pageSize', 'audience', 'emptyMessage', 'appearance'], 'G7 recent posts');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->properties->requiredString($props, 'source', 16);
        $boardSlug = $this->properties->optionalString($props, 'boardSlug', 80) ?? '';
        $period = $this->properties->requiredString($props, 'period', 16);
        $limit = $this->properties->requiredIntegerChoice($props, 'limit', [3, 4, 6, 8, 12]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->properties->requiredIntegerChoice($props, 'pageSize', [3, 4, 6]) : 3;
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');

        if (! in_array($source, ['recent', 'popular', 'board'], true)
            || ($boardSlug !== '' && preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/D', $boardSlug) !== 1)
            || ! in_array($period, ['today', 'week', 'month', 'year'], true)
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 recent posts configuration is invalid.');
        }

        $endpoint = $source === 'popular'
            ? "/api/modules/sirsoft-board/boards/popular?period={$period}&limit={$limit}"
            : "/api/modules/sirsoft-board/boards/posts/recent?limit={$limit}";
        if ($source === 'board') {
            if ($boardSlug === '') {
                throw new DocumentCompileException('게시글을 표시할 게시판을 선택해 주세요.');
            }
            $endpoint = '/api/modules/sirsoft-board/boards/'.rawurlencode($boardSlug)."/posts?per_page={$limit}&sort_by=id&sort_order=desc";
        }
        $dataLimit = $source === 'board' ? ' data-g7pb-data-limit="'.$limit.'"' : '';
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--posts '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-recent-posts" data-g7pb-data-source="posts" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$dataLimit.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">콘텐츠를 불러오는 중입니다.</p><div class="g7pb-dynamic-posts" data-g7pb-data-list aria-busy="true"></div>'.$this->markup->compilePagination('게시글').'</section>';
    }
}
