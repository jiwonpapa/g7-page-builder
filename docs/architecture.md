# Architecture

## 결론

G7 Page Builder는 코어 수정 없이 동작하는 독립 모듈입니다. 목록·생성은 G7 공개 admin route/layout으로 기존 관리자 외형을 사용하고, 편집 화면은 G7 Layout Editor와 분리해 Puck을 편집기 커널로 사용합니다. 기본 공개 출력은 활성 User Template의 `_user_base`를 재사용합니다. 선택한 Header·Footer 두 Site Part가 모두 정상 발행되면 공식 post-apply filter가 활성 User Template의 사용자 라우트 전체에 연결하며, 템플릿 파일·layout JSON·DB row는 수정하지 않습니다.

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
PageBuilderDocument v1  <- 유일한 원본
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
- Header·Footer Site Part가 모두 발행되고 `sirsoft-basic 1.x (>=1.1)` 호환 프로필이 일치하면 `core.layout_extension.after_apply` 결과에 blocking Site Shell data source와 `HtmlContent` 두 노드를 런타임 주입합니다. 원본 Header·Footer 노드는 삭제하지 않고 `enabled=false` fallback 조건으로 보존합니다.
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
