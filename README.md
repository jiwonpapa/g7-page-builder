# G7 Page Builder

그누보드7 코어를 수정하지 않고 일반 페이지와 랜딩 페이지를 블록 방식으로 제작하는 독립 모듈입니다.

## 결정된 방향

- G7 Layout Editor를 호출하거나 확장해 페이지 문서를 편집하지 않습니다.
- 독립 편집기는 MIT `Puck`을 커널로 사용하고 Puck은 Adapter 뒤에 격리합니다.
- 이 저장소는 페이지 문서, 리비전, 발행본, 블록 프리셋과 공개 렌더 결과를 소유합니다.
- `PageBuilderDocument`를 MVP에서는 안전한 HTML로 컴파일하며 G7 JSON UI 출력은 공개 렌더 계약이 생긴 뒤 추가합니다.
- 기본 모듈은 G7 코어의 lifecycle·Provider·route·migration·admin permission·모듈 소유 admin menu/layout·asset serving 표면만 사용합니다.
- `sirsoft-page`, `sirsoft-ecommerce`, User Template, Layout Extension은 선택 연동이며 없어도 전체 기본 흐름이 동작합니다.
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
        v
G7 module-owned public route/viewer
```

## 현재 상태

Hero·Features·CTA·Contact 수직 기능에 Hero Split·Hero Slider·Logo Cloud·Stats·Pricing·Team·Gallery·Bar Chart를 추가해 12종 테스트 카탈로그를 구현했습니다. 좌측 Blocks 라이브러리는 12종 축소 구조 미리보기와 용도를 표시하고 Puck 기본 DnD로 블록 사이 정확한 위치에 드롭합니다. 상단의 모바일·태블릿·PC 버튼은 iframe 캔버스 폭과 실제 반응형 렌더를 전환하며, `전체 미리보기`는 선택 블록 뒤에 빠르게 추가하는 보조 흐름입니다. G7 네이티브 페이지 빌더 문서함과 독립 편집기에서 문서 생성·재진입·메타수정, typed style·motion preset, 블록 추가·편집·정렬, 초안 저장과 reload, 미리보기, 2단계 발행, `/pages/{slug}` 공개, 선택형 홈(`/`), 리비전 조회·미리보기·복원·재발행 rollback·공개 해제까지 동작합니다. 공개 효과는 Reveal·Stagger·Soft Parallax·Counter·Chart Draw 5종이며, 효과가 있는 페이지에만 경량 IIFE 런타임을 조건부 로드합니다.

전체 유료 MVP는 아직 아닙니다. 자체 MediaPort 이미지 업로드·선택, 복구 가능한 문서 보관·복원·확인형 영구 삭제, Hero 중복 경고, Embla 슬라이더, 추천 효과 일괄 적용까지 구현됐습니다. 기본 SEO, 실패 발행 hash 불변 E2E, 최소 G7 fixture와 고정 시각 회귀 baseline은 다음 구현 범위입니다.

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

## 다음 단계

완료:

1. Puck ↔ `PageBuilderDocument v1` 왕복 Adapter
2. 모듈 자체 문서·리비전·발행 저장소
3. 12종 block schema·editor·PHP compiler·public renderer, 좌측 미리보기 DnD와 반응형 iframe 기기 전환, 핵심 lifecycle PC·태블릿·모바일 E2E
4. 별도 문서함, 메타수정, 최근 리비전 조회·미리보기·새 초안 복원·재발행 rollback·공개 해제
5. 5종 typed motion preset, 공개 런타임, reduced-motion·CSP 회귀시험

다음:

1. 기본 SEO 계약과 OG 이미지 선택 구현
2. 접근성·고정 시각 회귀 baseline 보강
3. 실패 발행 뒤 public hash 불변, 최소 G7 fixture, 접근성·시각 회귀 gate 추가

Product Grid는 기본 MVP 뒤 `sirsoft-ecommerce` 선택 Block Pack으로만 제공합니다.

## 개발·배포 문서

- [아키텍처](docs/architecture.md)
- [G7 연동 계약](docs/g7-integration-contract.md)
- [코어 계약 상태](docs/core-contracts.md)
- [편집기 엔진 결정](docs/editor-engine-decision.md)
- [블록 카탈로그 벤치마크](docs/block-catalog-benchmark.md)
- [동적 효과 계약](docs/motion-effects.md)
- [MVP 기능 명세](docs/mvp-functional-spec.md)
- [문서·발행 계약](docs/document-publish-contract.md)
- [품질 하네스](docs/quality-harness.md)
- [런타임·호스팅·Rust 정책](docs/runtime-hosting.md)
- [Docker 로컬 개발환경](docs/docker-development.md)
- [스테이징 배포 하네스](docs/deployment-harness.md)

Docker 로컬 개발환경, G7 설치 자동화, 체크섬 기반 릴리스 패키지와 `g7devops` 스테이징 배포 하네스가 구현되어 있습니다. 배포 순서는 `make quality-gate`, `make release-package`, `make deploy-staging`, `make smoke-staging`입니다.

제품 버전은 [SemVer 정책](docs/versioning-policy.md)을 따르며 사용자 관점 변경사항은 [CHANGELOG.md](CHANGELOG.md)에 기록합니다. G7 관리 화면과 릴리스 패키지는 동일한 버전과 changelog를 사용합니다.

로컬 G7 실행 소스는 제품 Git에서 제외된 `.runtime/gnuboard7`의 별도 clone을 사용합니다. 현재 기준은 공식 G7 `7.0.7`입니다.
