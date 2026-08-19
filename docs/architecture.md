# Architecture

## 결론

G7 Page Builder는 새 편집기 엔진을 소유하지 않습니다. G7의 범용 JSON UI 문서 편집 공개 계약을 사용하고, 페이지 문서와 완성 블록을 제공합니다.

## 소유권

| 영역 | 소유자 |
|---|---|
| 템플릿 라우트·Header·Footer·화면 틀 | G7 Layout Editor |
| 일반 페이지의 블록 본문 | G7 Page Builder |
| 기존 HTML 본문 | HtmlEditor/CKEditor |
| PageBuilderDocument | G7 Page Builder |
| 컴파일된 JSON UI | 생성물, 직접 편집 금지 |

## 계층

```text
Domain
  PageBuilderDocument, BlockDefinition
       |
Application
  Draft, Publish, Migrate, Compile
       |
Ports
  PageDocumentPort, JsonUiCompilerPort, MediaPort, CapabilityPort
       |
Adapters
  Gnuboard7, MySQL, Storage, AI Provider
```

## 업데이트 원칙

- 원본 문서는 G7 JSON UI와 분리합니다.
- Compiler는 대상 G7 JSON UI 엔진 버전을 명시합니다.
- 문서 마이그레이션은 `v1 -> v2` 단방향 체인으로 제공합니다.
- 마지막 정상 발행 결과는 새 컴파일 성공 전까지 교체하지 않습니다.
- 호환되지 않는 G7에서는 편집·발행만 중지하고 기존 공개 페이지를 유지합니다.

