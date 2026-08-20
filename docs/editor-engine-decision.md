# Editor engine decision

상태: Accepted
기준일: 2026-08-19

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
Puck type        -> BlockPreset.id
Puck props.id    -> block.instance_id
Puck props       -> block.props
Puck slot        -> block.slots
Puck root props  -> 편집 UI 메타데이터, 원본 문서에는 허용된 값만 복사
```

- `PuckEditorAdapter`만 Puck type을 import합니다.
- DB와 API에는 `PageBuilderDocument`만 저장합니다.
- Puck `AppState`, selection, sidebar, history와 원시 `Data`를 저장하지 않습니다.
- 공개 페이지는 Puck `<Render>`를 로드하지 않습니다.
- 좌측 Blocks는 공개 `drawer`·`drawerItem` override로 축소 미리보기만 꾸미고, 삽입·드롭·정렬은 Puck 기본 DnD를 그대로 사용합니다.
- 상세 `전체 미리보기`는 선택한 block 바로 뒤에 삽입하는 보조 흐름이며 좌측 DnD를 대체하지 않습니다.
- 모바일·태블릿·PC 버튼은 Puck `UiState.viewports`와 공식 iframe canvas를 제어합니다. 임의 CSS 축소 화면을 반응형 검증으로 간주하지 않습니다.
- Puck Cloud, Puck AI, Tiptap Pro/Cloud는 MVP 범위 밖입니다.
- 제3자 MIT/BSD/Apache 저작권 고지는 릴리스의 `THIRD-PARTY-NOTICES`에 포함합니다.

## 인라인 편집 계약

- Hero·분할 Hero의 보조 문구·제목·본문·버튼 문구와 Slider Hero 각 장면의 보조 문구·제목·본문·버튼 문구는 Puck `contentEditable`로 캔버스에서 직접 편집합니다.
- Hero 본문만 Puck Rich Text field를 사용하며 Puck 내부 Tiptap 구현을 별도 직접 의존성이나 문서 원본으로 취급하지 않습니다.
- URL·이미지·대체 텍스트·슬라이드 구조·배경·간격·효과는 속성 패널에서 typed field로 편집합니다.
- Slider Hero는 편집 중 자동 재생을 끄고 선택한 장면을 고정합니다. 이전·다음·점 버튼으로 장면을 바꾸며 공개 발행본에서만 Embla 반복·자동재생을 실행합니다.
- 화면용 `text-transform`이 인라인 입력값을 바꾸지 않도록 contentEditable 자식에는 변환을 적용하지 않습니다.
- Puck 상태를 저장하지 않고 인라인 변경도 즉시 `PageBuilderDocument` props로 역변환합니다.

## 도입 검증 상태

첫 수직 slice에서 확인한 항목:

1. 12종 테스트 카탈로그의 좌측 축소 미리보기, 원하는 위치 DnD, typed 편집과 선택 block 정렬을 지원합니다.
2. Puck ↔ `PageBuilderDocument` 왕복 Fixture가 통과합니다.
3. 저장 후 reload와 Puck undo/redo 표면이 동작합니다.
4. 편집기 모바일·태블릿·PC iframe 전환과 preview/public 제품 E2E가 통과합니다.
5. Puck을 import하지 않는 PHP compiler가 같은 14종 block을 결정적으로 컴파일합니다.
6. Hero-family 경고 닫기, Hero 직접 입력, Slider 장면 선택·인라인 필드와 저장 후 원문 보존을 실제 브라우저 E2E로 검사합니다.

아직 남은 채택 검증은 100개 block 성능 측정과 nested slot입니다. 현재 nested slot은 Adapter와 compiler에서 fail-closed하며, 이 두 항목이 실제 제품 요구가 될 때 기준을 통과하지 못하면 다른 엔진으로 자동 전환하지 않고 원인을 기록한 뒤 결정을 다시 엽니다.
