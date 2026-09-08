# G7 네이티브 편집 공개 호스트 계약 v1

상태: **NE1~NE4 로컬 구현·통합·수용 검증 완료**. 최신 기능 검증은 G7 공개 API 후보 `d264405fd09b70ac85aebe4f4a857cadbe22981e`(engine 1.68.1)와 PB 최종 제품 통합 `54450ecf86179da01b357fcc3d572ef210aa51fa` 조합이다. stock G7/upstream 제공이나 운영 배포를 뜻하지 않는다. [NE4 마감 증거](../audits/2026-09-08-native-editor-ne4.md), [현행 계획](editor-plan.md), [개발 헌법](../development-constitution.md)을 따른다. 아래 차수별 SHA와 제한은 당시 증거를 보존한다.

조사 기준 G7 `fde750cede7fda68329cea42fb706a00d4546bd3`에는 기존 네 메서드만 있었으며 H01~H04가 부족했다. 이번 후보에 공개 `registerPanel`과 `g7.layout-editor/1`을 추가했다. 내부 hook import·PB 우회 저장·호스트 DOM 읽기를 PB 연동으로 사용하지 않는다.

## 구현 범위

G7의 공개 편집 확장 계약과 그 전달·검증·회귀만 수정한다. 페이지/게시판 데이터·운영 템플릿·DB 스키마·인증 정책·운영 배포는 이 승인에 포함하지 않는다. G7은 별도 깨끗한 worktree에서 구현하고 해당 저장소 규칙과 검사를 적용한다. 아래 위치의 공개 계약과 소비 경로만 보완했다.

| 항목 | 현재 소스 위치 (G7 저장소 기준) | 구체적 변경 |
|---|---|---|
| H01 문맥 | `resources/js/core/template-engine/layout-editor/spec/nodeEditorRegistry.ts`; `widgetRegistry.ts`; `canvasOverlayRegistry.ts` | 공개 props에 불변 문서·선택 문맥을 전달하는 선택형 계약 추가. 기존 확장 호환 유지 |
| H01 수명 | `resources/js/core/template-engine/layout-editor/hooks/useRevisionedDocument.ts`; `hooks/useLayoutDocument.ts` | 문서/편집 모드/재로드의 session 식별자, 모든 편집·Undo/Redo에서 바뀌는 revision, 현재 권한과 서버 lockVersion 연결 |
| H02 경로 | `resources/js/core/template-engine/layout-editor/spec/canvasOverlayRegistry.ts`; `components/EditorCanvasOverlay.tsx` | 공개 onInsertChild의 string 경로와 실제 ComponentPath 배열 handler 불일치 수정. 기존 문자열 호출이 있으면 명시적 호환 변환과 회귀 제공 |
| H03 명령 | `resources/js/core/template-engine/layout-editor/components/EditorCanvasOverlay.tsx`; `extensions/command.ts`; `extensions/useExtensionHost.ts` | 문서/세션/revision/노드 ID·경로/출처/허용 자식 검사를 통과한 변경만 기존 patchLayout/history에 원자적으로 반영 |
| H01 전달 | `resources/js/core/template-engine/layout-editor/components/PropertyEditorModal.tsx`; `components/property-controls/ControlRenderer.tsx` | 확장 nodeEditor/widget에 같은 현재 문맥과 guarded command 전달. stale modal closure가 변경 권한을 유지하지 않음 |
| H04 확장 | `resources/js/core/template-engine/layout-editor/spec/exposeLayoutEditorGlobals.ts`; `resources/js/core/template-engine/G7CoreGlobals.ts`; `extensions/panelRegistry.ts`; `extensions/ExtensionPanels.tsx`; `components/EditorCanvasOverlay.tsx` | 이름 공간을 가진 선택형 패널 등록, 선택 snapshot 읽기/내보내기, 기존 삽입 명령 연결의 공개 계약과 소비 지점 제공. private registry 조회로 등록을 우회하지 않음 |

## 데이터·명령 계약

검증한 공개 진입점만 PB allowlist에 추가했다. 새 호스트 메서드는 같은 구현·검증 절차 없이 허용하지 않는다.

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

이 합격 조건의 증거 종류와 실제 결과는 NE1 마감 감사에 구분 기록했다. sirsoft-basic 일반 페이지의 기존 renderer/spec을 사용해 NAT-01을 통과했으며 템플릿 원본은 수정하지 않았다.


## NE1 로컬 공개 계약 구현

G7 별도 worktree의 engine-v1.65.0 후보가 `registerPanel`과 `g7.layout-editor/1` 소비 UI를 구현한다. PB allowlist는 그 다섯 번째 메서드만 추가한다. 적용 소스는 G7 `layout-editor/extensions/{contract,command,path,panelRegistry,useExtensionHost,ExtensionPanels}`와 `hooks/useRevisionedDocument`, 기존 registry/overlay/document 연결이다. 정확한 커밋 및 NAT-01 결과는 NE1 감사에 기록한다.

