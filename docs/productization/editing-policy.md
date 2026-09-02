# 페이지 편집 정책: 현재 계약과 목표 요구

상태: 과거 단계별 제한과 현 구현 계약을 기록한 문서입니다. 현재는 v1 호환과 v2 중첩 문서를 함께 다루지만 UI 전체 편집 완성은 입증되지 않았습니다. 아래 제한을 목표 제품의 영구 제외 범위로 해석하지 않습니다. 설계·검증 기준은 [개발 헌법](../development-constitution.md)을 따릅니다.

## 목표 요구와 현재 한계

- 기존 완성 블록의 내부 구조 편집, 중첩 트리에서 삽입·이동·삭제·복제·Undo, 같은 명령을 사용하는 캔버스/트리/설정 연결은 목표 요구입니다.
- 현재의 typed props 중심 복합 블록, 5종 leaf와 Section/Columns/Stack 문법은 호환을 지켜야 할 현 구현 범위입니다. 이 범위만 구현하고 전체 Visual UI Editor가 완료됐다고 판정하지 않습니다.
- G7 Layout Editor의 기술 스택·설정·JSON 활용·편집창·상태 구조를 참조하되 G7 편집기/runtime/문서/저장 엔진에 의존하지 않습니다.
- 범위를 확장할 때 문서 스키마·변환·명령·저장·출력·실제 UI 시나리오를 함께 정의합니다. 이 문서 정리로 해당 기능이 구현된 것은 아닙니다.

## 제품 범위

대상은 G7 운영자·사이트 제작자입니다. 완성 섹션으로 빠르게 만들되 필요한 구역은 제한된 요소 조합으로 구성하는 편집기입니다. 자유 좌표 디자인 도구나 G7 앱/템플릿 개발 도구를 만들지 않습니다.

- 원본: PageBuilderDocument. 편집 커널: 정확한 버전의 Puck, 글자 범위: 기존 Puck/Tiptap 필드.
- 화면상 내용·링크·미디어는 기존 직접 편집 경로를 사용합니다. 구조 편집은 명시적으로 켠 모드에서만 제공합니다.
- PC host 1024px 이상 + 1280px 캔버스에서 편집합니다. 768/360px 캔버스는 읽기 전용 미리보기입니다. PC 설정 패널에서 기기별 값을 지정할 수 있습니다.
- Header/Footer는 기존 Site Part 계약을 유지합니다. 본문 중첩 정책을 Site Part schema에 암묵적으로 적용하지 않습니다.
- 현 구현에서 기존 완성 블록의 내부 열·카드·슬라이드 등은 typed props와 반복 계약 중심입니다. 독립 트리 노드로 편집하는 목표 요구는 미완료입니다.

## G7R-01·03: 편집 능력의 원본

G7의 editor-spec 개념만 참고합니다. G7 파일·내부 runtime·DSL은 사용하지 않습니다.

| 계약 정보 | 유일한 책임/확장 지점 | 소비자 |
|---|---|---|
| block ID·version·schema·compiler·필요 capability | 기존 Pack manifest와 BlockRegistry | 로딩·저장 검증·컴파일 |
| 화면 필드 경로·plain/inline-rich/block-rich/structural 구분 | canvasEditingContract | 직접 편집·Inspector·선택 도구 |
| 반복 항목 최소/최대·미디어·링크 대상 | 기존 collectionLimit 및 경로 해석 함수 | 항목 추가·삭제·이동·도구 |
| 부모/자식·slot·깊이 규칙 | 새 layoutPolicy의 버전된 선언 | Puck 설정·트리 조작·PHP 검증용 공통 fixture |
| 색상·폭·크기·정렬 등 typed 값 | BlockAppearance·fontSize·pageDesignTokens | 공통 필드·CSS·PHP 출력 |
| 기본값·데모·품질 판정 | manifest/기존 block default + 제품 품질 계약 | 새 항목 생성·카탈로그·검증 |

현재 선언을 없애고 두 번째 거대 메타데이터를 만들지 않습니다. 합성된 읽기 모델은 생성 결과이지 새 원본이 아닙니다. controls registry가 필요하면 기존 필드 구현을 역할로 연결하는 최소 registry만 둡니다. 문자열로 코드·class·handler를 실행하지 않습니다.

