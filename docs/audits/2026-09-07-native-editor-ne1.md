# NE1 마감 — 공개 연동 계약과 원본 보존

상태: **NE1/NAT-01 완료 · 로컬 통합·동작 검증 완료**. 운영 배포와 stock G7/upstream 지원 완료를 뜻하지 않는다.

## 구현 및 커밋

| 저장소/범위 | 커밋 | 결과 |
|---|---|---|
| G7 공개 호스트 후보 | `9260d521ab3d69761a428b3d1c54df1297ecf6eb` | engine-v1.65.0의 공개 패널·문맥·명령과 소비 UI |
| PB 빌드 계획 하네스 | `3bc8d80dd1e9f88c709204d07c196c728c8b82b4` | native 빌드 입력 분류, PC 브라우저 범위 |
| PB NE1 구현 | `b39de138d563d384dd3c92fe701f76f88ff16e87` | 공개 adapter, 별도 entry, 평문 편집 패널, 로더·검증 |
| PB 제품 통합 | `e075b8149ce9b73d7397a9eaa89ea0c867979bb4` | scoped 통합과 실제 브라우저 gate 통과 |

G7 기준은 `fde750cede7fda68329cea42fb706a00d4546bd3`이며 별도 branch `codex/native-editor-host-ne1-20260907`에 후보를 보존한다. 검증 템플릿은 `sirsoft-basic` 1.1.3, 일반 라우트 `/e2e-sandbox`, G7 소유 JSON `e2e_sandbox`다. 운영 템플릿·페이지를 수정하지 않고 G7 공식 시험 시드에 한정해 API로 내용을 준비했으며 시험 뒤 원문을 복원했다.

## H01~H04 구현

- **H01 문맥**: template/layout/editMode/session/revision/lockVersion/readonly/node ID/ComponentPath를 전달한다. 문서 전환·재로드의 세션 교체와 로컬 변경/Undo/Redo의 revision을 구별한다. NodeEditor/Widget/CanvasOverlay에는 선택형 extensionHost를 제공한다.
- **H02 경로**: 기존 문자열을 실제 ComponentPath로 검증·변환한다. responsive 경로를 보존하고 잘못된 경로·가상 iteration 경로가 루트 삽입으로 바뀌는 것을 거부한다.
- **H03 명령**: 호스트가 최신 선택·문서·출처·잠금을 다시 확인한다. 성공한 변경만 기존 문서 셀과 history에 반영하며 오래된 요청, readonly, 보호 출처, 반복 조상, 중복 ID/금지 자식은 변경 없이 거부한다. 편집기 unmount 뒤 남은 callback도 무효다.
- **H04 패널**: `registerPanel` 등록·교체·해제·ready 큐와 실제 React 소비 UI가 있다. 불변 선택 snapshot을 읽을 수 있으며 guarded text/child 명령만 제공한다. mutable store·별도 저장 엔진을 공개하지 않는다.

PB는 `g7.layout-editor/1`을 런타임 검증하고 native domain/port/adapter를 분리한다. 새 번들은 G7의 React/ReactDOM/JSX runtime을 공유한다. bundle inventory에 Puck/Tiptap/React 사본이 없으며 native JS gzip 약 2.18KB로 8KB 상한 이내다. 공개 계약이 없는 호스트에는 이 패널을 로드하지 않는다.

v1 편집 범위는 route 소유 평문과 nesting이 허용하는 basic 자식 삽입이다. 일반 사용자가 이용하는 이번 UI는 평문 편집까지다. 스타일·미디어는 NE2, 반복/동적 요소/조합 내부 구조는 NE3 이후 범위이며 이 제한을 영구 제외 정책으로 만들지 않았다. 기존 G7 native 저장은 공개 반영 의미를 그대로 유지한다.

## 검증 결과

| 증거 | 실행 결과 |
|---|---|
| G7 호스트 단위/기존 문서·이력 회귀 | 관련 67개 통과. 최초 관련 5개 파일 66개, 이후 unmount 거부 1개 추가와 변경 파일 29개 재확인 |
| PB native 원본/adapter/React 패널 | 42개 통과 |
| 구조 하네스 | 28개 통과, 기존 구조 부채 상한 확대 없음 |
| PB 타입·스타일·빌드·asset inventory | strict typecheck, scoped 구조, CSS, production build/manifest/budget 통과 |
| **NAT-01 실제 일반 페이지** | PC 1개 통과. 선택 손잡이 → 문구 적용 → Undo → Redo → G7 저장 → 재열기, 서버 JSON에서 수정 외 차이 **0**, pageerror **0** |
| 기존 공개 페이지 | PC/태블릿/모바일 접근성·시각 회귀 3개 통과 |
| 기존 공개 runtime | 데이터·문의/컨트롤·슬라이더/모션·셸 4개 통과 |

NAT-01 실행은 약 9.2초였다. 원본의 ID, unknown node metadata, responsive 설정, 형제 번역 참조/actions 및 페이지 골격을 서버 GET으로 다시 비교했다. readonly·세션/경로 변경·반복·보호 출처의 거부는 호스트 단위 시험으로 확인했다. 이들을 운영 브라우저 시험으로 확대해서 보고하지 않는다.

G7 새 extension 소스의 타입 진단은 없으나 기존 의존 코드의 strict 진단이 남아 있다. G7 전체 strict typecheck 통과라고 주장하지 않으며 NE6 호환·회귀에서 해당 기준선을 구별해야 한다. PHP 기능/API 구현은 변경하지 않았다.

## 실행 증거와 재검증 범위

- 통합 명령: `make task-integrate-scoped TASK=native-ne1-browser-fix-20260907 INTEGRATION_TASK=native-ne1-host-integration-20260907`.
- NAT-01 원시 증거: `output/playwright/gates/native-ne1-host-integration-20260907/3cdb46b59ea584ad110eaea1b8679291de0312f0deeb2b96e6eff75482449636/f83630695d2d49beb8e2eba89ab35aa4`.
- 재열기 화면: `output/playwright/gates/native-ne1-host-integration-20260907/3cdb46b59ea584ad110eaea1b8679291de0312f0deeb2b96e6eff75482449636/f83630695d2d49beb8e2eba89ab35aa4/results/nativeEditorContract-nativ-44e65-t-Undo-Redo-save-and-reopen-desktop/native-ne1-reopened.png`. SHA256 `8d18d589607a69d25221f0909e112b616ac18957ddcfffae39200fc0d9772ce5`.
- G7 후보 JS 2개의 이전 파일과 SHA는 `.runtime/audits/native-ne1-host-runtime-backup-20260907/manifest.json`에 보존했다. 로컬 runtime에만 설치했다.
- 첫 브라우저 실패는 G7 드래그 손잡이 뒤의 텍스트 DOM 직접 클릭이었다. 실제 손잡이 클릭으로 수정하고 실패한 브라우저와 downstream을 이어 실행했다. 이전 성공 검사는 입력이 같은 경우 재사용했다.
- 옛 foundation/active/submitted worktree는 정상 superseded/integrated 기록으로 보존했다. lease를 강제로 해제하거나 PATHS를 몰래 늘리지 않았다.

## 차수 경계

기반만 있던 이전 기록은 `native-ne1-foundation-20260907`의 역사다. 이번 NE1은 실제 host·PB 통합 및 NAT-01까지 마감했다. **다음은 NE2 내용·스타일·미디어 편집**, **마지막은 NE6 호환·회귀·릴리스**다. 커밋은 로컬이며 push·운영 배포는 이번 차수에서 실행하지 않았다.
