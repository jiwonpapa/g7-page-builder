<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use stdClass;

/** The document places an opaque capability. The existing runtime owns its implementation. */
final class SystemMarkup
{
    /** @return array<string, string> */
    public static function attributes(stdClass $node, stdClass $document): array
    {
        if (! isset($node->system)) {
            return [];
        }
        $options = array_fill_keys(['search', 'account', 'cart', 'notifications', 'theme', 'locale', 'currency'], false);
        $options[$node->system->kind] = true;

        return ['data-v3-system' => $node->system->kind, 'data-g7pb-system-controls' => '',
            'data-g7pb-shell-options' => json_encode($options, JSON_THROW_ON_ERROR), 'data-g7pb-shell-locale' => $document->locale];
    }
}
