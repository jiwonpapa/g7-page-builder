# 독립 페이지 빌더 구조

현재 주 개발 대상은 G7 편집기 확장이 아니라 PB 소유 페이지 전체의 정밀 편집기다. [개발 헌법](development-constitution.md), [편집 정책](productization/editing-policy.md), [세부 스펙](productization/independent-editor-spec.md), [개발 계획](productization/editor-plan.md)을 따른다.

## 목표 책임과 소스 경계

아래는 기존 소스를 재사용하며 단계적으로 옮길 목표 구조다. 새 디렉터리 생성이나 계층 분리가 이미 완료됐다는 뜻이 아니다.

| 계층 | 위치와 역할 | 허용 의존 |
|---|---|---|
| 문서 도메인 | resources/js/documents, PHP src/Domain, schemas; 안정 ID·버전·노드·typed 디자인·순수 명령 | 도메인/공통 명세만; React/Puck/G7/DOM/I/O 금지 |
| 편집 포트 | resources/js/editor-ports 목표 경로; EditorEngine/DocumentStore/Media/RouteCatalog/Permissions | 문서 도메인만; vendor 타입 금지 |
| 사용 사례 | resources/js/editor-application 목표 경로; 세션·명령·저장/발행/복구 | 도메인·포트, 구체 Adapter 생성 금지 |
| UI | resources/js/editor; 작업면·레이어·Inspector·문맥 도구 | 도메인·사용 사례·포트; 직접 HTTP/저장 규칙은 점진 이관 |
| 편집 엔진 Adapter | resources/js/adapters/puck 목표 경로; 기존 PuckEditorAdapter/codec/history 재사용 | Puck·문서·포트; G7 host/editor API 금지 |
| 입력 Adapter | resources/js/adapters/interaction 목표 경로; Moveable/Selecto 이벤트·좌표 | typed 명령/선택 포트; DOM 결과 영속 금지 |
| 저장/서비스 Adapter | 기존 API 및 src/Infrastructure/Gnuboard7, ports 구현 | 공개 G7 API/모듈 연결; private import·직접 G7 테이블 금지 |
| 조립 entry | 독립 편집기 entry | UI와 선택한 Adapter 주입; G7 없는 테스트 조립점 필수 |
| 공개 렌더 | PHP compiler + 사전 빌드 public CSS/runtime | 마지막 정상 발행본, 편집기/관리 API 번들 참조 금지 |

기존 파일을 한 번에 이름만 바꾸거나 같은 계약을 새 경로에 복제하지 않는다. IP1/IP2가 실제 의존과 정적 gate를 함께 정리한다. 현재 구조 검사 통과는 이 목표 구조로의 이전 완료를 뜻하지 않는다.

PB 명령의 적용/거부/취소와 선택 복원을 한 흐름으로 관리한다. Puck history를 재사용하고 Moveable/Selecto/Tiptap이 독립 이력이나 원본을 만들지 않게 한다. 좌표/DOM은 입력과 미리보기이고, 확정 결과는 검증한 문서 명령이다.

React 편집 renderer와 PHP compiler는 별도 구현이다. 공통 버전 명세·레이아웃/스타일 의미·fixture를 공유하고 실제 치수/줄바꿈/순서를 비교한다. 고객 서버에 React SSR/Node 실행을 요구하지 않는다.

## G7과 보존 네이티브 모드

G7은 인증·권한·첨부·주소·공개 데이터와 모듈 호스팅을 제공하는 Adapter다. G7 없는 포트 대체 환경에서 핵심 편집을 시험한다. 범용 독립 서버나 G5 Adapter는 이번에 제공된 것으로 주장하지 않는다.

기존 native-editor와 adapters/gnuboard7 브라우저 호스트 연결은 별도 호환 트랙으로 남긴다. 이 모드의 G7 원본·선택·Undo·저장은 계속 G7 소유다. 미확보 registerPanel/호스트 패치를 독립 PB의 실행 전제에 넣지 않는다. [보존 계약](productization/editing-policy-native-20261012.md)과 [호스트 증거](productization/native-host-contract.md)를 유지하며 자동 변환/삭제하지 않는다.

## 기존 실행 경로와 보존 사항

아래는 현재 PB의 실행 기반이다. 새 정밀 디자인 계약은 문서 v3 목표로 구현하며 기존 v1/v2와 Site Part는 명시적인 이행 전까지 각 버전의 의미를 유지한다.

