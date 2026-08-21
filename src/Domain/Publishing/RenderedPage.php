<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageSeoMetadata;

final readonly class RenderedPage
{
    public function __construct(
        public string $title,
        public string $slug,
        public string $locale,
        public string $artifact,
        public string $artifactSha256,
        public ?\DateTimeImmutable $publishedAt = null,
        public string $shellMode = 'template',
        public ?PageSeoMetadata $seo = null,
    ) {}

    public function representationSha256(): string
    {
        return hash('sha256', json_encode([
            'title' => $this->title,
            'slug' => $this->slug,
            'locale' => $this->locale,
            'artifact_sha256' => $this->artifactSha256,
            'published_at' => $this->publishedAt?->format(DATE_ATOM),
            'shell_mode' => $this->shellMode,
            'seo' => $this->seo?->toArray(),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
}
