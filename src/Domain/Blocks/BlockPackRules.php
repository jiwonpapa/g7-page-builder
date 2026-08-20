<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final class BlockPackRules
{
    private const IDENTIFIER_PATTERN = '/^[a-z0-9][a-z0-9._\/-]{1,127}$/';

    private const PACK_ID_PATTERN = '/^[a-z0-9][a-z0-9._-]{1,63}\/[a-z0-9][a-z0-9._-]{1,63}$/';

    private const SEMVER_PATTERN = '/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/';

    private const SAFE_PATH_PATTERN = '#^(?!/)(?!.*(?:^|/)\.\.(?:/|$))[A-Za-z0-9._/-]+$#';

    public static function assertPackId(string $packId): void
    {
        if (preg_match(self::PACK_ID_PATTERN, $packId) !== 1) {
            throw new \InvalidArgumentException('Block Pack id must use publisher/name format.');
        }
    }

    public static function assertSemver(string $version, string $field): void
    {
        if (preg_match(self::SEMVER_PATTERN, $version) !== 1) {
            throw new \InvalidArgumentException("Block Pack {$field} must be a valid SemVer.");
        }
    }

    public static function assertIdentifier(string $value, string $field): void
    {
        if (preg_match(self::IDENTIFIER_PATTERN, $value) !== 1) {
            throw new \InvalidArgumentException("Block Pack {$field} is invalid.");
        }
    }

    public static function assertRelativePath(string $path, string $field): void
    {
        if (strlen($path) > 240 || preg_match(self::SAFE_PATH_PATTERN, $path) !== 1) {
            throw new \InvalidArgumentException("Block Pack {$field} must be a safe relative path.");
        }
    }

    /** @param array<string, string> $text */
    public static function assertLocalizedText(array $text, string $field): void
    {
        if (! isset($text['ko']) || $text['ko'] === '') {
            throw new \InvalidArgumentException("Block Pack {$field} requires Korean text.");
        }

        foreach ($text as $locale => $value) {
            if (! in_array($locale, ['ko', 'en'], true) || $value === '' || mb_strlen($value) > 240) {
                throw new \InvalidArgumentException("Block Pack {$field} has invalid localized text.");
            }
        }
    }

    public static function assertSha256(string $sha256, string $field): void
    {
        if (preg_match('/^[a-f0-9]{64}$/', $sha256) !== 1) {
            throw new \InvalidArgumentException("Block Pack {$field} must be a lowercase SHA-256.");
        }
    }

    /** @param array<string, mixed> $value */
    public static function assertJsonObject(array $value, string $field): void
    {
        try {
            json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } catch (\JsonException $exception) {
            throw new \InvalidArgumentException("Block Pack {$field} must be JSON serializable.", 0, $exception);
        }
    }
}