필드가 선언되지 않았으면 편집 UI에서 생성/변경을 허용하지 않습니다. 저장은 해당 block schema로 실행 시 검증합니다. 알려진 구조를 지원하지 못하는 상태에서 필드를 조용히 삭제해 저장하지 않습니다. 미지원 문서는 편집/발행을 중지하고 원본과 정상 발행본을 보존합니다.

## G7R-02: 현재 중첩 문법과 호환 경계

신설 ID는 `layout.section-01`, `layout.columns-01`, `layout.stack-01`, 최초 `block_version=1`로 예약합니다. 3차 구현 시 기존 registry 충돌 여부를 다시 확인합니다.

기본 leaf 허용 목록은 현재 ID `content.heading-01`, `content.rich-text-01`, `media.image-01`, `action.buttons-01`, `content.divider-01`의 5종입니다. Buttons의 자체 반복 목록은 기존 최소/최대를 유지합니다.

| 부모 | slot | 허용 자식 |
|---|---|---|
| 문서 root | blocks | 기존 v1 block 45종의 호환 인스턴스 또는 Section |
| Section | content | Columns, Stack, 기본 leaf |
| Columns | column1 / column2 / column3 중 활성 열 | Stack, 기본 leaf |
| Stack | content | 기본 leaf |
| 기본 leaf·기존 복합 블록 | 없음 | 자식 없음 |

- root에 Columns/Stack을 직접 넣지 않습니다. Section 안의 Section, Columns 안의 Columns, Stack 안의 Stack도 금지합니다.
- 최대 경로는 Section → Columns → Stack → leaf입니다. root를 제외한 노드 깊이는 4입니다.
- 열은 1/2/3열입니다. 비율은 1열 `1`, 2열 `1:1`, `1:2`, `2:1`, 3열 `1:1:1`만 허용합니다. 자유 수치 grid를 받지 않습니다.
- slot 이름은 안정적인 위치 식별자입니다. 열 순서를 바꾸더라도 노드 instance ID·내용·스타일은 보존합니다. Puck 전용 ID는 원본에 저장하지 않습니다.
- 빈 컨테이너는 합법입니다. 첫 자식 삽입과 drop 영역을 제공하며 빈 상태 안내는 발행 HTML에 출력하지 않습니다.
- 선언이 없거나 활성 열이 아닌 slot이면 삽입·이동·API 저장 모두 거부합니다.
- 3차는 Section + 2열 + Heading/RichText만 기능 입증에 개방합니다. 전체 허용표는 4차 검증 후 개방합니다.

### 내용 보존과 이력

- 자기 하위로 이동 금지. 이동은 기존 UUID, 복제/패턴 삽입은 subtree 전체 새 UUID를 사용합니다.
- 3→2열 축소는 제거될 열이 비어 있으면 즉시 처리합니다. 내용이 있으면 이동 대상과 결과를 확인한 후 제거될 열의 내용을 원래 순서대로 마지막 남은 열 끝에 합칩니다.
- 노드/slot 한도를 넘으면 작업 전체를 거부합니다. 부분 이동·자동 내용 삭제는 없습니다. 취소는 문서·선택·이력 모두 기존 상태를 유지합니다.
- 구조 삭제는 영향받는 하위 항목 수를 보여주고 확인합니다. 한 번의 이동·복제·열 변경·구역 삽입은 한 번의 Undo로 되돌립니다.

### v2 안전 한도

- 문서 전체 최대 500개 노드. root와 모든 slot의 노드를 합산하며 반복 props 항목은 해당 블록 한도로 따로 검증합니다.
- slot당 최대 200개 자식. 깊이는 위 허용표로 제한합니다.
- 원본 JSON은 compact UTF-8 직렬화 기준 1 MiB(1,048,576 bytes) 이하. 이미지 바이너리·base64는 넣지 않습니다. HTTP transport의 별도 제한을 대체하지 않습니다.
- 길이 판정용 직렬화는 불필요한 공백 없이 Unicode·슬래시를 그대로 쓰는 동일 규칙을 TS/PHP에 적용합니다. 한글·이모지·숫자·이스케이프가 포함된 공통 byte-boundary fixture로 일치를 확인하며 JS 문자 수를 byte 수로 대신하지 않습니다.
- 이 수치는 업계 표준/성능 보증이 아닌 초기 방어 한도입니다. 3차에서 TS/PHP 동일 경계 판정을 검증하고 8차에서 실제 최대 한도를 계측합니다. 올리려면 근거와 계약 변경이 필요합니다.
- v1에 새 한도를 소급 적용하지 않습니다. 한도 초과 v1의 v2 전환은 명시적으로 거부하고 v1 읽기·편집·기존 공개를 유지합니다.

