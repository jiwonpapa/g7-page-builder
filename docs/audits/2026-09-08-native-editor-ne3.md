# NE3 — 내부 트리·반복·동적 요소 편집 마감

NAT-03: **로컬 구현·통합·실제 브라우저/공개 runtime 검증 통과**. 현행 6차 계획의 3차이며 stock G7 지원·G7 main/upstream 반영·운영 배포와 구분한다.

## 코드 기준과 소유권

| 구분 | 검증 기준 |
|---|---|
| PB 차수 시작 | `9d21eab1c3430bd8655aabecadde2b2bb978d190` |
| PB 구조 편집 제출 / 통합 | `c80de8203d60687fa5205d74b8340e03928b1b32` / `6b765c5cb5c0473f6a386c62d5933286f8811a06` |
| PB 첨부 URL 수정 제출 / 통합 | `373d09347367e792b884e65880c7d0cf246bf1ea` / `5f97a35b735d4e0277d4eb883db8410a45e49225` |
| PB companion 최종 제출 / 통합 | `85fb7f8c4a1421f857b4b316109d7d11d4179bb9` / `9530e96a07acb9cfc749e5aac4c7c7c5824eb7be` |
| G7 NE2 기준 | `c9e59a55223dadb039d9e20fb0726623d25619b1`, engine-v1.66.0 |
| G7 NE3 최종 후보 | `da064086eacf9071afb81fa703121b9c69a4c89c`, engine-v1.67.0 |
| 실측 환경 | 로컬 `g7pb-dev`, `https://g7pb.test`, Node 24.19.0 / PHP 8.5.9, Chromium desktop 1600×1000 / 공개 mobile 390×844 |
| 실측 템플릿 | sirsoft-basic 1.1.3 `/e2e-sandbox`; 소유 표식이 있는 기술 검증 전용 `jiwonpapa-native_lab` `/native-lab` |

G7은 별도 `codex/native-editor-structure-ne3-20260907` 후보에 커밋했다. PB는 `adapters/gnuboard7`에서 공개 snapshot/명령만 소비한다. 원본 JSON·선택·트리·history·미리보기·저장은 G7 소유이며 기존 독립 PB/Puck 원본과 동기화하지 않는다. G7 private import/registry/런타임으로 우회하지 않는다.

## 구현과 실제 동작

| 기능 | 구현 경계와 확인한 결과 |
|---|---|
| 내부 children | 선택된 노드의 허용 위치에 삽입·위/아래 이동·다른 허용 부모로 이동·복제·삭제. 현재 nesting/palette와 출처를 다시 검증하고 한 명령을 한 history에 반영 |
| prop 트리·반복 배열 | 일반 children, 선언된 children prop, 기존 responsive 분기, array/array-group/array-cell-tree를 별도 collection으로 처리. 기본 배열/셀은 첫 편집 때 구체화하고 원본의 다른 필드를 보존 |
| ID·참조·권한 | 신규 표준 ID 발급과 알려진 내부 DOM 참조 재연결. 기존 source 보존, 외부 참조가 남는 삭제·불명확한 ID 바인딩·다른 출처·오래된 문맥·허용하지 않은 위치·순환 이동 거부 |
| 반복 템플릿 | G7의 기존 반복 템플릿 편집 모드에서 자식만 변경. source/item/index/바인딩 원문과 바깥 문서 보존. static data source와 `state.items`/`_local.items` 두 실물 JSON 형태에서 편집→저장→재열기→공개 반복 출력 확인 |
| 배열 이미지 | 기존 인증 첨부 API로 업로드→명시적 목록 선택→src 변경. caption/이미지와 배열 이동·복제·삭제를 같은 구조 명령으로 처리 |
| 동적 Slider | 템플릿 companion의 실제 IIFE/manifest/spec으로 연결. 편집 중 모든 항목 표시·자동재생 중지, 공개에서는 자동재생·이전/다음·Home/End/좌우 키·포커스/포인터 정지·비활성 탭 정지·reduced-motion·수명 해제 |

H05는 템플릿 manifest/IIFE export, H06은 이름 충돌 없는 새 capability/control/palette, H07은 실제 배열 collection 필드/미디어 명령으로 충족했다. 모듈 manifest나 widget 등록만으로 모든 템플릿에 renderer가 등록된다고 주장하지 않는다. 템플릿 제작자가 companion을 명시적으로 패키징해야 하며 설치된 사용자 템플릿에 자동 주입하지 않는다. 편집기 asset API가 실제 찾는 `dist/js/components.iife.js`·`dist/css/components.css`에 포함해야 한다.

