<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

/**
 * G7 구현과 독립적인 페이지 빌더 원본 문서입니다.
 */
final readonly class PageBuilderDocument
{
    /**
     * @param array<string, string|int|float|bool|null> $tokens
     * @param array<int, array<string, mixed>> $blocks
     */
    public function __construct(
        public string $documentId,
        public string $locale,
        public array $tokens,
        public array $blocks,
        public string $schemaVersion = 'g7-page-builder/v1',
    ) {}
}

