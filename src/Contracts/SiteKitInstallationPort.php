<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

interface SiteKitInstallationPort
{
    /** @param array<string, string> $paths
     * @return array<string, string>
     */
    public function conflicts(array $paths): array;

    public function assign(string $documentId, string $path): void;

    /** A savepoint lets failed document writes roll back before new media cleanup.
     * @param  callable(): array<string, mixed>  $write
     * @return array<string, mixed>
     */
    public function drafts(callable $write): array;

    /** Run once in one transaction; retries return the original committed receipt.
     * @param  callable(): array<string, mixed>  $install
     * @return array<string, mixed>
     */
    public function once(string $requestId, string $fingerprint, ?int $actorId, callable $install): array;
}
