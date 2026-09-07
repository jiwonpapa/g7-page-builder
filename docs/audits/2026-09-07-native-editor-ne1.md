# NE1 진행 기록 — 원본 보존 기반

상태: **PB 기반 코드 검증 완료, NE1 전체는 G7 공개 계약 보완 승인 대기**. 이 기록은 NE1/NAT-01 완료 증거가 아니다.

PB 기준 SHA: `4908bac0d2cd1f5d2179064e4e89835901e8ae08`. 소유 task: `native-ne1-foundation-20260907`. G7 기준 SHA: `fde750cede7fda68329cea42fb706a00d4546bd3`.

## 구현 범위

- [native JSON 경계](../../resources/js/native-editor/domain/node.ts): 외부 unknown을 검증하고 모든 JSON 필드의 분리된 불변 사본을 만든다. 미지 필드·id·출처·actions·responsive·자식 바인딩을 삭제하거나 PB 스키마로 변환하지 않는다. JSON으로 손실 없이 보존할 수 없는 객체는 거부한다.
- [평문 변경 후보](../../resources/js/native-editor/domain/textChange.ts): route 소유 노드의 최상위 평문 text만 변경한다. 기존 출처를 지우지 않으며 번역/표현식/markup·반복 root·다른 출처·예상 text 불일치를 거부한다. 동일 값은 무변경이다.
- 이 함수는 변경 후보만 반환한다. 권한·조상 잠금·문서/세션/revision 검증, G7 적용·Undo·저장·재열기는 제공하지 않는다. 일반 편집 UI에서 활성화하거나 새 native 번들로 등록하지 않았다. 평문 이외의 원본은 보존하고 후속 정식 편집기로 위임한다.

## 현재 코드에서 확인한 선행조건

현재 공개 NodeEditorProps는 node/params/spec/manifest/t/onPatchNode/templateIdentifier/candidates를 전달하며 layout/session/revision/readonly 전체 문맥은 없다. `PropertyEditorModal.tsx:455`의 전달 지점에서도 같다.

`canvasOverlayRegistry.ts:66`의 onInsertChild는 parentPath:string, `EditorCanvasOverlay.tsx:944`의 실제 handleInsert는 ComponentPath 배열이다. `:2447`에서 직접 연결한다. 공개 메서드는 기존 네 개이며 전역 패널·선택·내보내기 등록 계약은 확인되지 않는다.

[정확한 G7 수정 범위와 계약 보완안](../productization/native-host-contract.md)에 H01~H04의 변경 지점·데이터·명령·검증 조건을 정리했다. 현재 AGENTS의 Editor boundary와 NE1 계획은 G7 코어 변경을 별도 승인 작업으로 구분하므로 이 작업에서 G7 소스를 수정하지 않는다. 기존 PB 유지 경로를 늘려 native 구현 완료로 대신하지 않는다.

## 검증 기록

- 최초 단위 시험은 새 구현 모듈이 없어 import 해석 단계에서 실패했다. 제품 동작 실패 재현으로 확대하지 않는다.
- 2026-09-07 scoped submission 실행: 진척 정합성, `nativeNodeChange.test.ts` **32개 통과**, `tsc --noEmit` 통과, 변경된 제품 소스 2개 파일의 구조/의존 검사 통과. 총 4개 gate이며 full 검사를 요청하지 않았다.
- 실행 명령: `python3 -B scripts/g7pb.py run --base 4908bac0d2cd1f5d2179064e4e89835901e8ae08 --phase submission --task native-ne1-foundation-20260907`. Node 24/PHP 8.5 도구 경로에서 실행했으며 제출·통합 시 입력이 같은 성공 결과를 재사용한다.
- 브라우저 NAT-01과 G7 호스트 계약 증거는 아직 없다. 다음 차수는 NE2 내용·스타일·미디어 편집이며 NE1 전체 완료 후 시작한다. 마지막 차수는 NE6 호환·회귀·릴리스다.


## 공개 호스트 연동 후속 작업

사용자의 다음 차수 진행·차수별 커밋 지시에 따라 제시한 H01~H04 공개 계약 보완을 별도 G7 worktree에서 진행했다. 기존 G7/PB 저장소 원본은 분리한다. stock G7 지원이나 upstream 병합을 뜻하지 않는다.

- G7 후보: engine-v1.65.0, 공개 registerPanel과 g7.layout-editor/1. 문서/선택/출처 검증과 기존 history 적용, 삽입 문자열/반응형 경로 변환, 늦은 문서 GET 응답 차단.
- PB: 별도 native entry, runtime 검증 adapter, 평문 상세 편집 패널, onReady 지연 로더. React/ReactDOM/JSX runtime은 호스트를 공유한다. Puck/Tiptap과 기존 PB 문서 API는 사용하지 않는다.
- 단위 확인: G7 관련 67개, PB 원본/adapter 42개 통과. 구조 하네스 28개 통과. PB strict typecheck와 native production build 통과. native JS gzip 2.18KB, 공유 React 번들 포함 0건.
- 로컬 G7 후보 JS 2개는 기존 파일 SHA를 보존한 `.runtime/audits/native-ne1-host-runtime-backup-20260907` 뒤에 설치한다. 운영 배포는 실행하지 않았다.
- 실제 NAT-01 브라우저 시험은 통합 gate에서 수행하며, 결과 전에는 NE1 완료로 표시하지 않는다.

G7 공개 계약 구현 커밋: `9260d521` (로컬 `codex/native-editor-host-ne1-20260907`). 새 extension 파일의 타입 진단은 없으나, G7 기존 의존 코드의 strict 진단은 남아 있으므로 G7 전체 strict typecheck 통과로 보고하지 않는다. PB strict typecheck는 통과했다.
