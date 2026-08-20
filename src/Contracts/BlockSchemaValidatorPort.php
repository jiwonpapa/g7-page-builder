<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

interface BlockSchemaValidatorPort
{
    public function schemaRef(): string;

    /** @param array<string, mixed> $props */
    public function validate(array $props): void;
}
