<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use stdClass;

/** Fixed public adapter routes projected from validated capability inputs, never user endpoints. */
final class DataMarkup
{
    /** @return array<string, string> */
    public static function attributes(stdClass $node): array
    {
        $data = $node->data ?? null;
        if ($data === null) {
            return [];
        }
        $posts = str_starts_with($data->source, 'post');
        $base = $posts ? '/api/modules/sirsoft-board/boards' : '/api/modules/sirsoft-ecommerce/products';
        $endpoint = match ($data->source) {
            'post-detail' => $base.'/'.$data->board_slug.'/posts/'.$data->post_id,
            'product-detail' => $base.'/'.$data->product_key,
            default => $posts ? match ($data->feed) {
                'popular' => $base.'/popular?period='.$data->period.'&limit='.$data->limit,
                'board' => $base.'/'.$data->board_slug.'/posts?per_page='.$data->limit.'&sort_by=id&sort_order=desc',
                default => $base.'/posts/recent?limit='.$data->limit,
            } : match ($data->feed) {
                'new', 'popular' => $base.'/'.$data->feed.'?limit='.$data->limit,
                default => $base.'?per_page='.$data->limit.'&sort=latest',
            },
        };

        return ['data-g7pb-data-source' => $data->source, 'data-g7pb-endpoint' => $endpoint,
            'data-g7pb-audience' => $data->audience, 'data-g7pb-data-limit' => (string) $data->limit,
            ...isset($data->controls) ? ['data-g7pb-v3-controls' => json_encode($data->controls, JSON_THROW_ON_ERROR), 'data-g7pb-page-size' => (string) $data->controls->page_size] : [],
            'data-g7pb-v3-data' => json_encode($data->fields, JSON_THROW_ON_ERROR),
            'data-g7pb-empty-message' => '표시할 콘텐츠가 없습니다.'];
    }

    public static function wrap(stdClass $node, string $body): string
    {
        if (! isset($node->data)) {
            return $body;
        }
        $target = str_ends_with($node->data->source, '-detail') ? 'detail' : 'list';

        return '<template data-g7pb-data-template="">'.$body.'</template><div data-g7pb-data-'.$target.'="" style="display:contents" aria-busy="true"></div><p data-g7pb-data-status="" role="status" style="margin:0">콘텐츠를 불러오는 중입니다.</p>';
    }
}
