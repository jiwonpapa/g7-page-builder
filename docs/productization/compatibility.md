# 제품화 호환 결정 ADR-001

상태: 1차 결정, 후속 구현 대상. 이번에는 schema·제품 버전·DB를 변경하지 않습니다.

## 결정: v1 의미를 바꾸지 않고 v2 도입

현재 schema는 재귀 slots를 표현하지만 PageBuilderDocument는 v1만 받고 Puck adapter/PHP compiler는 비어 있지 않은 slots를 거부합니다. 구조형 문서와 기기별 값을 실제 지원하려면 저장·복원·Pack 호환을 함께 바꿔야 합니다. 따라서 이미 배포한 v1의 의미를 몰래 확장하지 않습니다.

- 신규 문서 계약: `g7-page-builder/v2`, schema 파일은 별도 `schemas/page-builder-document-v2.schema.json`로 추가할 예정입니다. v1 파일·fixture·reader를 유지합니다.
- v2는 기존 root blocks와 block ID/version을 보존하며 신설 layout 3종과 제한된 responsive 객체를 추가합니다.
- 3차 최소 경로가 통과하기 전에는 일반 신규 문서도 v1입니다. 4차 제품 흐름 통과 후 v2 기본 생성 전환을 통합 게이트에서 결정합니다.
- v1을 여는 것만으로 v2로 저장하지 않습니다. 최초 구조 기능 사용 시 전환 영향을 안내하고 동의한 저장에서 새 v2 revision을 만듭니다. 취소·검증 실패는 기존 draft/revision/publication을 변경하지 않습니다.
- v1 500개 root 제한과 기존 block props를 유지합니다. v2는 전체 500개 노드/slot 200개/깊이 4/compact JSON 1 MiB를 검증합니다. 전환 시 새 한도를 넘으면 v1 상태로 남깁니다.

## 버전별 책임

| 값 | 현행 근거 | 구현 시 결정 |
|---|---|---|
| document schema_version | g7-page-builder/v1 | v2 별도 reader/validator/compiler 경로 추가 |
| compiler_version | HtmlDocumentCompiler의 0.16.0 | G7 템플릿 sanitizer 안전 표식 계약을 추가했으며 v2 compiler 경로는 착수 당시 최신 버전에서 다시 결정 |
| block_version | manifest의 각 정수 | 기존 version의 의미 보존. 새 layout은 최초 1, 비호환 props 변경은 새 정수 |
| Pack manifest/품질 계약 | 각각 v1 | 편집/검증 증거 변경은 별도 버전. 구형 승인 자동 승격 금지 |
| module/package/lock | 0.30.0 | 0.y.z의 공개 계약 추가·변경이므로 후속 기능 릴리스 MINOR. 실제 번호는 version lease에서 결정 |
| G7 호환 | 모듈 지원 선언 + 공개 API 시험 | 이 개선만으로 최소 G7 버전을 올리지 않음 |

현재 HTML compiler의 target 표기는 `g7-7.0.7`입니다. 설치된 G7 7.0.8과 문자열이 다르다는 사실만으로 호환 실패나 성공을 결론내리지 않습니다. 기존 target 계약과 G7 fixture 시험을 함께 유지하며 표시 수정은 별도 영향 판단 대상입니다.

0.16.0의 출력 호환 경계는 [template-sanitizer-compatibility.md](template-sanitizer-compatibility.md)에 고정합니다. 이는 v1 문서 의미를 바꾸지 않는 발행 결과 계약 변경이며, v2 구조 기능 개방과 별개입니다.

Pack 최소 지원은 단순 설치 버전 숫자만으로 판단하지 않습니다. 새 layout/schema/필드 기능을 제공하는 editor·PHP compiler·schema가 모두 있는지 capability와 descriptor를 함께 검사합니다. 외부 Code Pack의 기존 정의는 자동 중첩 허용하지 않습니다.

## 보존·복원 표

| 상황 | 동작 |
|---|---|
| v1 읽기/단순 내용 편집 | 기존 v1 저장 경로 유지 |
| v1→v2 전환 | 복사·검증 후 새 revision, 원본 revision 불변 |
| 지원 안 되는 v2/새 block | 편집·새 저장·발행 중지, 마지막 정상 공개 HTML 유지 |
| compile/prepare 실패 | active publication pointer와 hash 불변 |
| v2 편집 후 과거 v1 복원 | 기존 복원처럼 과거 원본을 새 v1 revision으로 복사; 재발행은 별도 |
| 구버전 바이너리 rollback | v2 읽기를 보장하지 않으므로 단순 바이너리 rollback을 안전하다고 주장하지 않음 |
| 데이터 rollback 필요 | 유지보수 모드·검증된 DB/자산 백업 복원 또는 수정 버전 전진; 사용자 승인 필요 |
| v1 Pack 퇴역/카탈로그 숨김 | 기존 문서/revision/발행본의 정의·자산 보존 |

기존 SEO·slug·locale·shell mode·문서 ID·revision/CAS 값은 변환에서 빠지면 안 됩니다. `global`→`builder` 호환만 기존 정책대로 수행합니다. PageBuilderDocument와 SitePartDocument를 한 스키마로 통합하지 않습니다.

## 5차 사용자 Section 저장 경계 결정

- 소유자는 관리자 개인, 저장 내용은 Section subtree의 canonical snapshot입니다. 최초 기능은 독립 복사이며 전역 동기화가 아닙니다.
- PageBuilder 모듈 소유 `g7pb_section_patterns` 신규 저장소에 제목·분류·canonical schema/snapshot·필수 block 참조·소유자 외부 식별자를 저장할 계획입니다. 필요한 schema/index는 5차 migration lease에서 검증합니다.
- G7 사용자 테이블 직접 조회/FK를 만들지 않고 공개 인증 Adapter의 식별자와 권한 검사를 사용합니다.
- 미리보기는 재생성 가능한 결과물입니다. HTML·Puck state를 원본으로 저장하지 않습니다.
- 패턴 삭제는 목록에서 제거/보관하며 이미 삽입된 문서는 유지됩니다. 참조 중인 자산의 물리 삭제는 하지 않습니다. 물리 정리와 만료 정책은 이 차수 밖입니다.
- 사용자 패턴 저장으로 Block Pack 설치/제거/서명 정책을 우회하지 않습니다. 서버도 subtree ID·종류·크기·권한·자산 참조를 검증합니다.

## 이행 게이트

문서 v1/v2 공통 fixture, TS/PHP 허용·거부 결과, Canonical↔Puck 왕복, 과거 revision 복원, 마지막 발행본 보존이 전부 필요합니다. 배포에는 업그레이드·실패 복구 증거가 추가됩니다. 정책 문서 채택이 schema 변경·migration·배포를 실행했다는 뜻은 아닙니다.