v1 텍스트 명령은 route 소유의 일반 평문만 대상으로 하며 원본 필드 전체를 교체하지 않는다. 삽입은 기존 nesting이 허용하는 basic 자식에 한정한다. source·iteration·responsive 조합 삽입은 현재 거부하며 NE3의 확장 대상이다. 기존 등록 메서드·onPatchNode는 호환을 유지하되 PB는 guarded execute만 사용한다. 기능 미제공 호스트에서는 새 패널을 로드하지 않고 기존 PB 문서·발행 경로를 유지한다.

이는 stock G7에 이미 포함된 기능이라는 주장이 아니다. upstream 반영 전까지 호스트 후보와 PB 모듈을 함께 검증한 조합만 지원 증거를 갖는다.


## NE2 내용·스타일·미디어 공개 계약

NE2는 G7 `c9e59a55223dadb039d9e20fb0726623d25619b1` (engine-v1.66.0), PB 제품 통합 `45ae4152d8321726e14eeea6daa0f8ad35c7f9a9` 조합을 [NAT-02 감사](../audits/2026-09-07-native-editor-ne2.md)로 검증했다. protocol `g7.layout-editor/1`을 유지하며 기존 전역 등록 메서드를 추가하지 않는다.

- `snapshot.fields`: 현재 spec에서 허용된 스칼라 내용과 유한 스타일 선택지의 id/라벨/종류/값/초기화 상태/출처. 바인딩과 불투명 컨테이너는 보존한다. 공통 스타일만 노출하며 기존 다크/반응형 값을 수정하지 않는다.
- `execute({kind:'setControl',expected,control,value,reset?})`: 최신 문맥·spec 재검증 후 기존 recipe, patchLayout, history로 한 작업을 적용한다. 빈 alt와 override 초기화를 구분한다. 임의 필드 경로·클래스·CSS·HTML을 받지 않는다.
- `host.media.list({expected,scope:'page'|'template',signal?})`, `upload({expected,file,signal?})`: 기존 인증 첨부 API를 사용하고 완료 후 문맥을 다시 확인한다. 업로드는 현재 layout에 귀속되지만 노드는 수정하지 않는다. 별도 사용자 선택으로만 src를 변경한다. 파일 삭제 API를 확장에 노출하지 않는다.
- 표준 basic Img의 `core:image-ratio`/`core:image-fit`은 호스트가 소유한 유한 CSS 프리셋이다. template capability가 이미지 source 편집을 제공할 때만 노출하며 설치된 템플릿 파일을 수정하지 않는다.

fields/media가 없는 이전 호스트는 NE1 문구 편집을 유지한다. 서버가 이미 수신한 업로드는 취소 이후 정상 첨부 목록에 남을 수 있지만, 취소된 응답/오래된 문맥으로 노드 또는 새 선택 상태를 수정해서는 안 된다. 위 추가 계약은 별도 로컬 후보이며 G7 main/upstream·운영 배포는 NE6 릴리스 범위에서 구분 확인한다.

## NE3 내부 구조와 템플릿 renderer 계약

NE3 호스트 후보는 G7 `da064086eacf9071afb81fa703121b9c69a4c89c` (engine-v1.67.0)다. protocol `g7.layout-editor/1`과 기존 등록 메서드를 유지한다. NE1의 제한된 `insertChild`를 범용 트리 명령으로 오인하지 않으며 아래 선택형 계약을 사용한다. 실제 조합·검사 결과는 [NAT-03 감사](../audits/2026-09-08-native-editor-ne3.md)에 기록한다.

