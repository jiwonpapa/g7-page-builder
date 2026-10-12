# IP3 레이어와 재귀 구조 편집 검증

상태: UI 제출·Local 통합 진행 중. 순수 명령과 세션/codec은 통합됐고 독립 UI의 실제 입력 검사를 수행했다. 아직 IP3 완료 수는 올리지 않는다.

## 소유 범위

기준 SHA는 `355fec0f39df3ee40ae5a58f3442807a2aac6bbe`다. `ip3-tree-commands-20261012`는 tree/commands/clipboard 소스 3개, 관련 단위 시험 1개, 이 기록·원장·표시판·CHANGELOG 총 8개 파일만 소유한다. 기존 v1/v2, Site Part, schema, PHP 저장소·컴파일러, 제품 번들·의존성·예산은 변경하지 않는다.

## 명령의 책임

삽입·이동·복제·삭제·그룹/해제·복사/붙여넣기·이름·잠금·기본 숨김을 검증된 v3 원본에 대한 불변 트랜잭션으로 제공한다. 부모/자식 중복 선택은 DOM 순서의 최상위 선택으로 정규화한다. 실패는 원본·자산·선택에 부분 쓰기를 남기지 않는다. 선택과 접힘·Undo는 이 계층이 저장하지 않는다.

복사본은 새 노드 ID와 내부 fragment 링크를 연결하며 필요한 자산만 가져온다. 자산 ID 충돌과 문서 간 색 토큰 차이를 보존한다. 파일 삭제나 OS 클립보드 접근은 없다. 잠금은 편집 사고 방지이며 서버 권한이 아니다.

absolute 재부모화는 좌표 변환이 필요하므로 거부한다. 구조만으로 배치를 보존할 수 있는 연속된 block-flow 형제만 중립 Container로 묶으며 styled/semantic Container의 해제와 Flex/Grid 부모의 그룹 변경은 측정 없는 무손실 변환으로 가장하지 않는다. 정밀 배치/좌표 측정 연결은 IP4/IP5 대상이며 이 제한을 영구 제품 제외로 바꾸지 않는다.

## 검증 경계

v3는 현재 G7 기존 저장·발행 경로에 연결되지 않았다. 독립 포트 검증과 G7 영속·공개 출력 검증을 구분한다. `mountStructureEditor(element, options)`는 명시적 호스트 조립 API이며 기존 G7 entry를 대체하거나 자동 마운트하지 않는다. 현재 production dist에 추가되지 않았으며 고객 서버에 별도 Node 런타임을 요구하지 않는다.

구조용 renderer는 여섯 기본 요소와 기본 숨김을 렌더한다. 정밀 style 렌더/Inspector는 IP4, 핸들·좌표 변환은 IP5, 반응형 직접 편집은 IP6, 기존 블록/공통영역 연결은 IP7, 서버 저장 복구·컴파일·발행 일치는 IP9의 남은 작업이다. 문서 v3에 값을 저장할 수 있다는 사실을 해당 UI·출력 완료로 보지 않는다.

## 명령 계층 검증

macOS arm64, Node 24.19.0에서 `npx --no-install vitest run tests/Unit/documentV3Tree.test.ts`의 21개 시험, 제품 전체 TypeScript 검사, `make editor-plan-check`가 통과했다. 동일 시험의 명령 소스 3개 한정 V8 측정은 statements 98.50%, branches 94.92%, functions 98.14%, lines 100%다. 저장·브라우저·제품 전체 coverage 결과가 아니다.

첫 실행의 두 실패는 (1) 501개 root의 wire range 오류와 총 노드 오류 기대 구분, (2) UUID 숫자로 시작한 fragment의 schema 거부였다. 한도·schema를 바꾸지 않고 정확한 기대값과 `node-<UUID>` 안전 fragment를 사용했다. 일반 외부 fragment는 재작성하지 않는다. 새 UUID도 별도 regex가 아니라 기존 wire 명세로 검사한다.

## 세션·Puck 연결과 UI

- 명령 제출 `bcd38a1b41b5cb14fa04cff5ca028e071b97038e`, Local 통합 `9b2506f567f6ac1cbb9993a3b310eb623f4e901f`.
- `ip3-session-codec-20261012`: session/codec 소스 2개와 관련 시험 2개. 제출 `91d9c4f9718d14d92fe7ba2bc9c8d9c0b1916e49`, 통합 `030593e0761cf8c494a041be8a8c676d6e4be0b0`.
- `ip3-layer-ui-20261012`: 위 세션 제출 SHA에서 시작, primitive 기본값·UI/adapter 6개와 unit/E2E 2개, 이 기록·원장·표시판·CHANGELOG의 정확한 12개 파일.
- `ip3-browser-registration-20261012`: `030593e` 기준 browser_requirements.py와 해당 하네스 시험만 소유. 제출 `efb7f98b2bf073adb2c8fcab7742169a3a8a4762`. 신규 v3 소스 변경에 전용 3개 시나리오를 연결하며 기존 v1/v2 소스의 검사 매핑·기준은 유지한다. UI와 기능적으로 의존하므로 batch 통합한다.

