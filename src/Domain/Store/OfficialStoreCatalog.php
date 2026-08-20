<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

final readonly class OfficialStoreCatalog
{
    /** @param list<OfficialStoreProduct> $products */
    public function __construct(
        public string $generatedAt,
        public array $products,
    ) {
        $date = \DateTimeImmutable::createFromFormat(DATE_ATOM, $this->generatedAt);
        if (! $date instanceof \DateTimeImmutable || $date->format(DATE_ATOM) !== $this->generatedAt) {
            throw new \InvalidArgumentException('공식 마켓 생성 시각이 올바르지 않습니다.');
        }
        if (count($this->products) > 500) {
            throw new \InvalidArgumentException('공식 마켓 상품 수가 허용 범위를 벗어났습니다.');
        }
        $seen = [];
        foreach ($this->products as $product) {
            if (isset($seen[$product->identity()])) {
                throw new \InvalidArgumentException('공식 마켓 상품 id와 버전이 중복되었습니다.');
            }
            $seen[$product->identity()] = true;
        }
    }

    /** @param array<string, mixed> $value */
    public static function fromArray(array $value): self
    {
        StoreRules::assertOnlyKeys($value, ['catalog_version', 'publisher', 'generated_at', 'products'], '공식 마켓 카탈로그');
        $publisher = $value['publisher'] ?? null;
        if (! is_array($publisher)) {
            throw new \InvalidArgumentException('공식 마켓 발행자 정보가 올바르지 않습니다.');
        }
        StoreRules::assertOnlyKeys($publisher, ['id', 'name'], '공식 마켓 발행자');
        if (($value['catalog_version'] ?? null) !== 'g7pb-store/v1'
            || ($publisher['id'] ?? null) !== 'jiwonpapa'
            || ! is_string($publisher['name'] ?? null)
            || trim($publisher['name']) === '') {
            throw new \InvalidArgumentException('지원하지 않는 공식 마켓 카탈로그입니다.');
        }
        $products = $value['products'] ?? null;
        if (! is_array($products)) {
            throw new \InvalidArgumentException('공식 마켓 상품 목록이 올바르지 않습니다.');
        }

        return new self(
            generatedAt: StoreRules::requiredString($value, 'generated_at', 40),
            products: array_map(
                static fn (mixed $product): OfficialStoreProduct => is_array($product)
                    ? OfficialStoreProduct::fromArray($product)
                    : throw new \InvalidArgumentException('공식 마켓 상품 형식이 올바르지 않습니다.'),
                array_values($products),
            ),
        );
    }

    public function find(string $productId, string $productVersion): OfficialStoreProduct
    {
        foreach ($this->products as $product) {
            if ($product->productId === $productId && $product->productVersion === $productVersion) {
                return $product;
            }
        }

        throw new \DomainException('공식 마켓에서 해당 상품 버전을 찾지 못했습니다.');
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'catalog_version' => 'g7pb-store/v1',
            'publisher' => ['id' => 'jiwonpapa', 'name' => '지원소프트'],
            'generated_at' => $this->generatedAt,
            'products' => array_map(
                static fn (OfficialStoreProduct $product): array => $product->toArray(),
                $this->products,
            ),
        ];
    }
}
