# 독립 페이지 빌더 정밀 편집 개발 계획

<!-- editor-plan:independent-editor-20261012 -->

상태: **2026-10-12 IP1~IP10 구현 계획 6/10 완료, IP7 진행 중**. IP1 엔진 결합, IP2 정밀 문서·스타일 계약, IP3 레이어·재귀 구조, IP4 정밀 Inspector·자동 배치, IP5 핸들·다중 선택 작업면과 IP6 반응형 상세 편집의 구현·Local 통합·필수 증거를 확보했다. [IP1 증거](../audits/2026-10-12-ip1-engine-proof.md), [IP2 증거](../audits/2026-10-12-ip2-document-contract.md), [IP3 증거](../audits/2026-10-12-ip3-structure-editing.md), [IP4 증거](../audits/2026-10-12-ip4-precision-inspector.md), [IP5 증거](../audits/2026-10-12-ip5-canvas-interactions.md)를 참고한다. IP5 최종 FULL은 동일 Inter 4.1의 로컬 배포로 외부 글꼴 지연을 해소한 통합본에서 통과했다. IP6는 브라우저 51개와 일곱 폭의 1px 이내 출력 비교 및 최종 scoped 검증을 통과했다. [IP6 기록](../audits/2026-10-12-ip6-responsive-editing.md)에 구현·검증 SHA를 보존한다. IP7은 전체 내장 구성과 공통영역의 상세 편집·보호·명시 이행을 구현하며 [착수 기록](../audits/2026-10-12-ip7-catalog-compositions.md)에 범위를 명시했다. IP3~IP6는 독립 mount·테스트 저장 포트·PHP 초안 fragment 기준이며 기존 G7 화면·서버 저장/발행 전환 완료가 아니다. 정책 작업은 구현 분모에 넣지 않으며 제품 전체 정밀 편집·기존 문서 전환 완료로 보지 않는다. G7 코어 수정·운영 배포는 실행하지 않았다.

[편집 정책](editing-policy.md) · [세부 스펙](independent-editor-spec.md) · [진척 원장](editor-progress.json) · [표시판](editor-progress.md) · [구조](../architecture.md)

## 실행 규율

1. 선행 차수의 합격 조건을 충족한 뒤 다음 차수로 진행한다. 차수는 여러 scoped task로 나누되 task마다 깨끗한 기준 SHA와 24개 이하 정확한 파일 PATHS를 소유한다. 아래 scope는 설계 책임 범위이며 디렉터리 claim을 허용하지 않는다.
2. 새 schema·마이그레이션·vendor 의존·공유 runtime 변경은 해당 AREA/관련 검사 및 필요한 FULL 사유를 갖춘 별도 task에서 수행한다. G7 코어 변경은 독립 편집기 작업에 포함하지 않는다.
3. Puck 구조적 차단이 재현되면 원인·비용·대안을 기록하고 엔진 변경 결정을 받는다. 미구현을 기능 제외로 바꾸거나 DOM 우회·두 번째 원본/Undo로 덮지 않는다.
4. 각 기능 차수에서 관련 명령→Undo/Redo→저장→재열기→출력을 확인한다. IP9/IP10까지 검증을 미루지 않는다. IP1은 격리 기술 시험이며 제품 저장 성공을 주장하지 않는다.
5. 소스/통합/실동작/배포를 구분한다. 성공 입력 재사용·실패 downstream 재검증을 유지한다. 원장은 실제 제출/통합 SHA와 전용 실행 기록을 확보해야 done으로 바꾼다.
6. [이전 NE/UI 계획](editor-plan-native-20261012.md)과 [12/12 원장](editor-progress-native-20261012.json), 이전 EP 4/11은 해시로 보존하며 새 완료 수에 포함하지 않는다.
7. 운영 배포는 IP 완료와 별개다. 미배포 개발은 integration-finish NO_RELEASE=1로 종료하고 릴리스 검증 SHA를 승격하지 않는다.

## 공통 최소 시나리오

빈 페이지에 이미지·제목·본문·버튼을 삽입하고 중첩·순서·크기·간격·다중 선택·모바일 재정의를 수정한다. Undo/Redo·저장·재열기·미리보기·발행 결과를 비교한다. 이 최소 경로는 IP1의 기술 조각과 구분하고, 내장 전체/공통영역 수용을 대신하지 않는다.

## IP1 편집 엔진과 정밀 조작 결합 검증

<!-- editor-item:IP1 -->
<!-- editor-acceptance:IND-01 -->

선행: 정책·스펙 확정. 연결 요구: SPEC-01, SPEC-06, SPEC-07.

G7 없는 기술 fixture에서 Puck·Moveable·Selecto·Tiptap의 선택/입력/iframe/줌/취소/단일 Undo를 검증한다. 정확 패키지 버전·라이선스·번들·성능 예산을 기록하고 채택 또는 구조적 차단을 판정한다. 데모 성공을 제품 전체 완료로 보고하지 않는다.

필수 증거: unit, browser, architecture. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP2 정밀 문서와 스타일 계약

<!-- editor-item:IP2 -->
<!-- editor-acceptance:IND-02 -->

선행: IP1. 연결 요구: SPEC-02, SPEC-05.

v3 목표의 안정 노드/레이아웃/typed 스타일/단위/검증/이행 계약과 TS·PHP fixture를 고정한다. 기존 v1/v2·Site Part·미지 필드·발행본은 보존한다. 한도/예산과 구조 gate도 연결하며 UI만 먼저 자유 값을 저장하지 않는다.

필수 증거: contract, unit, compatibility. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP3 레이어와 재귀 구조 편집

