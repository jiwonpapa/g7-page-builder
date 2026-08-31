# 3-A2 · 문서 왕복 변환 분리와 SEO 보존

2026-08-31. 기준 SHA `ed8d1a0a548a3f64bf6dab1070debb6082a6e8e9`, task `productization-phase3a-adapter-20260831`, frontend profile.

## 결과 범위

`PuckEditorAdapter.tsx`에서 canonical 문서의 공통값·왕복 metadata 처리를 `puckDocumentAdapter.ts`로 분리합니다. 블록별 변환 함수는 주입하고, 같은 블록을 두 번 변환하던 경로를 한 번으로 줄입니다. Puck public Data 타입만 참조하며 새로운 history/DnD/저장 엔진은 만들지 않습니다. 기존 entry point와 import 계약은 유지합니다.

옮긴 파일에는 이전 어댑터와 같은 coverage 하한을 걸었습니다. 3-A1의 트리/정책에는 statements/lines/functions 95%, branches 90%의 파일별 gate를 추가했습니다. 새 정책 JSON과 TS/PHP 공통 fixture도 render/editing 증거 의존성에 연결합니다. 정책을 바꿔도 과거 digest가 그대로 통과하는 공백을 막습니다.

### 확인한 실제 결함

기존 변환 context와 반환 문서에 `seo`가 없어 **기존 SEO가 Puck 왕복 후 undefined가 됐습니다.** 편집 화면은 반환 문서를 draft로 저장하며 서버 `saveDraft`도 누락된 SEO를 이전 문서에서 보충하지 않습니다. focused 실패 시험에서 SEO title/description/og_image_url/robots가 사라짐을 확인한 뒤 분리된 변환에서 복사·보존하도록 수정했습니다. 반환 객체를 수정해도 원본/다음 반환 결과를 바꾸지 않는 시험을 포함합니다.

새 SEO 필드를 추가한 것이 아니라 이미 존재하는 canonical 필드의 유실을 고친 것입니다. v1 schema·API·DB·G7·Site Part·공개 CSS·발행 compiler는 변경하지 않습니다. 실제 편집/저장/reload/public 보존은 별도 브라우저 배치에서 확인하며, 단위시험만으로 서버 데이터 유실 회귀의 완전한 종료를 선언하지 않습니다.

## 검증

- 새 순수 모듈 미존재, 정책/fixture 의존성 누락 시험이 실패하는 것을 먼저 확인했습니다.
- 새 SEO 보존 시험은 `undefined`와 기존 SEO 객체의 불일치로 실패했습니다. 수정 후 같은 시험이 통과합니다.
- 기존 22개 왕복 변환 사례를 유지했습니다. 분리 모듈의 빈 v1 optional-field 보존, 블록당 1회 변환, 원본 불변 검사를 추가했습니다.
- SEO 수정 직전 전체 Vitest: 382 PASS, 14.94초. 추출 파일은 lines/statements/branches/functions 100%; 기존 어댑터는 각 하한을 계속 통과했습니다.
- SEO 수정 후 집중 검사: 어댑터 25개 + 의존성 15개 = 40 PASS. 제출/통합 profile은 최종 전체 시험을 다시 수행합니다.
- 품질 원장은 source digest만 갱신하며 내용/권리 심사와 기존 결정은 보존합니다. 560 pending과 릴리스 차단은 유지합니다.

## 선행 조건과 잔여 순서

3-A1은 submit `c2f883b`, main `ed8d1a0`으로 통합했습니다. 최종 TS 379 PASS / PHP 141 PASS(2,122 assertions), coordination·production build·현행 renderer·asset/budget 검사를 통과했습니다. 실제 실행은 `mixed`의 `dev-check` 경로이며 harness 마지막 메시지의 integration profile 문자열만 보고 전체 브라우저/release gate 성공으로 해석하지 않습니다.

현재 2차 공개 CSS는 썸네일 증거 140개와 기존 CSS-only claim의 결합으로 통합이 막혀 있습니다. 같은 범위 replacement·현재 기준 재적층·분리 제출/batch 통합 경계를 확인했으며, 현재 CSS와 다른 미래 digest를 제출하거나 과거 gate만 있는 기준을 선택해 우회하지 않습니다. 정식 범위 조정은 최종 승인 목록에 둡니다.

다음 순서는 SEO 실제 편집·저장·재진입·발행 회귀 → CSS/증거 소유권 조정 후 2차 잔여 완료 → 3차 v2 수직 기능 → 4차 구조/반응형 → 5차 개인 Section → 6~7차 콘텐츠 → 8차 전수/후보 검증입니다. 이 두 준비 배치는 3차 전체 완료가 아닙니다. PHP 컴파일러 책임 추출과 v2 API·Puck slot·발행·복원 연결도 남아 있습니다.

별도 승인/조작 항목은 기존 제출 CSS와 파생 증거를 함께 처리할 작업 범위 조정, 앱에서 blocked 상태인 기존 목표 재개, 사람의 콘텐츠·권리·시각 승인, 운영 배포입니다. 일반 구현 진행 승인을 반복해서 요구하지 않습니다. 목표 도구가 기존 미완료 목표로 신규 생성을 거부했고 재개 도구는 제공하지 않아 이번 세션 실행과 무인 목표 재개를 구분합니다.
