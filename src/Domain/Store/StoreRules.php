<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Store;

final class StoreRules
{
    private const SEMVER = '/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/';

    public static function assertProductId(string $value): void
    {
        if (preg_match('/^jiwonpapa\/[a-z0-9][a-z0-9._-]{1,63}$/', $value) !== 1) {
            throw new \InvalidArgumentException('공식 마켓 상품 id는 jiwonpapa namespace를 사용해야 합니다.');
        }
    }

    public static function assertSemver(string $value, string $field): void
    {
        if (preg_match(self::SEMVER, $value) !== 1) {
            throw new \InvalidArgumentException("{$field}는 유효한 SemVer여야 합니다.");
        }
    }

    public static function assertSha256(string $value, string $field): void
    {
        if (preg_match('/^[a-f0-9]{64}$/', $value) !== 1) {
            throw new \InvalidArgumentException("{$field}는 소문자 SHA-256이어야 합니다.");
        }
    }

    public static function assertHttpsUrl(string $value, string $field): void
    {
        $parts = parse_url($value);
        if (! is_array($parts)
            || ($parts['scheme'] ?? null) !== 'https'
            || ! is_string($parts['host'] ?? null)
            || isset($parts['user'])
            || isset($parts['pass'])
            || strlen($value) > 1000) {
            throw new \InvalidArgumentException("{$field}는 자격정보가 없는 HTTPS URL이어야 합니다.");
        }
    }

    /** @param array<string, mixed> $value */
    public static function requiredString(array $value, string $field, int $max = 240): string
    {
        $candidate = $value[$field] ?? null;
        if (! is_string($candidate) || trim($candidate) === '' || mb_strlen($candidate) > $max) {
            throw new \InvalidArgumentException("{$field} 값이 올바르지 않습니다.");
        }

        return $candidate;
    }

    /**
     * @param  array<string, mixed>  $value
     * @param  list<string>  $allowed
     */
    public static function assertOnlyKeys(array $value, array $allowed, string $field): void
    {
        $unexpected = array_diff(array_keys($value), $allowed);
        if ($unexpected !== []) {
            throw new \InvalidArgumentException("{$field}에 지원하지 않는 필드가 있습니다.");
        }
    }
}
