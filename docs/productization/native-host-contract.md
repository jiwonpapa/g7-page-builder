# NE1 — G7 공개 호스트 계약 보완안

상태: **G7 코어 변경 승인 전 검토안**. 새 함수·props는 아래에 제안할 뿐 현재 G7 SDK나 PB 실행 코드에서 제공·사용한다고 주장하지 않는다. [현행 계획](editor-plan.md)의 H01~H04를 마감하기 위한 외부 선행 작업이다. [개발 헌법](../development-constitution.md)의 공개 adapter 경계를 유지한다.

G7 기준 SHA: `fde750cede7fda68329cea42fb706a00d4546bd3`. 현재 공개 메서드는 registerWidget/registerNodeEditor/registerCanvasOverlay/onReady 네 개다. 2026-09-07 재확인에서 기준 SHA와 아래 계약 부족은 유지됐다. 내부 hook import·PB 우회 저장·호스트 DOM 읽기로 대체하지 않는다.

## 승인 요청 범위

G7의 공개 편집 확장 계약과 그 전달·검증·회귀만 수정한다. 페이지/게시판 데이터·운영 템플릿·DB 스키마·인증 정책·운영 배포는 이 승인에 포함하지 않는다. G7은 별도 깨끗한 worktree에서 구현하고 해당 저장소 규칙과 검사를 적용한다. 아래는 파일 후보이며 G7에서 실제 착수 시 소유 범위를 확정한다.

| 항목 | 현재 소스 위치 (G7 저장소 기준) | 구체적 변경 |
|---|---|---|
| H01 문맥 | `resources/js/core/template-engine/layout-editor/spec/nodeEditorRegistry.ts`; `widgetRegistry.ts`; `canvasOverlayRegistry.ts` | 공개 props에 불변 문서·선택 문맥을 전달하는 선택형 계약 추가. 기존 확장 호환 유지 |
| H01 수명 | `resources/js/core/template-engine/layout-editor/LayoutEditorContext.tsx`; `hooks/useLayoutDocument.ts` | 문서/편집 모드/재로드의 session 식별자, 모든 편집·Undo/Redo에서 바뀌는 revision, 현재 권한과 서버 lockVersion 연결 |
| H02 경로 | `resources/js/core/template-engine/layout-editor/spec/canvasOverlayRegistry.ts`; `components/EditorCanvasOverlay.tsx` | 공개 onInsertChild의 string 경로와 실제 ComponentPath 배열 handler 불일치 수정. 기존 문자열 호출이 있으면 명시적 호환 변환과 회귀 제공 |
| H03 명령 | `resources/js/core/template-engine/layout-editor/components/EditorCanvasOverlay.tsx`; 신규 `spec/extensionCommand.ts` 후보 | 문서/세션/revision/노드 ID·경로/출처/허용 자식 검사를 통과한 변경만 기존 patchLayout/history에 원자적으로 반영 |
| H01 전달 | `resources/js/core/template-engine/layout-editor/components/PropertyEditorModal.tsx`; `components/property-controls/ControlRenderer.tsx` | 확장 nodeEditor/widget에 같은 현재 문맥과 guarded command 전달. stale modal closure가 변경 권한을 유지하지 않음 |
| H04 확장 | `resources/js/core/template-engine/layout-editor/spec/exposeLayoutEditorGlobals.ts`; `resources/js/core/template-engine/G7CoreGlobals.ts`; `layout-editor/LayoutEditorChrome.tsx`; 신규 `spec/panelRegistry.ts` 후보 | 이름 공간을 가진 선택형 패널 등록, 선택 snapshot 읽기/내보내기, 기존 삽입 명령 연결의 공개 계약과 소비 지점 제공. private registry 조회로 등록을 우회하지 않음 |

## 제안하는 데이터·명령 계약

다음 명칭은 **설계 제안**이며 G7 구현·검증 전 PB allowlist에 추가하지 않는다.

