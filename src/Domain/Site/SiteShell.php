<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Site;

final readonly class SiteShell
{
    /**
     * @param  list<array{label: string, url: string}>  $navigation
     * @param  array{label: string, url: string}|null  $cta
     */
    public function __construct(
        public string $locale,
        public string $brandName,
        public string $logoUrl,
        public string $homeUrl,
        public string $headerVariant,
        public bool $sticky,
        public array $navigation,
        public ?array $cta,
        public string $footerText,
        public bool $showFooterNavigation,
    ) {
        if (preg_match('/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $this->locale) !== 1) {
            throw new \InvalidArgumentException('Site shell locale is invalid.');
        }
        if ($this->brandName === '' || mb_strlen($this->brandName) > 120) {
            throw new \InvalidArgumentException('Site shell brand name is invalid.');
        }
        if (! in_array($this->headerVariant, ['solid', 'transparent'], true)) {
            throw new \InvalidArgumentException('Site shell header variant is invalid.');
        }
        if ($this->logoUrl !== '' && ! self::isSafeImageUrl($this->logoUrl)) {
            throw new \InvalidArgumentException('Site shell logo URL is invalid.');
        }
        if (! self::isSafeUrl($this->homeUrl)) {
            throw new \InvalidArgumentException('Site shell home URL is invalid.');
        }
        if (count($this->navigation) > 10) {
            throw new \InvalidArgumentException('Site shell has too many navigation items.');
        }
        foreach ($this->navigation as $item) {
            self::assertLink($item, 'navigation');
        }
        if ($this->cta !== null) {
            self::assertLink($this->cta, 'CTA');
        }
        if (mb_strlen($this->footerText) > 300) {
            throw new \InvalidArgumentException('Site shell footer text is too long.');
        }
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(string $locale, array $data): self
    {
        $navigation = $data['navigation'] ?? [];
        $cta = $data['cta'] ?? null;
        if (! is_array($navigation) || ($cta !== null && ! is_array($cta))) {
            throw new \InvalidArgumentException('Site shell links must be arrays.');
        }

        /** @var list<array{label: string, url: string}> $normalizedNavigation */
        $normalizedNavigation = array_values(array_map(
            static fn (mixed $item): array => self::normalizeLink($item, 'navigation'),
            $navigation,
        ));

        return new self(
            locale: $locale,
            brandName: self::string($data, 'brand_name', '사이트 이름'),
            logoUrl: self::string($data, 'logo_url', ''),
            homeUrl: self::string($data, 'home_url', '/'),
            headerVariant: self::string($data, 'header_variant', 'solid'),
            sticky: (bool) ($data['sticky'] ?? true),
            navigation: $normalizedNavigation,
            cta: $cta === null ? null : self::normalizeLink($cta, 'CTA'),
            footerText: self::string($data, 'footer_text', ''),
            showFooterNavigation: (bool) ($data['show_footer_navigation'] ?? true),
        );
    }

    public static function defaults(string $locale): self
    {
        return self::fromArray($locale, [
            'brand_name' => '사이트 이름',
            'home_url' => '/',
            'navigation' => [],
            'footer_text' => '사이트 정보를 입력해 주세요.',
        ]);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'brand_name' => $this->brandName,
            'logo_url' => $this->logoUrl,
            'home_url' => $this->homeUrl,
            'header_variant' => $this->headerVariant,
            'sticky' => $this->sticky,
            'navigation' => $this->navigation,
            'cta' => $this->cta,
            'footer_text' => $this->footerText,
            'show_footer_navigation' => $this->showFooterNavigation,
        ];
    }

    public function representationSha256(): string
    {
        return hash('sha256', json_encode(
            ['locale' => $this->locale, ...$this->toArray()],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
        ));
    }

    /** @param array<string, mixed> $data */
    private static function string(array $data, string $key, string $default): string
    {
        $value = $data[$key] ?? $default;
        if (! is_string($value)) {
            throw new \InvalidArgumentException("Site shell {$key} must be a string.");
        }

        return trim($value);
    }

    /** @return array{label: string, url: string} */
    private static function normalizeLink(mixed $value, string $kind): array
    {
        if (! is_array($value)) {
            throw new \InvalidArgumentException("Site shell {$kind} link must be an object.");
        }
        $label = $value['label'] ?? null;
        $url = $value['url'] ?? null;
        if (! is_string($label) || ! is_string($url)) {
            throw new \InvalidArgumentException("Site shell {$kind} link is invalid.");
        }

        return ['label' => trim($label), 'url' => trim($url)];
    }

    /** @param array{label: string, url: string} $link */
    private static function assertLink(array $link, string $kind): void
    {
        if ($link['label'] === '' || mb_strlen($link['label']) > 80 || ! self::isSafeUrl($link['url'])) {
            throw new \InvalidArgumentException("Site shell {$kind} link is invalid.");
        }
    }

    private static function isSafeUrl(string $url): bool
    {
        if ($url === '' || strlen($url) > 2048) {
            return false;
        }
        if (($url[0] === '/' && ! str_starts_with($url, '//')) || $url[0] === '#') {
            return true;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        return is_string($scheme) && in_array(strtolower($scheme), ['http', 'https', 'mailto', 'tel'], true);
    }

    private static function isSafeImageUrl(string $url): bool
    {
        if ($url === '' || strlen($url) > 2048) {
            return false;
        }
        if ($url[0] === '/' && ! str_starts_with($url, '//')) {
            return true;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        return is_string($scheme) && in_array(strtolower($scheme), ['http', 'https'], true);
    }
}
