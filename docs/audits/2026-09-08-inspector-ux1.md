# 독립 PB 우측 설정 개선 1차

상태: UI 소스 구현 및 제한 검사 통과. 실제 브라우저·통합·배포는 아직 완료하지 않았다.

기준: 499e8361052ace420b1ed7e750bcd2177908d767. Task: inspector-ux1-20260908.

## 구현 범위

- PAGE 주요 6개 공통 선택 컨트롤, 색상 견본/현재 색상명, 보충 툴팁/접근성 설명 및 반복 박스 간격 축소.
- 공통 배치 라벨과 정렬 아이콘. 폭/높이의 5개 옵션 Select 유지.
- 반복 배경/여백 및 제목 단계의 선언 옵션을 공유 선택 컨트롤로 표시. Puck의 FieldOptions 타입 소실은 선언 옵션 일치 확인 후 단일 어댑터 단언으로 한정.
- 기기별 스타일 접기·별도 지정 개수. 기존 설정/초기화/Undo 명령 유지.

## 수행한 제한 검사

Node 24. TypeScript strict 통과. 관련 단위 5개 파일 46개 시험 통과. CSS 및 변경 소스 구조 검사 통과.
- blockInspectorFields.test.tsx, inspectorChoiceField.test.tsx: 8개.
- puckEditorConfig.test.tsx, puckEditorSurface.test.tsx, responsiveBlockStyle.test.ts: 38개.

## 남은 작업

실제 브라우저 시나리오와 통합 증거가 필요하다. 자산 URL 해시 변경은 별도 제출로 보존 중이다. 현행 planner.py의 resources/views 분류가 FULL을 요구해, 이 변경에 한정한 분류 보완 또는 전체 검증 허용을 사용자에게 확인했다. 이 상태를 1차 마감이나 배포로 보고하지 않는다.
