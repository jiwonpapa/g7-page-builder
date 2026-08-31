# 2-E4 — 템플릿 본문 언어 연결

기준 main: `6f1cd6a0a336092d373c7699152cbef46f628169`.
Task: `productization-phase2e4-template-20260831`, frontend profile.

## 결론과 범위

G7 template 본문이 원본 문서의 언어를 받지 못하던 경계를 모듈 소유 레이아웃에서 수정합니다. G7 기본 `HtmlContent`는 `lang` prop을 전달하지 않고 기본 `Div`는 표준 HTML 속성을 전달합니다. 따라서 모듈 소유 home/public/preview의 HtmlContent 바깥에 `Div[lang]` 한 겹을 두었습니다. `_user_base`, 헤더·푸터, G7 코어/템플릿 파일, sanitizer 설정, 기존 artifact와 canonical 문서는 수정하지 않습니다.

언어는 공개 API의 `page.locale`에 연결하며 빈 값은 한국어로 추정하지 않습니다. 원본 schema/compiler, Puck 0.23.0, 제품 버전은 그대로입니다. JSON은 G7 공개 선언 형식이고 변경 추적·시험은 strict TypeScript입니다. 새 편집 엔진이나 고객 서버용 Node 의존성은 추가하지 않습니다.

## 실패 경계와 실제 증거

Local `output/playwright/` 아래에 실행별 JSON·PNG·실패 context를 분리했습니다.

1. `phase2e4-red-20260831`: 수정 전 main, PC **1 FAIL, 5.5초**. 한국어 문서를 저장해 재진입한 editor는 ko인데 template preview 본문은 en이었습니다. 최초 언어 실패에서 중단했습니다.
2. `phase2e4-candidate-20260831`: 요청별 후보 레이아웃만 연결, PC **1 FAIL / 나머지 2 미실행**. 본문 ko 연결은 통과했으나 다음 CSS 경계에서 실패했습니다. Features 텍스트 7개 중 카드 제목 3개가 editor **18.72px / normal**, template **16px / 24px**였습니다. G7의 heading reset 상속이 원인입니다.
3. `phase2e4-combined-20260831`: 후보 레이아웃+기존 제출 CSS로 글자 비교는 통과했으나, 시험이 서버 HTML의 ko를 hydrated G7 화면의 en과 비교해 실패했습니다. 최종 시험은 실제 렌더링된 G7 관리자 host 언어를 기준으로 preview/public host가 변하지 않는지 검사합니다. 서버 HTML을 현재 브라우저 상태로 잘못 사용하지 않습니다.
4. `phase2e4-language-candidate-20260831`: PC PASS, 태블릿의 DOM 단발 읽기에서 undefined가 반환돼 FAIL, 모바일 미실행. 렌더 교체 중 분리 DOM을 읽는 가능성을 구분하기 위해 최종 시험은 현재 DOM에 연결된 본문의 상속 언어를 polling assertion으로 확인합니다. 고정 지연·언어 강제 변경·시험 재시도는 사용하지 않습니다.
5. `phase2e4-verified-candidate-20260831`: 최종 후보 **6 PASS, 1.8분**, retries/skip/flaky 0. 3기기 × 언어 경계/엄격한 치수 경계이며 각 사례에서 ko/en/ja 문서를 확인합니다. 언어 경계는 현행 CSS, 치수 경계는 미통합 CSS 후보를 사용합니다. 후자의 결과를 실제 main CSS 합격으로 간주하지 않습니다.

후보 레이아웃은 실제 G7 병합 응답에서 모듈 소유 본문 노드 정확히 하나만 교체합니다. G7 shell과 API 원본을 보존하고 공유 runtime 파일/캐시를 덮어쓰지 않습니다. CSS 후보는 `rich-boundary-20260831`의 기존 dist, SHA-256 `84c05e5a1ca5c5dca63ffa74ed1875b229a9049514bcb50ea080b3497e24ed40`이며 최신 main에서 재빌드된 승인본이라는 뜻이 아닙니다.

## 회귀시험과 변경 추적

- 언어 전용: 한국어/영어/일본어 각각 같은 문서의 저장값 GET, editor reload, 1280/768/360px 캔버스, template preview, 실제 prepare/commit 공개 발행을 확인합니다. 공개 본문은 문서 언어, host는 G7 언어를 유지해야 합니다. 테스트 소유 문서만 생성·발행·정리합니다.
- 엄격한 화면 검사: 동일 Features fixture의 언어·글자/이미지 치수·색상·overflow 비교를 별도 사례로 유지합니다. 실패 허용 오차·기존 전체 카탈로그 검사·skip 조건은 완화하지 않습니다. CSS가 통합되지 않은 main에서는 이 검사가 계속 실패할 수 있습니다.
- 세 모듈 레이아웃의 단위시험은 언어 wrapper, 기존 content id/class, HtmlContent sanitizer 유지, template 형제 노드의 언어 비변경을 확인합니다.
- home은 선언 계약 단위시험과 통합 후 공개 layout API 구조를 확인합니다. 실제 홈페이지 지정 전환은 실행하지 않으며 기존 홈페이지 설정을 바꾸지 않습니다.
- `resources/layouts/user`를 v2 render 의존성에 추가했습니다. 이 파일 변경이 검증 이력에서 누락되던 공백을 닫고 render 변화가 editing에도 전파되는 단위시험을 추가했습니다.
- 실파일/현재 PHP 수집 결과 content 0 / rights 0 / render 140 / editing 140, legacy thumbnail source 변화 0. render/editing fingerprint 280개만 갱신하고 기존 결정·legacy 기록의 동일성을 검사했습니다. **560 pending 유지**, 기술 검사 성공은 사람 승인이나 릴리스 허가가 아닙니다.
- native `npm run check` PASS: **38 files / 340 tests, V8 16.54초**, strict TypeScript, CSS lint, coverage 하한, G7 경계, production build, 현재 PHP source, v2 무결성, asset/용량 예산. PHP 제품 코드는 변경하지 않았으며 PHP 전체 시험 실행을 주장하지 않습니다.

## 화면 검토와 후속 배치

PC Features editor/preview PNG를 직접 열어 확인했습니다. editor는 축소된 캔버스이므로 PNG 자체의 픽셀 크기를 1:1 비교하지 않고 DOM 치수를 사용합니다. **preview에서 카드 아이콘이 사라지는 별도 차이**도 확인했습니다. G7 HtmlContent의 SVG 차단과 일치하며, 현재 글자/이미지 비교는 SVG 아이콘 존재를 검사하지 않습니다. 따라서 후보의 글자 치수 통과를 화면 전체 동일성이나 디자인 승인으로 표현하지 않습니다.

다음 CSS/템플릿 출력 배치는 기존 여백 8건, 이번 제목 크기 3건, 아이콘 존재와 정렬을 구분해 검증해야 합니다. 기존 CSS 제출본의 native heading 규칙이 제목 크기 경계도 다루지만, SVG/기능성 요소 누락까지 해결했다는 뜻은 아닙니다. 보안 필터를 넓히거나 G7 템플릿을 수정하지 않고 모듈 소유 출력/고정 runtime adapter 정책 안에서 검토합니다.

제출/통합 SHA와 gate 결과는 Git/coordination 기록으로 추적합니다. 실제 통합 main의 후보 주입 없는 결과는 `phase2e4-integrated-20260831`, 엄격한 치수 검사 잔여 실패는 `phase2e4-integrated-typography-20260831`로 별도 보존합니다. 2차 전체 완료·3차 진입·push·운영 배포·release 승인은 이번 배치에 포함하지 않습니다.
