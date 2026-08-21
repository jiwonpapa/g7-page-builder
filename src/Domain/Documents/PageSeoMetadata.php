<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

final readonly class PageSeoMetadata
{
    public function __construct(
        public string $title = '',
        public string $description = '',
        public string $ogImageUrl = '',
        public string $robots = 'index',
    ) {
        if (mb_strlen($this->title) > 70) {
            throw new \InvalidArgumentException('SEO title must be 70 characters or fewer.');
        }
        if (mb_strlen($this->description) > 200) {
            throw new \InvalidArgumentException('SEO description must be 200 characters or fewer.');
        }
        if (! in_array($this->robots, ['index', 'noindex'], true)) {
            throw new \InvalidArgumentException('SEO robots must be index or noindex.');
        }
        if ($this->ogImageUrl !== ''
            && preg_match('#^(?:/[A-Za-z0-9._~!$&\'()*+,;=:@%/-]*|https://[^\s]+)$#u', $this->ogImageUrl) !== 1) {
            throw new \InvalidArgumentException('SEO Open Graph image must be a relative or HTTPS URL.');
        }
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $allowed = ['title', 'description', 'og_image_url', 'robots'];
        if (array_diff(array_keys($data), $allowed) !== []) {
            throw new \InvalidArgumentException('SEO metadata contains unsupported fields.');
        }

        return new self(
            title: self::string($data, 'title'),
            description: self::string($data, 'description'),
            ogImageUrl: self::string($data, 'og_image_url'),
            robots: self::string($data, 'robots', 'index'),
        );
    }

    /** @return array{title: string, description: string, og_image_url: string, robots: string} */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'description' => $this->description,
            'og_image_url' => $this->ogImageUrl,
            'robots' => $this->robots,
        ];
    }

    /** @param array<string, mixed> $data */
    private static function string(array $data, string $key, string $default = ''): string
    {
        $value = $data[$key] ?? $default;
        if (! is_string($value)) {
            throw new \InvalidArgumentException("SEO {$key} must be a string.");
        }

        return trim($value);
    }
}
