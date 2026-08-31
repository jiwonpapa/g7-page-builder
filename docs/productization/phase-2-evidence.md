# 2차 실행 기록 — 승인과 검증 재사용

일자: 2026-08-31. 2-A task: `productization-phase2a-20260831`.
기준 SHA: `b5de8ddc9d5a5017eb091ca203dc24be70ef576e`. `shared-contract` 독점 lease, frontend profile.

## 2-A 작업 카드

- 요구사항: roadmap 2-A, 2-C의 증거 분리·과거 기록 보존·오래된 승인/삭제된 증거 거부.
- 구현: 버전된 JSON Schema, 순수 TypeScript fingerprint/이행/판정 함수, 실패 회귀시험.
- 재사용: 기존 Ajv 2020/format 검증, Node 24 SHA-256, Vitest/strict/coverage 및 worktree 하네스.
- 변경하지 않음: PageBuilderDocument schema v1, PHP compiler, Puck 0.23.0, 현재 카탈로그/썸네일/기존 approval, v1 릴리스 게이트.
- 배포 영향: 개발/CI용 도구만 추가합니다. 고객 서버에 Node 실행을 요구하거나 runtime에 새 의존성을 추가하지 않습니다.
- 복구: 별도 제출 단위이며 v1 원장/승인과 게이트를 그대로 남깁니다. 사용자 문서 이행이나 데이터 삭제가 없습니다.

## 구현한 판정

| 구분 | 의존성 | 변경 시 |
|---|---|---|
| 콘텐츠 의미 review | 명시된 콘텐츠 payload + 자산/권리 지문 | copy·용도·자산 변화에 재심사 |
| 자산 권리 review | 명시된 자산 bytes/provenance/권리 payload | 교체·출처 변화에 재심사 |
| 렌더 verification | 콘텐츠/권리 + compiler/CSS/출력 payload | 화면 변화에 재검증 |
| 편집 verification | 위 렌더 + editor/fixture payload | 선언·입력·표현 변화에 재검증 |

필드는 JSON object의 키 순서와 무관하게 hash하고 배열 순서는 보존합니다. 알 수 없는 새 dependency도 payload에서 누락하지 않고 hash합니다. CSS가 content/rights payload에 들어가지 않는 수집 계약이라면 CSS-only 변경은 그 두 심사를 무효화하지 않지만 render/editing은 계속 무효화합니다. 실제 dependency를 찾아 네 payload로 배정하는 2-B 수집기가 아직 연결되지 않았으므로, 이 함수 시험을 실제 140개 영향 판정 완료라고 표시하지 않습니다.

`createPendingEvidence`는 기존 review를 값 그대로 복사·분리하고 무결성 digest를 보존합니다. 신규 네 결정은 모두 pending이며 approved/passed를 만들어 주는 운영 함수는 없습니다. 테스트의 `reviewed()`만 합격/실패 검증을 위한 가짜 심사 fixture를 만듭니다.

`assessQualityEvidence`는 schema, 정확한 catalog ID 집합·중복, 현재 source, 개별 결정 source, evidence 파일 digest, 과거 기록 무결성을 검사합니다. 실제 파일의 읽기·hash·경로 제한은 collector가 담당하며 이 함수는 제공된 digest와 비교합니다. evidence 누락/변조, rejected/failed, stale 또는 pending이면 `ready=false`입니다. 오류가 없다는 것과 제품 승인은 별개입니다.

## 실행 증거

- 테스트 파일을 먼저 추가하고 구현 모듈이 없어 로드 실패하는 RED를 확인했습니다. 이후 21개 정상/실패 사례를 구현과 함께 확인했습니다.
- TypeScript strict PASS.
- 전체 Vitest V8: **34 files / 290 tests PASS**, 14.33초(macOS Node 24).
- 새 판정 코어 coverage: **statements 100%, branches 98.3%, functions 100%, lines 100%**. 파일별 하한을 95/90/95/95로 새로 추가했습니다. 기존 coverage 대상·하한은 축소하지 않았습니다.
- Node 24에서 `.ts` 모듈을 빌드 우회/추가 런타임 없이 직접 import하는 실제 실행 PASS: 과거 approved 입력도 새 4개 결정 pending, ready=false.
- 레거시 renderer source 검사나 v1 승인 hash를 갱신하지 않았습니다. 2-A 제출·통합 결과는 Git/coordination 기록으로 확인합니다.

## 다음: 2-B 실제 재고와 의존성 수집

1. manifest 45개 정의·95개 preset과 기존 inventory의 공급 유형/처리 상태를 exact ID로 연결합니다.
2. props·문구·이미지 bytes/출처·compiler/CSS·편집기/fixture 파일의 실제 내용을 수집합니다. 원격 자산/미정 dependency는 명시적으로 불완전 처리하며 조용히 제외하지 않습니다.
3. v2 shadow 원장을 만들되 기존 검토를 새 기준 합격으로 승격하지 않습니다. 기존 전체 검사와 병행해 변경 이유·영향 항목 수·소요 시간을 보고합니다.
4. CSS-only, copy, 자산 교체, 공통 compiler, 삭제된 증거 fixture를 실제 collector 입력에서 검증합니다.
5. 2-C에서 CLI/전체 gate 연결과 실패 차단을 확정한 뒤에만 실제 검증 재사용을 적용합니다. 미통합 `rich-boundary` CSS의 140개 stale source는 검증 대상이며 이 배치로 해소됐다고 표시하지 않습니다.

2차 전체 완료·140개 제품 심사 합격·3차 중첩 구현·릴리스 승인은 아직 아닙니다.
