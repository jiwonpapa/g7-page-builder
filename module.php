<?php

namespace Modules\Jiwonpapa\PageBuilder;

use App\Extension\AbstractModule;

/**
 * G7 Page Builder module entrypoint.
 *
 * 기능 구현 전 단계에서는 설치 가능한 최소 골격만 제공합니다. G7 공개 편집 계약이
 * 확정되기 전에 코어 내부 클래스나 템플릿 파일에 직접 연결하지 않습니다.
 */
class Module extends AbstractModule
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function getRoles(): array
    {
        return [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getPermissions(): array
    {
        return [
            'name' => [
                'ko' => '페이지 빌더',
                'en' => 'Page Builder',
            ],
            'description' => [
                'ko' => '페이지 빌더 문서와 블록 관리 권한',
                'en' => 'Permissions for page builder documents and blocks',
            ],
            'categories' => [],
        ];
    }
}