### 브라우저에서 발견하여 수정한 결함

1. G7 첨부 API의 같은 사이트 절대 URL이 일반 component JSON의 `NoExternalUrls` 저장 검사에 거부됐다. PB media adapter가 같은 origin의 첨부 URL만 경로로 적용하도록 수정했다. 다른 origin·credential·network-path URL의 의미는 바꾸지 않으며 G7 서버 검사를 약화하지 않았다.
2. 공개 TemplateApp은 `state`를 초기화하지만 편집 PreviewCanvas는 layout 로컬 기본값을 반영하지 않아 `_local.items` 반복이 나타나지 않았다. 호스트 미리보기의 기본값 병합과 기존 한 항목 편집 제한 연결을 수정했다. 기존 키가 이기고 일반 노드 변경마다 상태를 재초기화하지 않는다. 소스를 다른 형태로 바꿔 시험을 통과시킨 것이 아니라 두 원본 형태를 각각 통과시켰다.

## 검증 결과

| 검사 | 명령/대상 | 결과 |
|---|---|---|
| PB 구조 단위 | Vitest `tests/Unit/nativeStructure.test.tsx` | 9 통과 |
| PB 첨부 단위 | Vitest `tests/Unit/nativeMedia.test.tsx` | 8 통과; 취소/문맥/URL 경계 포함 |
| PB Slider 단위 | Vitest `tests/Unit/nativeSlider.test.tsx` | 7 통과; 렌더·키보드·타이머/이벤트 해제·감속·비활성 탭·항목 삭제 포함 |
| G7 구조 단위 | Vitest `layout-editor/__tests__/hooks/extensionStructure.test.tsx` | 17 통과; 표준 ID/참조/출처·기본 셀·그룹·responsive·순환/readonly/stale/반복 거부 포함 |
| G7 초기 상태·기존 반복 | Vitest `previewLocalDefaults.test.ts`, `guestOnlySeed.test.ts`, `iterationSampleLimit.test.ts` | 3개 파일 14 통과 |
| PB 제출·통합 | `make task-submit`, `make task-integrate-scoped` | strict TypeScript·관련 단위·구조·CSS·빌드/asset·실제 브라우저 gate 통과 |
| G7 편집기 build | Node 24 `NODE_ENV=production npm run build:core-editor` | 최종 후보 빌드 및 번들 커밋; 로컬 후보이며 NE6 배포 산출물 검사는 별도 |
| G7 동일 범위 타입 비교 | G7 tsconfig 옵션으로 `useExtensionHost.ts`와 `PreviewCanvas.tsx` 및 import graph를 NE2/NE3에 동일 적용 | 기준 60 / 현재 60, 추가 진단 0. 전체 G7 strict 통과는 아님 |
| 정식 기본 브라우저 | `tests/E2E/nativeEditorContract.spec.ts`, desktop | 3개 통과, 39.6초; 구조 및 NE1/NE2 회귀 |
| 정식 companion 브라우저 | `tests/E2E/nativeSliderContract.spec.ts`, desktop | 2개 통과, 1.1분; static data source / local state 각각 실동작 확인 |
| 번들 경계 | native editor 8KB / companion renderer 4KB gzip 각각 검사 | native 약 6.45KB, companion 약 1.43KB. React/Puck/Tiptap 재번들 없음 |

기본 브라우저는 삽입·이동·복제·삭제→Undo/Redo→저장→재열기와 전체 JSON 비교를 수행했다. companion 브라우저는 배열/셀/반복의 각 변경 후 저장 원본을 독립 예상과 비교하고 미지 필드와 수정 밖 구조의 보존을 확인한다. 공개에서는 실제 slider 재생·키보드와 모바일 reduced-motion/수동 이동·수평 넘침을 확인했다. 두 브라우저 시나리오의 pageerror는 모두 0이다. API 응답을 모킹한 성공 판정을 사용하지 않는다.