## G7R-04: 반응형 상속

기존 palette/font/radius/width/scale, BlockAppearance surface/spacing/width/height/alignment를 재사용합니다. 새 레이아웃 gap은 `none`/`compact`/`normal`/`spacious`의 고정 값(0/8/16/24 CSS px)만 허용합니다. 패딩은 기존 spacing 계약을 사용하며 임의 수치 CSS 필드를 만들지 않습니다.

기기별 override는 v2의 block `responsive.tablet`/`responsive.mobile`에 허용된 layout/appearance/element 값만 저장하도록 구현합니다. 문구·미디어·링크·children·slot은 저장할 수 없습니다. 정확한 JSON Schema는 이 계약과 공통 fixture로 3~4차에 구현합니다.

- 공통값은 기존 props/appearance, 기기별 값은 override입니다. PC 전용 override는 만들지 않습니다.
- 모바일: 0~639px, 태블릿: 640~1023px, PC: 1024px 이상을 새 구조 블록의 고정 구간으로 사용합니다. 기존 복합 블록 CSS의 호환 동작은 변경하지 않습니다.
- tablet/mobile은 각각 공통값을 상속합니다. mobile이 tablet override를 연쇄 상속하지 않습니다.
- 컨트롤은 상속 출처·지정 여부·최종 적용값을 표시합니다. 초기화는 override 삭제이며 당시 공통값의 복사가 아닙니다.
- Columns는 모바일에서 기본 1열, 태블릿에서 기본 최대 2열입니다. 태블릿은 1/2열 선택, 모바일은 1열로 제한합니다. DOM·읽기·키보드 순서는 원본 순서를 유지합니다.
- 글자 크기는 기존 정규화와 실제 px 표시를 재사용합니다. 새 S/M/L 표기만으로 실제 크기를 감추지 않습니다.
- 기기별 별도 콘텐츠 트리, 순서 역전, 임의 breakpoint, 새로운 다크 편집 축은 제외합니다. 기존 페이지 테마는 유지합니다.

## G7R-06·07: 상태·기본값

- 문서, 선택 경로, 저장 요청 revision/lock은 서로 다른 책임입니다. 자동 저장 중 캔버스 전체 입력을 막지 않습니다.
- 늦은 저장 응답이 최신 문서를 덮지 않아야 합니다. 충돌은 로컬 편집을 유지한 채 서버 버전 재확인·비교/수동 해결 경로로 안내합니다. 자동 병합은 하지 않습니다.
- 저장 성공만으로 Undo 이력을 강제 삭제하지 않습니다. 문서 전환/서버 revision 교체 시 새 기준선을 설정합니다. 기존 Puck 공개 API와 저장 기능을 재사용합니다.
- 필드 미지정은 선언된 기본값, 유효한 `[]`/빈 문자열은 명시적 비우기입니다. 필수 필드의 빈 값은 오류이며 임의 샘플로 채워 숨기지 않습니다.
- 반복 항목 첫 추가는 현재 표시 중인 기본 목록과 신규 항목을 함께 저장합니다. 최소 개수가 있는 목록은 빈 배열을 허용하지 않습니다.
- 긴 문구는 CSS 잘라내기로 숨기지 않습니다. 입력 한도 초과·잘못된 URL·필수 누락은 해당 필드의 한글 안내와 수정 경로를 제공합니다.

## G7R-05·08: 프리뷰와 공개 결과

같은 원본 fixture·공통 CSS/토큰 의미를 사용해 편집 JSX와 PHP 발행 출력을 비교합니다. 두 언어의 렌더 코드를 억지로 합치지 않습니다. 샘플 데이터는 preview 전용 공급 경계에서 격리하며 G7 전역 API 교체나 실제 데이터 저장을 하지 않습니다.

내용·스타일·구조·읽기 순서가 저장/reload·preview·공개 출력에서 일치해야 합니다. editor 선택 테두리·도구·빈 컨테이너 안내만 비교 제외 대상입니다. 이미지 로딩·폰트 준비 조건을 고정하고 computed style·실제 폭·줄바꿈과 화면을 함께 검사합니다.
