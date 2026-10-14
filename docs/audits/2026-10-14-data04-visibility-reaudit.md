# DATA04 목록 숨김 제한 재감사

2026-10-14 · 공통 목록 표시 결함 해소 · IP7/제품 전체 수용 미완료

## 범위와 결과

직전 DATA04 실패 보고 후 사용자의 “다음 진행해” 지시에 따라, 해당 실패의 별도 재감사와 추가 보완 1회를 진행했습니다. 이전 실패 커밋 32e65372c9f7bcfe248ae80afc1f3409b3035b86과 worktree는 그대로 보존했습니다. 새 기준 198176a4fd93585f011f64c1ddef2befa65e3c21에서 정확한 제품 파일 1개·기존 단위시험 1개·CHANGELOG.md만 수정했습니다. 블록별 대응·schema·G7 코어/테마·기존 문서 전환·배포는 없습니다.

원인은 공통 pagination이 hidden 속성만 설정해 작성된 inline display가 우선하는 것이었습니다. 앞선 실패 후보는 정리 시 display를 복구하여 현재 DOM 보존 불변식을 깨뜨렸습니다. 이번 보완은 행별 원래 display/우선순위를 WeakMap으로 보존하고, 표시 시 원래 반응형 변수 값을 복구합니다. 정리는 행 DOM을 바꾸지 않고 이벤트만 해제합니다. 동일 행에 컨트롤을 재설치해도 숨김용 none을 원래 값으로 잘못 기억하지 않습니다.

- source: resources/js/public/publicArchiveControls.ts
- 기존 시험: tests/Unit/publicArchiveControls.test.ts — 기존 assertion 3건 유지, 관련 회귀 1건 추가
- 제출: 52aec0b00cfc5991e5b52506c510345337ca9c98
- main 통합: 4098aacd8fc9efd90b73c99060aa38fd22879d48
- task: data04-visibility-reaudit-20261014 / integration-data04-reaudit-20261014

이번 보완은 첫 제출에서 성공했습니다. 추가 재구현·실패 시험 재시도는 0회입니다. 기존 실패를 성공으로 덮어쓰지 않고 후속 해결 근거를 연결합니다.

## 관련 검사

공식 scoped planner: 변경 3파일, full=false, 미분류 없음, 선택 15 gate입니다. 기존 관련 Vitest 9파일/112건과 TypeScript·구조 검사가 통과했습니다. 직접 관련 publicArchiveControls는 기존 3건+회귀 1건 모두 첫 실행 통과했습니다. 새 회귀는 반응형 변수·grid·inline display 없는 행·원래 priority, 검색 결과 0개, 정리 뒤 DOM/늦은 이벤트 무변경, 재설치 뒤 원래 display 복구를 확인합니다.

통합에서는 동일 입력 성공 결과를 재사용했습니다. 입력 계약이 불완전하여 재사용 금지인 기존 소수 gate는 하네스 규칙대로 처리했습니다. IMPLEMENTATION=1로 선택된 자동 브라우저 2개와 build gate를 미실행 인계했고 이를 성공으로 합산하지 않습니다. 아래 제한된 실제 브라우저 확인은 별도 증거입니다. 전체 acceptance=false를 유지합니다.

공식 제출 보고서:

```text
.git/g7pb-coordination-v1/python-checks/implementation-handoffs/
data04-visibility-reaudit-20261014/submission-d404f51f440e46eea1081844021e403c.json
```

## 실제 브라우저: 실패했던 목록 조작만 확인

Playwright 스킬의 CLI를 사용해 기존 로컬 Chrome session ip7-dynamic-20261014의 시험 소유 미리보기만 한 번 다시 열었습니다. 원본 ID a63b9060-d8c1-4c9d-a20c-729549bcbc70은 보관 상태를 유지했습니다. 새 문서·복원·저장·발행 요청은 없고 기존 문서를 주입하거나 응답을 mock하지 않았습니다. 온라인 로그인 탭과 운영 서버는 조작하지 않았습니다.

Local g7pb-dev / https://g7pb.test, runtime lease 아래 변경 입력 자산을 한 번 빌드했습니다. fingerprint b29be187348b6e65288dd19434b1baaf57086839188b088932250b97318331a4. JS/CSS 크기는 측정·경고 정책을 유지했습니다. 기존 Header/Footer·기본 작성/저장/발행 시험은 반복하지 않았습니다.

