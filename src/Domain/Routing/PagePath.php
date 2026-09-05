<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Routing;

final class PagePath
{
    public static function normalize(string $input): string
    {
        $path = '/'.trim(strtolower(trim($input)), '/');
        if (strlen($path) > 240 || preg_match('~^/[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*){0,7}$~D', $path) !== 1) {
            throw new \InvalidArgumentException('주소는 /about처럼 영문 소문자·숫자·하이픈으로 입력해 주세요.');
        }
        $first = explode('/', ltrim($path, '/'))[0];
        if (in_array($first, ['admin', 'api', 'modules', 'plugins', 'templates', 'assets', 'storage', 'build', 'dist', 'pages', 'page', 'login', 'logout', 'register', 'auth', 'password', 'sitemap', 'robots'], true)) {
            throw new \InvalidArgumentException('시스템에서 사용하는 주소입니다. 다른 주소를 입력해 주세요.');
        }

        return $path;
    }

    /** @param list<array<string, mixed>> $routes */
    public static function conflicts(string $path, array $routes): bool
    {
        foreach ($routes as $route) {
            $pattern = $route['path'] ?? null;
            if (! is_string($pattern)) {
                continue;
            }
            // G7's leading * permits module mount prefixes, including the root.
            $pattern = str_starts_with($pattern, '*/') ? substr($pattern, 1) : $pattern;
            $quoted = preg_quote($pattern, '~');
            $quoted = preg_replace('~\\\\:[a-zA-Z_][a-zA-Z0-9_]*~', '[^/]+', $quoted) ?? $quoted;
            $quoted = str_replace('\\*', '.*', $quoted);
            if (preg_match('~^'.$quoted.'/?$~iD', $path) === 1) {
                return true;
            }
        }

        return false;
    }
}
