# 2-E3 — CTA 본문 삭제 입력 경계

기준 `25e511cc041fc835409acde7fe88ff135e36bc85`, task `productization-phase2e3-input-20260831`, frontend profile.

## 결론

CTA 삭제 실패의 직접 원인은 **자동화의 DOM 전체 선택과 Tiptap 선택 반영 사이에 Delete가 먼저 도착한 입력 경쟁**이었습니다. 기존 제품 코드를 바꾸지 않은 상태에서 원인을 재현하고, 실제 포인터로 선택한 뒤 편집기의 선택 도구가 나타나는 것을 확인하고 삭제하는 시험으로 교정했습니다. 제품의 선택·삭제 핸들러나 Puck 내부를 덮어쓰지 않습니다.

기존 시험은 삭제 후 원래와 같은 문구를 다시 넣고 저장했으므로, 두 변경이 모두 유실되는 경우를 충분히 구분하지 못했습니다. 이제 **빈 본문 자체의 API 저장값·재진입·공개 발행**과 **다른 문구를 재입력한 저장값·재진입·재발행**을 각각 확인합니다.

## 작업 카드

- 요구사항: G7R-06·07. 선택 본문 삭제·재입력·저장·재진입·발행이 같은 원본을 유지해야 합니다.
- 재현 대상: `content.cta-split-01.body`, 기존 `optionalCanvasText.spec.ts`. 모바일 브라우저 모사 프로필에서 1440px PC 편집 모드로 전환한 뒤 삭제하는 경계입니다.
- 원인 분리: 실제 DOM 선택, Tiptap 문서/선택, 키보드·입력 이벤트와 저장 원본을 비교합니다. 화면 문제와 테스트 입력 문제를 구분하고, 원인 증명 전 제품 코드를 추정 수정하지 않습니다.
- 재사용: 기존 Puck/Tiptap 공통 필드, canonical 저장 API, 테스트 소유 문서 생성/정리 fixture. 새 편집기·히스토리·전역 입력 핸들러를 만들지 않습니다.
- 범위: 삭제 경계 진단·최소 수정·회귀시험과 실행 기록. 공개 CSS, G7 코어, 문서 스키마, Puck 버전, 승인 결정은 변경하지 않습니다. 편집 구현·시험 파일의 실제 변경 영향만 현재 파일 기반 v2 fingerprint에 반영합니다.
- 합격 조건: 최초 실패 증거 보존, PC·태블릿·모바일 프로필에서 선택 삭제·재입력·저장/reload·발행 확인, frontend strict/coverage/build/gate 유지. 실패·미실행을 pass로 집계하지 않습니다.
- 커밋: 정확한 소유 worktree에서 `task-submit`, Local integration/runtime 소유자가 `task-integrate`. 배포나 전체 2차 완료는 이번 배치의 자동 결과가 아닙니다.

## 실행 기록

### 재현과 인과 분리

현재 main 기존 시험 첫 3회는 통과했습니다(31.1초). 이 결과로 이전의 간헐 실패를 해소됐다고 판단하지 않고 입력 이벤트 진단을 추가했습니다. main과 worktree 모두 lockfile·설치 Playwright `1.62.1`, Puck `0.23.0`임을 확인했습니다. 설치 코드의 `playwright-core/lib/coreBundle.js`에서 `fill('')`가 DOM 전체 선택 뒤 `Delete`를 보내고, `prosemirror-view/dist/index.js`의 keydown 처리가 내부 선택을 사용함을 확인했습니다.

진단은 실제 CTA에 대한 DOM/편집기 상태를 읽어 첨부했으며 문서나 선택을 강제로 고치지 않았습니다. 같은 제품 bundle에서 **1 PASS / 1 FAIL / 3 미실행, 27.5초**로 실패를 다시 잡았습니다. `--max-failures=1`에서 나머지 실행이 중단됐으며 skip이나 재시도 성공 처리가 아닙니다.

실패 실행의 이벤트 순서는 다음과 같습니다. 시각은 해당 iframe의 `performance.now()`입니다.

| 시각(ms) | 이벤트 | 실제 선택/결과 |
|---|---|---|
| 514.3 | Delete keydown 진입 | DOM은 전체 문구, Tiptap은 `21→21`의 문장 끝 커서 |
| 515.2 | keydown 처리 후 | defaultPrevented=true, DOM·Tiptap 본문 모두 기존 문구 유지 |
| 530.6 | selectionchange 반영 | Tiptap 선택이 `1→21` 전체 문구로 갱신됨. Delete보다 약 16ms 늦음 |

실제 포인터 선택과 range 도구 준비를 확인한 비교 실행은 **3 PASS, 30.3초**였습니다. 3회 모두 Delete 진입 전에 내부 선택 `1→21`, 처리 후 빈 본문 `1→1`을 확인했습니다. 제품 JS/CSS·버전·원본 fixture는 동일하며 후보 bundle 주입을 사용하지 않았습니다. 최종 시험에서는 진단용 DOM 속성·Tiptap 인스턴스 읽기·환경 분기를 제거했습니다.

