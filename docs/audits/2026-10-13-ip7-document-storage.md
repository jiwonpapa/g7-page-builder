# IP7 공통 요소 문서의 실제 저장 연결

IP7은 진행 중이다. 이번 범위는 블록 카탈로그 없이 만든 v3 원본을 기존 인증 API·문서 저장소·리비전에 연결하는 것이다. 실제 편집 화면 전환과 v3 공개 출력은 아직 완료되지 않았다. API로 준비한 요소 트리를 UI에서 작성했다고 보고하지 않는다.

## 구현과 통합 경계

- 불변 v3 값과 버전별 저장 codec·빈 문서 생성기는 `b920648fce082894308d0bd045a1a95be0208b18`에 통합했다. v1/v2는 기존 읽기/쓰기 정책을 유지하고 v3의 빈 객체·목록·false·0을 구별한다.
- 프런트 저장 어댑터는 제출 `7e19b05c4482b82d149dfebebce2ebb6ec674f1f`, 통합 `c0ff7aa77c877682fc7792cbe49f5a871b24e276`다. 기존 인증·오류 전송을 재사용하며 서버 `lock_version`을 CAS 토큰으로 사용한다. 문서 revision과 혼동하지 않고, 저장 중 새 입력이나 바뀐 세션을 응답으로 덮지 않는다. 관련 기존 lifecycle 1개와 독립 v3 브라우저 87개가 통과했다. 이때 v3 시험은 주입 저장 포트이며 실제 DB 저장 증거는 아니었다.
- 서버는 `PageDocument` 읽기 계약 뒤에서 기존 `PageBuilderDocument`와 검증된 v3 값을 사용한다. 새 영속 포맷·저장 테이블·블록별 편집기를 추가하지 않는다. 저장·메타데이터 변경·복제·리비전 조회/복원은 같은 저장소와 트랜잭션을 사용한다.
- `schema_version=g7-page-builder/v3`를 명시해야 빈 v3 문서를 생성한다. 기존 생성 요청은 v1을 유지한다. 일반 초안 저장에서 v1/v2와 v3 사이의 변경은 거부하며 사용자 원본을 자동 이행하지 않는다.
- v3 초안 요청은 원본 JSON으로 검증하여 `{}`와 `[]`를 보존한다. URL 문서 ID와 본문의 ID가 다르면 거부한다. SEO 생략 시 기존 설정을 보존하며, 메타데이터 변경이 요소·자산·반응형 트리를 평문화하지 않는다. PHP·TS는 같은 선택적 SEO 스키마와 공유 사례를 검사한다.
- 빈 문서 생성·저장에서는 기존 블록 registry/컴파일러를 해석하지 않는다. 컴파일러는 출력 요청에서만 지연 해석한다. 기존 컴파일러는 v3 출력을 지원한다고 가장하지 않고 거부한다. v3를 기존 Page Kit으로 손실 변환해 내보내지도 않는다.

## 제출 및 실패 보존

24개 정확 파일을 `shared-contract` lease로 소유했다. 스키마와 기본 디자인 정책이 바뀌므로 제출·통합에 `FULL=1`을 명시했다. 일반 scoped 제출의 공유 계약 범위 오류와 Pint 형식 오류를 수정했으며 합격 기준은 바꾸지 않았다.

원 제출은 `71f004f406bec521266bc3caa045b5d457cd7bc4`다. 첫 통합은 새 E2E의 JSON 정적 import가 Node 24에서 import attribute를 요구하여 수집 단계에서 실패했다. Local은 원복했고 제품 동작 실패로 합산하지 않았다. 실패 증거는 `output/playwright/gates/integration-ip7-20261012/87a42231c3a0e8bfd58a97f39e47a3eff11f5d33c643972dcdfc8174bbfab8fc/8bc234868bfd46a781bd1d5e136c1944/`에 보존한다.

별도 clean worktree에서 공식 `task-replace-submitted`로 같은 PATHS·AREAS·PROFILE을 상속했다. 원 제출과 worktree는 superseded 이력으로 보존했다. 교체 task는 `ip7-server-storage-fix-20261013`, 제출은 `a5c00b060c7f824028444f562e894ded1aa619c0`다. 제품 소스는 동일하며 E2E fixture 로딩만 Node ESM에 맞게 수정했다. 세 프로젝트 수집 검사 후 재제출했다.

## 현재 확보한 동작 증거

