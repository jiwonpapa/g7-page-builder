<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

interface RouteCatalogPort
{
    /**
     * @return array{
     *     active_template: string,
     *     routes: list<array<string, mixed>>
     * }
     */
    public function catalog(): array;
}
