# 2-E2 — 한국어 줄 높이의 실제 원인과 캔버스 언어 수정

일자: 2026-08-31. Task `productization-phase2e2-locale-20260831`.
기준 `830c8a589a3eaffbc1c919d8419972c6a0963adf`, frontend profile.

## 결론

이전 CSS 후보에서 발생한 내부 요소 높이 69건의 원인은 Puck의 리치텍스트 중첩 DOM 자체가 아니라 **캔버스 `lang=en` / 독립 미리보기 `lang=ko` 불일치**였습니다. 같은 글꼴 문자열·크기·굵기·`line-height: normal`이라도 실제 브라우저에서 언어에 따라 줄 높이가 달랐습니다. CSS 숫자나 허용 오차를 조정하지 않고 원본 문서의 locale을 제품 캔버스에 연결합니다.

언어 수정은 main에 통합했고 최종 runtime의 언어 비교 3개는 통과했습니다. 그러나 함께 실행한 기존 선택 문구 회귀에서 모바일 기기 모사의 CTA 본문 삭제가 간헐적으로 실패했습니다. **언어 결함 수정·커밋과 전체 편집 회귀 합격은 구분하며, 후자는 아직 완료하지 않았습니다.**

## 재현 → 원인 분리 → 구현

1. 최신 main 편집 bundle과 이전 CSS 후보를 요청 단위로 주입한 desktop 시험에서 69건을 다시 재현했습니다. 대표 제목 61px 대 65px, 카드 제목 22px 대 24px이며 문서 모드는 양쪽 모두 `CSS1Compat`였습니다. 모든 자식 DOM의 font/line-height도 같았고 유효 언어만 달랐습니다.
2. 같은 저장 문서·같은 CSS·같은 viewport에서 캔버스 언어만 ko로 바꾸는 진단을 실행했습니다. 차이가 **69 → 0**이 됐습니다. 이 실험은 원인 분리이며 제품 합격 시험이 아닙니다. 실험용 DOM 변경은 원복했고 최종 테스트 코드에 남기지 않았습니다.
3. `PuckEditorAdapter.tsx`의 기존 `FullSiteCanvasContext`에 원본 `document.locale`을 전달하고, 제품 소유 `.g7pb-preview-page`의 `lang`으로 선언합니다. locale이 바뀌면 memo도 갱신합니다. Puck iframe/내부 CSS를 수정하거나 관리자 html 언어를 덮어쓰지 않습니다.
4. 공개 문서 계약·저장/발행 payload·히스토리·CSS·Puck 버전·compiler·썸네일·기존 approval에는 변화가 없습니다. 기존 strict TypeScript/React context를 재사용하며 새 상태 저장소나 측정 보정 로직을 만들지 않습니다.

초기 CSS/리치텍스트 소유 task는 직접 생성한 진단 변경만 보존·원복해 clean 상태에서 해제했습니다. 원인이 밝혀진 뒤 새 locale task로 정확한 경로를 다시 claim했으며 기존 lease를 확장하거나 다른 task의 CSS를 수정하지 않았습니다.

## 회귀시험과 근거

- Unit RED: 캔버스 언어 없음으로 신규 단위시험이 실패했습니다. 제품 수정 후 한국어·영어·일본어 locale 전환, host 언어 보존, onChange/onPublish 미호출을 통과했습니다. JSDOM에서 Puck iframe 자체를 검증하지 않으며 실제 iframe은 아래 브라우저 시험으로 확인합니다.
- 브라우저: 한국어/영어 문서를 실제 API에 각각 저장하고 편집 화면에 재진입한 뒤 같은 문서의 독립 미리보기와 비교합니다. PC 1280 / 태블릿 768 / 모바일 360 CSS px 캔버스, 실제 iframe, 문서 언어, 글자 크기·높이·색상·폭·넘침을 검사합니다. 원본 문서 locale을 검증 기준으로 사용하고 시험이 강제로 lang을 고치지 않습니다.
- 후보 편집 bundle + 현재 main public CSS의 언어 회귀는 **3 projects PASS, 17.8초**, 한국어/영어 각 1문서입니다. retries 0. PNG는 실제 캔버스의 화면 축척을 유지하므로 원본 이미지 크기가 다를 수 있으며, 치수 비교는 canvas CSS px 기준입니다.
- 최종 후보에서 언어 회귀와 기존 선택 문구 삭제/재입력·저장·발행·공개 확인을 함께 실행해 **6 tests PASS, 50.7초**, retries/skipped/flaky 0을 확인했습니다. 모바일 PNG를 직접 열어 보이는 제목의 줄바꿈·크기는 확인했지만, 긴 블록의 편집 PNG에는 iframe 바깥 잘림과 모바일 도구 막대가 포함됐습니다. 이 PNG를 전체 카드 내용의 시각 합격 증거로 사용하지 않습니다. 전체 텍스트 치수는 DOM 비교 결과이며 별도로 구분합니다. 이 시험은 후보 편집 bundle 주입 상태이며 최종 main 검증과 구분합니다.
- 전체 native frontend check **37 files / 336 tests PASS**, Vitest V8 16.06초, strict·CSS lint·production build·실제 PHP source·v2 실파일 증거·asset/번들 예산 PASS. 기존 coverage 대상/하한과 비교 허용 오차는 유지했습니다.
- v2 원장 영향은 content 0 / rights 0 / render 0 / editing 140입니다. 이전 approval record·legacy thumbnail source는 변경하지 않습니다. 신규 심사/검증 560개는 pending이며 기술 통과로 제품 승인을 만들지 않습니다.

실행 디렉터리(Local `output/playwright/`):

