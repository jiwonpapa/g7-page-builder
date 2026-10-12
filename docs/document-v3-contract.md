# v3 정밀 문서와 스타일 계약

IP2는 새 정밀 편집의 목표 wire 계약과 독립 TS/PHP 검증을 제공한다. 현재 서비스의 v1/v2 저장·컴파일러에는 연결하지 않는다. 기존 모드를 열거나 저장해도 v3로 바뀌지 않는다. 제품 편집·변환 실행·출력은 IP3~IP9의 별도 구현 대상이다.

[세부 스펙](productization/independent-editor-spec.md) · [계획](productization/editor-plan.md) · [검증 기록](audits/2026-10-12-ip2-document-contract.md)

## 원본과 식별자

새 원본의 schema_version은 g7-page-builder/v3다. 기존 계약의 문서 ID·slug·locale·shell_mode와 노드 instance_id·type·block_version·props·slots를 유지하는 별도 버전이며 벤더 Data가 아니다. schema는 [공통 wire 명세](../schemas/page-builder-document-v3.schema.json), 의미·한도는 [공통 정책](../schemas/design-policy-v3.json)에 있다. 계약 변경은 SemVer와 새 버전/명시 이행을 따른다. 현재 모듈 버전과 기존 compiler_version은 바꾸지 않는다. 아직 v3 compiler_version이나 발행 artifact는 없다.

ID는 소문자 UUID이며 문서 안에서 노드 ID와 자산 ID는 각각 유일하다. 이름과 잠금은 영속 필드이고 선택·포커스·접힘·줌·좌표 객체·history는 세션 필드다. 잠금은 서버 권한을 대체하지 않는다. 노드의 DOM/배열 index를 영속 식별자로 쓰지 않는다.

기본 문법은 Section/Container/Heading/Text/Image/Link다. 컨테이너만 content 슬롯을 가지며 중첩은 같은 노드 문법을 쓴다. 텍스트는 문단과 typed run으로 표현하고 Tiptap HTML/JSON 자체를 원본으로 저장하지 않는다. plain text에 포함된 꺾쇠는 HTML 입력이 아니며 renderer는 반드시 이스케이프한다. 제목 level·링크 의미는 스타일과 분리한다.

이 새 primitive 문법이 기존 내장 블록 전체의 전환을 뜻하지 않는다. IP7에서 종류별 mapping/capability/미지원 진단을 추가한다. 외부 블록·알 수 없는 필드는 기존 원본에 보존하며 새 v3 검증 시 조용히 제거하지 않고 거부한다. Site Part에는 이 페이지 스키마를 강제로 적용하지 않는다.

## 값과 반응형 의미

| 값 | 고정 규칙 |
|---|---|
| 길이 | 유한 숫자, 0.01 단위. px 최대 8192, rem 최대 512, %/vw/vh 최대 1000. padding/gap/크기/반경은 음수 금지, margin/inset/자간은 명시된 signed 범위 허용 |
| 크기 | auto는 CSS 자연 크기, hug는 내용 맞춤, fill은 부모 배치가 제공하는 남은 공간. min/max는 별도 길이이며 같은 단위에서 min > max를 거부 |
| 상대 단위 | rem은 root font, vw/vh는 viewport, %는 해당 CSS 속성의 containing block 기준. 저장 시 px로 환산하지 않으며 편집/출력은 같은 layout context로 해석. 화면 줌은 저장값에 곱하지 않음 |
| Flex/Grid | 방향·wrap·정렬·grow/shrink/basis·gap, 길이/fr/minmax 트랙. 최대 24트랙/배치, fr 0.01~100. raw repeat/calc/CSS 수식은 금지 |
| 색/외형 | #RRGGBB/#RRGGBBAA 또는 6개 의미 토큰. 문서 토큰의 실값은 hex만 허용하여 순환 참조 방지. gradient 2~8개 단조 증가 stop, shadow 8개 이하, border/반경 개별 변 지원 |
| 글자 | sans/serif/mono, weight 100~900의 100 단위, typed px/rem 크기·행간·자간·서식. 글꼴 다운로드/임의 font CSS를 저장하지 않음 |
| 배치 | absolute는 relative/absolute 컨테이너의 직접 자식만 허용. 회전/inset은 absolute에만 허용. 모든 반응형 문맥에서 부모 조건 검사 |
| 자산 | 문서 assets의 UUID 참조, URL은 HTTPS 또는 단일 /로 시작하는 상대 주소. 링크에는 안전한 #fragment도 허용. 참조 제거는 파일 삭제가 아님 |

