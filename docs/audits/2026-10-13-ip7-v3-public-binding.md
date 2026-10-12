# IP7 v3 발행 포트의 서버 연결

작업: `ip7-v3-public-binding-20261013`. 기준은 공통 컴파일러 제출 `72fe64e836ad1640f3556a01a1a8105c767ffa50`다. 두 task는 서로 다른 소유 파일이며 함께 통합해야 한다.

Provider의 기존 DocumentCompilerPort binding만 스키마별 router로 연결한다. v3는 기존 저장소의 미리보기 토큰·발행 후보·원자적 활성화·revision 복원·마지막 정상 발행본 계약을 그대로 사용한다. 새 route, DB 테이블, G7 코어 수정, 자동 문서 변환은 추가하지 않는다.

기존 블록 runtime과 compiler의 초기화는 v1/v2 문서를 컴파일할 때만 발생한다. optional 카탈로그가 실패해도 v3 원본의 저장·미리보기·발행은 영향을 받지 않아야 한다.

검증 범위는 실제 Eloquent 저장소의 in-memory DB 통합 시험과 실제 Provider의 지연 binding이다. 브라우저 발행 버튼 및 활성 User Template 화면까지의 제품 수용은 별도 실행 증거가 필요하며 이 제출로 완료 처리하지 않는다. 원장·표시판은 현재 제품 진입 task 소유자에게 제출·통합 증거를 인계한다.

최초 제출 `709a9b253b766a9f7040009cc84712db72c6a172`의 공식 통합에서 SitePart 회귀 12개와 v3 생성→저장→미리보기→발행→초안 변경→재발행→revision 복원 시험은 통과했다. 새 보관 시험이 기존 archive 계약을 잘못 기대해 1건 실패했다. 기존 저장소는 보관 시 active를 해제하고 superseded 발행본을 보존한다. 제품 코드를 바꾸지 않고 활성 0개·보존된 HTML 동일성을 검사하도록 공식 replacement `ip7-v3-public-binding-archive-20261013`에서 수정한다. 최초 실패 통합은 원복됐으며 로컬 테마도 jwsoft-business01 0.3.1로 복구했다.

## 정식 통합 결과

보존 replacement 제출 `0da2e56607909025ddcd32d2405db2f177b3e141`과 compiler 제출 `72fe64e836ad1640f3556a01a1a8105c767ffa50`을 Local `79c08f50741894228eccceaf1ae9636644a0a165`로 통합했다. Docker의 G7 Provider·실제 저장소를 쓰는 in-memory 통합 시험 `StructureDocumentPersistenceTest` 5개/74 assertions 및 기존 `SitePartArtifactsTest` 12개/81 assertions가 통과했다. 세 shell의 미리보기·후보/확정·재발행·원본 revision 복원·충돌·마지막 정상 발행본·보관 보존을 확인하며, optional registry가 예외를 던져도 v3 경로는 성공한다.

관련 Site Part 브라우저 증거는 `output/playwright/gates/integration-ip7-20261012/5d3ca089a020fcbd7b95fc85650f74f7aa0cf838e1403d08706906e956ca6b79/c7d949c8c48c47f8ae6951997faa2108/`에 있다. `site-part-state.json`은 closed=true, 생성 session 1개 restored=true를 확인했다. 테마 원복·파일 해시와 공통 브라우저 증거는 [컴파일 기록](2026-10-13-ip7-v3-public-compiler.md)의 최종 통합 절을 따른다. 실제 v3 발행 UI의 합격과 전체 IP7 완료는 별도이며 미완료 상태를 유지한다.
