# Block Pack contract

상태: implementation baseline
계약 버전: `g7pb-block-pack/v1`

## 결론

블록 인스턴스, 블록 정의, 프리셋, 설치 패키지는 서로 다른 생명주기를 가집니다. 페이지에서 블록을 삭제하는 동작은 문서만 변경하며, Block Pack 비활성화·제거와 연결하지 않습니다.

기본 제품의 35개 블록과 18개 실무 프리셋은 `jiwonpapa/builtin-core` 내장 Pack으로 제공합니다. 이 중 G7 최근 게시글·상품 그리드·콘텐츠 아카이브·상품 쇼케이스는 공개 API endpoint와 노출 대상을 typed props로만 저장합니다. 외부 Data Preset Pack은 실행 코드 없이 기존 블록의 props를 복사하며, 외부 Code Pack은 서명·신뢰 발행자·버전 병존 계약을 통과할 때만 로드합니다.

## 용어

| 용어 | 의미 |
|---|---|
| Block instance | `PageBuilderDocument.blocks[]`에 저장된 실제 페이지 구성 요소 |
| Block definition | block ID·version의 schema, editor component, compiler를 연결하는 실행 계약 |
| Block preset | 이미 등록된 block definition에 복사할 기본 props와 카탈로그 메타데이터 |
| Data Preset Pack | JSON·썸네일만 포함하고 새 실행 코드를 등록하지 않는 패키지 |
| Code Pack | 새 block definition과 사전 빌드 editor/PHP compiler/CSS를 제공하는 신뢰 패키지 |

## 식별자와 버전

- Pack은 `publisher/name` 형식의 `pack_id`와 SemVer `pack_version`으로 식별합니다.
- `pack_id`의 publisher namespace와 `publisher.id`는 반드시 일치합니다.
- Block은 안정적인 `block_id`와 정수 `block_version`으로 식별합니다.
- Preset은 Pack 내부에서 안정적인 `preset_id`를 사용합니다.
- Pack 업데이트는 기존 Block version의 의미를 바꾸지 않습니다. 호환되지 않는 props 변경은 새 `block_version`을 추가합니다.
- 문서에는 Pack version을 저장하지 않습니다. 문서의 `block_id + block_version`을 Registry가 현재 활성 구현으로 해석합니다.

## 패키지 상태

```text
staged -> enabled <-> disabled -> retired
   |         |           |
   +---------+-----------+-> quarantined
```

- `staged`: 다운로드와 해시 검증은 끝났지만 아직 Registry에 노출하지 않은 상태
- `enabled`: 새 블록 추가·편집·컴파일에 사용 가능한 상태
- `disabled`: 새 추가 목록에서는 숨기지만 기존 문서용 구현은 유지하는 상태
- `retired`: 새 추가와 재활성화를 막지만 참조 중인 과거 version을 보존하는 상태
- `quarantined`: 검증·호환성·파일 무결성 실패로 로드하지 않는 상태
- 물리 제거는 모든 문서·리비전에서 해당 Pack의 block definition 참조가 0일 때만 허용합니다.

## Manifest v1

Manifest는 `schemas/block-pack-manifest.schema.json`으로 검증합니다.

- `kind=data`는 `presets`만 제공하며 `blocks`와 `runtime`을 선언할 수 없습니다.
- `kind=code`는 하나 이상의 `blocks`와 신뢰된 runtime provider를 선언합니다.
- label·description은 최소 한국어를 포함합니다.
- 모든 패키지 파일은 Pack 상대경로와 SHA-256을 기록합니다. Manifest와 detached signature는 자기 해시 목록에서 제외합니다.
- runtime 문자열은 manifest가 임의 코드를 실행하는 지시가 아닙니다. 신뢰된 `BlockPackProvider`가 등록한 키와 일치할 때만 활성화합니다.

## Application contracts

- `BlockRegistry`: 활성 Pack의 definition·preset을 충돌 없이 조회합니다.
- `BlockPackRepository`: 설치본·상태·출처·digest를 저장합니다.
- `BlockPackReleaseSourcePort`: GitHub Release 같은 외부 소스의 버전과 아카이브를 조회합니다.
- `BlockFavoritePort`: 관리자별 block ID 즐겨찾기를 저장합니다.
- `BlockUsagePort`: 문서·리비전 참조를 집계하고 물리 제거 가능 여부를 판정합니다.
- `BlockPackProvider`: 신뢰 Code Pack의 manifest와 compiler/editor 등록 키를 제공합니다.

