# G7 Page Builder Development Guide

## Communication

- 사용자에게는 존댓말을 사용하고 `형님`이라고 부른다.
- 결과와 영향부터 간결하게 보고한다.

## Cleanup and approval orchestration

<!-- policy:cleanup-approval-orchestration:v1:start -->

- 요청 결과와 필수 검증을 끝내는 데 필요하지 않은 임시파일·중간 산출물 삭제는 작업 중간에 실행하거나 승인 요청하지 않는다.
- 비차단 정리는 모든 필수 작업이 끝난 뒤로 모으고, 삭제 전 정확한 경로·크기·소유 범위·복구 가능성을 읽기 전용으로 확인한 다음 한 번의 승인 요청으로 제시한다.
- 비차단 정리 승인이 없거나 응답이 지연돼도 요청 결과와 필수 검증이 끝났다면 정리를 보류한 채 완료 보고하며, 정리 승인을 기다리느라 task를 대기 상태로 남기지 않는다.
- 삭제 없이는 필수 작업을 계속할 수 없는 디스크 부족·잠금·경로 충돌·검증 오염이 확인된 경우에만 중간 승인을 요청하고, 차단 원인과 최소 삭제 대상을 함께 제시한다.
- 검증 하네스가 자신이 만든 고유 임시 디렉터리를 검증된 `trap`으로 자동 정리하는 경우는 예외다. 사용자 파일·공유 캐시·증거 산출물·활성 worktree는 임시파일로 간주하지 않는다.
- 실행 환경이 삭제 승인을 요구하면 우회하지 않는다. 다만 비차단 삭제라면 승인 도구를 호출하지 않고 마지막 정리 단계까지 보류한다.

<!-- policy:cleanup-approval-orchestration:v1:end -->

## Parallel work and integration

- 동시 구현은 채팅별 Codex-managed Git worktree 하나와 task 하나로 분리한다. 기본 Local checkout은 통합과 단일 `g7pb-dev` runtime 전용이다.
- 모든 구현 task는 깨끗한 기준 SHA에서 `make coord-start TASK=<id> PATHS=<comma-separated-prefixes> PROFILE=<profile>`로 시작한다. migration·공개 계약·버전 파일은 각각 `AREAS=migration`, `shared-contract`, `version` 독점 lease를 함께 얻는다.
- task가 claim하지 않은 파일은 수정하지 않는다. 범위가 늘어나면 기존 task를 억지로 확장하지 말고 충돌 task가 없는지 확인한 뒤 새 task로 다시 시작하거나 통합 담당자에게 이관한다.
- Worktree에서는 `make task-submit TASK=<id>`만 사용해 범위검사·프로필 검증·커밋·제출 SHA 기록을 완료한다. 제출 전 수동 merge, 다른 task branch 수정, shared Local checkout 직접 수정은 금지한다.
- 새 기준과 의미 충돌한 submitted task를 다시 작성해야 할 때는 수동 release나 metadata 수정을 하지 않는다. 별도 clean worktree에서 `make task-replace-submitted TASK=<new-id> SUPERSEDES=<submitted-id> BASE_REF=<reviewed-sha>`만 사용하며, 하네스가 기존 PATHS·AREAS·PROFILE을 그대로 상속하고 원본 제출 SHA·worktree를 `superseded` history로 보존해야 한다.
- 제출 뒤 원 변경과 함께 생성되어야 하는 렌더 스냅샷·인덱스·manifest·증거 digest 같은 결합 산출물이 gate에서 확인되고 사용자가 새 소유 범위를 명시적으로 승인한 경우에만, 별도 clean worktree에서 `make task-replace-submitted-expanded TASK=<new-id> SUPERSEDES=<submitted-id> PATHS=<old-and-approved-new-prefixes> BASE_REF=<reviewed-sha>`를 사용한다. 기존 PATHS 항목은 모두 유지하고 AREAS·PROFILE은 그대로 상속하며, 일반 교체와 동일하게 원본 제출 SHA·worktree를 보존해야 한다.
- 통합 담당자는 Local에서 `AREAS=integration,runtime`을 독점 claim하고, 독립 task는 `make task-integrate TASK=<submitted-id> INTEGRATION_TASK=<integration-id>`로 순차 병합한다. 서로 기능적으로 의존하지만 PATHS·AREAS가 겹치지 않는 submitted task 2개 이상은 `make task-integrate-batch TASKS=<id,id,...> INTEGRATION_TASK=<integration-id>`로만 함께 병합한다. batch는 가장 강한 profile gate를 한 번 실행하고 Git·metadata를 전부 성공시키거나 전부 원복해야 하며, 충돌·중복 ID·claim 겹침을 허용하지 않는다. 하네스의 사전검사와 임시 병합 검증을 우회하지 않는다.
- `make dev-*`, Docker 기반 `quality-*`, release·staging 명령은 runtime lease를 가진 Local integration task만 실행한다. Worktree에서 고정 `g7pb-dev` 컨테이너를 직접 조작하지 않는다.
- 모든 제출 task가 통합되거나 동일 범위·동일 profile replacement로 보존 대체되고, 그 replacement까지 통합된 뒤 `make integration-verify TASK=<integration-id>`를 통과해야 release 명령을 사용할 수 있다. 검증한 HEAD가 바뀌면 다시 전체 검증한다.
- task 채팅과 worktree는 통합 또는 `superseded` 보존 기록 전에 archive·삭제하지 않는다. dirty/untracked 파일이나 기준 SHA 이후 커밋이 있으면 lease를 강제 해제하지 않는다.
- 현재 task의 범위는 `make coord-status`와 실제 `base_sha` 대비 diff로 판단한다. 채팅 기억이나 문서만으로 다른 task의 소유권을 추정하지 않는다.

