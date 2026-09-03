<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\Blocks;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\CompilationUrlPolicy;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockAppearanceCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockMarkupCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\BlockPropertyReader;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument\HtmlEscaper;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class G7ProductDetailBlockCompiler implements BlockTypeCompilerPort
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
        return 'builtin.g7-ecommerce-product-detail-01';
    }

    /** @param array<string, mixed> $props */
    public function compile(array $props): string
    {
        $this->properties->assertOnlyKeys($props, ['eyebrow', 'heading', 'productKey', 'detailUrl', 'buttonLabel', 'audience', 'showDescription', 'emptyMessage', 'appearance'], 'G7 product detail');
        $eyebrow = $this->properties->optionalString($props, 'eyebrow', 120);
        $heading = $this->properties->requiredInlineRichTextString($props, 'heading', 200);
        $productKey = $this->properties->requiredString($props, 'productKey', 100);
        $detailUrl = $this->properties->requiredString($props, 'detailUrl', 2048);
        $buttonLabel = $this->properties->requiredString($props, 'buttonLabel', 120);
        $audience = $this->properties->requiredString($props, 'audience', 16);
        $showDescription = $this->properties->requiredBoolean($props, 'showDescription');
        $emptyMessage = $this->properties->requiredString($props, 'emptyMessage', 300);
        $appearance = $this->appearance->appearanceClasses($props, 'soft', 'normal');

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/D', $productKey) !== 1
            || ! in_array($audience, ['all', 'guest', 'member'], true)) {
            throw new DocumentCompileException('G7 product detail configuration is invalid.');
        }
        $this->urls->assertAllowedUrl($detailUrl, 'G7 product detail');
        $endpoint = '/api/modules/sirsoft-ecommerce/products/'.rawurlencode($productKey);
        $hidden = $audience === 'all' ? '' : ' hidden';

        return '<section class="g7pb-block g7pb-dynamic g7pb-data-detail g7pb-product-detail '.$appearance.'" data-testid="page-builder-rendered-block" data-block-type="g7-product-detail" data-g7pb-data-source="product-detail" data-g7pb-endpoint="'.$this->escaper->escapeAttribute($endpoint).'" data-g7pb-audience="'.$audience.'" data-g7pb-detail-url="'.$this->escaper->escapeAttribute($detailUrl).'" data-g7pb-detail-label="'.$this->escaper->escapeAttribute($buttonLabel).'" data-g7pb-show-description="'.($showDescription ? 'true' : 'false').'" data-g7pb-empty-message="'.$this->escaper->escapeAttribute($emptyMessage).'"'.$hidden.'>'.$this->markup->compileSectionHeading($eyebrow, $heading).'<p class="g7pb-dynamic__status" data-g7pb-data-status role="status">상품을 불러오는 중입니다.</p><div class="g7pb-data-detail__content" data-g7pb-data-detail aria-busy="true"><a class="g7pb-data-detail__action" data-g7pb-detail-action href="'.$this->escaper->escapeAttribute($detailUrl).'" hidden>'.$this->escaper->escape($buttonLabel).'</a></div></section>';
    }
}
