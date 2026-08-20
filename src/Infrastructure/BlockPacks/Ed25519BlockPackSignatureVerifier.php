<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\BlockPacks;

use Modules\Jiwonpapa\PageBuilder\Contracts\BlockPackSignatureVerifierPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;

final readonly class Ed25519BlockPackSignatureVerifier implements BlockPackSignatureVerifierPort
{
    /** @param array<string, mixed> $trustedPublishers Runtime configuration keyed by key_id. */
    public function __construct(private array $trustedPublishers) {}

    public function verify(BlockPackManifest $manifest, string $manifestJson, string $detachedSignature): void
    {
        $keyId = $manifest->publisher['key_id'] ?? null;
        $trusted = is_string($keyId) ? ($this->trustedPublishers[$keyId] ?? null) : null;
        $publisherId = is_array($trusted) ? ($trusted['publisher_id'] ?? null) : null;
        $publicKeyBase64 = is_array($trusted) ? ($trusted['public_key'] ?? null) : null;
        if (! is_array($trusted)
            || $publisherId !== $manifest->publisher['id']
            || ! is_string($publicKeyBase64)) {
            throw new \DomainException('신뢰 목록에 없는 Code Block Pack 발행자 키입니다.');
        }

        $publicKey = base64_decode($publicKeyBase64, true);
        $signature = base64_decode(trim($detachedSignature), true);
        if (! is_string($publicKey) || strlen($publicKey) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || ! is_string($signature) || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES) {
            throw new \DomainException('Code Block Pack 공개키 또는 detached signature 형식이 올바르지 않습니다.');
        }
        if (! sodium_crypto_sign_verify_detached($signature, $manifestJson, $publicKey)) {
            throw new \DomainException('Code Block Pack manifest 서명이 일치하지 않습니다.');
        }
    }
}
