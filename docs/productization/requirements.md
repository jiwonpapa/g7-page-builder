# 요구사항-검증 대응표

상태: 1차 시험 명세. 아래 ‘구현 배치’는 예정이며 현재 통과 표시가 아닙니다. 실제 실행 결과는 phase-1-evidence.md와 각 차수 종료 기록에 남깁니다.

3-B는 LAY-01의 Section→2열 Columns→Heading/RichText 성공 경로와 COMP-01의 v1 유지 기반을 연결했습니다. 3-C는 금지 구조·상한·Puck 변환 원자성·v1 메타데이터 복원·마지막 정상본 부정 시험을 [3-C 실행 기록](phase-3-boundaries.md)에 연결합니다. 실제 통과 여부는 각 task의 full 통합 profile로 판정하며, 4차 UI 범위를 앞당겨 완료로 표시하지 않습니다.

| ID | 요구사항·합격 사례 | 구현 배치 | 시험 층/기존 재사용 지점 |
|---|---|---|---|
| P1-BASE | 기준 SHA·lease·dirty 파일·실행 환경 기록 | 1-A | coord-status, git diff, runtime 소유자 확인 |
| P1-INV | 45 정의/95 preset/5 kit ID 중복·누락 0, 새 기준 승인 0 | 1-C | manifest/AST 선언/원장 대조 |
| P1-VIS | 3개 기준 페이지의 내용/시각 합격 기준과 기존 실패 사례 | 1-C·6-C | 정적 기존 화면 검토와 새 실제 화면 시연을 구분 |
| G7R-01 | 블록별 허용 필드와 도구 노출 일치, 미선언 입력 거부 | 3-A·4-A·5-C | canvasEditingContract, documentSchema, PHP props 검증 |
| G7R-02 | 동일 부모/자식 표를 추가·드롭·API 저장에 적용 | 3-C·4-A·5-B | 새 layoutPolicy fixture + documentSchema/HtmlDocumentCompilerTest 확장 |
| G7R-03 | 색/크기/간격 공통 컨트롤을 대표 2종 이상에서 같은 동작으로 사용 | 4-B | BlockAppearance, fontSize, puckEditorSurface |
| G7R-04 | mobile override 삭제 후 공통값 변경 상속; tablet 지정값 유지 | 4-B | 새 responsive 순수 로직 + JSX/PHP 출력 비교 |
| G7R-05 | 샘플 상태가 실제 인증·draft·발행에 영향 없음 | 2-B·2-C·6-C·7-E | preview 공급 경계 + E2E blockCatalogQuality/G7 연동 |
| G7R-06 | 연속 편집/저장 응답/충돌/Undo/문서 전환 시 내용 보존 | 4-C·8-A | 기존 editorInteractionQuality + 저장/CAS 시험 |
| G7R-07 | 기본 목록 첫 편집, 빈 값/미지정/필수 오류 의미 보존 | 3-C·5-B·6-A | 공통 defaults/배열 fixture + schema/adapter/PHP |
| G7R-08 | 동일 원본의 편집/preview/public 내용·구조·스타일 일치 | 4-B·6-C·8-A | editorLayoutParity, 공통 fixture·폰트 준비·실제 너비 |
| LAY-01 | Section→Columns→Stack→leaf 성공, 금지 중첩 거부 | 3-B·3-C | canonical↔Puck slot 왕복 + PHP 출력 |
| LAY-02 | 빈 slot 첫 삽입 성공; 201번째 자식 거부 | 3-C·4-A | 순수 트리/서버/실제 drop |
| LAY-03 | 전체 500노드 허용/501거부, 1MiB 경계, 깊이 초과 거부 | 3-C | TS/PHP 동일 JSON fixture, UTF-8 다중 byte 포함 |
| LAY-04 | 3→2열 취소 불변/확인 시 순서·스타일 보존/한 Undo 복원 | 4-A·4-C | 컴포넌트 + 실제 포인터/키보드 |
| LAY-05 | 자기 하위 이동 거부, 이동 UUID 유지, 복제 UUID 전부 재발급 | 3-C·5-B | 순수 트리 + 저장/reload |
| COMP-01 | v1 단순 편집 v1 유지, 최초 구조 사용 동의 후 새 v2 revision | 3-B·4-C | documentSchema/puckDocumentAdapter, 저장 통합 |
| COMP-02 | v1 SEO·slug·locale·shell·block_version·revision 유지 | 3-C | 기존 Contract fixture + 왕복/복원 |
| COMP-03 | v2 미지원·compile 실패가 active hash를 바꾸지 않음 | 3-C·8-A | HtmlDocumentCompilerTest + publication 통합/E2E |
| COMP-04 | 상한 넘는 v1 전환 거부 후 기존 v1 동작 유지 | 3-C | 버전별 validator + 저장/E2E |
| PAT-01 | 구역 저장→다른 문서 삽입→독립 수정, 권한 거부/자산 보존 | 5-A·5-B | 신규 저장소/CAS·API 계약 + 제품 E2E |
| QA-01 | CSS 변경 시 의미 심사 재사용/렌더 증거 갱신 | 2-A·2-C·8-B | blockProductQuality.test, check-block-product-quality |
| QA-02 | dependency/필수 fixture 누락과 오래된 승인 반드시 실패 | 2-B·2-C | checker 부정 시험 + 마지막 전체 gate |
| UX-01 | PC 편집·tablet/mobile 읽기 전용, PC에서 기기별 설정 | 4-B·8-A | editorViewportPolicy + 실제 포인터 E2E |
| UX-02 | 한글 조합·문장 일부 서식·요소 전체 서식 충돌 없음 | 4-C | richTextEditingNative + editorInteractionQuality |
| CONTENT-01 | 대표 6개+3개 전체 페이지의 9조건 심사, 추가 의존 블록 포함 | 6-A~C | inventory 6-A/6-B + 자동/사람 판정 별도 |
| CONTENT-02 | 모든 preset 1배치, 7차 하위 배치 최대8, 과거 ID보존 | 7차 | inventory 대조 + 호환 fixture |
| RELEASE-01 | 모든 제출 통합·final SHA gate·승인된 배포만 | 8-C | integration-verify + release guard |

