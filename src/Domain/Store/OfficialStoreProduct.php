<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

final readonly class OfficialStoreProduct
{
    /**
     * @param  array<string, string>  $title
     * @param  array<string, string>  $description
     * @param  list<string>  $tags
     * @param  array{page_builder: string, php: string, g7: string}  $compatibility
     * @param  array{thumbnail_url: string, screenshots: list<string>, demo_url?: string|null}  $preview
     * @param  array{url: string, sha256: string, bytes: int}  $artifact
     * @param  list<array{block_id: string, block_version: int}>  $requiredBlocks
     */
    public function __construct(
        public string $productId,
        public string $productType,
        public string $productVersion,
        public array $title,
        public array $description,
        public string $category,
        public array $tags,
        public array $compatibility,
        public array $preview,
        public array $artifact,
        public array $requiredBlocks = [],
    ) {
        StoreRules::assertProductId($this->productId);
        StoreRules::assertSemver($this->productVersion, '상품 버전');
        if (! in_array($this->productType, ['block_pack', 'page_kit'], true)) {
            throw new \InvalidArgumentException('공식 마켓 상품 종류가 올바르지 않습니다.');
        }
        if (! isset($this->title['ko']) || trim($this->title['ko']) === ''
            || ! isset($this->description['ko']) || trim($this->description['ko']) === '') {
            throw new \InvalidArgumentException('공식 마켓 상품에는 한국어 제목과 설명이 필요합니다.');
        }
        if (preg_match('/^[a-z0-9][a-z0-9._-]{1,63}$/', $this->category) !== 1) {
            throw new \InvalidArgumentException('공식 마켓 상품 카테고리가 올바르지 않습니다.');
        }
        if (count($this->tags) > 20 || count(array_unique($this->tags)) !== count($this->tags)) {
            throw new \InvalidArgumentException('공식 마켓 상품 태그가 올바르지 않습니다.');
        }
        foreach (['page_builder', 'php', 'g7'] as $key) {
            if (trim($this->compatibility[$key]) === '') {
                throw new \InvalidArgumentException('공식 마켓 호환성 정보가 올바르지 않습니다.');
            }
        }
        StoreRules::assertHttpsUrl($this->artifact['url'], '상품 아티팩트 URL');
        StoreRules::assertHttpsUrl($this->preview['thumbnail_url'], '상품 미리보기 URL');
        foreach ($this->preview['screenshots'] as $screenshot) {
            StoreRules::assertHttpsUrl($screenshot, '상품 스크린샷 URL');
        }
        if (isset($this->preview['demo_url'])) {
            StoreRules::assertHttpsUrl($this->preview['demo_url'], '상품 데모 URL');
        }
        StoreRules::assertSha256($this->artifact['sha256'], '상품 아티팩트 digest');
        if ($this->artifact['bytes'] < 1 || $this->artifact['bytes'] > 52_428_800) {
            throw new \InvalidArgumentException('공식 마켓 상품 크기가 허용 범위를 벗어났습니다.');
        }
    }

    /** @param array<string, mixed> $value */
    public static function fromArray(array $value): self
    {
        StoreRules::assertOnlyKeys($value, [
            'product_id', 'product_type', 'product_version', 'title', 'description',
            'category', 'tags', 'license', 'compatibility', 'preview', 'artifact', 'requirements',
        ], '공식 마켓 상품');
        if (($value['license'] ?? null) !== 'free') {
            throw new \InvalidArgumentException('현재 공식 마켓은 무료 상품만 허용합니다.');
        }
        $title = $value['title'] ?? null;
        $description = $value['description'] ?? null;
        $tags = $value['tags'] ?? null;
        $compatibility = $value['compatibility'] ?? null;
        $preview = $value['preview'] ?? null;
        $artifact = $value['artifact'] ?? null;
        $requirements = $value['requirements'] ?? [];
        $blocks = is_array($requirements) ? ($requirements['blocks'] ?? []) : [];
        if (! is_array($title) || ! is_array($description) || ! is_array($tags)
            || ! is_array($compatibility) || ! is_array($preview) || ! is_array($artifact)
            || ! is_array($requirements) || ! is_array($blocks)) {
            throw new \InvalidArgumentException('공식 마켓 상품 형식이 올바르지 않습니다.');
        }
        StoreRules::assertOnlyKeys($title, ['ko', 'en'], '공식 마켓 상품 제목');
        StoreRules::assertOnlyKeys($description, ['ko', 'en'], '공식 마켓 상품 설명');
        StoreRules::assertOnlyKeys($compatibility, ['page_builder', 'php', 'g7'], '공식 마켓 호환성');
        StoreRules::assertOnlyKeys($preview, ['thumbnail_url', 'screenshots', 'demo_url'], '공식 마켓 미리보기');
        StoreRules::assertOnlyKeys($artifact, ['url', 'sha256', 'bytes'], '공식 마켓 아티팩트');
        StoreRules::assertOnlyKeys($requirements, ['blocks'], '공식 마켓 요구사항');
        foreach ([$title, $description] as $localized) {
            foreach ($localized as $locale => $text) {
                if (! is_string($locale) || ! is_string($text) || trim($text) === '' || mb_strlen($text) > 240) {
                    throw new \InvalidArgumentException('공식 마켓 다국어 문구가 올바르지 않습니다.');
                }
            }
        }
        if (array_filter($tags, static fn (mixed $tag): bool => ! is_string($tag)) !== []) {
            throw new \InvalidArgumentException('공식 마켓 상품 태그가 올바르지 않습니다.');
        }
        foreach ($tags as $tag) {
            if (trim($tag) === '' || mb_strlen($tag) > 40) {
                throw new \InvalidArgumentException('공식 마켓 상품 태그가 올바르지 않습니다.');
            }
        }
        if (array_key_exists('demo_url', $preview)
            && $preview['demo_url'] !== null
            && ! is_string($preview['demo_url'])) {
            throw new \InvalidArgumentException('공식 마켓 데모 URL이 올바르지 않습니다.');
        }

        $requiredBlocks = [];
        $seenBlocks = [];
        foreach ($blocks as $block) {
            if (! is_array($block) || ! is_string($block['block_id'] ?? null)
                || ! is_int($block['block_version'] ?? null) || $block['block_version'] < 1) {
                throw new \InvalidArgumentException('공식 마켓 블록 요구사항이 올바르지 않습니다.');
            }
            StoreRules::assertOnlyKeys($block, ['block_id', 'block_version'], '공식 마켓 블록 요구사항');
            $identity = $block['block_id'].'@'.$block['block_version'];
            if (isset($seenBlocks[$identity])) {
                throw new \InvalidArgumentException('공식 마켓 블록 요구사항이 중복되었습니다.');
            }
            $seenBlocks[$identity] = true;
            $requiredBlocks[] = ['block_id' => $block['block_id'], 'block_version' => $block['block_version']];
        }

        $screenshots = $preview['screenshots'] ?? null;
        if (! is_array($screenshots) || count($screenshots) > 8
            || array_filter($screenshots, fn (mixed $item): bool => ! is_string($item)) !== []) {
            throw new \InvalidArgumentException('공식 마켓 스크린샷 형식이 올바르지 않습니다.');
        }

        return new self(
            productId: StoreRules::requiredString($value, 'product_id', 128),
            productType: StoreRules::requiredString($value, 'product_type', 20),
            productVersion: StoreRules::requiredString($value, 'product_version', 64),
            title: array_filter($title, 'is_string'),
            description: array_filter($description, 'is_string'),
            category: StoreRules::requiredString($value, 'category', 64),
            tags: array_values($tags),
            compatibility: [
                'page_builder' => StoreRules::requiredString($compatibility, 'page_builder', 100),
                'php' => StoreRules::requiredString($compatibility, 'php', 100),
                'g7' => StoreRules::requiredString($compatibility, 'g7', 100),
            ],
            preview: [
                'thumbnail_url' => StoreRules::requiredString($preview, 'thumbnail_url', 1000),
                'screenshots' => array_values($screenshots),
                'demo_url' => is_string($preview['demo_url'] ?? null) ? $preview['demo_url'] : null,
            ],
            artifact: [
                'url' => StoreRules::requiredString($artifact, 'url', 1000),
                'sha256' => StoreRules::requiredString($artifact, 'sha256', 64),
                'bytes' => is_int($artifact['bytes'] ?? null) ? $artifact['bytes'] : 0,
            ],
            requiredBlocks: $requiredBlocks,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'product_id' => $this->productId,
            'product_type' => $this->productType,
            'product_version' => $this->productVersion,
            'title' => $this->title,
            'description' => $this->description,
            'category' => $this->category,
            'tags' => $this->tags,
            'license' => 'free',
            'compatibility' => $this->compatibility,
            'preview' => $this->preview,
            'artifact' => $this->artifact,
            'requirements' => ['blocks' => $this->requiredBlocks],
        ];
    }

    public function identity(): string
    {
        return $this->productId.'@'.$this->productVersion;
    }
}
