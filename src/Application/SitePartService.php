<?php

namespace Modules\Jiwonpapa\PageBuilder\Application;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SitePartNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;

final class SitePartService
{
    public function __construct(
        private readonly SitePartRepository $repository,
        private readonly SitePartHtmlCompiler $compiler,
    ) {}

    public function get(string $kind, string $locale): SitePartSnapshot
    {
        return $this->repository->find($kind, $locale)
            ?? throw new SitePartNotFoundException('Site Part was not found.');
    }

    public function published(string $kind, string $locale): ?SitePartSnapshot
    {
        return $this->repository->findPublished($kind, $locale);
    }

    public function bootstrap(string $kind, string $locale, SiteShell $shell, ?int $actorId): SitePartSnapshot
    {
        $existing = $this->repository->find($kind, $locale);
        if ($existing !== null) {
            return $existing;
        }

        $document = new SitePartDocument(
            sitePartId: $this->uuidV4(),
            kind: $kind,
            locale: $locale,
            tokens: [],
            blocks: [$this->legacyBlock($kind, $shell)],
        );

        return $this->repository->create(
            $kind === 'header' ? '기본 Header' : '기본 Footer',
            $document,
            $actorId,
        );
    }

    /** @param array<string, mixed> $payload */
    public function saveDraft(
        string $kind,
        string $locale,
        string $title,
        array $payload,
        int $expectedLockVersion,
        ?int $actorId,
    ): SitePartSnapshot {
        $current = $this->get($kind, $locale);
        $title = trim($title);
        if ($title === '') {
            throw new \InvalidArgumentException('Site Part title must not be empty.');
        }

        $payload['site_part_id'] = $current->document->sitePartId;
        $payload['kind'] = $kind;
        $payload['locale'] = $locale;
        $document = SitePartDocument::fromArray($payload);

        return $this->repository->saveDraft(
            $title,
            $document,
            $expectedLockVersion,
            $actorId,
        );
    }

    public function publish(
        string $kind,
        string $locale,
        int $expectedLockVersion,
        ?int $actorId,
    ): SitePartSnapshot {
        $current = $this->get($kind, $locale);
        $this->compiler->compile($current->document, $current->revision);

        return $this->repository->publish(
            $current->document->sitePartId,
            $expectedLockVersion,
            $actorId,
        );
    }

    /** @return list<SitePartRevision> */
    public function revisions(string $kind, string $locale, int $limit = 20): array
    {
        $current = $this->get($kind, $locale);

        return $this->repository->listRevisions(
            $current->document->sitePartId,
            min(50, max(1, $limit)),
        );
    }

    /** @return array<string, mixed> */
    private function legacyBlock(string $kind, SiteShell $shell): array
    {
        if ($kind === 'header') {
            return [
                'instance_id' => $this->uuidV4(),
                'type' => 'site.header.navigation-01',
                'block_version' => 1,
                'props' => [
                    'brand_name' => $shell->brandName,
                    'logo_url' => $shell->logoUrl,
                    'home_url' => $shell->homeUrl,
                    'variant' => $shell->headerVariant,
                    'sticky' => $shell->sticky,
                    'navigation' => $shell->navigation,
                    'cta' => $shell->cta,
                    'mobile_menu' => true,
                ],
                'slots' => [],
            ];
        }
        if ($kind !== 'footer') {
            throw new \InvalidArgumentException('Site Part kind must be header or footer.');
        }

        return [
            'instance_id' => $this->uuidV4(),
            'type' => 'site.footer.simple-01',
            'block_version' => 1,
            'props' => [
                'brand_name' => $shell->brandName,
                'home_url' => $shell->homeUrl,
                'navigation' => $shell->showFooterNavigation ? $shell->navigation : [],
                'footer_text' => $shell->footerText,
            ],
            'slots' => [],
        ];
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20),
        );
    }
}