## 현행 시험 파일

아래 파일이 존재함을 확인했고 일부를 1차 기준선에서 실행했습니다. 새 요구사항 전체를 이미 검사한다는 뜻은 아닙니다.

- `tests/Unit/documentSchema.test.ts`
- `tests/Unit/puckDocumentAdapter.test.ts`
- `tests/Unit/blockPackManifest.test.ts`
- `tests/Unit/blockProductQuality.test.ts`
- `tests/Unit/editorViewportPolicy.test.ts`
- `tests/Unit/richTextEditingNative.test.tsx`
- `tests/Unit/puckEditorSurface.test.tsx`
- `tests/UnitPhp/HtmlDocumentCompilerTest.php`
- `tests/UnitPhp/BlockPackContractTest.php`
- `tests/E2E/editorInteractionQuality.spec.ts`
- `tests/E2E/editorLayoutParity.spec.ts`
- `tests/E2E/blockCatalogQuality.spec.ts`

## 2차 착수 카드 — 다음 코드 범위

목표는 승인 증거 분리이며 콘텐츠 디자인이나 중첩 구현을 섞지 않습니다.

| 배치 | 실제 후보 파일/범위 | 검증·lease |
|---|---|---|
| 2-A | schemas/block-product-quality.schema.json, resources/block-packs/builtin-core/product-quality.json | shared-contract, 버전된 의미/권리·렌더/편집 증거와 구형 이력 보존 |
| 2-B | scripts/check-block-product-quality.mjs, 해당 썸네일 증거/의존성 계산, docs/quality-harness.md | 변경 영향 unknown이면 전체 검사, 기존 안전 gate와 나란히 비교 |
| 2-C | tests/Unit/blockProductQuality.test.ts, 관련 tests/Harness, CHANGELOG.md | 코드 영향에 맞는 frontend/mixed/full profile; 자동 승인/coverage 축소 금지 |

정확한 PATHS는 1차 통합 SHA와 기존 활성 task 해소 뒤 다시 claim합니다. 현재 tests/Unit·CHANGELOG·docs/quality-harness는 다른 task가 소유하므로 이 1차에서 수정하지 않습니다. 필수 실패 사례를 먼저 작성한 뒤 구현하고, 기능상 의존하지만 소유권이 분리된 제출물만 기존 batch 통합 하네스를 사용합니다.

## 완료 판정

요구사항 ID → 실제 파일/fixture → 실행 결과 → 화면/저장/공개 증거가 연결되어야 완료입니다. 문서·타입·설정·테스트 존재, 테스트 통과, 사용자 시각 승인, 통합, 배포는 각각 따로 보고합니다.