## 소유권

| 영역 | 소유자 |
|---|---|
| `canvas` 콘텐츠 전체 | G7 Page Builder |
| Site Part 미발행·장애 시 기본 Header·Footer·navigation | 활성 G7 User Template |
| 선택형 builder shell과 호환 User Template 공통 Header·Footer Site Part 문서·리비전·발행본 | G7 Page Builder |
| 기존 HTML 본문 | HtmlEditor/CKEditor |
| PageBuilderDocument | G7 Page Builder |
| Block Pack manifest·설치 상태·관리자 즐겨찾기 | G7 Page Builder |
| Puck UI 상태 | 임시 편집 상태, 영속 금지 |
| 컴파일된 HTML·JSON UI | 생성물, 직접 편집 금지 |

## 계층

```text
Domain
  PageBuilderDocument, SitePartDocument, BlockDefinition, BlockPackManifest
       |
Application
  Draft, Publish, Migrate, Compile, BlockRegistry, BlockPackManager
       |
Ports
  PageBuilderRepository, SitePartRepository, DocumentCompilerPort, MediaPort,
  BlockPackRepository, BlockPackArchivePort, BlockPackReleaseSourcePort,
  BlockFavoritePort, BlockUsagePort, BlockPackProvider
       |
Adapters
  PuckEditor, Gnuboard7, MySQL, local ZIP storage, GitHub Release
```

## 실행 흐름

```text
Puck editor Data
      |
      v
PuckEditorAdapter
      |
      v
PageBuilderDocument (현재 v1/v2, 정밀 디자인 v3 목표) <- 유일한 원본
      |
      v
PHP validate + compile
      |
      v
last-good published HTML + typed data attributes
      |
      v
G7 module-owned canonical route
      |
      +-- template: active User Template HtmlContent slot (default)
      +-- builder/none: module-owned standalone viewer
      +-- scoped public CSS/effects IIFE
```

## MVP 공개 방식

- 문서 스키마 v1은 `canvas`만 허용합니다.
- 기본 `shell_mode=template`의 `/pages/{slug}`는 모듈 user route와 layout을 통해 활성 User Template의 `_user_base` 안에 발행 artifact를 `HtmlContent`로 삽입합니다.
- `template` 문서를 홈으로 지정한 경우에만 공개 route merge filter가 `/`의 layout을 모듈 home layout으로 교체합니다. 홈 해제·공개 해제·조회 실패 시 원래 G7 템플릿 홈으로 되돌아갑니다.
- Header·Footer Site Part가 모두 발행되고 `sirsoft-basic 1.x (>=1.1)` 호환 프로필이 일치하면 `core.layout_extension.after_apply` 결과에 progressive Site Shell data source와 `HtmlContent` 두 노드를 런타임 주입합니다. 원본 Header·Footer 노드는 삭제하지 않고 셸 조회 전과 `enabled=false` fallback에서 계속 보존하므로 G7 라우트 렌더링을 차단하지 않습니다.
- 공통 셸 API·컴파일·호환성 중 하나라도 실패하거나 모듈이 비활성화되면 원본 템플릿 Header·Footer·navigation을 사용합니다. admin 템플릿에는 적용하지 않습니다.
- `shell_mode=builder`에서만 모듈 전용 Header·Footer `SitePartDocument`를 같은 Puck 캔버스에서 편집하고 각각 독립 revision으로 발행합니다.
- Site Part는 `site.header.*`, `site.footer.*` 블록만 허용하며 발행 시 PHP compiler와 URL allowlist를 통과한 active revision만 공개합니다.
- 검색·인증·마이페이지·알림·장바구니·테마·언어·통화는 Site Part 문서 필드가 아닙니다. compiler가 고정 마커를 만들고 사전 빌드된 G7 runtime adapter가 공개 state/action/API로만 컨트롤을 구성합니다.
- 0.6.x의 `SiteShellPort` 값은 최초 Site Part bootstrap 입력과 미발행 fallback으로만 유지하며 전환 후 편집 진입점으로 사용하지 않습니다.
- 문서는 기본 `shell_mode=template`입니다. Page Builder 자체 shell이 필요한 캠페인은 `builder`, 공통영역 없는 인트로는 `none`을 선택합니다. 구형 `global`은 읽을 때 `builder`로 호환하며 저장 시 정규화합니다. 이 값은 revision과 publication에 함께 snapshot됩니다.
- 활성 템플릿 route catalog를 G7 공개 service로 읽어 로그인·회원가입·게시판·쇼핑몰·마이페이지·Page Builder 링크를 선택합니다. route parameter는 공개 API 목록 또는 관리자 선택값으로 채우고 최종 문서에는 검증된 URL만 저장합니다.
- `sirsoft-page` metadata와 G7 JSON UI는 각각 별도 선택 Adapter·출력 target으로만 검토합니다.
- G7 최근 게시글·상품 그리드는 번들 모듈의 Model·Repository·테이블을 참조하지 않고 공개 REST API만 호출하는 선택형 내장 블록입니다. 대상 모듈이 없거나 응답에 실패하면 해당 블록만 빈 상태로 닫힙니다.
- 선택 연동이 없거나 실패해도 기본 문서의 저장·발행·공개 렌더는 중단하지 않습니다.

