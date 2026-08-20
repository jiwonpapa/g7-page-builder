<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockTypeCompilerPort;

final class BlockCompilerRegistry
{
    /** @var array<string, BlockTypeCompilerPort> */
    private array $compilers = [];

    public function register(BlockTypeCompilerPort $compiler): void
    {
        $key = $compiler->key();
        if (preg_match('/^[a-z0-9][a-z0-9._\/-]{1,127}$/', $key) !== 1) {
            throw new \InvalidArgumentException('Block compiler key is invalid.');
        }
        if (isset($this->compilers[$key])) {
            throw new \DomainException("Block compiler {$key} is already registered.");
        }

        $this->compilers[$key] = $compiler;
    }

    /** @param array<string, mixed> $props */
    public function compile(string $key, array $props): string
    {
        $compiler = $this->compilers[$key] ?? null;
        if ($compiler === null) {
            throw new \DomainException("Block compiler {$key} is not registered.");
        }

        return $compiler->compile($props);
    }

    public function has(string $key): bool
    {
        return isset($this->compilers[$key]);
    }

    public function unregister(string $key): void
    {
        unset($this->compilers[$key]);
    }
}
