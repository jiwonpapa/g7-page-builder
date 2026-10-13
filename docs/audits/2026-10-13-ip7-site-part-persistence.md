# IP7 공통 요소 Site Part 저장과 발행

IP7은 진행 중이다. 기준 SHA `f1f84194d212bdcc4aed944654116199bdf89e8b`에서 `ip7-site-part-persistence-20261013` task가 저장·컴파일·관리 API 연결과 관련 검사를 맡는다. 공통 `PageBuilderDocument v3` 요소를 기존 Site Part 리비전·잠금·세트 발행 경로에 연결하며 Header/Footer 전용 편집기나 블록별 렌더러는 추가하지 않는다.

## 변경 범위

- `SitePartSource`는 종류·ID·locale·버전의 읽기 전용 공통 인터페이스다. 구형 v1과 요소 v2는 각 원본을 유지한다.
- 저장 codec은 버전별 검증을 분기하며 객체와 목록을 구별한다. 일반 저장에서 버전·ID·종류·locale·v3 slug 변경을 거부한다. 기존 v1 세트 템플릿의 ID 연결 의미는 유지한다.
- 세트 생성 API의 명시적인 `schema_version=g7-page-builder/site-part/v2` 선택만 빈 요소 문서를 만든다. 기본 생성과 기존 문서 읽기는 v1 의미를 유지한다. 새 요소 세트는 자동 활성화하지 않는다.
- 새 문서는 기존 v3 페이지 compiler로 출력하고 Header/Footer 의미 요소로 감싼다. 공개 요청은 저장된 발행본만 읽는다.
- 새 요소 공통영역은 Header/Footer 세트로만 발행한다. 다른 세트 문서 혼입, 잠금 충돌, 두 번째 발행본 기록 실패는 부분 변경 없이 거부한다.

이번 변경의 `shared-contract` lease와 FULL 검증 사유는 Site Part repository 입력 계약과 관리 API의 v2 지원 추가다. G7 코어·테마 원본·migration·의존성·운영 배포·기존 문서 자동 이행은 범위에 없다. 공통 편집 화면 연결·명시 이행/복원·고정 runtime capability·최종 UX 수용은 후속 구현이다.

## 검증

초기 관련 검사에서 기존 계약/발행 단위 시험 20개·107 assertions와 새 codec/factory/compiler 시험 16개·50 assertions가 통과했다. 새 시험은 raw JSON 왕복, 객체/목록·0/false 보존, 신원과 버전 변경 거부, 구형 기록 보존, 같은 요소 compiler 출력 및 누락 capability 거부를 포함한다.

DB와 controller 검사는 임시 SQLite에서 생성·저장·재조회·리비전·세트 발행/활성화·충돌·오류 rollback·마지막 정상 발행본·과거 발행본 준비를 확인했다. 공식 제출에서는 runtime 검사를 보류했고 Local 통합에서 새 시험 10개·110 assertions를 통과했다. 이 증거는 실제 저장소/controller 동작 검증이며 새 v2 편집 화면의 사용자 조작 증거는 아니다.

## 공식 통합 결과

제출 SHA는 `da7f6d36f59610e51e1db614c6e6fbad703acffc`, 통합 SHA는 `2cbdd892ac8057b882b4724f1ce0d38226be88b1`이다. PHP 8.5.3/Node 24의 Worktree 제출 검사와 PHP 8.5.9/Node 24.19.0의 Local Docker 검사를 구분했다. 최초 정적 검사에서 공통 CompileResult의 HTML 문자열 확인 누락을 보완한 뒤 타입 검사를 통과했다. 기존 성공 입력은 공식 하네스의 재사용 판단을 따랐다.

```sh
make task-submit TASK=ip7-site-part-persistence-20261013 FULL=1
make task-integrate-scoped TASK=ip7-site-part-persistence-20261013 INTEGRATION_TASK=integration-ip7-20261012 FULL=1
```

| 검사 | 결과 |
|---|---|
| 관련 PHP 단위 | 64개 통과 |
| 관련 DB/controller 및 기존 통합 | 72개 통과, 새 Site Part 시험 10개 포함 |
| 전체 하네스 | 478개 통과 |
| 전체 PHP 단위 | 425개·5,818 assertions 통과 |
| PHP coverage 실행 | 513개·6,634 assertions 통과, 기존 PHPUnit notice 1건 |
| 프런트엔드 | 160개 파일·1,712개 시험 통과 |
| 구조·타입·빌드·자산·예산 | 통과 |
| 제품 브라우저 | PC/태블릿/모바일 49개 통과 |
| 공통 셸·모바일 메뉴 | 45개 통과 |

PHP 전체 coverage는 77.87%, compiler facade 93.68%, compiler family 89.63%, 기존 페이지 service 96.59%, 페이지 repository 94.81%로 각 기준을 통과했다. 기존 공통영역 편집·발행·세트 전환, 페이지 발행·revision 복원, 전체 카탈로그 출력, 레이아웃·접근성·100블록 성능, 공통 셸·로그아웃 회귀를 유지했다. 새 v2 문서는 같은 컴파일러의 HTML 일치를 검증했지만 브라우저의 정밀 편집·세트 미리보기와 1px 출력 비교는 화면 연결 차수에 남아 있다.

FULL 증거 경로:

```text
output/playwright/gates/integration-ip7-20261012/f4375c645e369976817667b63bfaf81ba7c9e3860376c031c119e0e1c6836d60/a3fb4a248c0e48f49f683b19dece96b8/
```

`site-part-state.json`은 `closed: true`이며 16개 세션 모두 `restored: true`다. 승인된 로컬 시험용 `sirsoft-basic` 1.1.4 전환 뒤 원래 `jwsoft-business01` 0.3.1로 복구했다. 두 테마와 번들 원본의 파일 해시 집계는 전후 모두 `92b96b54a6e26e4c9dc2fe8e0525367d9f0bdb557094af3313f7cec2f76994f6`이다.

별도 task `ip7-site-part-persistence-proof-20261013`가 이 결과와 통합 SHA를 원장에 부분 증거로 기록했다. IP7은 진행 중이며 UI 연결·명시 이행/복원·고정 runtime capability·전체 카탈로그 수용은 완료되지 않았다. 운영 배포는 하지 않았다.
