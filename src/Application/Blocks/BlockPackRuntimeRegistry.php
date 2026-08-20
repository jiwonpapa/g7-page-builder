<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackProviderLoaderPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;

final class BlockPackRuntimeRegistry
{
    /** @var array<string, array{compilers: list<string>, schemas: list<string>}> */
    private array $active = [];

    public function __construct(
        private readonly BlockPackProviderLoaderPort $providers,
        private readonly BlockCompilerRegistry $compilers,
        private readonly BlockSchemaRegistry $schemas,
    ) {}

    public function activate(BlockPackInstallation $installation): void
    {
        if ($installation->manifest->kind !== 'code' || $installation->source === 'builtin') {
            return;
        }
        $identity = $installation->manifest->identity();
        if (isset($this->active[$identity])) {
            return;
        }

        $provider = $this->providers->load($installation);
        $requiredCompilers = array_fill_keys(array_map(
            static fn ($definition): string => $definition->compiler,
            $installation->manifest->blocks,
        ), true);
        $requiredSchemas = array_fill_keys(array_map(
            static fn ($definition): string => $definition->schemaRef,
            $installation->manifest->blocks,
        ), true);
        $registeredCompilers = [];
        $registeredSchemas = [];

        try {
            foreach ($provider->compilers() as $compiler) {
                $key = $compiler->key();
                if (! isset($requiredCompilers[$key]) || in_array($key, $registeredCompilers, true)) {
                    throw new \DomainException("Code Block Pack compiler 등록이 manifest와 다릅니다: {$key}");
                }
                $this->compilers->register($compiler);
                $registeredCompilers[] = $key;
            }
            foreach ($provider->schemaValidators() as $validator) {
                $schemaRef = $validator->schemaRef();
                if (! isset($requiredSchemas[$schemaRef]) || in_array($schemaRef, $registeredSchemas, true)) {
                    throw new \DomainException("Code Block Pack schema 등록이 manifest와 다릅니다: {$schemaRef}");
                }
                $this->schemas->register($validator);
                $registeredSchemas[] = $schemaRef;
            }
            sort($registeredCompilers);
            sort($registeredSchemas);
            $expectedCompilers = array_keys($requiredCompilers);
            $expectedSchemas = array_keys($requiredSchemas);
            sort($expectedCompilers);
            sort($expectedSchemas);
            if ($registeredCompilers !== $expectedCompilers || $registeredSchemas !== $expectedSchemas) {
                throw new \DomainException('Code Block Pack runtime 등록 항목이 manifest 정의를 모두 충족하지 않습니다.');
            }
        } catch (\Throwable $exception) {
            foreach ($registeredCompilers as $key) {
                $this->compilers->unregister($key);
            }
            foreach ($registeredSchemas as $schemaRef) {
                $this->schemas->unregister($schemaRef);
            }

            throw $exception;
        }

        $this->active[$identity] = ['compilers' => $registeredCompilers, 'schemas' => $registeredSchemas];
    }

    public function deactivate(BlockPackInstallation $installation): void
    {
        $registration = $this->active[$installation->manifest->identity()] ?? null;
        if ($registration === null) {
            return;
        }
        foreach ($registration['compilers'] as $key) {
            $this->compilers->unregister($key);
        }
        foreach ($registration['schemas'] as $schemaRef) {
            $this->schemas->unregister($schemaRef);
        }
        unset($this->active[$installation->manifest->identity()]);
    }

    public function swap(?BlockPackInstallation $previous, BlockPackInstallation $next): void
    {
        if ($previous === null || $previous->manifest->identity() === $next->manifest->identity()) {
            $this->activate($next);

            return;
        }

        $this->deactivate($previous);
        try {
            $this->activate($next);
        } catch (\Throwable $exception) {
            $this->activate($previous);

            throw $exception;
        }
    }
}
