<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation;

use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

/** URL capabilities shared by block markup and rich text. */
final class CompilationUrlPolicy
{
    public function assertAllowedUrl(string $url, string $property): void
    {
        if ($url === '#g7-action-logout' || $this->isRelativeUrl($url) || $this->isHttpsUrl($url) || $this->isMailtoUrl($url) || $this->isTelUrl($url)) {
            return;
        }

        throw new DocumentCompileException("{$property} URL is not allowed.");
    }

    public function assertAllowedImageUrl(string $url): void
    {
        if ($this->isRelativeUrl($url) || $this->isHttpsUrl($url)) {
            return;
        }

        throw new DocumentCompileException('Image URL is not allowed.');
    }

    public function assertPageOrHttpsUrl(string $url, string $property): void
    {
        if ($this->isRelativeUrl($url) || $this->isHttpsUrl($url)) {
            return;
        }

        throw new DocumentCompileException("{$property} URL is not allowed.");
    }

    private function isRelativeUrl(string $url): bool
    {
        return str_starts_with($url, '/')
            && ! str_starts_with($url, '//')
            && ! str_contains($url, '\\')
            && preg_match('/[\x00-\x20\x7f]/', $url) !== 1;
    }

    private function isHttpsUrl(string $url): bool
    {
        if (preg_match('/[\x00-\x20\x7f]/', $url) === 1 || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        return strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https'
            && is_string(parse_url($url, PHP_URL_HOST))
            && parse_url($url, PHP_URL_HOST) !== '';
    }

    private function isMailtoUrl(string $url): bool
    {
        if (! str_starts_with(strtolower($url), 'mailto:')) {
            return false;
        }

        $email = substr($url, 7);

        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    private function isTelUrl(string $url): bool
    {
        return preg_match('/^tel:\+?[0-9][0-9.-]{2,39}$/i', $url) === 1;
    }

    public function phoneHref(string $phone): string
    {
        if (preg_match('/^\+?[0-9][0-9 .()\-]{2,39}$/', $phone) !== 1) {
            throw new DocumentCompileException('Contact phone is invalid.');
        }

        $normalized = preg_replace('/[ .()\-]/', '', $phone);
        $href = 'tel:'.($normalized ?? '');

        if (! $this->isTelUrl($href)) {
            throw new DocumentCompileException('Contact phone is invalid.');
        }

        return $href;
    }
}
