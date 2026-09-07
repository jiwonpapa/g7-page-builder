# Editor engine decision

상태: **Puck 채택 결정 유지**. 최초 결정일: 2026-08-19. 아래 후보 비교의 버전과 평가는 도입 당시 기록이며 현재 경쟁 제품의 전수 비교가 아닙니다.

2026-09-07 역할 정리: 현행 제공 범위는 [편집 정책](productization/editing-policy.md), 진행 순서·증거는 [개발 계획](productization/editor-plan.md)과 [진척 표시판](productization/editor-progress.md)을 따릅니다. 엔진 API의 존재, 제품에 연결된 기능, 실제 브라우저 검증을 서로 구분합니다.

## 결정

독립 Page Builder 편집기는 MIT 라이선스의 `@puckeditor/core`를 사용합니다. 최초 도입 버전은 `0.23.0`으로 정확히 고정합니다. G7 Layout Editor와 Tiptap 단독 구현은 사용하지 않습니다.

Puck은 드래그앤드롭, 블록 목록, 속성 필드, 중첩 slot, 복제·삭제, undo/redo, 반응형 iframe preview와 publish hook을 이미 제공합니다. Puck의 Rich Text field가 Tiptap 기반이므로 텍스트 블록에는 이것만 사용합니다.

## 후보 비교

| 후보 | 라이선스 | 장점 | 본 제품의 부담 | 판정 |
|---|---|---|---|---|
| Puck 0.23.0 | MIT | React용 완성 편집 UI, typed component config, slot, viewport | 0.x API 변경을 Adapter·Fixture로 차단해야 함 | 채택 |
| GrapesJS 0.23.5 | BSD-3-Clause | 가장 풍부한 HTML/CSS 웹 빌더 기능 | 자유형 HTML/CSS 프로젝트를 제한된 블록 문서로 변환하는 비용이 큼 | 제외 |
| Craft.js 0.2.12 | MIT | React DnD·직렬화 core | 완성 UI가 없어 패널·필드·미리보기를 직접 만들어야 함 | 제외 |
| Tiptap 3.x | MIT core | 안정적인 schema 기반 rich text | 페이지 canvas·블록 패널·responsive layout이 없음 | Rich Text 전용 |
| Editor.js 2.31.6 | Apache-2.0 | 단순 block JSON, 콘텐츠 편집에 적합 | 다단 layout·responsive canvas가 없음 | 제외 |

공식 근거:

