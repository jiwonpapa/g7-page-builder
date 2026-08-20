# G7 Page Builder

그누보드7 코어를 수정하지 않고 일반 페이지와 랜딩 페이지를 블록 방식으로 제작하는 독립 모듈입니다.

## 결정된 방향

- G7 Layout Editor를 호출하거나 확장해 페이지 문서를 편집하지 않습니다.
- 독립 편집기는 MIT `Puck`을 커널로 사용하고 Puck은 Adapter 뒤에 격리합니다.
- 이 저장소는 페이지 문서, 리비전, 발행본, 블록 프리셋과 공개 렌더 결과를 소유합니다.
- `PageBuilderDocument`를 MVP에서는 안전한 HTML로 컴파일하며 G7 JSON UI 출력은 공개 렌더 계약이 생긴 뒤 추가합니다.
- 기본 모듈은 G7 코어의 lifecycle·Provider·route·migration·admin permission·모듈 소유 admin menu/layout, 활성 User Template의 공개 route/layout merge와 asset serving 표면만 사용합니다.
- 기본 출력은 현재 활성 User Template의 Header·Footer·navigation을 그대로 사용하고 Page Builder 발행 HTML만 콘텐츠 영역에 삽입합니다. 템플릿 파일·layout JSON·DB row는 수정하지 않습니다.
- `sirsoft-page`와 Layout Editor는 사용하지 않습니다. `sirsoft-board`·`sirsoft-ecommerce`는 공개 route/API가 있을 때 링크 선택기와 데이터 블록에서만 사용하며 hard dependency가 아닙니다.
- G7의 기존 `페이지 관리`는 메뉴·데이터·URL까지 그대로 보존하고, 별도 `페이지 빌더` 메뉴에서 자체 문서함과 편집기로 진입합니다.

```text
PageBuilderDocument
        |
        v
PHP Compiler
        |
        v
Sanitized published artifact
        |
        +--> active G7 User Template content slot (default)
        |
        +--> module-owned builder/none viewer (opt-in)
```

## 현재 상태

현재 모듈 버전은 `0.10.0`입니다. 지원소프트 단일 발행자의 공식 무료 마켓에서 검증된 Block Pack을 즉시 설치하고, 완성 Page Kit을 기존 문서와 사이트 설정을 건드리지 않는 새 미발행 초안으로 적용할 수 있습니다. 관리자가 만든 페이지는 모듈 소유 이미지를 포함한 Page Kit ZIP으로 내보낼 수 있습니다. 계약과 제외 범위는 [공식 무료 마켓 계약](docs/official-store-contract.md)에 고정했습니다.

Hero·Features·CTA·Contact 수직 기능에 Hero Split·Hero Slider·Logo Cloud·Stats·Pricing·Team·Gallery·Bar Chart를 추가한 12종 블록은 `jiwonpapa/builtin-core` 내장 Pack으로 등록됩니다. 편집기는 서버 카탈로그의 검색·분류·관리자별 즐겨찾기와 Data Preset 복사를 지원합니다. 관리 화면에서는 외부 Pack ZIP 설치·활성화·비활성화·사용량 확인·안전 제거와 GitHub Release 최신 안정 버전 확인·명시적 설치를 수행합니다. 외부 Code Pack은 신뢰 발행자 Ed25519 서명, 파일 digest, 정확한 PHP compiler/schema/editor 등록을 통과해야 하며 내장 component를 덮어쓸 수 없습니다.

좌측 Blocks 라이브러리는 축소 구조 미리보기와 용도를 표시하고 Puck 기본 DnD로 블록 사이 정확한 위치에 드롭합니다. Hero 계열 문구는 캔버스에서 직접 수정하며 Slider Hero는 편집 중 선택 장면을 고정하고 공개본에서만 Embla 자동재생을 적용합니다. G7 네이티브 페이지 빌더 문서함과 독립 편집기에서 문서 생성·재진입·메타수정, 선택형 Page Builder Header·Footer, PC·모바일 메뉴 편집, 문서별 출력 shell, typed style·motion preset, 초안 저장과 reload, 미리보기, 2단계 발행, `/pages/{slug}` 공개, 선택형 홈(`/`), 리비전 조회·미리보기·복원·재발행 rollback·공개 해제까지 동작합니다. 링크 필드는 활성 G7 템플릿의 로그인·회원가입·게시판·쇼핑몰·마이페이지·Page Builder route를 검색하고 필요한 게시판·카테고리·상품·문서를 선택해 URL을 완성합니다.

전체 유료 MVP는 아직 아닙니다. 자체 MediaPort 이미지 업로드·선택, 복구 가능한 문서 보관·복원·확인형 영구 삭제, Hero 중복 경고, Embla 슬라이더, 추천 효과 일괄 적용, 활성 User Template 연결과 G7 route 선택까지 구현됐습니다. 기본 SEO, 실패 발행 hash 불변 E2E, 최소 G7 fixture와 고정 시각 회귀 baseline은 다음 구현 범위입니다.

## 저장소 역할

| 저장소 | 소유 범위 |
|---|---|
| `gnuboard7` | 모듈 생명주기·Provider·라우트·migration·관리자 권한·관리자 메뉴 동기화·정적 asset serving |
| `g7-page-builder` | 독립 편집기·페이지 문서·리비전·발행본·Block Pack·상용 배포 정책 |

