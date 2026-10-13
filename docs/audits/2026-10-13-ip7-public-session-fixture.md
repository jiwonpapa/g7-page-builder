# IP7 공개 런타임의 CSRF 세션 fixture 보완

task `ip7-public-session-fixture-20261013`, 기준 `effc89d40cd547391ee9ce68b92e6bea8430f996`. 제품 구현이나 보안 기준 변경이 아니라, 승인된 문의 세션 갱신 경로를 기존 모의 서비스에 반영하는 2파일 작업이다.

공통 폼 통합 후보는 설치형 39개, 독립 편집기 270개, 보존 구조·테마 6개, 모바일 탐색 9개를 통과했다. 이어진 `publicRuntimeLifecycle.spec.ts`에서 모의 경로 목록에 `GET /sanctum/csrf-cookie`가 없어 문의 사례 1개가 실패했다(다른 3개 통과). 실제 제품 실패로 덮거나 실제 서비스로 우회하지 않는다.

실패 증거: `output/playwright/gates/integration-ip7-20261012/a6eb4bfd11d06644b661960af436bcd4ab2dbdd2c0aa742c36284e782099a443/a9d0e670b4654712b98a4618913703f9/results.json`. 원 통합은 원복됐으며 로컬 테마도 JW 0.3.1로 복구됐다. G7 `composer.lock` 및 `AppServiceProvider.php`의 사전·사후 해시는 일치한다.

정확한 모의 CSRF 경로만 추가한다. 매 명시적 제출마다 인코딩한 새 XSRF 쿠키를 반환하고 GET→POST→GET→POST 순서, 정확히 2회 제출, 디코딩한 새 토큰과 오래된 meta 토큰 미사용을 검사한다. 503 이후 입력 유지·재시도 성공·다른 폼 무변경·폼 값·예상 밖 요청 차단·런타임 오류 0 검사는 유지한다.

제출의 수집/타입 검사는 실제 브라우저 성공이 아니다. 통합에서 실패 gate 및 downstream을 재검증하고 같은 입력의 기존 성공 증거를 재사용한다. IP7 전체 또는 배포 완료를 주장하지 않는다.
