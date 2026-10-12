# 독립 정밀 편집 정책 전환 기록

기준: 2026-10-12, main df2aeedbbe016f30999ebeec128757329dd18530. 작업: independent-editor-policy-20261012.

사용자 지시: 페이지를 요소별로 세부 편집하는 스펙을 확정하고 독립 페이지 빌더 구조의 정책을 먼저 반영한다. G7 코어 수정·운영 배포·기존 문서 삭제/자동 변환은 수행하지 않는다.

## 결정과 적용 범위

- [편집 정책](../productization/editing-policy.md)과 [세부 스펙](../productization/independent-editor-spec.md): PB 원본/명령/저장 소유, 정밀 수치·레이아웃·다중 선택·반응형·내장 전체/PB 공통영역 범위.
- [구조](../architecture.md)와 [엔진 결정](../editor-engine-decision.md): Puck/Tiptap 재사용, Moveable/Selecto 도입 전 결합 시험, 단일 선택/Undo, G7 없는 포트 대체 검증.
- AGENTS·개발 헌법·캔버스 계약·제품화 안내를 같은 방향으로 연결한다. 네이티브는 유지보수/호환 트랙이며 삭제하지 않는다.
- [새 계획](../productization/editor-plan.md)은 IP1~IP10이다. 정책 작업을 제품 기능으로 합산하지 않고 0/10에서 시작한다.
- 추가 의존성·schema/compiler/module 버전·제품 runtime 소스·G7 코어·사용자 DB를 변경하지 않는다.

## 이전 이력 보존

다음 파일은 기준 HEAD의 원문 바이트를 그대로 복사했다. 계획·원장은 현행 진척 checker의 history에 등록하고 SHA-256·계획 ID·완료 수를 검사한다. 정책·표시판 해시는 아래 기록으로 확인한다.

| 보존 파일 | SHA-256 |
|---|---|
| editing-policy-native-20261012.md | 35bd5389c60bfe318229a0a57339b2ab11ab9f11693e95422f58d9b3b0480628 |
| editor-plan-native-20261012.md | 75859695726f88d76264e1e3d1b68deb2702c0759cfa1ca231a1afe82afc4e8f |
| editor-progress-native-20261012.json | c9c37c3e82f6a0c0a807d3e7a6dc58dad7479750de8b6d22b2e9c2e94f803946 |
| editor-progress-native-20261012.md | a7212400d6894af73d9d50bd20438e2642f62396c8a14ae68e2766493b66788c |

이전 EP 4/11, NE/UI 12/12는 당시 기록이며 새 정밀 편집 완료 수는 아니다. 기존 역사 문서의 ‘현재/다음’은 당시 문맥으로만 읽는다.

## 검증과 완료 범위

- make editor-plan-check: 정책/계획 ID·요구/항목 ID·의존성·증거·로컬 링크·표시판 정합성 통과.
- python3 -B -m unittest tests.Harness.test_editor_progress: 23건 통과. 두 세대의 완료 archive를 보존하면서 IP 진척을 0으로 시작하고 과거 ID 재사용을 거부하는 회귀를 추가했다.
- Node 24의 make infra-check BASE_REF=df2aeedbbe016f30999ebeec128757329dd18530: 변경 19파일, 관련 gate 4개 통과, 미분류 0, full/runtime/browser 실행 없음.
- 규범 변경에 따른 check-design-architecture: 제품 435파일 정적 검사 통과. 기존 등록 부채 220건은 남아 있으며 새 기능 품질이나 기존 부채 해소의 증거가 아니다.
- make coord-check TASK=independent-editor-policy-20261012 및 git diff --check: 범위/공백 검사 통과.
- archive 4개를 기준 HEAD 내용과 SHA-256으로 비교하여 원문 바이트 보존을 확인했다.

제출·통합 SHA와 최종 검사 상태는 coordination의 해당 task 기록과 Git 이력으로 확인한다. 이 기록 작성 시점에는 제품 기능 구현/운영 배포를 하지 않았다.

제품 UI·브라우저·발행 시험은 이번 정책 작업에서 실행하지 않는다. 문서 정합성 통과로 실제 정밀 편집 성공을 주장하지 않는다. 다음 제품 작업은 IP1이며 별도 정확 파일 claim에서 시작한다.
