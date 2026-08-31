# 2-E1 — 개발 기술 검증과 제품 승인 경계

일자: 2026-08-31. Task `productization-phase2e1-20260831`.
기준 SHA `f9ed5a4d0ab6dd4e7709cd58fcc0fa94aa811e38`, frontend profile, package script 변경용 version lease.

## 결정과 범위

기존 개발 gate는 콘텐츠·썸네일 기술 검사와 CSS까지 포함한 v1 통합 승인 digest를 함께 요구했습니다. 새 화면을 검증하기 위해 썸네일을 재생성하면 오래된 승인 때문에 개발 자체가 막히는 구조였습니다. 개발 gate에 명시적인 `--technical` 모드를 추가하고, 실제 제품 승인과 분리합니다. 기존 v1 record나 digest를 갱신해 합격시키지 않습니다.

| 실행 경로 | 검사와 승인 경계 |
|---|---|
| 단위시험 제출 | 콘텐츠 정책·재고·썸네일/동적 샘플 + v2 현재 증거 무결성. 통합 제품 승인 아님 |
| 전체 check / 제품 E2E 전 | 위 검사 + 현재 PHP renderer/전체 public CSS source와 생성 인덱스의 일치. 전체 check는 build 이후 실행 |
| 썸네일 생성기 candidate | 기존 기술 후보 검사 유지. 승인 생성 없음 |
| 기본 명령 / `--release` | 기존 v1 통합 승인 검사 유지. 단독 실행은 배포 권한이 아님 |
| 패키징·배포 | 기존 v1 최신 승인 + v2 `--require-ready` + site-shell + coordination guard 모두 유지 |

`--technical`, `--candidate`, `--release`는 상호 배타적입니다. 특히 기존 `--candidate --release`가 승인 판정을 생략할 수 있던 조합을 실패 처리합니다. 오타·중복 옵션·값 없는 root도 실패합니다. CLI 성공 출력은 기술/후보/과거 승인 검사를 구분하고 `release_authorized=false`를 명시합니다.

기술 검증에서 rejected 과거 기록을 고치지 않고 다음 수정 후보를 검사할 수는 있습니다. 이것은 거부 결정을 승인으로 바꾼 것이 아닙니다. v2의 pending/rejected/failed/stale·삭제/변조된 증거 차단과 과거 record 무결성 검사는 그대로 남습니다.

이번 범위는 기존 개발 MJS checker·package 연결·TypeScript 회귀시험입니다. 승인/지문 코어는 기존 strict TypeScript를 재사용합니다. 제품 TS/React, PHP compiler, 문서 계약, Puck 버전, CSS, manifest, 썸네일, 기존 approval, release/deploy 스크립트는 변경하지 않습니다. 고객 서버 런타임과 사용자 문서/발행본에도 변화가 없습니다.

## CSS 후보 실제 실패 — 통합하지 않은 이유

현재 main의 편집 bundle과 실제 G7 runtime에서 기존 `editorLayoutParity.spec.ts`를 desktop으로 실행했습니다. 후보 public CSS만 요청 단위로 주입했으며 저장소/runtime 파일을 바꾸지 않았습니다. 테스트 소유 문서를 저장하고 같은 문서의 컴파일 미리보기와 비교했습니다.

- 미통합 task: `rich-boundary-20260831`, 제출 `57037cc8c5d1a76c16a6f3fb5fb1f0fb840c2cd7`.
- 이번에 실제 주입한 dist CSS SHA-256: `84c05e5a1ca5c5dca63ffa74ed1875b229a9049514bcb50ea080b3497e24ed40`. 이 진단은 해당 bytes 기준이며 후보를 새 기준에서 재빌드·통합한 증거가 아닙니다.
- macOS Chromium desktop, 1 test FAIL, 9.9초, retry 0. 모든 preset을 넣은 첫 시나리오에서 실패해 뒤 Page Kit 시나리오는 실행하지 않았습니다.
- 내부 요소 **69개 높이 불일치**: features 19, process-timeline 4, stats 12, pricing 8, tabs 1, comparison-table 2, event-schedule 2, download-resources 2, notice 1, card-grid 15, article-list 3.
- 첫 features 제목은 편집 61px / 미리보기 65px, 카드 제목은 22px / 24px였습니다. 측정된 font family/size/weight/line-height 값은 같았지만 높이는 달랐습니다. 따라서 `line-height: normal`만으로 DOM 구조 차이까지 해결했다고 볼 수 없습니다. 정확한 line-box 원인과 수정은 다음 배치에서 진단합니다.
- 보고서: Local `output/playwright/phase2e-candidate-20260831/report.json`, 오류 문맥은 같은 디렉터리 `results/`. 상세 비교는 `output/playwright/parity-elements/desktop-ALL_PRESET_LAYOUT_GATE.json`이며 이 공용 진단 경로는 이후 실행 시 바뀔 수 있습니다.

