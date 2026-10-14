# DATA02 별도 재감사와 승인된 추가 수정

2026-10-14 사용자가 "DATA02에 한해 별도 재감사 후 추가 수정 1회"를 허용했습니다. 기능 확장·검사 확대·기존 문서 전환·테마/코어 수정·운영 배포 승인이 아닙니다.

## 보존과 정확 범위

- 원래 실패 후보 `e0c34b2e81317284a2d455c350a1635879e73fad`와 `editor-dynamic-elements-20261013`의 failed-implementation 기록은 그대로 보존합니다.
- 새 깨끗한 기준은 `8acf4a64e77a19381df839f72d81fe92952077a6`, 구현 task는 `editor-data02-repair-20261014`, 통합 task는 `integration-data02-repair-20261014`입니다.
- 실패 후보의 17개 파일 변경을 현재 기준에 복원합니다. 기존 CHANGELOG 항목은 보존하며 새 후속 항목을 추가합니다. 다른 제품 코드와 85개 시작 구성은 바꾸지 않습니다.
- 후보 대비 제품 로직 수정은 `DataBindings::collect`의 문자열 ID 검증 한 곳뿐입니다. 재감사/승인/상태 문서는 이 보존 후보와 후속 결과를 구별하기 위한 기록입니다.

## 원인과 추가 수정 1/1

기존 최초 실패는 `parameterByRef.type`, param-out 선언 한 번 보완 후 실패는 `paramOut.type`입니다. `stdClass`의 동적 `instance_id`를 검증 없이 배열 키로 쓰면 값이 문자열이라는 지역적 추론이 성립하지 않습니다. 선언을 늘리거나 타입을 넓히는 대신 기존 `Bindings::index`와 동일하게 `is_string`으로 확인하고 실패 시 `Schema::reject('shape')`로 거부합니다. 공통 schema의 UUID 검증·PHPStan level·타입 범위·원래 참조 인덱스 계약은 유지합니다.

승인된 추가 제품 수정은 1/1 사용했습니다. 이 수정 후 같은 문제나 새 구현 문제가 발생하면 더 수정하지 않고 별도 실패 기록으로 인계합니다.

## 검사 경계와 결과

DATA02 타입 차단은 해소했습니다. 제출 `3cb8a20d0e53a17b60392e5924f62d1b6b5fb236`, main 통합 `c8baed6cc4fbd2df1a1b735b916aa1665ff0cb9b`입니다. 실패 후보 대비 15개 제품 파일을 비교한 실제 차이는 `DataBindings::collect`의 문자열 검사 3줄뿐입니다. 85개 시작 구성과 다른 구현은 그대로 보존했습니다.

- 제출: 기존 선택 gate 145개 중 40개 통과·91개 동일 입력 성공 재사용·14개 runtime/수용 보류, returncode=0, acceptance=false.
- 통합: 같은 145개 중 32개 통과·99개 성공 재사용·14개 보류, returncode=0, acceptance=false. 입력 계약을 확정할 수 없는 기존 검사는 재사용하지 않았으며 검사 대상을 확대하지 않았습니다.
- 기존 실패 gate `phpstan:core`는 오류 없이 통과했습니다. 관련 unit/PHP·타입·구조·Pint도 통과 또는 정당한 성공 입력을 재사용했습니다. 신규 제품 시험은 추가하지 않았으므로 새 동적 기능의 모든 행위를 시험했다는 뜻이 아닙니다.
- 제출 보고서: `.git/g7pb-coordination-v1/python-checks/implementation-handoffs/editor-data02-repair-20261014/submission-a4791a81a79f413eb2a6d2a3e959b358.json`.
- 통합 보고서: `.git/g7pb-coordination-v1/python-checks/implementation-handoffs/integration-data02-repair-20261014/integration-1306df6eaedf4ab4be6876ad385493bf.json`.
- main 통합 후 runtime lease 아래 `make dev-build-assets TASK=integration-data02-repair-20261014`를 변경 입력에 한 번 실행하여 production build에 성공했습니다. fingerprint `d1a627bad10409fa9eee2654aa378959c5e2908cb53392072eee7cd82e108541`입니다. 실제 브라우저/UX 확인이나 운영 배포가 아닙니다.

이번 승인 범위의 추가 수정은 성공했으며 재발·추가 재구현은 없습니다. 과거 실패 SHA·보고서는 삭제하거나 성공 기록으로 바꾸지 않습니다.

기존 실패 후보의 선택 검사만 공식 planner로 확인하며 동일 명령/대상/의존 입력의 성공은 재사용합니다. 공유 v3 schema/policy의 기존 FULL 분류 사유만 명시하고 IMPLEMENTATION=1로 browser/runtime/full-product와 downstream 수용을 보류합니다. 새 테스트·fixture·시나리오·coverage 확대는 없습니다. 검증 계획이 이 범위를 넘으면 실행하지 않습니다.

동적 6종 실제 응답·권한·실패/빈 상태·복제 ID·저장 재열기·Undo·출력/UX 수용과 아직 구현하지 않은 검색/필터/페이지 실행 컨트롤 동등성은 기존 재감사 인계 항목입니다. 이 타입 문제 해소를 전체 편집기 완성이나 해당 컨트롤 완성으로 바꾸지 않습니다.

최종 종합 verification에서 FULL=1로 오래된 release 신뢰 기준부터 범위를 넓히는 실행은 재개하지 않습니다. 공유 schema/policy 때문에 scoped 종합 계획이 분류를 요구하더라도 검사 하네스 수정이나 전체 재검증으로 확대하지 않습니다. 이번 제출/통합의 정확한 18개 변경과 기록 후속의 문서 범위만 처리하며 전체 VERIFIED/릴리스 수용은 남깁니다.

후속 잔여 진행 결과: 이 보고서 작성 당시 미구현으로 남긴 검색/필터/페이지 조작 UI와 동적 6종 시작 데이터는 ead0f89d30c65bc2fc7c1e9ae93179e3d6888160 기준으로 소스 구현·통합했습니다. DATA02 자체를 다시 고친 것이 아닙니다. 실제 제품 수용과 공개 JS 예산 미달은 그대로 남기며 [최종 잔여 결과](2026-10-14-editor-remaining-implementation.md)에 인계합니다. 위 시점별 실패와 미구현 기록은 당시 상태로 보존합니다.
