<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockSchemaValidatorPort;

final class BlockSchemaRegistry
{
    /** @var array<string, BlockSchemaValidatorPort> */
    private array $validators = [];

    public function register(BlockSchemaValidatorPort $validator): void
    {
        $schemaRef = $validator->schemaRef();
        if ($schemaRef === '' || strlen($schemaRef) > 512) {
            throw new \InvalidArgumentException('Block schema reference is invalid.');
        }
        if (isset($this->validators[$schemaRef])) {
            throw new \DomainException("Block schema validator {$schemaRef} is already registered.");
        }

        $this->validators[$schemaRef] = $validator;
    }

    /** @param array<string, mixed> $props */
    public function validate(string $schemaRef, array $props): void
    {
        $validator = $this->validators[$schemaRef] ?? null;
        if ($validator === null) {
            throw new \DomainException("Block schema validator {$schemaRef} is not registered.");
        }

        $validator->validate($props);
    }

    public function has(string $schemaRef): bool
    {
        return isset($this->validators[$schemaRef]);
    }

    public function unregister(string $schemaRef): void
    {
        unset($this->validators[$schemaRef]);
    }
}
