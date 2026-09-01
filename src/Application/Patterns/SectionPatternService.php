<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Patterns;

use Modules\Jiwonpapa\PageBuilder\Application\Blocks\BlockRegistry;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SectionPatternRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Patterns\SectionPattern;

final class SectionPatternService
{
    public function __construct(
        private readonly SectionPatternRepository $patterns,
        private readonly DocumentCompilerPort $compiler,
        private readonly BlockRegistry $blocks,
    ) {}

    /** @return list<array<string, mixed>> */
    public function all(int $actorId): array
    {
        return array_map(function (SectionPattern $pattern): array {
            $error = $this->compatibilityError($pattern);

            return $pattern->toArray($error === null, $error);
        }, $this->patterns->allFor($actorId));
    }

    /** @param array<string, mixed> $section */
    public function create(
        int $actorId,
        string $title,
        string $category,
        string $sourceDocumentSchema,
        array $section,
    ): SectionPattern {
        $title = trim($title);
        $category = trim($category);
        if ($title === '' || mb_strlen($title) > 120) {
            throw new \InvalidArgumentException('패턴 이름은 1자 이상 120자 이하여야 합니다.');
        }
        if (preg_match('/^[a-z0-9][a-z0-9._-]{1,63}$/', $category) !== 1) {
            throw new \InvalidArgumentException('패턴 분류가 올바르지 않습니다.');
        }
        if ($sourceDocumentSchema !== 'g7-page-builder/v2') {
            throw new \InvalidArgumentException('Section 패턴은 v2 문서에서만 저장할 수 있습니다.');
        }
        if (($section['type'] ?? null) !== 'layout.section-01') {
            throw new \InvalidArgumentException('Section 전체만 내 패턴으로 저장할 수 있습니다.');
        }

        $document = new PageBuilderDocument(
            documentId: $this->uuidV4(),
            slug: 'section-pattern-validation',
            mode: 'canvas',
            locale: 'ko',
            tokens: [],
            blocks: [$section],
            schemaVersion: 'g7-page-builder/v2',
            shellMode: 'none',
        );
        $this->compiler->compile($document, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);

        $nodes = $this->nodes($section);
        $requiredBlocks = array_values(array_unique(array_map(
            static fn (array $node): string => (string) $node['type'].'@'.(int) $node['block_version'],
            $nodes,
        )));
        sort($requiredBlocks);
        $assetReferences = $this->assetReferences($section);
        $now = new \DateTimeImmutable;

        return $this->patterns->create(new SectionPattern(
            patternId: $this->uuidV4(),
            actorId: $actorId,
            title: $title,
            category: $category,
            sourceDocumentSchema: $sourceDocumentSchema,
            section: $section,
            requiredBlocks: $requiredBlocks,
            assetReferences: $assetReferences,
            preview: ['kind' => 'section-summary', 'block_count' => count($nodes)],
            createdAt: $now,
            updatedAt: $now,
        ));
    }

    public function delete(int $actorId, string $patternId): void
    {
        if (! $this->patterns->deleteFor($patternId, $actorId)) {
            throw new \DomainException('내 패턴을 찾을 수 없습니다.');
        }
    }

    private function compatibilityError(SectionPattern $pattern): ?string
    {
        foreach ($pattern->requiredBlocks as $identity) {
            [$type, $version] = explode('@', $identity, 2);
            if (str_starts_with($type, 'layout.')) {
                continue;
            }
            if ($this->blocks->definition($type, (int) $version) === null) {
                return "필수 블록 {$identity}을 현재 환경에서 사용할 수 없습니다.";
            }
        }

        return null;
    }

    /** @param array<string, mixed> $section
     * @return list<array<string, mixed>>
     */
    private function nodes(array $section): array
    {
        $nodes = [];
        $pending = [$section];
        while ($pending !== []) {
            $node = array_pop($pending);
            $nodes[] = $node;
            foreach (($node['slots'] ?? []) as $children) {
                if (! is_array($children)) {
                    continue;
                }
                foreach (array_reverse($children) as $child) {
                    if (is_array($child)) {
                        $pending[] = $child;
                    }
                }
            }
        }

        return $nodes;
    }

    /** @param array<string, mixed> $section
     * @return list<string>
     */
    private function assetReferences(array $section): array
    {
        $references = [];
        $walk = function (mixed $value, ?string $key = null) use (&$walk, &$references): void {
            if (is_array($value)) {
                foreach ($value as $childKey => $child) {
                    $walk($child, is_string($childKey) ? $childKey : null);
                }

                return;
            }
            if (is_string($value) && is_string($key)
                && preg_match('/(?:src|image|avatar|logo|poster|media)$/i', $key) === 1
                && preg_match('#^(?:https?://|/)#', $value) === 1) {
                $references[] = $value;
            }
        };
        $walk($section);
        $references = array_values(array_unique($references));
        sort($references);

        return $references;
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);
    }
}
