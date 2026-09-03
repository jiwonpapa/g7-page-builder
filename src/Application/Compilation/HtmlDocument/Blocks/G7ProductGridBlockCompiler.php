<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class G7ProductGridBlockCompiler implements BlockTypeCompilerPort
{
    public function __construct(
        private BlockPropertyReader $properties,
        private BlockAppearanceCompiler $appearance,
        private BlockMarkupCompiler $markup,
        private HtmlEscaper $escaper,
    ) {}

    public function key(): string
    {
        return 'builtin.g7-ecommerce-product-grid-01';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'source', 'limit', 'columns', 'pageSize', 'audience', 'detailBasePath', 'emptyMessage', 'appearance'], 'G7 product grid');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $source = $this->properties->requiredString($props, 'source', 16);
        $limit = $this->properties->requiredIntegerChoice($props, 'limit', [2, 3, 4, 6, 8, 12]);
        $columns = $this->properties->requiredIntegerChoice($props, 'columns', [2, 3, 4]);
        $pageSize = array_key_exists('pageSize', $props) ? $this->properties->requiredIntegerChoice($props, 'pageSize', [2, 3, 4, 6]) : 4;
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $detailBasePath = $this->properties->requiredString($props, 'detailBasePath', 200);
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');

        if (! in_array($source, ['latest', 'new', 'popular'], true)
            || ! in_array($audience, ['all', 'guest', 'member'], true)
            || preg_match('#^/[A-Za-z0-9/_-]*$#', $detailBasePath) !== 1) {
            throw new DocumentCompileException('G7 product grid configuration is invalid.');
        }

        $endpoint = match ($source) {
            'new' => "/api/modules/sirsoft-ecommerce/products/new?limit={$limit}",
            'popular' => "/api/modules/sirsoft-ecommerce/products/popular?limit={$limit}",
            default => "/api/modules/sirsoft-ecommerce/products?per_page={$limit}&sort=latest",
        };
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-dynamic--products '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-grid" data-g7pb-data-source="products" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-page-size="'.$pageSize.'" data-g7pb-audience="'.$audience.'" data-g7pb-product-base="'.$this->escaper->escapeAttribute(rtrim($detailBasePath, '/')).'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-dynamic-products g7pb-dynamic-products--'.$columns.'" data-g7pb-data-list aria-busy="true"></div>'.$this->markup->compilePagination('상품').'</section>';
    }
}