- [Puck repository and MIT license](https://github.com/puckeditor/puck)
- [Puck 0.23.0 release](https://github.com/puckeditor/puck/releases/tag/v0.23.0)
- [Puck Data](https://puckeditor.com/docs/api-reference/data)
- [Puck Slot](https://puckeditor.com/docs/api-reference/fields/slot)
- [Puck Rich Text](https://puckeditor.com/docs/api-reference/fields/richtext)
- [GrapesJS Storage Manager](https://grapesjs.com/docs/modules/Storage.html)
- [Craft.js repository](https://github.com/prevwong/craft.js/)
- [Tiptap core concepts](https://tiptap.dev/docs/editor/core-concepts/introduction)
- [Editor.js repository](https://github.com/codex-team/editor.js)

## 종속성 차단 계약

```text
Puck type        -> 등록된 block ID/version의 편집 컴포넌트
Puck props.id    -> block.instance_id
Puck props       -> block.props
Puck slot        -> block.slots
Puck root props  -> 편집 UI 메타데이터, 원본 문서에는 허용된 값만 복사
```

- Puck type과 API는 편집 UI·EditorAdapter 경계에서 사용합니다. 현재 여러 편집 UI/변환 파일이 이 역할을 나누며, 문서 도메인과 DB/API 원본 계약은 Puck의 타입·상태에 의존하지 않습니다.
- DB와 API에는 `PageBuilderDocument`만 저장합니다.
- Puck `AppState`, selection, sidebar, history와 원시 `Data`를 저장하지 않습니다.
- 공개 페이지는 Puck `<Render>`를 로드하지 않습니다.
- 좌측 Blocks는 공개 `drawer`·`drawerItem` override로 축소 미리보기만 꾸미고, 삽입·드롭·정렬은 Puck 기본 DnD를 그대로 사용합니다.
- 상세 라이브러리의 클릭 삽입은 선택 위치와 부모/자식 규칙에 따른 보조 흐름이며 좌측 DnD와 같은 문서 명령을 사용합니다. 선택한 컨테이너가 허용하면 그 슬롯으로 삽입하며 모든 경우에 최상위 블록 뒤로 넣는 것은 아닙니다.
- 모바일·태블릿·PC 버튼은 Puck `UiState.viewports`와 공식 iframe canvas를 제어합니다. 임의 CSS 축소 화면을 반응형 검증으로 간주하지 않습니다.
- Puck Cloud, Puck AI, Tiptap Pro/Cloud는 MVP 범위 밖입니다.
- 제3자 MIT/BSD/Apache 저작권 고지는 릴리스의 `THIRD-PARTY-NOTICES`에 포함합니다.

## 인라인·문맥 편집 계약

가운데 캔버스의 선택·직접 편집 상세 계약은 [Canvas Editing Contract](canvas-editing-contract.md)를 따릅니다. 내장 블록은 공통 요소 선택 계약을 사용하고 Inspector와 문맥 도구는 허용된 필드·스타일·데이터 설정에 같은 명령을 연결합니다. 명시적인 내부 구성 UX도 기존 캔버스와 문서·Undo를 사용하며 별도 블록 편집 엔진을 만들지 않습니다.

- 모든 내장 블록의 주요 제목·설명·버튼 문구와 반복 항목의 핵심 문구는 Puck `contentEditable`로 캔버스에서 직접 편집합니다.
- Hero, 독립 Rich Text, Image + Text 본문은 Puck Rich Text field를 사용하며 Puck 내부 Tiptap 구현을 별도 직접 의존성이나 문서 원본으로 취급하지 않습니다.
- 선택 요소 가까이의 벌룬 도구에서 해당 `fieldPath`의 글꼴·크기·굵기·정렬·색상 token만 바꾸고, 주요 버튼은 G7 route 선택기, 이미지는 MediaPort 선택기를 바로 엽니다.
- route·media picker는 Puck overlay portal로 등록해 모달 조작 중 canvas selection과 적용 대상이 사라지지 않게 합니다.
- URL·이미지 대체 텍스트·반복 항목 구조·블록 배경·간격·효과는 속성 패널의 typed field로 편집합니다. 임의 font-size·class·inline style은 저장하지 않습니다.
- Slider Hero는 편집 중 자동 재생을 끄고 선택한 장면을 고정합니다. 이전·다음·점 버튼으로 장면을 바꾸며 공개 발행본에서만 Embla 반복·자동재생을 실행합니다.
- 화면용 `text-transform`이 인라인 입력값을 바꾸지 않도록 contentEditable 자식에는 변환을 적용하지 않습니다.
- Puck 상태를 저장하지 않고 인라인 변경도 즉시 `PageBuilderDocument` props로 역변환합니다.

## 전체 사이트 캔버스

- 중앙 캔버스는 문서의 `shell_mode`에 따라 Header → Page → Footer 순서로 보여줍니다.
- `template`은 활성 G7 템플릿 소유 공통영역임을 읽기 전용 placeholder로 표시하며 실제 결과는 공개 미리보기에서 확인합니다.
- `builder`는 발행된 Page Builder Site Part를 실제로 그리며 Header·Footer 편집을 선택하면 같은 작업 화면의 embedded Site Part editor로 전환합니다.
- `none`은 인트로용 Page canvas만 표시합니다. 이 구분은 G7 Layout Editor나 템플릿 파일을 수정하지 않습니다.

## 도입 및 후속 검증 기록

아래 항목은 도입 이후 누적된 지원·검증 범위의 기록입니다. 현재 HEAD의 전체 시험을 새로 실행한 결과가 아니며 새 슬롯 편집의 완료 증거로 사용하지 않습니다. 현재 실행 근거는 현행 진척 원장과 각 배치의 종료 기록에서 확인합니다.

1. 45종 제품 카탈로그와 95개 내장 프리셋의 좌측 축소 미리보기, 원하는 위치 DnD, typed 편집과 선택 block 정렬을 지원합니다.
2. Puck ↔ `PageBuilderDocument` 왕복 Fixture가 통과합니다.
3. 저장 후 reload와 Puck undo/redo 표면이 동작합니다.
4. 편집기 모바일·태블릿·PC iframe 전환과 preview/public 제품 E2E가 통과합니다.
5. Puck을 import하지 않는 PHP compiler가 같은 45종 block을 결정적으로 컴파일합니다.
6. Hero-family 경고 닫기, Hero 직접 입력, Slider 장면 선택·인라인 필드, 요소별 style token과 route 적용 후 저장·재로드를 실제 브라우저 E2E로 검사합니다. 글자 범위 편집은 합성 Selection을 금지하고 실제 포인터 드래그, 범위 툴바·요소 벌룬 상호배타, 선택 해제·반복 선택, preview/public DOM 영속성을 세 viewport에서 통과해야 합니다.

최초 채택 당시에는 100개 block 성능 측정과 nested slot을 미완료 검증으로 남겼습니다. 이후 Section·Columns·Stack과 기본 요소 5종은 canonical/Puck/서버 검증/출력으로 연결됐으므로 nested slot 전체가 미지원이라는 당시 판단은 현행 상태가 아닙니다. 기존 복합 블록 내부의 명명된 슬롯과 새 구성요소는 아직 별도 구현·검증 대상입니다. 과거 100개 block 측정 과제와 새 대표 시나리오의 성능 결과도 구분하며, 원인을 확인하지 않고 다른 엔진으로 자동 전환하지 않습니다.