## Block Pack 실행 경계

- 23개 기본 정의는 내장 Pack manifest에서 PHP compiler Registry와 Puck catalog로 동시에 등록합니다.
- Data Preset Pack은 JSON props와 정적 자산만 제공하며 실행 코드를 등록하지 않습니다.
- Code Pack은 발행자 귀속 Ed25519 서명과 모든 파일 digest를 통과한 뒤에만 PHP provider와 editor IIFE를 로드합니다.
- 비활성 Pack은 신규 카탈로그에서 숨기되 기존 문서 해석용 resolved version을 유지합니다.
- Pack 제거는 해당 block identity를 참조하는 모든 모듈 소유 문서·리비전이 0일 때만 수행합니다.
- GitHub 네트워크는 관리자의 확인·설치 요청에서만 사용하며 공개 요청은 마지막 정상 발행 HTML만 읽습니다.

## 업데이트 원칙

- 원본 문서는 Puck과 G7 출력 형식에서 분리합니다.
- Compiler는 출력 형식과 대상 엔진 버전을 명시합니다.
- 문서 마이그레이션은 `v1 -> v2` 단방향 체인으로 제공합니다.
- 마지막 정상 발행 결과는 새 컴파일 성공 전까지 교체하지 않습니다.
- 모듈이 활성인 schema/compiler 비호환에서는 편집·발행만 중지하고 기존 공개 페이지를 유지합니다.
- 코어 버전 비호환으로 모듈이 비활성화되면 viewer route도 사라지므로 배포 doctor가 해당 G7 업데이트를 중지합니다.
- 공개 요청에서는 Puck·Node·컴파일러를 실행하지 않고 저장된 발행본만 읽습니다.
- 동적 효과는 canonical block의 typed `motion` 계약을 PHP compiler가 `data-g7pb-motion` 속성으로 변환합니다.
- 공개 효과 런타임은 G7 Adapter view가 self-hosted asset으로 조건부 로드하며 Domain/Application은 브라우저 구현을 알지 않습니다.

## 개발과 검증 경계

일반 구현은 별도 Worktree에서 `PROFILE=scoped`와 24개 이하의 정확한 파일 PATHS로 시작합니다. 제출·통합·최종확인·CI는 같은 Python 변경 검사 계획을 사용합니다. 미분류 변경은 범위 오류이며 전체검증으로 자동 확대하지 않습니다. 공유 런타임·계약 또는 RC 전체검증은 사유를 명시한 `FULL=1` 요청으로 구분합니다.

Worktree 제출은 선택된 정적·단위 검사를 수행합니다. 실제 G7 연동·브라우저 및 빌드 산출물 검사는 `DEFERRED`로 표시하고 Local의 integration/runtime lease 아래에서 수행합니다. 후보 소스·환경·실제 dist 지문이 일치한 뒤 관련 자산 검사와 브라우저 동작을 확인해야 통합할 수 있습니다. `DEFERRED`는 제품 동작 성공이 아닙니다.

기존 완성 블록의 내부 구조 편집과 중첩 삽입·이동·삭제는 목표 요구로 유지합니다. 문서·검사 기준의 정비가 이 기능의 구현이나 사용자 화면 검증을 완료했다는 뜻은 아닙니다.
