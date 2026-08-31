# 1차 기준선과 검증 증거

일자: 2026-08-31. Task: `productization-phase1-20260831`.
Worktree: `codex/productization-phase1-20260831`, 시작 SHA `8b75d3a654638bfeb932985f67f8106ef05c8c42`.

## 증거 수준

이 기록은 새 기능의 제품 합격이나 운영 배포 보고가 아닙니다. 실제 읽은 원본·실행한 독립 검사·기존 정적 화면 관찰을 구분합니다. 새 v2·중첩·반응형 override·패턴 저장은 문서 기준이며 아직 구현하지 않았습니다.

## 기준선과 기존 작업

시작 시 Local main은 clean, 제품은 0.30.0이었습니다. `make coord-status`와 각 worktree의 실제 diff를 확인했습니다.

| 선행 task | 관찰 상태 | 충돌/선행 영향 |
|---|---|---|
| rich-boundary-20260831 | active·미커밋 public CSS 변경 | 공개 표현 기준이 아직 통합되지 않음 |
| wysiwyg-media-20260831 | active·미커밋 renderer/CSS/E2E/문서 변경 | tests/Unit·CHANGELOG·quality-harness 포함 소유 중 |
| wysiwyg-optional-20260831 | active·미커밋 Puck/일부 renderer 변경 | 새 구조·필드 통합의 선행 기준 |
| wysiwyg-media-integration-20260831 | active·integration/runtime 소유 | 공용 g7pb-dev와 main 통합 담당 |

그 작업의 변경을 가져오거나 수정·커밋·취소하지 않았습니다. 1차는 비중복 문서 PATHS와 shared-contract AREA를 별도로 claim했습니다. 선행 task ID는 소유권 증거이며, 특정 채팅이 소유자라고 추정하여 실행 권한을 가져오지 않습니다.

## 소스 확인

- Manifest: 45개 block 정의, 그중 신규 목록 44개/호환 전용 HeroSplit 1개, 95개 preset.
- Page Kit: 5개. 3개 기준 페이지를 포함한 모든 현재 Kit 원본이 HeroSplit을 사용합니다.
- `canvasEditingContract.ts`를 TypeScript AST로 읽어 45개 component별 필드 종류·경로·직접 미디어/route·동적 데이터·반복 한도를 inventory에 연결했습니다. TS를 문자열로 eval하지 않았습니다.
- 기존 품질 기록은 `codex-assisted`, `approved`, 2026-08-30 일괄 심사입니다. 출처를 보존하되 새 기준 승인으로 승격하지 않았습니다.
- 현재 schema v1은 재귀 slot 형태를 표현하지만 adapter와 compiler는 실제 비어 있지 않은 slot을 거부합니다. frontend와 PHP 양쪽을 확인했습니다.
- 원장 출처 파일은 SHA-256으로 기록했습니다. 원본이 바뀌면 이 스냅샷을 자동 최신 상태로 간주하지 않습니다.

## 실행한 기준선 검사

독립 worktree에 lockfile 기준 개발 의존성을 설치했습니다. Node 24.19.0, PHP 8.5.3입니다. 고객 서버나 고정 Docker runtime은 사용하지 않았습니다.

| 검사 | 결과 | 시간/범위 |
|---|---|---|
| npm run typecheck | PASS | tsc --noEmit, 시간 별도 미계측 |
| npm run check:editor-acceptance | PASS | EDITOR_ACCEPTANCE_CONTRACT OK, 실제 브라우저 시험 아님 |
| Vitest 지정 5개 파일 | PASS, 63 tests | 1.26초, documentSchema/puckDocumentAdapter/blockPackManifest/blockProductQuality/editorViewportPolicy |
| HtmlDocumentCompilerTest | PASS, 60 tests/456 assertions | PHPUnit 0.284초 |
| BlockPackContractTest | PASS, 13 tests/87 assertions | PHPUnit 0.012초 |

검사한 범위의 실패는 0입니다. 전체 테스트·coverage·현행 화면이 모두 통과했다는 의미는 아닙니다. 실행 시간은 이 환경의 한 번 측정이며 성능 보증이나 절감률이 아닙니다.

재현 명령(Node 24와 PHP 8.5 PATH에서 실행):

```bash
npm ci --no-audit --no-fund
composer install --no-interaction --prefer-dist
npm run typecheck
npm run check:editor-acceptance
npx vitest run tests/Unit/documentSchema.test.ts tests/Unit/puckDocumentAdapter.test.ts tests/Unit/blockPackManifest.test.ts tests/Unit/blockProductQuality.test.ts tests/Unit/editorViewportPolicy.test.ts --maxWorkers=2
vendor/bin/phpunit tests/UnitPhp/HtmlDocumentCompilerTest.php
vendor/bin/phpunit tests/UnitPhp/BlockPackContractTest.php
make coord-check TASK=productization-phase1-20260831
make task-submit TASK=productization-phase1-20260831
```

## 정적 화면 관찰

`resources/store/dist/previews/{service-conversion,local-business,editorial-community}-{desktop,mobile}.webp` 6장을 직접 확인했습니다. 서비스 제목 줄바꿈·지역 지도 빈 영역·에디토리얼 탐색 계층을 새 기준의 검토 사례로 지정했습니다. WEBP는 당시 생성된 산출물로 실제 지도 장애·현재 편집기 안정성·현재 공개 동작을 증명하지 않습니다.

새 대표 시안을 생성하거나 사용자 대신 시각 승인하지 않았습니다. [콘텐츠 기준](content-policy.md)에 개선 목표와 합격/불합격 사례를 구체화했습니다.

## 제출 게이트와 미완료 경계

- 원장 대조 PASS: 정의 45/프리셋 95/Kit 5의 ID 중복·누락 0, 6-A 대표 6개/6-B 기준 Kit 3개, 7차 하위 배치 14개·최대 8개 프리셋, 원본 SHA-256 일치, 로컬 문서 링크 46개 존재 확인.
- `make coord-check TASK=productization-phase1-20260831`는 SCOPE_OK, `git diff --check`는 PASS입니다.
- docs profile(version·boundary·coordination harness)은 `task-submit`이 다시 실행하며 실패 시 커밋하지 않습니다. 최종 제출 성공과 commit SHA는 Git/coordination metadata 및 차수 결과 보고가 증거입니다. 커밋 자기 자신의 SHA를 문서에 미리 쓰지 않습니다.
- 공용 runtime의 글자 선택·이미지 교체·저장·새로고침·공개 화면 재확인은 선행 편집 작업 통합 후 실행해야 합니다. 현재 runtime lease를 우회하지 않았습니다.
- 1차 main 통합과 통합 후 frontend gate는 Local integration 소유자가 수행해야 합니다. 문서 worktree 제출을 main 통합 완료로 표시하지 않습니다.
- 대표 화면 기준의 사용자 확인과 선행 작업을 이어받을 권한은 별도 요청 상태입니다. 기존 변경/lease를 강제 해제하지 않습니다.
- CHANGELOG.md는 기존 task 소유입니다. 이번 산출물은 미구현 기능의 설계 문서이며 제품 버전을 올리지 않았습니다. 실제 기능을 반영하는 후속 배치는 Unreleased 기록을 함께 제출합니다.

1차 상태는 **계약/원장 작성·독립 기준선 검사 완료, 차수 전체 종료는 통합·실제 화면 확인 대기**입니다. 그 조건이 닫히기 전 2차 구현 완료로 진행하지 않습니다.