- 불변 문맥: `templateIdentifier`, `layoutName`, `editMode`, `sessionId`, `revision`, `lockVersion`, `readonly`, 현재 노드 ID와 `ComponentPath`.
- `sessionId`는 동일 라우트라도 문서 재로드·편집 모드 전환 시 바뀐다. `revision`은 로컬 변경·Undo/Redo마다 증가하며 서버 `lockVersion`과 구분한다. 이 값들이 없을 때 0/빈 문자열을 채워 문맥이 있다고 처리하지 않는다.
- 현재 G7 경로 형식은 `number | { responsive: string }` 세그먼트의 배열이다. root children 경로와 responsive 분기를 문자열 index처럼 혼용하지 않는다. 공개 타입과 실제 handler의 의미가 일치해야 한다.
- guarded command는 예상 문맥·대상 ID/경로·변경을 함께 받는다. 실행 직전에 최신 문맥·readonly·출처·허용 구조를 확인하고 성공 때만 기존 문서와 history를 갱신한다. 거부는 명시적 reason을 돌려주며 부분 수정·history 증가가 없어야 한다.
- 명령 결과는 적용/무변경/거부를 구분한다. PB가 만든 분리된 node 변경 후보도 권한이나 원자적 적용의 증거가 아니다. G7 명령 경계에서 다시 검증한다.
- 패널 props에는 불변 snapshot과 허용 명령을 전달한다. 전체 mutable document·내부 store/dispatch를 노출하지 않는다. 선택·내보내기 문맥이 변경되면 이전 요청은 무효다. 등록 이름 중복·해제·ready 재실행의 동작을 명시한다.
- source metadata와 원본 알 수 없는 필드를 보존한다. 저장 시 합성 원본 복원은 기존 G7 경로에서 수행하며 PB에서 출처를 지우지 않는다. 네이티브 저장은 현재 공개 반영 의미를 유지한다.

## 합격 시험

1. 현재 공개 extension fixtures가 새 선택형 props 유무와 관계없이 동작한다. 등록·ready 큐·중복/해제·lazy 로딩을 확인한다.
2. 직접 route 노드 하나 편집→Undo→Redo→저장→재열기로 변경 외 의미 diff 0을 확인한다. id·출처·번역·표현식·actions·responsive·미지 필드를 보존한다.
3. 두 번째 문서/템플릿/선택으로 전환하거나 reload/Undo 후 오래된 비동기 요청을 완료해도 새 문서에 적용되지 않는다.
4. readonly·base/partial/다른 extension·반복 인스턴스·금지 부모/자식은 문서·선택·history 모두 무변경이다.
5. 부모 경로에 responsive 세그먼트가 있는 실제 삽입과 문자열 호환 경로를 검증한다. 타입 검사 통과만으로 runtime 동작을 대신하지 않는다.
6. 패널의 선택·snapshot 내보내기·삽입이 같은 세션/명령 경계를 사용한다. 전역 등록 함수만 만들고 소비 UI가 없는 상태를 지원 완료로 표시하지 않는다.

G7 공개 계약 완료 후 PB adapter/entry와 지원 템플릿 spec을 연결하고 실제 브라우저 NAT-01을 수행해야 NE1 전체가 완료된다. 이 문서 승인만으로 NE2를 시작하지 않는다.


## NE1 로컬 공개 계약 구현

G7 별도 worktree의 engine-v1.65.0 후보가 `registerPanel`과 `g7.layout-editor/1` 소비 UI를 구현한다. PB allowlist는 그 다섯 번째 메서드만 추가한다. 적용 소스는 G7 `layout-editor/extensions/{contract,command,path,panelRegistry,useExtensionHost,ExtensionPanels}`와 `hooks/useRevisionedDocument`, 기존 registry/overlay/document 연결이다. 정확한 커밋 및 NAT-01 결과는 NE1 감사에 기록한다.

v1 텍스트 명령은 route 소유의 일반 평문만 대상으로 하며 원본 필드 전체를 교체하지 않는다. 삽입은 기존 nesting이 허용하는 basic 자식에 한정한다. source·iteration·responsive 조합 삽입은 현재 거부하며 NE3의 확장 대상이다. 기존 등록 메서드·onPatchNode는 호환을 유지하되 PB는 guarded execute만 사용한다. 기능 미제공 호스트에서는 새 패널을 로드하지 않고 기존 PB 문서·발행 경로를 유지한다.

이는 stock G7에 이미 포함된 기능이라는 주장이 아니다. upstream 반영 전까지 호스트 후보와 PB 모듈을 함께 검증한 조합만 지원 증거를 갖는다.
