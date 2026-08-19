<?php

namespace Modules\Jiwonpapa\PageBuilder;

use App\Extension\AbstractModule;

/**
 * G7 Page Builder module entrypoint.
 *
 * 이 파일은 G7 공개 모듈 생명주기와 제품 Adapter를 연결하는 Composition Root입니다.
 * 비즈니스 로직, Model/Repository 또는 직접 DB 접근을 두지 않습니다.
 */
class Module extends AbstractModule
{
    /**
     * Page Builder 전용 관리자 진입점입니다.
     *
     * 기존 G7 번들 페이지 기능의 메뉴·URL·데이터는 수정하거나 대체하지 않습니다.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAdminMenus(): array
    {
        return [
            [
                'name' => [
                    'ko' => '페이지 빌더',
                    'en' => 'Page Builder',
                ],
                'slug' => 'jiwonpapa-page-builder',
                'url' => '/admin/page-builder',
                'icon' => 'fas fa-layer-group',
                'order' => 60,
                'permission' => 'jiwonpapa-page_builder.documents.read',
            ],
        ];
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
            'categories' => [
                [
                    'identifier' => 'documents',
                    'resource_route_key' => 'page_builder_document',
                    'owner_key' => 'created_by',
                    'name' => [
                        'ko' => '페이지 빌더 문서',
                        'en' => 'Page Builder Documents',
                    ],
                    'description' => [
                        'ko' => '페이지 빌더 문서·리비전·발행본 관리',
                        'en' => 'Manage page builder documents, revisions, and publications',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => ['ko' => '문서 조회', 'en' => 'View Documents'],
                            'description' => ['ko' => '페이지 문서 조회', 'en' => 'View page builder documents'],
                            'type' => 'admin',
                            'roles' => ['admin', 'manager'],
                        ],
                        [
                            'action' => 'create',
                            'name' => ['ko' => '문서 생성', 'en' => 'Create Documents'],
                            'description' => ['ko' => '새 페이지 문서 생성', 'en' => 'Create page documents'],
                            'type' => 'admin',
                            'roles' => ['admin', 'manager'],
                        ],
                        [
                            'action' => 'update',
                            'name' => ['ko' => '문서 편집', 'en' => 'Edit Documents'],
                            'description' => ['ko' => '페이지 정보 수정과 초안 저장', 'en' => 'Update page metadata and save drafts'],
                            'type' => 'admin',
                            'roles' => ['admin', 'manager'],
                        ],
                        [
                            'action' => 'manage',
                            'name' => ['ko' => '문서 발행', 'en' => 'Publish Documents'],
                            'description' => ['ko' => '발행 준비와 확정', 'en' => 'Prepare and commit publications'],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
            ],
        ];
    }
}
