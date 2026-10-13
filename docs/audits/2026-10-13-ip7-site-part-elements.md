# IP7 공통 요소 기반 Site Part

착수 기준 `04ba68777a0b15dd1f68a3a0c9120b33394f7ea0`, task `ip7-site-part-elements-20261013`. IP7은 진행 중이다. 이 작업은 새 공통영역 계약과 보존 검증이며 UI·서버 저장·세트 발행 완료가 아니다.

## 계약과 연결 순서

- `site-part/v2`는 Header/Footer 소유 종류와 **기존 v3 PageBuilderDocument 하나**만 보관한다. 별도 블록 문법·편집기·Undo·렌더러를 만들지 않는다. ID·locale·요소·자산·스타일은 content가 단일 소유한다.
- 내용 문서는 공통 `StructureEditor`에 전달하고 같은 문서 명령으로 수정한 뒤 원래 Site Part에 돌려준다. 다른 문서 ID·locale·slug의 결과는 거부한다. shell은 `none`이며 페이지 SEO를 갖지 않아 셸 재귀나 페이지 설정 혼동을 막는다.
- 기존 `site-part/v1`은 그대로 보존한다. 새 계약의 validator가 구형 데이터를 읽으면서 바꾸지 않는다. API 연결 때 별도 버전 분기와 명시 전환·revision 복원을 구현한다.
- 이 작업은 새 타입·TS/PHP 공통 fixture·검증만 소유한다. 뒤이어 저장/컴파일 경계, 같은 편집 화면의 Site Part 호스트, Header/Footer 세트 미리보기·발행을 연결한다. 고정 인증/검색 등의 실행은 공통 runtime capability 작업으로 분리하고, 정적인 가짜 UI로 완료 처리하지 않는다.
- 공유 계약 task는 `shared-contract` lease 아래 제출·통합했다. 새 schema 제출/통합의 FULL 사유는 공통영역 소유 계약 추가다. 공개 CSS 용량 상한만 별도 사용자 승인 task에서 제거했으며, [정책 변경 기록](2026-10-13-ip7-public-css-budget.md)처럼 다른 자산 예산과 품질 검사는 유지했다.

## 증거 범위

양 언어의 원본 불변·거부·동일 요소 명령·출력 검증과 기존 제품의 FULL 회귀 검사를 통과했다. 새 v2 Site Part의 API·저장·편집 UI·세트 발행 연결은 아직 없으므로 해당 기능의 브라우저/서버 증거는 후속 작업에서 확보한다. 별도 소유 task `ip7-site-part-contract-proof-20261013`에서 통합 SHA와 부분 증거를 원장에 기록하며 IP7은 진행 중으로 유지한다.

## 관련 검사

초기 관련 검사에서 TS 24개, PHP 6개/66 assertions, 하네스 5개가 통과했다. PHP의 반환 배열 문서 주석 줄바꿈을 바로잡은 뒤 PHPStan·Pint·타입 검사·변경 소스 3개 구조 검사 및 task 소유 범위 검사가 통과했다. PHP에도 공통 동작 참조와 500노드 한도 검사를 추가했다. 두 언어는 같은 16개 수용/거부 fixture를 소비한다. AJV 독립 wire 검사도 같은 외부 문서 schema를 등록하며, 자산·ID·shell·SEO 의미 검사는 각 제품 validator에서 별도 검증한다.

구조 명령 검사는 이름 미등록 Header/Footer에 공통 제목 삽입·내용 변경·모바일 스타일을 한 transaction으로 적용하고 원본 불변·재직렬화·원래 content 복귀를 확인한다. 이 단위 검사만으로 브라우저 Undo 또는 서버 revision 복원을 완료 처리하지 않는다. PHP는 같은 페이지 compiler에 content를 전달한 결과와 완전히 같은 출력임을 확인한다. 실제 Site Part compiler/API 연결은 아직 남아 있다.

## 최종 통합 검증

제출 SHA는 `a581a2428334feae40401ae8a1442333619eb05d`, 통합 SHA는 `c4e31a6008fcafb5a7563af68655d9b0f5fa5d8b`다. Local integration/runtime lease 아래 다음 명령으로 검사·통합했다. 위 초기 검사 이후 보완을 포함한 최종 관련 PHP 검사는 7개/72 assertions를 통과했다.

```sh
make task-integrate-scoped TASK=ip7-site-part-elements-20261013 INTEGRATION_TASK=integration-ip7-20261012 FULL=1
```

| 검사 | 결과 |
|---|---|
| 관련 TS / PHP | 24개 / 7개·72 assertions 통과 |
| 전체 하네스 | 478개 통과 |
| PHP 기능 | 409개·5,768 assertions 통과 |
| PHP coverage 실행 | 487개·6,474 assertions 통과, 기존 PHPUnit notice 1건 |
| 프런트엔드 | 160개 파일·1,712개 시험 통과 |
| 빌드·자산·예산·구조·계획 검사 | 통과 |
| 제품 브라우저 | 49개 통과 |
| 공통 셸·모바일 내비게이션 브라우저 | 45개 통과 |

PHP coverage는 전체 77.07%, compiler facade 93.68%, compiler family 89.63%, service 96.59%, repository 94.81%로 각 기준을 통과했다. 브라우저 회귀는 기존 페이지 생성·편집·발행·revision 복원·발행 해제, 중첩 구조, 기존 Site Part, 레이아웃·접근성·100블록 성능, PC/태블릿/모바일 셸과 로그인 상태별 동작 등을 포함한다. 이는 자동 회귀 결과이며 새 v2 Site Part UI에 대한 육안 수용 감사가 아니다.

FULL 브라우저 증거 위치는 다음과 같다.

```text
output/playwright/gates/integration-ip7-20261012/1aba7ae0c057b666ac21dc72c76a2da88526276fb8934283e2324fe43eecb245/1958a4dbeb6646cb9fab7619c1e899b5/
```

`site-part-state.json`은 `closed: true`, `spec: full-product`이고 16개 세션 모두 `restored: true`다. 승인된 로컬 시험 동안만 `sirsoft-basic` 1.1.4를 활성화했으며 종료 시 `jwsoft-business01` 0.3.1로 복구했다. 두 테마와 번들 원본의 전체 파일 해시 집계는 전후 모두 `92b96b54a6e26e4c9dc2fe8e0525367d9f0bdb557094af3313f7cec2f76994f6`이다. 운영 배포·G7 코어 변경·기존 문서 자동 전환은 실행하지 않았다.

남은 범위는 v2 Site Part 저장/API/컴파일 분기, 동일 공통 편집 화면 연결, Header/Footer 세트 미리보기·발행, 명시 이행·revision 복원, 보호 runtime capability와 IP7 전체 수용 검사다. 계약 통합만으로 이 범위를 완료 처리하지 않는다.