<!-- editor-item:IP3 -->
<!-- editor-acceptance:IND-03 -->

선행: IP2. 연결 요구: SPEC-02, SPEC-03.

캔버스/트리 선택·조상 탐색·이름·잠금·숨김과 중첩 삽입/이동/복제/삭제/그룹/해제/붙여넣기를 연결한다. ID·참조·DOM 순서·거부·Undo/Redo·저장/재열기를 실제 입력으로 확인한다.

필수 증거: unit, browser. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP4 정밀 Inspector와 자동 배치

<!-- editor-item:IP4 -->
<!-- editor-acceptance:IND-04 -->

선행: IP3. 연결 요구: SPEC-04, SPEC-05, SPEC-10.

Flex/Grid와 수치/단위 크기·padding/margin/gap·테두리·배경·글꼴/행간/자간·부분 서식을 지원한다. 직접 입력/패널은 같은 명령, 미지정/0/reset은 별개이며 저장·재열기·출력 치수/스타일이 일치한다.

필수 증거: unit, browser, parity. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP5 핸들과 다중 선택 작업면

<!-- editor-item:IP5 -->
<!-- editor-acceptance:IND-05 -->

선행: IP4. 연결 요구: SPEC-06, SPEC-07, SPEC-08, SPEC-10.

Moveable/Selecto를 제품 명령에 연결하여 리사이즈·비율·스냅·키보드·허용 absolute/회전·다중 변경·정렬/분배·팬/줌을 구현한다. 50/100/200%와 scroll/iframe, IME, Esc, readonly에서 오적용 0과 한 동작 한 Undo를 증명한다.

필수 증거: unit, browser, accessibility. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP6 반응형 상세 편집

<!-- editor-item:IP6 -->
<!-- editor-acceptance:IND-06 -->

선행: IP5. 연결 요구: SPEC-09.

desktop host에서 세 폭의 모든 허용 요소 값을 직접 편집한다. base 독립 상속/override/reset, 경계 폭, gap/방향/Grid/표시/크기와 DOM 의미를 검증한다. 모바일 1열/미리보기 전용 제한을 새 디자인에 남기지 않는다.

필수 증거: contract, browser, parity. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP7 내장 구성 템플릿과 공통영역

<!-- editor-item:IP7 -->
<!-- editor-acceptance:IND-07 -->

선행: IP6. 연결 요구: SPEC-12, SPEC-13.

내장 카탈로그 전체의 구성/편집/보호/이행 capability 대응표를 완성한다. Hero/Card/ImageText와 반복·동적 블록, PB Header/Footer의 내부 요소를 편집하고 기존 원본의 명시 이행·거부·복원을 증명한다. 대표 1종 통과로 전체를 닫지 않는다.

현재 블록별 조립 함수와 편집기 사이의 직접 의존은 [공통 요소 구조 교정](../audits/2026-10-12-ip7-element-editor-correction.md)에 따라 제거한다. 신규 구성은 같은 요소 트리의 데이터 정의만으로 추가되어야 하며, 구성 이름별 편집/삽입/렌더 코드 추가를 수용하지 않는다. 기존 포맷 이행과 일반 편집기를 분리하고, 같은 번들에서 처음 보는 구성을 편집하는 증거를 확보한다.

필수 증거: contract, browser, compatibility. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP8 미디어와 재사용 구성

<!-- editor-item:IP8 -->
<!-- editor-acceptance:IND-08 -->

선행: IP7. 연결 요구: SPEC-11, SPEC-14.

선택 문맥을 보존하는 미디어 업로드/교체/alt/fit/초점과 사용자 구성 저장/검색/재삽입을 제공한다. 지연·취소·문서 전환·미지원 자산·새 ID/내부 참조·독립 사본을 확인하며 원본 파일을 삭제하지 않는다.

필수 증거: unit, browser, compatibility. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP9 저장 복구와 공개 출력 일치

<!-- editor-item:IP9 -->
<!-- editor-acceptance:IND-09 -->

선행: IP8. 연결 요구: SPEC-13, SPEC-15, SPEC-16.

단계별로 해 온 저장 검증을 종합한다. 초안/발행·충돌·늦은 응답·revision 복원·Site Part 세트 원자성·마지막 정상 발행본을 확인한다. 편집/preview/public을 동일 준비 조건에서 치수 1 CSS px 이하로 비교한다.

필수 증거: browser, parity, concurrency. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.

## IP10 독립성 호환성과 제품 수용

<!-- editor-item:IP10 -->
<!-- editor-acceptance:IND-10 -->

선행: IP9. 연결 요구: SPEC-01, SPEC-16.

SPEC-01~16과 내장 대상 전체의 누락 0, G7 없는 편집 및 지원 G7/테마 조합, 100/500노드 예산, PC/태블릿/모바일·키보드/IME·실패 회귀를 판정한다. 기능 제품 수용만 다루며 운영 배포는 별도 승인·증거로 남긴다.

구현 완료 뒤 실제 사용자 흐름의 E2E와 UI·UX 감사를 수행한다. 새 구성의 무코드 등록, 내부 요소 선택과 직접 입력, Inspector 대상, 단일 Undo, 저장/재열기·발행/복구를 확인하고 세 폭의 가독성·넘침·가림·초점을 육안 검사한다. 미달은 수정 후 재검증하며 단위/구조 검사 통과만으로 의도한 UX의 구현을 주장하지 않는다.

필수 증거: architecture, compatibility, browser, performance, accessibility. 전용 실행 기록에 기준 SHA·환경·실행 명령·결과·실패/미실행·남은 한계를 기록한다.