- `phase2e2-red-20260831`: 69건 재현 및 첫 실패 블록 editor/preview PNG.
- `phase2e2-language-probe-20260831`: 언어만 바꾼 인과 분리 진단 JSON(원래 테스트는 실패 유지).
- `phase2e2-locale-candidate-20260831`: 한국어/영어 × 3기기 제품 수정 비교.
- `phase2e2-catalog-candidate-20260831`: 현재 public CSS의 별도 문단 여백 8건.
- `phase2e2-combined-candidate-20260831`: locale 수정 + 미통합 CSS 조합의 전체 preset/첫 Page Kit 검사.
- `phase2e2-verified-candidate-20260831`: 최종 후보의 언어·선택 문구 저장/발행 회귀 및 화면 캡처.
- `phase2e2-integrated-20260831`: 후보 주입 없이 실제 main runtime을 검사한 5 PASS / 1 FAIL 기록.
- `phase2e2-mobile-repeat-20260831`: 같은 main에서 모바일 삭제 실패를 다시 재현한 반복 검사 기록.

## 최종 main 검증 — 편집 회귀 미합격

main `49fa207559d51362ed430a39a36f94cd005400cc`의 Docker 빌드 결과를 실제 runtime에서 제공하고, macOS Chromium으로 검사했습니다. 후보 JS/CSS 주입 없이 언어 회귀와 기존 선택 문구 편집·저장·발행 시험을 실행한 결과는 **5 PASS / 1 FAIL, 58.1초, retries 0**입니다.

- 한국어/영어 저장 문서의 언어·줄 높이 비교: PC·태블릿·모바일 모사 **3 PASS**.
- 기존 선택 문구 삭제/재입력·저장·발행: PC·태블릿 **2 PASS**, 모바일 모사 **1 FAIL**.
- 실패 경계: `tests/E2E/optionalCanvasText.spec.ts:110`. CTA 본문의 실제 `.tiptap[contenteditable="true"]`에 초점이 있고 `fill('')`를 실행했지만, 10초 후에도 기존 본문이 남았습니다. 이 실패 실행에서는 이후 저장/발행 단계에 도달하지 않았습니다.
- 동일 main·동일 시험의 모바일 3회 반복(`--repeat-each=3 --retries=0 --max-failures=1`) 결과는 **1 PASS / 1 FAIL / 1 미실행, 26.2초**입니다. 세 번째는 첫 실패 중단 정책으로 실행되지 않았으며, 테스트에 `skip`을 추가하지 않았습니다.
- 실패 PNG에서 선택된 기존 본문과 인라인 도구 막대가 보이는 것을 확인했습니다. 입력 이벤트·선택 상태·편집기 초기화 중 어느 것이 원인인지는 아직 확정하지 않았습니다. 후보 검사 통과를 근거로 최종 실패를 무시하거나, 언어 수정과 무관한 기존 결함이라고 단정하지 않습니다. 실제 휴대폰 검증 결과도 아닙니다.

브라우저 결과 JSON과 실패 PNG·trace는 위 실행 디렉터리에 보존합니다. 재시도로 통과 결과만 취하거나 입력 검증을 제거하지 않고, 다음 구현 배치에서 이 삭제 경계를 먼저 원인 분리합니다.

## 남은 조건 — 전체 카탈로그 합격 아님

현재 main public CSS를 유지한 검사에서는 Hero 본문 5개·FAQ 답변 3개, 총 **8개 문단 바깥 여백 차이**가 남았습니다. 예를 들어 Hero는 편집 35px / 미리보기 75px로 p의 바깥 margin이 더해집니다. 이는 언어 결함과 별개이며 기존 `rich-boundary-20260831` task가 소유한 public CSS에서 처리할 사항입니다.

locale 수정과 이전 CSS 후보를 함께 적용하면 첫 **95 presets / 내부 요소 431개 비교가 0 차이**로 통과했습니다. 그러나 다음 `company-launch` Page Kit의 G7 template 미리보기는 언어가 en이어서 원본 ko와 다릅니다. template html 자체는 G7 소유이므로 덮어쓰지 않고, 모듈 소유 본문 영역에 API가 이미 제공하는 `page.locale`을 전달하는 후속 G7 연동 수정이 필요합니다. 전체 Page Kit·태블릿·모바일 카탈로그 검사는 첫 실패에서 중단했으며 통과로 집계하지 않습니다.

다음 배치는 모바일 모사의 CTA 본문 삭제 실패 원인 분리를 우선하고, 모듈 소유 template 본문 언어 연결, public CSS 문단 경계, 새 렌더 기준 썸네일/증거 갱신과 해당 의존 task 통합을 이어갑니다. 후보 주입 통과만으로 CSS를 main에 합치거나 오래된 source/승인을 갱신해 우회하지 않습니다. 2차 전체 완료·3차 진입·제품 승인·push·배포는 이번 결과에 포함하지 않습니다.

## 제출·통합

- 구현 제출 `e2483ca0bc3cef8711158b8fa9f8341c37339042` → main `49fa207559d51362ed430a39a36f94cd005400cc`.
- Docker frontend 통합 gate PASS: strict·336개 단위시험/coverage·production build·현재 PHP/thumbnail source·v2 실파일 gate·asset/예산.
- 후속 증거 정리 task `productization-phase2e2-evidence-20260831`은 이 문서만 수정합니다. 모바일 PNG의 확인 가능 범위와 최종 main의 실패를 기록하며 제품 코드·원장·시험 조건을 바꾸지 않습니다. 문서 제출/통합 SHA는 Git/coordination 기록으로 확인합니다.
