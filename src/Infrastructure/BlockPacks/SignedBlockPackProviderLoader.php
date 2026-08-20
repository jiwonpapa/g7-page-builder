<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackProvider;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackProviderLoaderPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackInstallation;

final class SignedBlockPackProviderLoader implements BlockPackProviderLoaderPort
{
    public function load(BlockPackInstallation $installation): BlockPackProvider
    {
        $runtime = $installation->manifest->runtime;
        if ($installation->manifest->kind !== 'code' || $runtime === null) {
            throw new \DomainException('Code Block Pack runtime provider가 없습니다.');
        }
        $root = realpath($installation->sourceReference);
        $providerPath = realpath($installation->sourceReference.'/'.$runtime['provider']);
        if ($root === false || $providerPath === false || ! str_starts_with($providerPath, $root.'/')) {
            throw new \DomainException('Code Block Pack provider 경로가 설치 경계를 벗어났습니다.');
        }
        $expectedDigest = $installation->manifest->files[$runtime['provider']] ?? null;
        $actualDigest = hash_file('sha256', $providerPath);
        if (! is_string($expectedDigest) || ! is_string($actualDigest) || ! hash_equals($expectedDigest, $actualDigest)) {
            throw new \DomainException('Code Block Pack provider 파일 무결성이 변경되었습니다.');
        }

        $manifest = $installation->manifest;
        $provider = (static function (string $path) use ($manifest): mixed {
            return require $path;
        })($providerPath);
        if (! $provider instanceof BlockPackProvider) {
            throw new \DomainException('Code Block Pack provider가 BlockPackProvider 계약을 구현하지 않습니다.');
        }
        if ($provider->manifest()->toArray() !== $manifest->toArray()) {
            throw new \DomainException('Code Block Pack provider manifest가 서명된 manifest와 다릅니다.');
        }

        return $provider;
    }
}
