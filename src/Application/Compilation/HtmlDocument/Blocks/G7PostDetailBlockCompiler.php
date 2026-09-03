<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class G7PostDetailBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private CompilationUrlPolicy $urls,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.g7-board-post-detail-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'boardSlug', 'postId', 'detailUrl', 'linkLabel', 'audience', 'showContent', 'emptyMessage', 'appearance'], 'G7 post detail');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $boardSlug = $this->properties->requiredString($props, 'boardSlug', 80);
        $postId = $props['postId'] ?? null;
        $detailUrl = $this->properties->requiredString($props, 'detailUrl', 2048);
        $linkLabel = $this->properties->requiredString($props, 'linkLabel', 120);
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $showContent = $this->properties->requiredBoolean($props, 'showContent');
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearance->appearanceClasses($props, 'default', 'normal');

        if (preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/D', $boardSlug) !== 1
            || ! is_int($postId) || $postId < 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 post detail configuration is invalid.');
        }
        $this->urls->assertAllowedUrl($detailUrl, 'G7 post detail');
        $endpoint = '/api/modules/sirsoft-board/boards/'.rawurlencode($boardSlug).'/posts/'.$postId;
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-post-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-post-detail" data-g7pb-data-source="post-detail" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escaper->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escaper->escapeAttribute($linkLabel).'" data-g7pb-show-content="'.($showContent ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">게시글을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escaper->escapeAttribute($detailUrl).'" hidden>'.$this->escaper->escape($linkLabel).'</a></div></section>';
    }
}