## Architecture boundary

- 제품 저장소는 G7 코어 저장소와 분리한다.
- `src/Domain`, `src/Application`, `src/Contracts`에서는 G7 클래스와 Laravel 구현을 import하지 않는다.
- 모든 G7 연동은 `src/Infrastructure/Gnuboard7` Adapter에서만 수행한다.
- 루트 `module.php`는 G7 공개 `AbstractModule`을 연결하는 Composition Root 예외다. 여기에는 비즈니스 로직·DB 접근을 두지 않는다.
- `src/Providers/*ServiceProvider.php`는 Adapter binding, View·공개 route·middleware 등록만 수행하는 Laravel Composition Root 예외다.
- 기본 제품의 G7 의존성은 모듈 lifecycle·Provider 발견, API·Web route, migration, admin auth·permission, 모듈 소유 admin menu와 admin route/layout 2개, 활성 User Template route 조회·모듈 소유 user route 2개/layout 3개, route merge filter, 공식 `core.layout_extension.after_apply` 후처리 filter, 정적 asset serving으로 제한한다.
- custom role은 등록하지 않는다. `페이지 빌더` 전용 admin menu 하나만 별도 등록한다.
- G7 기본 `페이지 관리` 메뉴·slug·URL·데이터를 재사용·수정·숨김·대체하지 않는다.
- 기본 출력은 활성 User Template의 `_user_base`를 사용하되 기존 템플릿 파일·layout JSON·DB row는 수정하지 않는다. Page Builder 모듈이 선언한 정확히 2개 user route와 3개 user layout만 merge하고, 호환 프로필이 일치할 때만 공식 post-apply filter로 발행 Site Part를 런타임 결과에 연결한다.
- `sirsoft-page`, Layout Extension 저장소·overlay·Layout Editor는 사용하지 않는다. `sirsoft-board`와 `sirsoft-ecommerce`는 route/data 선택기의 공개 API capability로만 조회하며 모듈 hard dependency로 만들지 않는다.
- 선택형 G7 Adapter와 Block Pack은 capability가 없으면 해당 선택지만 비활성화하고 문서 저장·독립 shell 발행·마지막 정상 발행본에 영향을 주지 않는다.
- G7 내부 프론트엔드 경로(`resources/js/core/**`)와 `G7Core.__runtime`을 사용하지 않는다.
- G7 또는 번들 모듈의 Model·Repository·DB 테이블을 직접 참조하지 않는다.
- 기존 템플릿 파일과 레이아웃 파일을 수정하지 않는다. User Template 연결은 이 모듈의 `resources/routes/user.json`, `resources/layouts/user/**`, 공개 route merge filter와 공식 post-apply filter로만 수행한다.
- 페이지 빌더는 자기 모듈의 문서·리비전·발행본 테이블만 소유한다.
- 기본 `shell_mode=template` 공개 페이지는 활성 User Template이 site header·footer·navigation을 소유하고, Page Builder layout의 `HtmlContent` 영역에 마지막 정상 발행본만 삽입한다.
- `shell_mode=builder`는 Page Builder가 소유한 Header·Footer Site Part를 포함한 독립 viewer, `shell_mode=none`은 공통영역 없는 독립 viewer를 사용한다. 구형 `global`은 읽을 때 `builder`로 호환한다.
- Header·Footer Site Part 두 발행본이 모두 정상이고 활성 User Template 호환 프로필이 일치하면 사용자 기본 라우트 전체에 Page Builder 셸을 적용한다. API·컴파일·호환성 실패 시 원본 G7 Header·Footer를 렌더하며 admin route는 적용 대상이 아니다.
- 검색·로그인·회원가입·로그아웃·마이페이지·알림·장바구니·테마·언어·통화 컨트롤은 편집 문서 필드가 아니라 모듈 소유 고정 G7 runtime adapter가 제공한다. 문서는 endpoint·handler·인증 동작을 소유하거나 수정하지 않는다.
- 페이지 빌더 원본은 `PageBuilderDocument`이며 HTML과 G7 JSON UI는 교체 가능한 생성 결과물이다.
- 생성된 HTML·JSON UI와 편집기 벤더 상태를 원본처럼 직접 수정하거나 저장하지 않는다.