모든 수치 범위·enum·개별 단위 허용 목록은 스키마가 최종 기준이다. TS와 PHP에 숫자 테이블을 복제하지 않는다. opacity/gradient stop은 0.001, 정수·weight처럼 별도 step이 있는 값은 해당 명세를 따른다. 수치는 반올림/자동 보정하지 않고 정밀도 초과를 거부한다. 코드 내부 부동소수 오차 판정만 1e-7 tolerance를 쓴다.

base와 tablet/mobile은 동일 style 문법이다. 두 override는 각각 base를 상속하고 서로 상속하지 않는다. style의 각 property는 원자적 값이므로 border/shadow/track 내부 일부를 병합하지 않는다. 각 변이 독립 property여서 개별 reset이 가능하다. 미지정은 상속/선언 없음, 0/false/빈 alt는 명시 값, reset은 해당 override key 제거다. null을 reset으로 저장하지 않는다.

정책의 기본 display=block/position=flow/hidden=false/opacity=1은 renderer fallback 의미이며 원본에 자동 삽입하지 않는다. 나머지 미지정 속성은 선언을 만들지 않는다. effectiveStyle은 authored base와 override의 병합값을 돌려주며 browser computed style이 아니다. 실제 hug/fill·CSS 생성·상대 단위 치수 및 접근성 일치는 IP4/IP9 수용 시험에 속한다.

폭 640 미만 mobile, 640~1023 tablet, 1024 이상 base다. 트리는 공통이며 폭마다 노드를 복제하지 않는다. 모바일을 1열로 강제하지 않는다. 반응형 UI 자체는 IP6이다.

## 한도와 검증 경계

전체 노드 500, 중첩 노드 깊이 16, compact UTF-8 JSON 1 MiB, JSON 깊이 128이다. 기존 v2의 깊이 4 등 한도는 그대로 둔다. v3는 미완성 UI의 한도를 늘린 것이 아니라 별도 버전의 검증 계약이다. 100/500노드 순수 검증 예산은 로컬 동일 환경 1초 미만이며 IP1의 캔버스 준비/선택 예산과 다른 항목이다.

TS는 unknown을 받아 JSON 값·순환·유한 수·getter/벤더 객체·wire 모양·노드/자산 참조·부모 문맥을 순서대로 검사한다. PHP는 JSON object와 list를 구분해 decode하고 같은 스키마/정책을 검사한다. {}를 []로 바꾸는 coercion/default/removeAdditional은 없다. 두 언어의 스키마 해석기는 checked-in 명세에서 쓰는 제한된 keyword만 대상으로 하며 범용 JSON Schema 구현이 아니다. TS 시험은 별도 Ajv 2020으로 wire fixture를 교차 확인한다.

Node/React/Puck/G7/Laravel/DOM/HTTP는 새 도메인의 의존성이 아니다. PHP의 schema/policy 파일 로딩은 외부에서 주입한다. 기존 도메인 LayoutPolicy의 compact JSON byte 의미만 재사용한다. 구조 gate가 이 계층 경계를 검사한다.

## 명시 이행과 복구

prepareMigration은 사용자의 명시 선택과 일치하는 양의 원본 revision을 요구한다. 지원 원본 schema가 v1/v2인지와 JSON/용량을 확인한 뒤 원본 JSON 문자열을 공백·알 수 없는 필드까지 그대로 보관하는 snapshot 준비 값만 반환한다. 이 결과는 원본 유효성/변환 가능성 인증서가 아니며 candidate나 publication을 만들지 않는다.

이행 실행에는 다음 순서가 필수다.

1. 저장 포트에서 revision 재확인 후 원본 JSON과 원본 schema/compiler·자산/주소·기존 publication 연결을 복구 가능한 revision으로 보존한다.
2. IP7의 전체 block mapping이 모든 필드를 설명해야 한다. 미지원 블록·미지 필드는 진단하고 원본을 바꾸지 않는다.
3. v3 후보를 양쪽 계약으로 검증하고 초안에만 적용한다. 사용자 Undo/원본 revision 복원 경로를 제공한다.
4. IP9 저장/컴파일/원자적 발행 조건이 별도로 통과해야 publication을 교체한다. 실패/409/중단 시 원본과 마지막 정상 발행본을 유지한다.

snapshot 준비 함수에는 저장소가 주입되지 않으므로 현재 DB·revision·publication·기존 문서를 변경할 경로가 없다. 실제 snapshot 영속화·전체 mapping·Undo/복원·발행 전환은 아직 구현하지 않았으며 IP7/IP9 없이 자동 전환을 연결하면 안 된다.
