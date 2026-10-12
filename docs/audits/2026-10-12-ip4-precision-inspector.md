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

직접 실행한 관련 단위 테스트는 3개 파일 41개 통과했습니다. 범위 검증은 제출 하네스에서 별도로 확인합니다. 공통 presentation fixture는 모든 기존 스타일 필드를 포괄합니다.
아직 Inspector UI, Puck/Tiptap 직접 입력, PHP 정적 렌더, 브라우저 치수/스타일 parity를 검증하지 않았습니다.
IND-04의 unit/browser/parity 증거가 모두 확보되기 전 IP4 완료로 표시하지 않습니다.
Moveable/Selecto 핸들, 다중 디자인 선택(IP5), 반응형 입력 UI(IP6), 기존 블록 이행(IP7), 운영 저장/발행(IP9)은 이번 범위가 아닙니다.