## Editor boundary

- Page Builder는 G7 Layout Editor와 분리된 독립 편집 화면을 제공한다.
- 편집기 커널은 MIT `@puckeditor/core`를 정확한 버전으로 고정해 사용하고 `EditorAdapter` 뒤에 격리한다.
- Puck의 `AppState`와 원시 `Data`는 영속 원본이 아니다. 저장 전후 항상 `PageBuilderDocument`로 변환한다.
- 드래그앤드롭·속성 패널·히스토리·반응형 캔버스를 새로 복제하지 않는다.
- Tiptap은 Puck의 리치텍스트 필드 구현으로만 사용한다. Tiptap을 페이지 레이아웃 엔진으로 사용하지 않는다.
- Hero 계열의 화면상 텍스트는 Puck `contentEditable`로 직접 편집하고 URL·이미지·구조·preset은 속성 패널에서 편집한다.
- 임의 class·Tailwind·inline style·raw HTML·JavaScript field를 문서 계약이나 편집기에 추가하지 않는다.
- Layout Editor는 `PageBuilderDocument`와 생성된 발행본을 열거나 저장하지 않는다.

## Compatibility

- 공개 계약과 문서 스키마는 SemVer를 따른다.
- 제품 버전은 `module.json`, `package.json`, `package-lock.json`에서 항상 일치시킨다.
- 사용자에게 의미 있는 변경은 Keep a Changelog 형식의 `CHANGELOG.md` `Unreleased`에 기록한다.
- 배포한 버전의 내용은 바꾸지 않고 변경이 필요하면 새 SemVer를 발행한다.
- 모든 문서는 `schema_version`, 모든 컴파일 결과는 `compiler_version`을 기록한다.
- G7 업데이트 후 과거 Fixture 재컴파일·렌더링 시험을 통과해야 한다.
- 모듈이 활성인 상태의 schema/compiler 비호환에서는 편집·발행을 중지하되 마지막 정상 발행본을 유지한다.
- G7 코어 업데이트가 모듈을 비활성화하면 자체 route도 사라지므로 배포 전 호환 시험 실패 시 G7 업데이트 자체를 중지한다.

## Runtime and hosting boundary

- MVP 공식 지원 환경은 단일 Ubuntu LTS VPS 기준으로 제한한다.
- 제품 런타임은 PHP 요청 처리와 사전 빌드된 브라우저 JS/CSS만 필수로 한다.
- TypeScript·React는 로컬 또는 CI에서 빌드하고 검증된 `dist`를 릴리스에 포함한다.
- 고객 서버에서 Node·npm·Vite 빌드를 실행하지 않는다.
- Page Builder는 Node 서버, Rust daemon, FFI, PHP native extension, Redis, Reverb를 필수 의존성으로 만들지 않는다.
- 공개 요청에서는 문서를 재컴파일하지 않고 마지막 정상 발행 결과만 렌더링한다.
- MVP에는 원격 라이선스 서버, 런타임 만료 또는 코드 인코딩을 넣지 않으며 구매한 릴리스와 기존 발행본을 기간 만료로 중단하지 않는다.
- Rust는 PHP 기준 구현의 실제 병목이 측정된 뒤 `docs/runtime-hosting.md`의 게이트를 통과한 무상태 선택형 CLI로만 검토한다.
- 초기에는 공유호스팅을 공식 지원하지 않지만 VPS 전용 의존성을 제품 코어에 추가하여 향후 호환 경로를 막지 않는다.

## Quality gates

- PHP: PHP 8.5, PHPUnit, Laravel Pint, PHPStan, Xdebug line coverage 하한선.
- Frontend: Node 24, TypeScript strict, Vitest V8 coverage 하한선, production build 및 asset manifest 검사.
- Browser: Playwright로 생성→편집→미리보기→발행 흐름을 확인한다.
- PC·태블릿·모바일 시각 회귀를 확인한다.
- 코어 내부 import와 직접 테이블 접근은 정적 검사로 차단한다.
- 테스트에서 `skip`으로 미구현 제품 흐름을 녹색 처리하지 않는다.