### 구현한 시험 계약

1. 하나의 문단인 fixture를 실제 triple-click으로 선택하고, DOM 선택 문자열과 기존 range 도구 표시를 확인합니다. 고정 sleep·강제 클릭·직접 editor command를 사용하지 않습니다.
2. Delete와 Backspace를 별도 사례로 실행하며 빈 입력 확인은 그대로 유지합니다.
3. 저장 성공만 보지 않고 서버 문서를 GET해 CTA 본문이 정확히 `<p></p>`인지, 블록 4개가 남는지 확인합니다. reload 뒤 편집 영역이 재입력 가능하게 남고 좁은 읽기 전용 캔버스에서는 본문 요소가 사라지는 것도 확인합니다.
4. 주소 누락 발행 차단은 유지합니다. 주소를 채운 뒤 빈 본문을 실제 발행하고, 공개 페이지에 CTA 제목은 남고 본문 요소/이전 문구는 없는지 확인합니다.
5. 기존과 다른 문구를 입력해 정확한 canonical HTML 저장값, reload, 두 번째 발행본을 확인합니다. 빈 Hero 버튼·Heading 보조 문구·Contact 연결 계약도 계속 검사합니다.
6. 저장/API/발행 검사는 같은 helper를 두 삭제 사례에서 재사용합니다. 제품 렌더러·Tiptap/Puck 상태·DB 스키마·단위시험·공개 CSS는 변경하지 않습니다.

### 검증 결과

- PC·태블릿·모바일 모사 × Delete/Backspace: **6 PASS, 72.9초**.
- 모바일 모사 두 사례를 각각 3회 반복: **6 PASS, 70.5초**.
- 위 검사는 retries 0, 실패/skip/flaky 0입니다. 개발 main의 실제 bundle을 사용했고 후보 JS/CSS는 주입하지 않았습니다.
- 각 프로필에서 1440/768/390px 창 너비 전환과 기존 패널 가림 검사를 유지했습니다. 삭제 입력 자체는 1440px 창의 PC 편집 모드입니다. 실제 휴대폰에서 모바일 편집을 지원/검증했다는 뜻이 아닙니다.
- 모바일 모사의 빈 값/재입력 각각의 editor reload·public PNG 4장을 직접 열어 본문 유무와 문구를 확인했습니다. 편집/공개 캔버스 폭·축척이 다르므로 이 PNG를 전체 WYSIWYG 치수 합격이나 카탈로그 디자인 승인으로 사용하지 않습니다.
- native `npm run check` PASS: strict TypeScript, CSS lint, **37 files / 336 tests, V8 15.34초**, coverage 하한, G7 의존 경계, production build, 현재 PHP source, v2 실파일 증거, asset/번들 예산. 검사 대상·하한·허용 오차는 변경하지 않았습니다.

### 증거 위치

Local `output/playwright/` 아래:

- `phase2e3-red-20260831`: 기존 시험 첫 3회. 이 명칭은 진단 단계 이름이며 실제 결과는 PASS입니다.
- `phase2e3-input-probe-20260831`: 실패·성공의 이벤트 JSON 첨부와 실패 PNG/`error-context.md`.
- `phase2e3-pointer-probe-20260831`: 동일 제품에서 포인터 입력의 이벤트 JSON 첨부.
- `phase2e3-expanded-20260831`: 두 삭제 키 × 3기기의 저장·재진입·빈 값 발행·재입력 발행.
- `phase2e3-mobile-repeat-20260831`: 모바일 두 사례 × 3회 반복.

trace는 시험 파일의 `test.use({ trace: 'off' })`가 적용돼 생성되지 않았습니다. 앞선 2-E2 기록에 적힌 전역 `on-first-retry`/retries 설명보다 파일별 trace off가 실제 직접 사유입니다. JSON·PNG·실패 context와 trace를 혼동하지 않습니다.

## 변경 영향·통합 경계

v2 수집기로 현재 PHP 출력과 파일을 다시 읽었으며 content 0 / rights 0 / render 0 / editing 140, legacy thumbnail source 변경 0입니다. 보수적인 전체 편집 시험 의존성으로 test 파일 변경이 140개 항목에 반영됩니다. 기존 승인 결정과 560개 pending은 그대로이며 기술 시험 성공을 승인으로 바꾸지 않습니다.

제출/통합 SHA와 frontend gate는 coordination/Git 기록으로 확인합니다. 통합 후 같은 시험과 기존 언어 회귀의 실제 main 실행 결과는 별도 `phase2e3-integrated-20260831/report.json`에 기록하며 위의 기준 main 시험과 구분합니다.

이 배치는 삭제 시험의 입력 경쟁 교정과 실제 저장/발행 검증 강화입니다. 2차 전체 완료·3차 중첩 구현·릴리스 승인·push·배포는 포함하지 않습니다. 다음 잔여 작업은 G7 template의 모듈 소유 본문 언어 연결과 미통합 public CSS의 문단 여백 8건입니다. `rich-boundary-20260831`의 CSS 소유권/제출본은 그대로 보존합니다.