Domain·Application·Contracts는 GitHub, Laravel, G7 구현을 import하지 않습니다. GitHub source와 G7 persistence/API는 각각 Infrastructure Adapter로 둡니다.

## 설치·업데이트

```text
release 조회
  -> SemVer·호환성 선택
  -> 임시 파일 다운로드
  -> 크기·파일 수·ZIP 경로 검사
  -> manifest·SHA-256·서명 검증
  -> manifest와 provider의 compiler·schema·editor descriptor 일치 검사
  -> staged 저장
  -> 원자적 디렉터리 전환
  -> Registry enable
```

- GitHub `releases/latest` 값을 자동 설치하지 않습니다. Release 목록을 자체 SemVer·호환성 규칙으로 선택합니다.
- GitHub 조회는 draft·prerelease를 제외하고, exact ZIP asset 이름·GitHub SHA-256 digest·크기를 모두 확인합니다. Release의 SemVer와 설치 ZIP manifest의 `pack_version`이 정확히 같아야 하며, 확인과 설치는 별도 관리자 동작입니다.
- public 요청과 editor 초기 로드에서는 외부 네트워크를 호출하지 않습니다.
- 고객 서버에서 Node·npm·Vite를 실행하지 않습니다. Code Pack editor/CSS는 사전 빌드 결과를 포함합니다.
- 업데이트는 새 Pack version을 나란히 설치한 뒤 검증에 성공해야 활성 version을 교체합니다.
- 같은 `block_id + block_version`의 정의는 업데이트에서 바꿀 수 없습니다. 사용 중인 과거 block version을 새 Pack이 누락하면 활성 전환을 거부합니다.
- 기존 문서 마이그레이션은 복사본에서 단방향으로 수행하고 성공 전 원본과 마지막 정상 발행본을 유지합니다.

## Code Pack 신뢰와 런타임

- `manifest.sig`는 원본 `manifest.json` bytes에 대한 detached Ed25519 signature입니다.
- 운영자는 `config/block-packs.php`에 `key_id => { publisher_id, public_key }`를 명시합니다. 키는 지정한 publisher namespace에만 유효합니다.
- PHP provider, editor IIFE, CSS와 block schema·thumbnail 파일은 모두 manifest digest 목록에 있어야 합니다.
- provider는 `BlockPackProvider`만 반환하며 manifest에 선언한 compiler와 schema validator를 정확히 등록해야 합니다.
- editor IIFE는 `window.G7PageBuilderBlockPacks.register(...)`로 정확한 Pack identity와 component를 등록합니다. 내장 component 덮어쓰기, 중복 component, 미선언 component는 거부합니다.
- editor JS/CSS는 설치된 파일을 자체 module route로만 로드합니다. 공개 페이지에는 서버가 컴파일한 HTML과 해당 Pack의 self-hosted CSS만 사용하며 Code Pack editor JS를 로드하지 않습니다.
- Code Pack은 신뢰된 PHP·브라우저 코드를 실행하는 고권한 확장입니다. Data Preset Pack과 같은 무코드 신뢰 등급으로 취급하지 않습니다.

## 제거와 즐겨찾기

- 블록 인스턴스 삭제는 Puck 편집 동작이며 Pack 상태를 바꾸지 않습니다.
- 즐겨찾기는 stable block ID 기준의 관리자 개인 설정입니다. 문서와 Pack manifest에 기록하지 않습니다.
- 비활성화는 새 추가만 막고 기존 문서의 편집·재컴파일 호환 구현을 유지합니다.
- 사용 중인 Pack 제거 요청은 `G7PB_BLOCK_PACK_IN_USE`로 거부하고 문서·리비전 참조 수를 반환합니다.
- Data Preset Pack 제거는 기존 문서에 복사된 props를 변경하지 않습니다.

## 실패 원칙

- 알 수 없는 block ID/version은 저장·편집·신규 발행을 fail-closed합니다.
- Code Pack compiler가 없거나 checksum이 바뀌면 해당 Pack을 격리합니다.
- Pack 실패는 다른 Pack과 기존 active publication을 변경하지 않습니다.
- 물리 파일 교체 실패는 직전 활성 Pack 디렉터리와 Registry snapshot으로 롤백합니다.
