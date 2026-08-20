<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Blocks;

final class BlockPackCompatibility
{
    public static function matches(string $version, string $constraint): bool
    {
        foreach (preg_split('/\s+/', trim($constraint)) ?: [] as $token) {
            if ($token === '') {
                continue;
            }
            if (! self::matchesToken($version, $token)) {
                return false;
            }
        }

        return true;
    }

    private static function matchesToken(string $version, string $token): bool
    {
        if (preg_match('/^(>=|<=|>|<|=)?(\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?)$/', $token, $matches) === 1) {
            $operator = $matches[1] !== '' ? $matches[1] : '=';

            return version_compare($version, self::normalizeVersion($matches[2]), $operator);
        }

        if (preg_match('/^\^(\d+)\.(\d+)\.(\d+)$/', $token, $matches) === 1) {
            $minimum = "{$matches[1]}.{$matches[2]}.{$matches[3]}";
            $maximum = (int) $matches[1] > 0
                ? ((int) $matches[1] + 1).'.0.0'
                : '0.'.((int) $matches[2] + 1).'.0';

            return version_compare($version, $minimum, '>=') && version_compare($version, $maximum, '<');
        }

        throw new \InvalidArgumentException("Unsupported Block Pack compatibility constraint: {$token}");
    }

    private static function normalizeVersion(string $version): string
    {
        return substr_count($version, '.') === 1 ? $version.'.0' : $version;
    }
}
