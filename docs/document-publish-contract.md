# Document and publication contract

## 원본 문서

`PageBuilderDocument`만 편집 원본입니다.

관리자 진단 화면은 현재 원본 JSON과 임시 preview compiler의 HTML을 읽기 전용으로 비교할 수 있습니다. 진단 생성은 active publication을 변경하지 않으며, 표시된 HTML을 다시 원본으로 저장할 수 없습니다.

```json
{
  "schema_version": "g7-page-builder/v1",
  "document_id": "uuid",
  "slug": "my-landing-page",
  "mode": "canvas",
  "locale": "ko",
  "shell_mode": "template",
  "tokens": {},
  "blocks": []
}
```

Block은 `instance_id`, `type`, `block_version`, `props`, 선택형 `slots`를 가집니다. schema는 향후 중첩을 위해 Block 배열을 표현하지만 첫 수직 slice의 Adapter와 compiler는 비어 있지 않은 `slots`를 fail-closed합니다. Editor vendor 전용 키는 허용하지 않습니다.

## CompileResult

```json
{
  "schema_version": "g7-page-builder-compile-result/v1",
  "compiler_version": "0.1.0",
  "document_id": "uuid",
  "source_revision": 7,
  "target_format": "html",
  "target_engine_version": "g7-7.0.7",
  "artifact": "<section class=\"g7pb-...\">...</section>",
  "artifact_sha256": "64 lowercase hex chars",
  "warnings": []
}
```

- 같은 문서·compiler·target은 byte-identical artifact와 같은 hash를 만들어야 합니다.
- 시간, random ID, host path, editor selection을 artifact에 넣지 않습니다.
- HTML class/id는 `g7pb-` prefix를 사용합니다.
- 임의 script, event handler, style tag, javascript URL은 compile 단계에서 거부합니다.

## 저장 모델

구현 migration은 아래 논리 모델을 따릅니다.

| 저장소 | 핵심 값 |
|---|---|
| `g7pb_documents` | slug, title, mode, locale, current lock, active publication id |
| `g7pb_revisions` | immutable document JSON, 당시 title, schema version, author, created at |
| `g7pb_publications` | source revision, prepared lock version, compiler version, artifact, hash, status |
| `g7pb_preview_tokens` | token hash, document/revision, expires at |
| `g7pb_site_shells` | locale별 공통 Header·Footer·메뉴 JSON, lock version |

G7 또는 번들 모듈 테이블에 foreign key를 만들지 않습니다. 선택형 외부 reference가 필요해지면 기본 저장소와 분리된 Adapter 전용 mapping table에만 둡니다.

## 상태 전이

```text
draft --prepare--> candidate --commit--> active
  |                    |
  +----save revision---+--fail/expire--> rejected

active --new publish--> active(new)
  previous active remains immutable

active --unpublish--> superseded + draft retained
```

- draft save는 `expected_lock_version` compare-and-swap입니다.
- revision과 publication은 immutable입니다.
- commit은 document의 active pointer만 transaction에서 바꿉니다.
- candidate는 prepare 당시 lock version을 기록하며 commit 시 현재 lock과 다시 비교합니다. draft 변경·metadata 변경·공개 해제 뒤의 오래된 token은 commit할 수 없습니다.
- candidate failure/expiry는 active pointer를 변경하지 않습니다.
- 공개 해제는 active pointer만 비우고 문서·revision·publication 기록은 삭제하지 않습니다.
- rollback은 과거 JSON을 새 revision으로 복사한 뒤 정상 publish 절차를 다시 수행합니다. 원본 과거 revision과 현재 active publication은 복원만으로 변경하지 않습니다.
- 과거 미리보기와 복원은 revision에 저장된 당시 title·slug·locale을 함께 사용합니다.
- 문서 복제는 원본의 현재 draft를 새 문서 revision 1로 기록하며 publication·home·preview token·revision 이력은 복사하지 않습니다.
- `shell_mode`는 문서 revision과 publication에 snapshot하며 `template`, `builder`, `none`을 허용합니다. 구형 `global`은 `builder`로 읽고 다음 저장에서 정규화합니다.
- `template`은 활성 G7 User Template의 `_user_base`를 사용합니다. `builder`는 Page Builder Site Part 발행본, `none`은 canvas만 렌더합니다.
- Page Builder Site Part와 구형 공통영역 설정은 별도 revision/CAS 저장소에서 관리하며 활성 G7 템플릿 데이터에 기록하지 않습니다.

## Preview

- preview token 원문은 DB에 저장하지 않고 hash만 저장합니다.
- 기본 만료는 15분이며 해당 시간 안에는 같은 revision을 반복 확인할 수 있습니다. 명시 revoke API는 현재 제공하지 않습니다.
- preview 응답은 `no-store`, `noindex`, frame 정책을 설정합니다.
- public endpoint는 preview token을 받지 않습니다.
- public HTML/API는 ETag를 유지하되 `public, no-cache, must-revalidate`로 매 요청 원본 상태를 재검증합니다. cache purge 계약 전에는 `max-age`와 `stale-while-revalidate`를 사용하지 않습니다.
- ETag는 artifact만이 아니라 title·slug·locale·published-at을 포함한 전체 공개 표현 hash입니다.

## Migration

- 문서와 block migration은 순수 단방향 함수입니다.
- 원본 revision을 덮어쓰지 않고 migration 결과를 새 revision으로 저장합니다.
- 지원하지 않는 schema/block/compiler에서는 저장·발행을 막고 active publication은 유지합니다.