## 개발 환경

- 로컬 Docker: 실제 `g7pb-dev` 통합 컨테이너 1개
- PHP 8.5.9 + Xdebug
- Laravel 12.62.0 host (G7 7.0.7 lock)
- Nginx, MariaDB 10.11, Redis 7
- Node 24 LTS, Composer 2
- React 19.2
- Vite 7
- TypeScript strict
- Puck 0.23.0(정확한 버전 고정), Puck 내장 Tiptap Rich Text
- Vitest, PHPUnit 13, Pint, PHPStan, Playwright 1.62.1

로컬 접속은 `https://g7pb.test`만 사용합니다. 최초 설치와 일상 명령은 [Docker 로컬 개발환경](docs/docker-development.md)을 따릅니다.

## 병렬 Worktree 작업

동시 구현 채팅은 각각 Codex-managed Git worktree와 coordination task를 사용합니다. 기본 Local checkout은 통합과 단일 `g7pb-dev` runtime 전용이며 Worktree에서 Docker·G7·브라우저 gate를 직접 실행할 수 없습니다.

```bash
# Worktree 구현 채팅
make coord-start TASK=editor-task PATHS=resources/js/editor,tests/Unit PROFILE=frontend
make task-submit TASK=editor-task

# 기본 Local 통합 채팅
make coord-start TASK=integration-20260820 AREAS=integration,runtime,version PROFILE=full
make task-integrate TASK=editor-task INTEGRATION_TASK=integration-20260820
make integration-verify TASK=integration-20260820
```

상세한 소유권·충돌·취소·릴리스 규칙은 [Worktree coordination 하네스](docs/worktree-coordination.md)를 따릅니다.

## 다음 단계

완료:

1. Puck ↔ `PageBuilderDocument v1` 왕복 Adapter
2. 모듈 자체 문서·리비전·발행 저장소
3. 12종 block schema·editor·PHP compiler·public renderer, 좌측 미리보기 DnD와 반응형 iframe 기기 전환, 핵심 lifecycle PC·태블릿·모바일 E2E
4. 별도 문서함, 메타수정, 최근 리비전 조회·미리보기·새 초안 복원·재발행 rollback·공개 해제
5. 5종 typed motion preset, 공개 런타임, reduced-motion·CSP 회귀시험
6. 독립 Block Pack 계약, 14개 내장 블록 Registry 이관, 카탈로그 검색·분류·즐겨찾기
7. G7 공개 API 기반 최근 게시글·상품 그리드와 전체·비회원·회원 노출 조건
7. Data/Code Pack ZIP 설치·상태 전환·사용량 기반 제거, GitHub Release digest 업데이트, Ed25519 Code Pack runtime

다음:

1. G7 게시판·쇼핑 상품을 읽는 선택형 `ContentSourcePort`와 실제 동적 Block Pack
2. 선택형 Page Builder shell의 다단 메뉴·드롭다운과 Header·Footer 프리셋 확장
3. 기본 SEO 계약과 OG 이미지 선택, 접근성·고정 시각 회귀 baseline 보강

Product Grid는 기본 MVP 뒤 `sirsoft-ecommerce` 선택 Block Pack으로만 제공합니다.

## 개발·배포 문서

- [아키텍처](docs/architecture.md)
- [G7 연동 계약](docs/g7-integration-contract.md)
- [코어 계약 상태](docs/core-contracts.md)
- [편집기 엔진 결정](docs/editor-engine-decision.md)
- [블록 카탈로그 벤치마크](docs/block-catalog-benchmark.md)
- [Block Pack 계약](docs/block-pack-contract.md)
- [공식 무료 마켓 계약](docs/official-store-contract.md)
- [공식 무료 마켓 구현 배치](docs/official-store-implementation-batches.md)
- [동적 효과 계약](docs/motion-effects.md)
- [MVP 기능 명세](docs/mvp-functional-spec.md)
- [문서·발행 계약](docs/document-publish-contract.md)
- [공통 Header·Footer 계약](docs/site-shell-contract.md)
- [User Template·라우트 연결 계약](docs/template-route-integration.md)
- [품질 하네스](docs/quality-harness.md)
- [Worktree coordination 하네스](docs/worktree-coordination.md)
- [런타임·호스팅·Rust 정책](docs/runtime-hosting.md)
- [Docker 로컬 개발환경](docs/docker-development.md)
- [스테이징 배포 하네스](docs/deployment-harness.md)

Docker 로컬 개발환경, G7 설치 자동화, 체크섬 기반 릴리스 패키지와 `g7devops` 스테이징 배포 하네스가 구현되어 있습니다. 병렬 task를 모두 통합한 뒤 `make integration-verify TASK=<integration-id>`, `make release-package TASK=<integration-id>`, `make deploy-staging TASK=<integration-id>`, `make smoke-staging TASK=<integration-id>` 순서로 실행합니다.

제품 버전은 [SemVer 정책](docs/versioning-policy.md)을 따르며 사용자 관점 변경사항은 [CHANGELOG.md](CHANGELOG.md)에 기록합니다. G7 관리 화면과 릴리스 패키지는 동일한 버전과 changelog를 사용합니다.

로컬 G7 실행 소스는 제품 Git에서 제외된 `.runtime/gnuboard7`의 별도 clone을 사용합니다. 현재 기준은 공식 G7 `7.0.7`입니다.
