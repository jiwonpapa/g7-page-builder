<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;

final readonly class CallbackBlockTypeCompiler implements BlockTypeCompilerPort
{
    /** @param \Closure(array<string, mixed>): string $compiler */
    public function __construct(
        private string $key,
        private \Closure $compiler,
    ) {}

    public function key(): string
    {
        return $this->key;
    }

    public function compile(array $props): string
    {
        return ($this->compiler)($props);
    }
}