세션 포트는 문서/세션/revision/readonly를 확인하고 지연 저장 응답의 다른 문서 적용을 막는다. codec은 Puck Data의 안정 ID와 슬롯을 v3 원본으로 왕복하며 숨은 vendor 필드를 원본에 저장하지 않는다. 단일 Puck history에 문서 명령을 기록하고 캔버스 native DnD도 같은 검증을 거친다. 별도 Undo 엔진은 없다.

기존 의미 토큰·버튼을 재사용해 레이어/작업면/구조 속성 3개 영역을 구성했다. 선택·접힘은 세션 상태다. 레이어 선택과 캔버스 선택, 조상 탐색, 이름·잠금·숨김, 삽입 위치·다중 선택 구조 명령을 연결했다. 리치텍스트/정밀 스타일 패널을 이 차수에 추가하지 않았다.

## 실제 입력 및 실패 보완

명령 21개, 세션 19개, codec 7개, UI 5개 단위 시험이 각각 통과했다. 제품 TypeScript 검사도 통과했다. 기존 PAGE 생성/저장/발행/복구 브라우저 회귀는 앞의 두 통합에서 각각 1개 통과했으며 로컬 테마를 전환하지 않았다.

브라우저는 실제 `mount.tsx`를 Vite로 번들링해 G7 없는 호스트에 마운트한다. 자체 편집기 모형이 아니다. 네트워크는 fixture HTML/이미지만 허용하고 DraftPort는 테스트 호스트의 canonical JSON/정수 revision 메모리 저장이다. 실제 G7 인증·DB·동시 저장·PHP 공개 출력의 성공 증거는 아니다. 번들은 기존 JS gzip 508,500바이트/CSS gzip 45,200바이트 상한을 그대로 검사한다.

`npx --no-install playwright test tests/E2E/structureEditorV3.spec.ts --project=desktop --retries=0 --reporter=line --output=output/playwright/ip3/recursive-20261012-1534`: 3개 통과(5.6초). 빈 원본에서 삽입·이름·그룹/해제·복제/삭제·재부모화·순환 거부·정렬·잠금/숨김·붙여넣기·단일 Undo/Redo·저장/새 mount 재열기를 버튼·키보드·포인터로 확인한다. 캔버스/미리보기의 ID DOM 순서와 그룹 전후 iframe 내부 좌표 차이 1px 이하를 검사한다. 독립적인 1440×1000 데스크톱 호스트 기준이며 반응형 편집·발행 parity 증거로 사용하지 않는다.

같은 폴더의 `v3-structure-reopened.png`, `v3-canvas-drag.png`를 육안 확인했다. 이미지 로드 후 캡처하며 선택과 레이어 순서, 재열기 콘텐츠를 확인했다. 초기 실패는 다음과 같이 보완했다.

- Puck DnD의 별도 status와 겹치던 locator는 편집 상태의 접근 가능한 이름으로 특정했다.
- Undo의 실제 목표 snapshot과 승인을 연결해 그룹/붙여넣기 취소가 거부되던 문제를 수정했다.
- iframe 키보드 Ctrl/Meta+Z를 공개 iframe override에서 동일 Puck history로 전달했다. 입력칸·IME는 가로채지 않는다.
- 그룹 검사에서 host 조상 탐색줄 변화 37px를 문서 변위로 측정하던 것을 iframe 내부 좌표로 바로잡았고, 탐색줄 높이도 고정했다. 허용 오차는 변경하지 않았다.
- StrictMode 재연결과 세션 교체 후 늦은 저장 응답 무시를 단위 시험으로 고정했다.

운영 배포·기존 문서 전환·테마 변경·파일 삭제는 실행하지 않았다. 최종 Local 통합 결과와 인수 상태는 후속 증거 커밋에 기록한다.

## Linux 통합 실패와 보존 교체

원 UI 제출 `c95b38fc9c0a1ed33b523d09707d5faaf1af1f24`와 회귀 등록의 첫 batch 통합은 Linux 브라우저 9개가 `jsxDEV is not a function`으로 실패해 자동 원복됐다. `dev` 컨테이너의 `NODE_ENV=development`와 시험 bundle의 React production define이 충돌했다. 원 제출 전의 macOS 9개 성공과 Linux 통합 성공을 혼동하지 않는다.

`ip3-layer-ui-production-20261012`는 별도 clean worktree와 `030593e0761cf8c494a041be8a8c676d6e4be0b0` 기준으로 `task-replace-submitted`를 실행했다. 원 제출·worktree는 superseded history로 보존하고 정확한 12개 파일·scoped profile을 상속했다. 시험 bundle을 만드는 동안만 NODE_ENV를 production으로 맞추고 finally에서 복원한다. 개발 컨테이너 설정·제품 의존성·용량 기준은 변경하지 않았다. macOS에서 `NODE_ENV=development`를 명시한 동일 3개 시나리오는 5.8초에 통과했다.

원 제출 검사에서 확장자 없는 `vite.puck-history`를 의존성 스캐너가 찾지 못했고 `.ts` import는 현재 TS 설정에서 거부됐다. TS/Playwright/Vite가 지원하는 `.js`→`.ts` 해석을 명시해 해결했으며 검사기·tsconfig를 완화하지 않았다. 코드 점검에서 편집 링크의 보조 클릭 이동도 차단하고 미리보기 링크 동작을 보존하는 UI 단위 시험을 추가했다.
