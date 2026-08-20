<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Routing;

final class RouteCatalogNormalizer
{
    /** @var array<string, array{id: string, label: string, category: string}> */
    private const KNOWN_LAYOUTS = [
        'home' => ['id' => 'site.home', 'label' => '홈', 'category' => '사이트'],
        'auth/login' => ['id' => 'auth.login', 'label' => '로그인', 'category' => '회원'],
        'auth/register' => ['id' => 'auth.register', 'label' => '회원가입', 'category' => '회원'],
        'auth/forgot_password' => ['id' => 'auth.forgot-password', 'label' => '비밀번호 찾기', 'category' => '회원'],
        'auth/reset_password' => ['id' => 'auth.reset-password', 'label' => '비밀번호 재설정', 'category' => '회원'],
        'board/boards' => ['id' => 'board.list', 'label' => '게시판 목록', 'category' => '게시판'],
        'board/popular' => ['id' => 'board.popular', 'label' => '인기 게시물', 'category' => '게시판'],
        'board/index' => ['id' => 'board.detail', 'label' => '게시판', 'category' => '게시판'],
        'board/form' => ['id' => 'board.write', 'label' => '게시물 작성', 'category' => '게시판'],
        'board/show' => ['id' => 'board.post', 'label' => '게시물 상세', 'category' => '게시판'],
        'shop/index' => ['id' => 'shop.products', 'label' => '상품 목록', 'category' => '쇼핑몰'],
        'shop/category' => ['id' => 'shop.category', 'label' => '상품 카테고리', 'category' => '쇼핑몰'],
        'shop/show' => ['id' => 'shop.product', 'label' => '상품 상세', 'category' => '쇼핑몰'],
        'shop/cart' => ['id' => 'shop.cart', 'label' => '장바구니', 'category' => '쇼핑몰'],
        'shop/checkout' => ['id' => 'shop.checkout', 'label' => '주문·결제', 'category' => '쇼핑몰'],
        'mypage/profile' => ['id' => 'account.profile', 'label' => '내 정보', 'category' => '마이페이지'],
        'mypage/profile-edit' => ['id' => 'account.profile-edit', 'label' => '내 정보 수정', 'category' => '마이페이지'],
        'mypage/change-password' => ['id' => 'account.password', 'label' => '비밀번호 변경', 'category' => '마이페이지'],
        'mypage/orders' => ['id' => 'account.orders', 'label' => '주문 내역', 'category' => '마이페이지'],
        'mypage/orders/show' => ['id' => 'account.order', 'label' => '주문 상세', 'category' => '마이페이지'],
        'mypage/mileage' => ['id' => 'account.mileage', 'label' => '마일리지', 'category' => '마이페이지'],
        'mypage/wishlist' => ['id' => 'account.wishlist', 'label' => '찜한 상품', 'category' => '마이페이지'],
        'mypage/addresses' => ['id' => 'account.addresses', 'label' => '배송지', 'category' => '마이페이지'],
        'jiwonpapa-page_builder.page_builder_public' => ['id' => 'page-builder.page', 'label' => '페이지 빌더 문서', 'category' => '페이지 빌더'],
    ];

    /**
     * @param  list<array<string, mixed>>  $routes
     * @return array{active_template: string, routes: list<array<string, mixed>>}
     */
    public function normalize(
        string $activeTemplate,
        array $routes,
        string $shopBasePath = 'shop',
        bool $shopHasNoRoute = false,
    ): array {
        $normalized = [];
        $seenIds = [];

        foreach ($routes as $route) {
            $path = $this->normalizePath($route['path'] ?? null, $shopBasePath, $shopHasNoRoute);
            if ($path === null || str_starts_with($path, '/admin')) {
                continue;
            }

            $layout = is_string($route['layout'] ?? null) ? $route['layout'] : '';
            $known = self::KNOWN_LAYOUTS[$layout] ?? null;
            $id = $known['id'] ?? 'route.'.substr(hash('sha256', $layout.'|'.$path), 0, 16);
            if (isset($seenIds[$id])) {
                $id .= '.'.substr(hash('sha256', $path), 0, 8);
            }
            $seenIds[$id] = true;
            $parameters = $this->parameters($path);
            $source = is_array($route['source'] ?? null) ? $route['source'] : [];

            $normalized[] = [
                'id' => $id,
                'label' => $known['label'] ?? $this->fallbackLabel($route, $path),
                'category' => $known['category'] ?? $this->fallbackCategory($source),
                'path' => $path,
                'auth_required' => (bool) ($route['auth_required'] ?? false),
                'guest_only' => (bool) ($route['guest_only'] ?? false),
                'parameters' => $parameters,
                'parameter_sources' => $this->parameterSources($id, $parameters),
                'source' => [
                    'kind' => is_string($source['kind'] ?? null) ? $source['kind'] : 'template',
                    'identifier' => is_string($source['identifier'] ?? null) ? $source['identifier'] : null,
                ],
            ];
        }

        $normalized[] = [
            'id' => 'auth.logout',
            'label' => '로그아웃',
            'category' => '회원',
            'path' => '#g7-action-logout',
            'action' => 'logout',
            'auth_required' => true,
            'guest_only' => false,
            'parameters' => [],
            'parameter_sources' => [],
            'source' => ['kind' => 'core', 'identifier' => null],
        ];

        return [
            'active_template' => $activeTemplate,
            'routes' => $normalized,
        ];
    }

    private function normalizePath(mixed $value, string $shopBasePath, bool $shopHasNoRoute): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        $path = ltrim(trim($value), '*');
        if (str_contains($path, '{{')) {
            if (! str_contains($path, 'sirsoft-ecommerce')) {
                return null;
            }
            $replacement = $shopHasNoRoute ? '' : trim($shopBasePath, '/');
            $path = preg_replace('/\{\{.+?\}\}/', $replacement, $path);
        }

        if (! is_string($path) || str_contains($path, '{{')) {
            return null;
        }

        $path = '/'.ltrim($path, '/');
        $path = (string) preg_replace('#/+#', '/', $path);

        return $path;
    }

    /** @return list<string> */
    private function parameters(string $path): array
    {
        preg_match_all('/:([A-Za-z_][A-Za-z0-9_]*)/', $path, $matches);

        return array_values(array_unique($matches[1]));
    }

    /**
     * @param  list<string>  $parameters
     * @return array<string, string>
     */
    private function parameterSources(string $id, array $parameters): array
    {
        $sources = [];
        foreach ($parameters as $parameter) {
            $sources[$parameter] = match (true) {
                $id === 'page-builder.page' && $parameter === 'slug' => 'page',
                str_starts_with($id, 'board.') && $parameter === 'slug' => 'board',
                $id === 'shop.category' && $parameter === 'slug' => 'category',
                $parameter === 'product_code' => 'product',
                default => 'manual',
            };
        }

        return $sources;
    }

    /** @param array<string, mixed> $route */
    private function fallbackLabel(array $route, string $path): string
    {
        $meta = is_array($route['meta'] ?? null) ? $route['meta'] : [];
        $title = $meta['title'] ?? null;

        return is_string($title) && $title !== '' && ! str_starts_with($title, '$t:')
            ? $title
            : $path;
    }

    /** @param array<string, mixed> $source */
    private function fallbackCategory(array $source): string
    {
        return ($source['kind'] ?? null) === 'module' ? '모듈' : '기타';
    }
}
