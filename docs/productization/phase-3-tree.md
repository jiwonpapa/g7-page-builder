# 3-A1 · 문서 트리와 공통 구조 정책

2026-08-31. 기준 SHA `259e6953aa0c307850fbbb7556b6f3bca53f9d9e`.

## 범위와 판정

사용자의 남은 차수 연속 추진·자동 커밋 지시에 따른 독립 준비 배치입니다. 2차의 미통합 공개 CSS를 가져오거나 선행 조건이 충족됐다고 판정하지 않습니다. **이 배치는 순수 구조 모듈이며, v2 API·편집·발행 기능은 아직 개방하지 않습니다.** 3-A의 기존 어댑터 추출과 3-B/3-C의 수직 기능은 남아 있습니다.

- 요구사항: G7R-02, 구조 이동·복제·삭제·열 축소의 데이터 보존, TS/PHP 구조 판정 일치.
- task: `productization-phase3a-tree-20260831`, `mixed`, `shared-contract` 독점 lease.
- 소유 범위: 새 TS 정책/트리 2개, PHP 정책 1개, 정책 JSON, 공통 fixture, TS/PHP 시험, v2 품질 증거의 영향 digest, 이 기록·추진 README·Unreleased.
- 재사용: 기존 `PageBuilderBlock` 형태와 45개 root 호환 ID. Puck DnD·selection·history 엔진을 새로 만들지 않습니다.
- 바꾸지 않음: v1 schema, 기존 PageBuilderDocument 생성/저장/컴파일러, Puck 화면, Site Part, G7, 기존 CSS task, 제품·compiler 버전, DB, 운영 서버.

## 계약

`schemas/layout-policy-v1.json`에 허용 자식 그룹, 구조 ID, 45개 호환 ID, 5개 leaf, 열 비율·방어 한도를 고정합니다. TS/PHP는 같은 선언과 `tests/Fixtures/layout-policy-cases.json`을 읽습니다. PHP Domain은 정책을 주입받으며 G7/Laravel·파일시스템을 참조하지 않습니다.

- Section → Columns → Stack → leaf까지만 허용합니다. root Columns/Stack·중첩 복합 블록·미선언/비활성 slot·중복 UUID는 거부합니다.
- 전체 500개 노드, slot당 200개, 깊이 4, compact UTF-8 1MiB입니다. 한글·이모지·슬래시·이스케이프·지수 표기 수치의 byte fixture를 공유합니다.
- 이동은 ID·props·반응형 값·문서 metadata를 보존합니다. 같은 slot 이동의 index는 원본 제거 이후 위치입니다.
- 복제는 모든 하위 ID를 재발급하고 중복/잘못된 ID 생성 시 결과 전체를 거부합니다.
- 구조 삭제와 내용 있는 열 축소는 영향 노드 수를 반환합니다. 확인 전 원본 문서 참조를 유지합니다. 실제 선택·Undo 묶음은 후속 Puck 연결 책임입니다.
- 열 축소는 사라지는 열을 순서대로 마지막 남는 열 끝에 합칩니다. 한도 초과는 확인 전에 거부하고 부분 삭제하지 않습니다.

이 정책 모듈은 구조만 검사합니다. 문서 envelope, 각 블록 props, 반응형 허용 필드의 완전한 JSON Schema 검증을 대체하지 않습니다. PHP associative decoding은 빈 JSON object/list를 구분하지 못하므로 후속 v2 API는 원본 JSON shape 검증을 별도로 연결해야 합니다. 숫자 byte 정규화는 크기 판정용이며 저장 원본 직렬화를 교체하지 않습니다.

## 검증 기록

- 시험 먼저 작성: TS 모듈 미존재로 suite 실패, PHP 클래스 미존재로 5개 오류를 확인한 뒤 구현했습니다.
- 초기 34개 TS 사례 중 수치 byte fixture가 53으로 잘못 작성된 1개 실패를 확인했습니다. 실제 compact JSON `[1,1.5,0,1e-7,0.000001,100000000000000000000,1e+21]`은 51 bytes이며 TS/PHP가 동일합니다. 기대값을 51로 교정했습니다.
- 정확히 1MiB 문자열 시험에서 PHP 정규식의 반복 한도 실패를 발견하고 문자열 chunk를 possessive 반복으로 처리하도록 수정했습니다. 한도 자체를 올리거나 JSON 오류를 무시하지 않았습니다.
- 새 모듈 집중 시험: TS 39 PASS. lines/functions 100%, statements 99.37%, branches 98.30%; 기존 어댑터 하한보다 높은 CLI 하한 검사 통과.
- PHP 집중 시험: 7 PASS, 269 assertions. 공통 fixture·바이트·노드/slot/문서 크기·입력 실패와 전체 부모×자식 판정 표를 검사합니다. JSON 정수 `1`과 `1.0`도 같은 구조 판정을 하되 원본 값을 바꾸지 않습니다.
- 최종 방어 사례 2개/정수 표기 시험 추가 전 전체 `npm run check`: 39 files / 377 PASS, 14.41초. production build·CSS lint·아키텍처·자산·bundle budget·현재 renderer 기준 썸네일 검사를 통과했습니다. `composer check`: PHP 140 PASS, 2,119 assertions, PHPStan/Pint 통과. 최종 제출/통합 profile은 추가 사례까지 다시 실행합니다.
- 품질 증거는 기존 객체와 비교해 render/editing source digest만 바뀌었음을 검사한 후 갱신했습니다. content/rights와 모든 결정 및 과거 원장은 동일하며 560 pending·release ready=false를 유지합니다.
- 전체 profile·제출·통합 결과는 아래 실행 완료 기록과 Git/coordination SHA를 함께 확인합니다. focused 시험을 브라우저 기능 합격으로 집계하지 않습니다.

## 보류된 선행 조건과 승인 목록

2차 `rich-boundary-20260831` 통합을 현재 main에서 재시도했습니다. merge 사전 검사는 통과했지만 최신 CSS에 대한 기존 썸네일 source 140개가 stale하여 frontend gate가 실패했고, harness가 병합을 취소했습니다. Local HEAD는 기준 SHA로 보존됐으며 `make dev-build-assets`로 ignored dist도 기존 main으로 다시 빌드했습니다.

기존 CSS task는 `resources/css/page-builder-public.css`만 소유합니다. 해당 task의 replacement는 동일 PATHS/AREAS/PROFILE을 상속해야 하므로 썸네일·증거 원장을 임의로 추가하지 않습니다. 증거 갱신을 포함한 정식 작업 범위 조정이 필요하며, 사용자의 지시대로 최종 승인 목록에 모읍니다. 썸네일 검사 삭제·과거 승인 재사용·lease 강제 해제로 해결하지 않습니다.

사람의 콘텐츠/권리/시각 승인 560개는 pending을 유지합니다. 실제 운영 배포·릴리스 승인도 수행하지 않습니다. 중첩 편집·저장·발행·복원 및 4~8차 완료로 보고하지 않습니다.