레이아웃 QA 지침에 따라 첫 실패 경계에서 원인을 기록하고 전체 합격으로 진행하지 않았습니다. 비교 허용 오차를 늘리거나 테스트를 skip하지 않았습니다. 이 실패가 이번 gate 변경으로 고쳐졌다고 주장하지 않습니다.

## 검증 기록

- RED: 신규 단위시험 4개 실패로 technical 분리 미구현과 모드 혼용 허용을 확인했습니다.
- GREEN: 블록 gate 단위시험 12개, 기술 모드 CLI·잘못된 조합/옵션 7개 실패, 개발/배포 wiring 변조 12개 거부를 확인했습니다.
- 전체 native `npm run check` PASS: strict TypeScript, CSS lint, **37 files / 335 tests**, V8 coverage 하한, architecture/G7 boundary, production build, 실제 PHP 최신 source 검사, v2 실파일 하네스, assets/번들 예산. Vitest 14.02초이며 기존 coverage 대상·하한은 낮추지 않았습니다.
- 원장 갱신 영향은 **content 0 / rights 0 / render 0 / editing 140**입니다. 테스트 파일 변경만 편집 의존성에 반영됐고 legacy source 변화는 0/140입니다. 기존 approval record와 썸네일은 수정하지 않았습니다.
- 실제 `--json --require-ready` CLI는 **exit 1 / pending 560 / ready=false / shadow_valid=true**로 릴리스를 차단했습니다. 기술 통과를 제품 승인으로 승격하지 않습니다.
- 제출/Local 통합은 coordination 하네스가 scope·profile을 재검증하고 성공할 때만 commit/history를 기록합니다. 최종 SHA와 Docker 통합 gate 결과는 완료 응답 및 Git/coordination 이력으로 확인합니다.

## 다음 2-E2와 3차 진입 조건

1. 최신 main 기준에서 미통합 CSS를 정식 replacement로 다시 검토하고 편집/미리보기 line-box 차이를 수정합니다. 필요한 editor 수정은 별도 소유 범위로 나눕니다.
2. 실제 PC·태블릿·모바일에서 같은 저장 문서의 preset/Page Kit 레이아웃·텍스트·미디어 비교를 통과시킵니다. 실패한 시나리오를 제외하지 않습니다.
3. 변경된 renderer 기준 썸네일을 재생성하고 인덱스 freshness 및 v2 영향 갱신을 검증합니다. content/rights 심사 재사용과 render/editing 재검증을 분리하며 기존 승인 record는 보존합니다.
4. 저장·재진입·미리보기·발행의 기존 회귀를 확인하고, CSS와 산출물의 의존 batch를 하네스로 통합합니다. 이후에만 2차 남은 수락 항목을 닫고 3차 제한 중첩 계약/편집 구현으로 진입합니다.

v1 릴리스 승인의 최종 퇴역은 이번 범위가 아닙니다. 6~7차 실제 콘텐츠/권리/화면 심사를 v2에 완료하고 별도 릴리스 이행 배치에서 그 책임을 이전하기 전까지 v1과 v2가 모두 릴리스를 차단합니다. 따라서 이 배치만으로 새 CSS 카탈로그가 배포 가능해졌다고 표현하지 않습니다. push·배포·정리는 실행하지 않습니다.
