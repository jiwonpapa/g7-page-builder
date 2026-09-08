<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compositions;

use Modules\Jiwonpapa\PageBuilder\Contracts\NativeCompositionRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Compositions\NativeComposition;

final readonly class NativeCompositionService
{
    public function __construct(private NativeCompositionRepository $repository) {}

    /** @return array{items: list<array<string, mixed>>, has_more: bool} */
    public function page(int $actorId, int $page): array
    {
        if ($actorId < 1 || $page < 1 || $page > 10000) {
            throw new \InvalidArgumentException('목록 범위를 확인해 주세요.');
        }
        $items = $this->repository->pageFor($actorId, $page);

        return ['items' => array_map(fn (NativeComposition $item): array => $item->toArray(), array_slice($items, 0, 30)),
            'has_more' => count($items) > 30];
    }

    public function create(int $actorId, string $schema, string $title, string $snapshot): NativeComposition
    {
        if ($actorId < 1) {
            throw new \InvalidArgumentException('로그인이 필요합니다.');
        }
        NativeComposition::validate($schema, $title, $snapshot);
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);
        $id = substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);

        return $this->repository->create(new NativeComposition($id, $actorId, trim($title), $snapshot, (new \DateTimeImmutable)->format(DATE_ATOM)));
    }

    public function find(int $actorId, string $id): NativeComposition
    {
        return $this->repository->findFor($actorId, $id) ?? throw new \DomainException('조합을 찾을 수 없습니다.');
    }

    public function delete(int $actorId, string $id): void
    {
        if (! $this->repository->deleteFor($actorId, $id)) {
            throw new \DomainException('조합을 찾을 수 없습니다.');
        }
    }
}
