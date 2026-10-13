# IP7 개발 DB의 전체 행 지문 검사

task `ip7-runtime-proof-budget-20261013`, 기준 `601d18d9b6e1ebd44dc93da22cd99f3586c7a2e6`. 범위는 읽기 전용 검증 하네스이며 제품·G7·테마·DB 값은 수정하지 않는다.

통합 검사 성공 재사용이 `runtime-proof-unavailable:JSONDecodeError`로 차단됐다. 실제 PHP 출력은 `Runtime snapshot row budget exceeded; reuse unavailable.`이었다. `SHOW TABLE STATUS`의 추정치는 전체 296,493행, 그중 `g7_seo_cache_stats` 264,058행이다. 추정치를 정확 행 수로 주장하지 않는다.

고정 20만 행 중단 대신 지문 계산에 25초와 추가 메모리 64MiB의 제한을 둔다. 외부 실행 timeout도 그대로 유지한다. 모든 테이블·모든 행의 키 정렬·PHP 직렬화·SHA-256·행 해시 정렬을 보존하며 합친 해시 문자열을 추가 생성하지 않고 순차 해시한다. 어느 예산이라도 초과하면 지문을 반환하지 않는다. 통계 테이블 제외·샘플링·데이터 삭제·기존 성공 receipt 승격은 하지 않는다.

하네스는 이전 방식과 동일 digest, 순서 독립성, 중복 행 변화, 210,001행 전체 처리와 마지막 행 변화, 시간/메모리 초과 실패, 잘못된 테이블 읽기 전 거부를 검사한다. 기존 RuntimeProof의 외부 DB/환경 변경·중단·실패·증거 누락 재사용 거부 시험은 유지한다. 기존 관측 실패 때 저장되지 않은 성공 checkpoint를 소급 생성하지 않는다.