- PHP 관련 단위 시험 42개·168개 단언이 통과했다. 빈 v3 생성/저장 시 컴파일러 미해석, 출력 요청의 지연 해석 재사용, 메타데이터 원본 불변과 잘못된 값의 거부를 포함한다.
- 실제 Eloquent 저장소와 모듈 migration을 SQLite 메모리 DB에 연결한 `StructureDocumentPersistenceTest` 3개·31개 단언이 통과했다. 새로운 저장소 인스턴스의 재조회, SEO 보존, 복제, 명시적 리비전 복원, stale lock, 세대 간 일반 저장 거부, Controller의 원본 JSON 검증을 확인했다. 이후 공식 Docker 통합에서도 이 파일과 기존 관련 G7 통합 시험들이 통과했다.
- 설치된 G7 인증 API의 `structureDocumentPersistence.spec.ts`는 desktop/tablet/mobile 세 프로젝트 **3개 통과, 10.8초**다. 빈 문서 생성 → 미등록 이름의 요소 트리 저장 → 새 HTTP 클라이언트 조회 → SEO/언어/shell 변경 → SEO 생략 저장 → 409/잘못된 ID/잘못된 map 거부 → 원본 불변 → revision 2의 명시적 복원을 확인했다. 편집 UI 조작 시험은 아니다.
- API 증거: `output/playwright/gates/integration-ip7-20261012/5f93769857fde829d6a456ac8df5bcec4a03982c726322a46295781ab75e37ce/dbfda6b5ebb84197b281afc149d9e254/`. `persistent-round-trip` 첨부에 각 원본/응답과 리비전 목록을 보존한다. 각 시험이 생성한 정확 ID·slug의 문서만 휴지통으로 이동하여 복구 가능하게 유지했고 영구 삭제하지 않았다.

공식 `make task-integrate-scoped TASK=ip7-server-storage-fix-20261013 INTEGRATION_TASK=integration-ip7-20261012 FULL=1`은 종료 코드 0으로 통과했다. 최종 Local 통합 SHA는 `a2d7abfcddd67d0daf2212231aeb5b8486197d16`이며 통합 후 Local은 clean이다.

- 전체 PHP 471개·5,056개 단언, 별도 G7 PHP 76개·663개 단언이 통과했다. 각 실행에 기존 PHPUnit notice 1건이 있으며 notice 없음으로 보고하지 않는다. PHP line coverage는 전체 76.86%, PageBuilderService 96.59%, 저장소 94.81%로 기존 하한을 유지했다.
- 전체 프런트 품질·production build·asset manifest·번들 용량 검사가 통과했다. 기존 제품 브라우저 49개(9.3분), Site Shell·모바일 내비게이션 45개(1.7분)가 통과했다. 기존 100블록 성능 통과를 새 v3의 100/500노드 최종 수용으로 대신하지 않는다.
- Site Part 복구 원장은 `output/playwright/gates/integration-ip7-20261012/e5335faa47f7f86886fb811f1791b0dbc3180a8aa2f718ee8019f4e565bd0016/13c95ebfbc634e85b6e5c57f1290917b/site-part-state.json`이다. 종료·세션 복구 상태를 확인했으며 기존 공통영역을 변경한 채 남기지 않았다.
- 기존 승인 범위의 테마 임시 전환 후 EXIT trap이 `jwsoft-business01` 0.3.1을 ACTIVE, `sirsoft-basic` 1.1.4를 INACTIVE로 복구했다. 두 테마 관련 1,667개 파일의 전후 해시는 모두 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`로 같다.

## 다음 필수 작업

1. 인증 후 문서 버전에 맞는 실제 편집 번들을 선택하고, 빈 v3 문서에서 공통 요소 작성·저장·재열기를 UI로 검증한다. 기존 v1/v2 편집 경로는 보존한다. 공개 view에서 인증 전에 원본을 조회하여 번들을 선택하지 않는다.
2. 같은 문서 명령·Puck 이력·저장 주체를 유지하며 미디어와 사용자 구성, 미저장/충돌/복구 흐름을 연결한다. 새로운 카드·배너 이름별 편집기 분기는 추가하지 않는다.
3. v3 전체 반응형 공개 compiler와 preview/public 연결, PB Site Part, 명시 이행 및 IP8~IP10의 나머지 수용 조건을 충족한다. 초안 fragment 렌더만으로 발행을 완료 처리하지 않는다.

G7 코어·템플릿 원본·운영 서버는 수정하지 않는다. 현재 로컬 runtime의 `APP_VERSION=7.0.11` 증거를 G7 7.1 검증으로 확대하지 않는다.
