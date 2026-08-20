<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

interface BlockTypeCompilerPort
{
    public function key(): string;

    /** @param array<string, mixed> $props */
    public function compile(array $props): string;
}
