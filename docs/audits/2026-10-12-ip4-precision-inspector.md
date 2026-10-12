# IP4 정밀 Inspector와 자동 배치

## 상태와 범위

2026-10-12, 기준 `2c82f737b836fb98cfab5077b37d0fe1bc4abce2`.
IP4는 진행 중입니다. 단위 기반 구현은 제품 UI 완료나 운영 발행 연결을 뜻하지 않습니다.

첫 task `ip4-design-commands-20261012`는 스타일·본문 변경 명령, 기존 session 연결, CSS 선언 생성, 관련 테스트와 이 기록/진척/변경 기록 11개 파일만 소유합니다.
v3 스키마와 기존 v1/v2·Site Part, G7 코어, 의존성, 품질 기준, 테마는 변경하지 않습니다.

## 설계

- 패널과 캔버스는 같은 불변 문서 명령을 사용합니다. 입력과 결과를 기존 v3 계약으로 검증하며 잠금·stale context·readonly는 기존 session에서 거부합니다.
- 스타일 생략, 명시적 0, reset 삭제를 구분합니다. base 변경은 tablet/mobile override를 지우지 않습니다.
- Flex/Grid, 크기·단위, 박스·배경·타이포그래피는 생성 CSS입니다. 문서에는 raw CSS/HTML/vendor 상태를 저장하지 않습니다.
- 기존 Puck history 포트만 사용합니다. 새 Undo 엔진은 만들지 않습니다.

## 검증 및 남은 작업

기반 제출 `957d90605efcfd79439c4d00ad7e466cfae9af6f`, Local 통합 `069c5721fb819f690a38de71211578f1ef909adb`에서 관련 47개 단위 테스트와 기존 v3 구조 브라우저 3개를 통과했습니다. 공통 presentation fixture는 모든 기존 스타일 필드를 포괄합니다.

후속 task `ip4-inspector-ui-20261012`는 19개 정확 파일을 claim했습니다. 스키마 기반 Inspector, Puck의 공개 contentEditable/Tiptap 필드와 typed run 변환, 같은 스타일을 쓰는 React 캔버스/미리보기를 연결합니다. 임의 HTML/CSS는 영속 문서 필드가 아닙니다. Inspector 초안은 적용할 때만 한 명령으로 전달하며 0/미지정/reset을 분리합니다.

PHP 별도 제출 `906c32445078053227e8813f52941432b32e0315`의 6개 시험/124개 assertion이 통과했습니다. 이는 독립 초안 fragment이며 운영 발행본이나 G7 컴파일러 교체가 아닙니다.
승인된 검사 등록은 기존 fixture 등록 2개 파일 및 브라우저 등록 2개 파일로 한정합니다. Inspector·본문·부분 서식·편집/미리보기/PHP 1px 치수와 CSS 비교는 기존 독립 시험 파일의 추가 시나리오로 연결합니다.

Inspector 및 본문 관련 새 단위 시험은 작성·실행했습니다. 실제 브라우저 입력과 치수/스타일 parity는 Local 결합 gate에서 검증할 예정이며 아직 성공 증거로 기록하지 않습니다. PC 작업면 시험을 모바일 반응형 입력, 실제 OS IME, G7 저장/발행 성공으로 해석하지 않습니다.
IND-04의 unit/browser/parity 증거가 모두 확보되기 전 IP4 완료로 표시하지 않습니다.
Moveable/Selecto 핸들, 다중 디자인 선택(IP5), 반응형 입력 UI(IP6), 기존 블록 이행(IP7), 운영 저장/발행(IP9)은 이번 범위가 아닙니다.