| 실제 목록 | 로드/처음 표시 | 페이지 조작 | 검색·분류 |
|---|---|---|---|
| posts | 6개 중 3개 | 다음 2 / 2에서 3개, 이전에서 3개 | 제목 일치 1개·불일치 0개·초기화 3개, 실제 분류 일치 1개·불일치 0개·초기화 3개 |
| post-archive | 12개 중 4개 | 다음 2 / 3에서 4개, 이전에서 4개 | 제목 일치 1개·불일치 0개·초기화 4개, 실제 분류 일치 1개·불일치 0개·초기화 4개 |
| products | 1개 중 1개 | 단일 페이지 이전/다음 비활성 | 제목 일치 1개·불일치 0개·초기화 1개, 없는 분류 0개·초기화 1개 |
| product-showcase | 1개 중 1개 | 단일 페이지 이전/다음 비활성 | 제목 일치 1개·불일치 0개·초기화 1개, 없는 분류 0개·초기화 1개 |

실제 UI fill/click과 DOM 읽기로 30개 중간 관찰을 기록했습니다. 이를 새 E2E 30건으로 세지 않습니다. 모든 숨김 행에서 computed display=none과 실제 높이=0을 확인했습니다. 다시 표시된 행은 원래 var(...) display를 유지했습니다. 빈 결과는 0 / 0과 안내가 표시됐고 조작 중 게시글/상품 데이터 재요청은 0건이었습니다. 첫 실행 pass=true이며 재시도하지 않았습니다.

상품은 로컬 표본이 1개이고 분류 값이 없어 **다중 상품 페이지 및 실제 상품 분류 일치 검증은 미실행**입니다. PC의 현재 창 한 곳에서만 확인했습니다. 모바일/태블릿·template/builder 출력·권한·실패 응답·새 발행·전체 UI/UX로 확대하지 않습니다.

증거:

- output/playwright/data04-manual-result-20261014.json — SHA256 46a837d116defbd2f906c106c1ea4e5a42f891d5befb729e14793ab4c4b48b29
- output/playwright/data04-lists-restored-20261014.png — 1200×1279, SHA256 7a0388fbeb8b87a989154845db09901079eb0be44ae6ad57c2850687dee49fe2

캡처를 직접 열어 첫 목록에 3개만 표시되고 페이지 버튼 뒤에 다음 목록이 이어지는 것을 확인했습니다. 원본 서명 미리보기 토큰은 보고서에 남기지 않습니다.

## 화면에서 추가 관찰한 미해결 사항 — DATA05

캡처의 카드 이미지 영역에 빈 여백이 남습니다. 첫 목록의 이미지 3개를 읽은 결과 src 없음·hidden=true인데 computed display=block, 높이 231.328125px였습니다. 이는 행 pagination이 아닌 데이터 이미지 필드의 숨김 표시 문제입니다. publicDataTemplates.ts는 빈 이미지에 hidden만 설정하고 있어 별도 보완 대상입니다.

이 관찰을 무시하고 전체 UX가 정상이라고 선언하지 않습니다. 이번에 확정한 행 표시 범위 밖이므로 제품 수정·시험 확대 없이 기록만 남겼습니다. DATA04는 해소됐지만 DATA05는 미해결이며 추가 보완을 시도하지 않았습니다. 다음 작업은 이 빈 이미지 표시의 공통 처리와 직접 관련 시험/동일 화면 확인으로 한정할 수 있습니다.

## 종료 경계

IP7은 in_progress를 유지합니다. 이번 결과는 DATA04의 공통 행 표시·필터·페이지·정리 결함 해소이지 동적 기능/제품 전체 수용이 아닙니다. DATA05와 이전 미실행 범위, IP8~IP10 수용은 따로 남깁니다. 기존 v1/v2/Site Part 처리는 독립 프로세스입니다.

온라인은 기존 0.37.0-dev.20261014 / a84b8eb4edfffa2f0aecb90f39605624a7394c39 배포 상태를 변경하지 않았습니다. 소스·보고의 커밋/푸시, scoped 확인·NO_RELEASE 종료를 온라인 배포나 release 합격으로 표현하지 않습니다.
