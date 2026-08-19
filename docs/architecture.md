# Architecture

## 결론

G7 Page Builder는 코어 수정 없이 동작하는 독립 모듈입니다. 목록·생성은 G7 공개 admin route/layout으로 기존 관리자 외형을 사용하고, 편집 화면은 G7 Layout Editor와 분리해 Puck을 편집기 커널로 사용합니다. 기본 제품은 G7의 모듈 lifecycle·Provider·route·migration·admin permission·admin layout·asset serving 표면에만 연결합니다.

## 소유권

| 영역 | 소유자 |
|---|---|
| G7 shell과 분리된 `canvas` 전체 | G7 Page Builder |
| 기존 HTML 본문 | HtmlEditor/CKEditor |
| PageBuilderDocument | G7 Page Builder |
| Puck UI 상태 | 임시 편집 상태, 영속 금지 |
| 컴파일된 HTML·JSON UI | 생성물, 직접 편집 금지 |

## 계층

```text
Domain
  PageBuilderDocument, BlockDefinition
       |
Application
  Draft, Publish, Migrate, Compile
       |
Ports
  PageDocumentPort, DocumentCompilerPort, PublicationPort, MediaPort
       |
Adapters
  PuckEditor, Gnuboard7, MySQL, Storage
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
G7 module-owned public route/viewer
      |
      +-- motion이 있을 때만 1.6KB gzip public effects IIFE
```

## MVP 공개 방식

- 문서 스키마 v1은 `canvas`만 허용합니다.
- `/pages/{slug}` PHP Web route가 발행본을 직접 렌더하며 G7 User SPA layout이나 User Template을 거치지 않습니다.
- 발행본 하나를 홈으로 지정한 경우에만 `/`을 가로채고, 미지정·조회 실패 시 G7 기본 홈으로 통과시킵니다.
- G7 공통 Header·Footer를 강제로 주입하지 않습니다. 전용 Header·Footer block은 별도 block으로만 추가하며 현재 12종 테스트 카탈로그에는 없습니다.
- 향후 User Template shell, `sirsoft-page` metadata, 쇼핑몰 Product Grid, G7 JSON UI는 각각 별도 선택 Adapter·Block Pack으로만 추가합니다.
- 선택 연동이 없거나 실패해도 기본 문서의 저장·발행·공개 렌더는 중단하지 않습니다.

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