G7 전체 tsconfig로 실행한 넓은 검사에는 기존 진단이 남아 있다. 초기 확장 전용 19건, 확대된 동일 의존 그래프 60건, 전체 소스/테스트의 1,577건을 서로 증감으로 비교하지 않는다. 최종 유효 비교는 `g7-scoped-types-result.json`의 동일 설정·동일 루트·동일 의존성에서 60→60이며, 잘못된 범위 비교 기록은 `valid:false`로 명시했다. 기존 G7 전체 타입 부채 해소나 전 저장소 무오류를 이번 합격으로 주장하지 않는다.

### 증거와 복원

- 기본 브라우저: `output/playwright/gates/native-ne3-integration-20260907/0e0637243a1c9ef9af6d1fa9ac8980fce85e5d0826ae2e2f07b6b5021ecce0a9/dd92c4767c5547beb672246dbad645dd/`.
- Companion 브라우저: `output/playwright/gates/native-ne3-integration-20260907/c5336346d56fc1e9fde00966bcd004d9ef393d076a70efedf8df1e4a227c5be8/59a871ce4ffc40a7ad4d1487c62f69db/`.
- 실제 saved JSON·무손실 비교·pageerror·runtime 검증 항목은 `NAT-03-native-storage-and-runtime` 첨부에 기록한다. `native-ne3-iteration.png`, `native-ne3-public-desktop.png`, `native-ne3-public-mobile.png`는 실제 캔버스/공개 출력이다. 모바일 캡처에서 줄바꿈·수동 이동·감속 상태와 넘침 없는 출력을 확인했다. 디자인 상품 품질 합격용 그림이 아니다.
- G7 명령/타입/build 증거: `.runtime/audits/native-ne3-evidence-20260907/`. runtime 편집기 번들 교체는 `.runtime/audits/native-ne3-runtime-backup-20260907/manifest.json`의 이전 digest를 먼저 확인했다. 기존 runtime Git tree를 초기화하지 않았다.
- 기본 시험의 `/e2e-sandbox` 원본은 복원한다. Companion의 활성 템플릿은 시험별 `native-ne3-lab-activation.json`에 이전 값과 복원 결과를 남기며 `finally`에서 원래 활성 `sirsoft-basic`으로 복원한다. 시험이 만든 첨부 ID만 정상 G7 삭제 API로 정리한다. 소유 표식이 있는 비활성 기술 템플릿 파일과 실패 증거는 보존한다.
- PB 실패 제출·교체 worktree는 정식 superseded 이력으로 보존했다. Docker 실행의 최초 기록 경로가 `/var/www/audits`를 가리켜 권한 오류를 일으킨 하네스 문제는 Playwright의 시험별 output 경로로 수정했다. 제품 실패를 skip 처리하지 않았다.
- helper 소유 경로와 companion build controller가 관련 검사를 선택하도록 하네스 통합 `890c1e1afbb0f03b69fe38a7456b8c33d225edd1`, `68147dc0b92aad9ec77705208c02d6427101e35b`를 기록했다. 성공한 동일 입력 gate는 재사용하고 수정된 입력·실패 downstream만 다시 실행한다.

## 남은 범위

표준 `id` 외에 선언 의미가 확인되지 않은 식별자, 알 수 없는 ID 바인딩, 보호된 상속/삽입 영역, 다른 배열 계약 간 이동은 안전하게 거부한다. 모든 사용자 컴포넌트·템플릿에 같은 구조 편집이 된다는 의미가 아니다. 지원하지 않은 구조를 영구 제외하거나 완료로 집계하지 않는다.

G7 기존 Save는 history를 초기화한다. Undo/Redo 증거는 저장 전 구조 명령에 해당하며 저장 경계를 넘는 Undo를 주장하지 않는다. 반복 편집 전체 페이지 캡처에서는 호스트 상단 도구모음과 상세 패널 일부가 겹친다. 동작 시험을 시각 UX 완료로 바꾸지 않으며 NE5의 패널·도구모음 배치 검토 대상으로 남긴다. arbitrary class/CSS/raw HTML/JS 필드·원본 이중 저장을 추가하지 않았다. 콘텐츠/킷/판매 테마 증설과 전체 콘텐츠 감사는 하지 않았다.

**다음 차수는 NE4 사용자 조합 저장과 재삽입**이다. 그 뒤 NE5 삽입·설정·미리보기·저장 흐름을 연결한다. **마지막은 NE6 호환·회귀·릴리스**로 실제 동시 저장·지원 조합·권한/장애 복구와 승인된 push·배포·운영 재열기 증거를 마감한다. 이번 차수에서는 push·운영 배포를 수행하지 않았다.
