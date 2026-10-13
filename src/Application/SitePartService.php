<?php

namespace Modules\Jiwonpapa\PageBuilder\Application;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\EmptyElementSitePart;
use Modules\Jiwonpapa\PageBuilder\Application\Documents\SitePartStorageCodec;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\SitePartNotFoundException;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PublishedSitePartSet;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\ElementSitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartRevision;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSetSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSource;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SiteShell;

final class SitePartService
{
    /** @param array<string, array{kind: string, value: string}> $tokens */
    public function __construct(
        private readonly SitePartRepository $repository,
        private readonly SitePartHtmlCompiler $compiler,
        private readonly SitePartStorageCodec $documents = new SitePartStorageCodec,
        private readonly ?EmptyElementSitePart $emptyElements = null,
        private readonly array $tokens = [],
    ) {}

    public function get(string $kind, string $locale, ?string $setId = null): SitePartSnapshot
    {
        return $this->repository->find($kind, $locale, $setId)
            ?? throw new SitePartNotFoundException('Site Part was not found.');
    }

    public function published(string $kind, string $locale): ?SitePartSnapshot
    {
        return $this->repository->findPublished($kind, $locale);
    }

    public function publishedSet(string $locale): ?PublishedSitePartSet
    {
        return $this->repository->findPublishedSet($locale);
    }

    public function bootstrap(string $kind, string $locale, SiteShell $shell, ?int $actorId): SitePartSnapshot
    {
        $existing = $this->repository->find($kind, $locale);
        if ($existing !== null) {
            return $existing;
        }

        $set = $this->createSet('기본 세트', $locale, $shell, $actorId);

        return $kind === 'header' ? $set->header : $set->footer;
    }

    /** @return list<SitePartSetSnapshot> */
    public function listSets(string $locale): array
    {
        return $this->repository->listSets($locale);
    }

    public function createSet(string $title, string $locale, SiteShell $shell, ?int $actorId, string $schemaVersion = 'g7-page-builder/site-part/v1'): SitePartSetSnapshot
    {
        $title = trim($title);
        if ($title === '') {
            throw new \InvalidArgumentException('헤더·푸터 세트 이름을 입력해 주세요.');
        }
        if ($schemaVersion === 'g7-page-builder/site-part/v2') {
            $factory = $this->emptyElements ?? throw new \InvalidArgumentException('Element Site Part creation is unavailable.');

            return $this->repository->createSet(
                $title,
                $factory->create($this->uuidV4(), 'header', $locale, $this->tokens),
                $factory->create($this->uuidV4(), 'footer', $locale, $this->tokens),
                $actorId,
                activateIfFirst: false,
            );
        }
        if ($schemaVersion !== 'g7-page-builder/site-part/v1') {
            throw new \InvalidArgumentException('Site Part schema version is not supported.');
        }

        return $this->repository->createSet(
            $title,
            $this->defaultDocument('header', $locale, $shell),
            $this->defaultDocument('footer', $locale, $shell),
            $actorId,
        );
    }

    public function activateSet(string $setId, string $locale, ?int $actorId): SitePartSetSnapshot
    {
        return $this->repository->activateSet($setId, $locale, $actorId);
    }

    /**
     * @param  array<string, mixed>|string  $headerPayload
     * @param  array<string, mixed>|string  $footerPayload
     */
    public function saveSetDraft(
        string $setId,
        string $locale,
        string $headerTitle,
        array|string $headerPayload,
        int $headerExpectedLockVersion,
        string $footerTitle,
        array|string $footerPayload,
        int $footerExpectedLockVersion,
        ?int $actorId,
    ): SitePartSetSnapshot {
        $currentHeader = $this->get('header', $locale, $setId);
        $currentFooter = $this->get('footer', $locale, $setId);
        $header = $this->draftDocument($headerPayload, $currentHeader->document, legacySet: true);
        $footer = $this->draftDocument($footerPayload, $currentFooter->document, legacySet: true);

        return $this->repository->saveSetDraft(
            $setId,
            $this->requiredTitle($headerTitle),
            $header,
            $headerExpectedLockVersion,
            $this->requiredTitle($footerTitle),
            $footer,
            $footerExpectedLockVersion,
            $actorId,
        );
    }

    public function publishSet(
        string $setId,
        string $locale,
        int $headerExpectedLockVersion,
        int $footerExpectedLockVersion,
        ?int $actorId,
    ): SitePartSetSnapshot {
        $header = $this->get('header', $locale, $setId);
        $footer = $this->get('footer', $locale, $setId);
        $headerArtifact = $this->compiler->compile($header->document, $header->revision);
        $footerArtifact = $this->compiler->compile($footer->document, $footer->revision);

        return $this->repository->publishSet(
            $setId,
            $headerExpectedLockVersion,
            $footerExpectedLockVersion,
            $actorId,
            $headerArtifact,
            $footerArtifact,
        );
    }

    /** @param array<string, mixed>|string $payload */
    public function saveDraft(
        string $kind,
        string $locale,
        string $title,
        array|string $payload,
        int $expectedLockVersion,
        ?int $actorId,
        ?string $setId = null,
    ): SitePartSnapshot {
        $current = $this->get($kind, $locale, $setId);
        $title = trim($title);
        if ($title === '') {
            throw new \InvalidArgumentException('Site Part title must not be empty.');
        }

        $document = $this->draftDocument($payload, $current->document);

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
        ?string $setId = null,
    ): SitePartSnapshot {
        $current = $this->get($kind, $locale, $setId);
        if ($current->document instanceof ElementSitePartDocument) {
            throw new \InvalidArgumentException('Element Site Parts must be published as a complete Header/Footer set.');
        }
        $artifact = $this->compiler->compile($current->document, $current->revision);

        return $this->repository->publish(
            $current->document->sitePartId,
            $expectedLockVersion,
            $actorId,
            $artifact,
        );
    }

    /** @return list<SitePartRevision> */
    public function revisions(string $kind, string $locale, int $limit = 20, ?string $setId = null): array
    {
        $current = $this->get($kind, $locale, $setId);

        return $this->repository->listRevisions(
            $current->document->sitePartId,
            min(50, max(1, $limit)),
        );
    }

    /** @param array<string, mixed>|string $payload */
    private function draftDocument(array|string $payload, SitePartSource $current, bool $legacySet = false): SitePartSource
    {
        // Preserve legacy set-template identity binding only for the old format.
        // Element documents always carry and validate their own identity.
        if ($legacySet && is_array($payload) && $current instanceof SitePartDocument
            && ($payload['schema_version'] ?? null) === $current->schemaVersion) {
            $payload['site_part_id'] = $current->sitePartId;
            $payload['kind'] = $current->kind;
            $payload['locale'] = $current->locale;
        }
        $json = is_string($payload) ? $payload : json_encode($payload, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);

        return $this->documents->decodeDraft($json, $current);
    }

    private function defaultDocument(string $kind, string $locale, SiteShell $shell): SitePartDocument
    {
        return new SitePartDocument(
            sitePartId: $this->uuidV4(),
            kind: $kind,
            locale: $locale,
            tokens: [],
            blocks: [$this->legacyBlock($kind, $shell)],
        );
    }

    private function requiredTitle(string $title): string
    {
        $title = trim($title);
        if ($title === '') {
            throw new \InvalidArgumentException('Site Part title must not be empty.');
        }

        return $title;
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
                    'mobile_menu_style' => $shell->mobileMenuStyle,
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