- `snapshot.collections`는 현재 병합 spec, nesting, palette와 출처에서 계산한 불변 목록이다. `children`, `array`, `cell`을 구분하며 허용 선택지·항목·지원 필드·수정 가능 여부만 전달한다. collection ID는 해당 revision에서만 유효한 불투명 값이며 PB에서 경로로 해석하지 않는다.
- `execute({kind:'structure',expected,change})`는 `insert`, `move`, `duplicate`, `delete`, `field`를 받는다. 호스트가 최신 문맥·원본·선언을 다시 검사하고 한 번의 patch/history로 적용한다. PB는 mutable G7 문서나 별도 Undo 저장소를 갖지 않는다.
- 일반 children, 선언된 children prop, 기존 responsive 분기, 정적 배열/배열 그룹, 배열 항목의 셀 트리를 지원한다. 기본 배열은 첫 편집 때 명시적으로 구체화한다. 노드 슬롯 간 이동은 허용 nesting과 순환 검사를 통과해야 한다. 서로 다른 배열 계약 간 이동은 거부한다.
- 복제·삽입 시 표준 `id`를 새로 만들고 선언된 내부 DOM 참조를 재연결한다. 기존 출처와 미지 필드는 보존한다. 외부 참조가 남는 삭제, 해석하지 못한 ID 참조·비표준 `idField`, 보호된 출처/삽입 영역은 거부한다. 이 거부를 해당 구조의 영구 미지원 정책으로 확대하지 않는다.
- 반복 인스턴스에서 원본 경로를 추측하지 않는다. 기존 반복 템플릿 편집 모드의 `iterationRoot` 아래 자식만 변경하며 반복 source·item/index 변수와 외부 원본을 보존한다. 바인딩 필드 자체는 잠긴다. static data source와 `state`/`_local` 두 형태의 실제 편집·공개 출력을 시험한다.
- 반복 편집 미리보기는 실제 layout의 `initLocal`/`state` 기본값을 반영하되 이미 있는 로컬 키를 덮지 않는다. 일반 노드 변경만으로 로컬 상태를 다시 초기화하지 않는다. 기존 한 항목 편집 제한을 결합 문맥에 적용한다.
- 배열 이미지 필드는 G7 첨부 API와 NE2 미디어 패널을 공유한다. 같은 origin의 첨부 URL은 경로로 적용하여 G7의 정상 component JSON 저장 검사를 통과한다. 외부 URL 제한을 해제하지 않으며 서버가 검사하는 원본을 우회하지 않는다.

H05 renderer는 템플릿의 실제 manifest/IIFE export 경로, H06은 기존 capability를 대체하지 않는 새 이름의 spec 병합, H07은 위 collection 필드/명령과 이미지 선택으로 연결한다. `registerWidget`이 JSX renderer를 등록한다고 가정하지 않는다. 선택형 `PageBuilderSlider` companion은 템플릿 제작자가 명시적으로 패키징하며 설치된 템플릿을 자동 수정하지 않는다. 편집 중 전체 항목 표시/자동재생 중지와 공개 재생·키보드·reduced-motion 동작을 분리한다.

G7의 기존 저장은 history를 초기화한다. NE3 Undo/Redo 증거는 저장 전 개별 명령에 관한 것이며 저장을 넘는 Undo 지원을 주장하지 않는다. 현재 호스트에 collections가 없으면 기존 NE1/NE2 기능을 유지한다. G7 main/upstream 반영과 운영 배포는 별도 NE6 완료 증거가 필요하다.


## NE4 — 사용자 조합 공개 명령

G7 후보의 `host.compositions.export({expected, signal})`는 `ExtensionMediaResult<string>`을 반환한다. `insert({expected, snapshot, collection, index, signal})`는 기존 `EditorExtensionResult`를 반환한다. optional 계약이며 `g7.layout-editor/1` 기본 등록·텍스트·필드 명령과 기존 확장 호환을 유지한다.

- G7 소스: `extensions/compositions.ts`, `extensions/compositionDocument.ts`, `extensions/useExtensionHost.ts`. 공개 API 밖의 selection/history/registry 객체를 PB로 노출하지 않는다.
- PreviewCanvas가 실제 렌더에 쓰는 격리된 컴포넌트 목록의 manifest·존재 확인을 호스트에 전달한다. 관리자 셸 singleton을 템플릿 renderer로 간주하지 않는다.
- G7 `LayoutService`가 상속 슬롯의 부모 wrapper와 자식 route 출처를 별도로 기록한다. 자식 본문이 부모 layout 이름으로 표기되어 내보내기가 거부되던 오류를 수정했다.
- 포맷은 `g7.editor-composition/v1`; 현재 템플릿/spec/nesting/manifest 지문, 허용 구조, 출처, G7 첨부 목록, 비동기 문맥을 확인한다. 새 ID·내부 참조와 기존 history 한 건으로 적용한다.
- PB 저장소는 사용자별 스냅샷을 불변 문자열로 보관한다. G7 문서를 복제 저장·동기화하지 않으며 저장소 삭제는 페이지·첨부 삭제가 아니다. 인증/권한/소유권은 [개인 조합 API](../api-native-compositions.md), 사용 범위는 [내 조합 계약](native-compositions.md)을 따른다.
- 실제 기술 fixture는 G7 admin content API에 먼저 저장한 원본을 기준으로 PB 변경 전후를 비교했다. 기존 G7 content 요청·리소스의 associative JSON 변환은 빈 객체를 배열로 바꾸므로, G7 전체 JSON 종류 무손실을 이 시험의 성공으로 주장하지 않는다. PB 스냅샷 문자열의 `{}`/`[]` 보존은 별도 실제 저장소 시험으로 확인한다. G7 저장 자체의 종류 보존 검증·해결은 NE6 수용 감사에 남긴다.

확정 SHA와 명령·시험·runtime 파일 지문은 [NAT-04 마감 기록](../audits/2026-09-08-native-editor-ne4.md)에 기록한다. 후보가 없는 stock G7·임의 테마·운영 환경의 제공 완료를 뜻하지 않는다.
