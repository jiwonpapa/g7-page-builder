# IP7 공개 문의 세션 복구

범위: 공통 공개 문의 runtime의 제출 전 CSRF 준비. 문서·문의 API·인증/검증 미들웨어·G7 코어는 변경하지 않는다.

## 재현

2026-10-13 Local `601d18d`, G7 7.1.0에서 새로 만든 소유 v3 독립 페이지로 검사했다. 빈 페이지의 기존 meta 토큰으로 잘못된 문의를 보내면 422였으나, 실제 `page-effects.iife.js`가 비회원 `/api/auth/user`를 조회한 401 이후 같은 요청은 419였다. 공식 `/sanctum/csrf-cookie` 204 뒤 갱신된 XSRF cookie로 보내면 다시 422였다. 문의 레코드는 생성하지 않았고 진단용 문서는 공식 API로 보관 처리했다. 토큰·쿠키 값은 기록하지 않았다.

이는 다른 채팅의 런타임 갱신과 별개로 현재 로컬에서 재현한 세션 문제다. 외부 갱신 중 수집한 화면 폭 증거를 이 문제의 근거로 사용하지 않는다.

## 변경

- 제출 전 공식 CSRF endpoint를 호출하고 반환된 cookie를 사용한다. 과거 페이지 meta 토큰으로 되돌아가지 않는다.
- 준비 실패는 입력을 보존하고 오류를 표시한다. 실제 POST는 한 번만 보내며 419를 자동 재시도하지 않는다.
- 준비/제출 중 중복 클릭, 폐기/교체된 폼의 늦은 응답, 제출 뒤 새로 쓴 입력 보호를 유지한다.

검증 결과는 task 제출 및 Local 실제 통합 시험 후 별도로 판정한다. 이 기록 자체는 제품 E2E 성공이 아니다.

## 동일 공개 폼 재렌더의 미전송 입력 보존

공식 통합 시도 `ded5c2e4321a9d9b895df301ccc46906b5fe82fa676fee6bace1a3b733026668/d13b80e00eb2469bb25af978825e96f8`의 installed browser 결과는 38/39였다. 실패는 mobile/template 문의 폼의 이름 값 보존 assertion이다. `common-form-visitor-trace.zip`에서 mount 2의 이름 길이 5 입력(1264ms) 이후 mount 3으로 교체(1272ms)되며 길이 0이 되는 것을 확인했다. 테스트의 재입력·재시도 없이 재현했으며, 실패 통합은 원복되고 활성 테마도 JW로 복구됐다.

보완은 PB 공개 문의 runtime에만 적용한다. 페이지 URL·동작 주소·소유 block ID·전체 원본 폼 markup이 같은 즉시 DOM 교체에서 미전송 입력만 넘긴다. React의 같은 HTML 재렌더도 실제 public observer/hydration 경로로 검증한다. 새 원본/주소/중복 식별/명시 dispose/다음 event-loop turn에는 값을 넘기지 않으며, 미일치 snapshot은 해당 checkpoint 종료 시 폐기한다. hidden token·password는 복사하지 않고 CSRF 준비 및 실제 POST는 기존 단일 요청 계약을 유지한다. 진행 중 제출을 자동 재전송하거나 새 폼에 늦은 응답을 적용하지 않는다.

`ip7-inquiry-live-handoff-20261013` 기준은 helper 제출 SHA `20ac0336bc67f4e8a1987e6f98b34794dd2ca4f8`이며 기존 세션 task를 공식 보존 교체한다. Node 24에서 `npx vitest run tests/Unit/publicInquiryForms.test.ts tests/Unit/publicInquiryContinuity.test.tsx --reporter=dot` 35개와 `npm run typecheck`가 통과했다. 실제 installed browser의 수정 후 결과는 아직 없으며, 이 단위 시험으로 IP7 완료 또는 테마 호환 완료를 선언하지 않는다. 테마·G7 코어 파일 변경은 없다.
