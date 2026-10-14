# IP7 동적 데이터·새 Header/Footer 제한 재감사

2026-10-14 · 부분 성공·목록 표시 결함 미해결 · IP7/제품 전체 수용 미완료

## 결과와 범위

승인된 다음 범위인 동적 6종과 새 Header/Footer만 확인했습니다. 기존 Site Part desktop 시험 2건은 첫 실행 통과했습니다. 동적 6종은 실제 편집 UI의 삽입·연결·저장·재열기·공개 미리보기·명시 발행까지 확인했지만, 작성된 inline display가 목록의 hidden 상태를 덮어 검색/분류/페이지 표시가 잘못됩니다. 표시 문제의 1회 보완이 기존 정리 불변식 시험에서 실패하여 후보를 동결했습니다. **동적 목록 UI/UX 합격이나 IP7 완료로 처리하지 않습니다.**

새 E2E spec/시나리오, 전체 E2E·coverage, 기존 문서 전환, G7 코어/테마 변경, 온라인 서버 변경은 하지 않았습니다. 통과한 Header/Footer 시험과 이전 기본 흐름 4건을 다시 실행하지 않았습니다.

## Header/Footer: 기존 2건 첫 실행 통과

기준 4eff6d58584afc5b85723466a9954c1f9df942cd, Local integration/runtime lease integration-ip7-dynamic-parts-20261014, g7pb-dev Docker / https://g7pb.test. 기존 build fingerprint c40bc65e2098c72632e40701e2409dc3a7efcb0fbdb76fffc4acc62f7c45ac7d를 재사용했습니다.

tests/E2E/structureSitePartProduct.spec.ts의 기존 desktop 2건만 workers=1, retries=0, max-failures=1로 실행했습니다.

| 기존 시험 | 첫 실행 결과 | 확인 범위 |
|---|---|---|
| generic Site Parts preserve separate histories save reopen preview and atomic publication at three widths | 통과, 42.6초 | 새 Header/Footer의 독립 이력·저장·재열기·쌍 발행·사이트 적용, 1280/768/360px 출력/스타일·1 CSS px 기준 |
| generic Site Part save conflicts and delayed responses preserve current input and block publication | 통과, 13.0초 | 409/지연 저장 뒤 현재 입력 보호와 발행 차단 |

브라우저 JSON duration 56.214342초, expected=2/unexpected=0/skipped=0/flaky=0. 실행 wrapper 포함 57.529초입니다. 제품 수정 0회, fixture restore 반환값 0, journal closed=true, 두 session restored=true입니다. 원래 활성 세트 포인터를 복구했고 시험 소유 세트 4개는 비활성으로 보존했습니다. 기존 Site Part를 변환하거나 삭제하지 않았습니다.

증거 디렉터리:

```text
output/playwright/gates/integration-ip7-dynamic-parts-20261014/
3bb6f900868f1d9499f49b3c0cebde47335ebb429b1b236f1be7bc2bba352864/
b3970424f22e4d4bbafed20d5961ece6/
```

results.json SHA256: 513a9a8da3e440fc668842a31af01a47f5b80cd60f17d3857b2132e923108df7. execution.json과 site-part-state.json을 함께 보존합니다. report/data의 preview-1280 캡처 bc16947ddb9b02af71d0f4347354f294567ac366.png와 public-360 캡처 6780995e1056fb15016dc1496e6183d165d08c19.png를 직접 열어 공통영역과 모바일 경계의 가림/잘림이 없는 것을 확인했습니다. 아래 출력 수정 전 기준의 시험이며 새 기준에서 재실행한 것으로 표시하지 않습니다.

## 동적 6종: 실제 UI 작성과 부분 출력

Playwright CLI의 별도 로컬 Chrome session ip7-dynamic-20261014를 사용했습니다. 사용자의 온라인 로그인 탭은 조작하지 않았습니다. API로 문서를 주입하거나 응답을 mock하지 않고 구성 선택→구성 삽입으로 6개를 작성했습니다.

- 시험 소유 ID a63b9060-d8c1-4c9d-a20c-729549bcbc70, slug g7pb-data-audit-20261014-0115, 제목 동적 6종 제한 재감사, shell_mode=none.
- 저장/재조회 HTTP 200, root 6개·노드 85개·고유 ID 85개. 6개 데이터 Inspector의 원천/필드/목록과 상세 구분을 확인했습니다.
- 최근 게시글 개수 12→6 적용, Undo→12, Redo→6, UI 저장을 확인했습니다.
- 기존 로컬 게시글 inquiries/42와 상품 JW-STABLE-20260901을 상세 Inspector에 연결했습니다. G7 게시글·상품 원본은 만들거나 변경하지 않았습니다.
- DATA03을 1회 보완·통합한 뒤 실패했던 공개 미리보기 준비부터만 재개했습니다. 실제 UI의 명시 확인창에서 발행하고 공개 링크를 열었습니다.

| 연결 | 미리보기/공개 로드 항목 | 상태 |
|---|---:|---|
| posts | 6 | 실제 응답 렌더, 빈 오류 안내 없음 |
| post-archive | 12 | 실제 응답 렌더, 빈 오류 안내 없음 |
| post-detail | 1 | 실제 게시글 렌더 |
| products | 1 | 실제 상품 렌더 |
| product-showcase | 1 | 실제 인기 상품 렌더 |
| product-detail | 1 | 실제 상품 상세 렌더 |

두 화면 모두 data-ready=true 6개, 중복 DOM ID 0개, 분리한 원형 wrapper 자식 0개였습니다. 목록의 **로드 수이지 페이지당 표시 수의 합격 증거가 아닙니다.** posts의 4~6번째 및 archive의 5~12번째는 hidden=true인데 computed display=flex·높이 420.703125/514.6875px로 여전히 보였습니다(DATA04). 이후 검색·분류·페이지 UX 성공을 주장하거나 추가 감사로 확대하지 않았습니다. 상품은 로컬 데이터가 1개뿐이므로 다중 상품 페이지 동작의 증거도 아닙니다. template/builder 동적 출력·권한/빈/오류/충돌 행렬은 미실행입니다.

발행 확인한 로컬 주소는 /pages/g7pb-data-audit-20261014-0115입니다. 종료 시 정확한 제목·slug·ID를 확인한 뒤 문서함의 보관 확인 UI로 이 문서만 보관했습니다. HTTP 200, status=archived, lock_version=7, archived_at=2026-10-14T01:32:05+00:00. 공개 해제되며 문서/리비전은 복원 가능합니다. purge나 기존 사용자 문서 변경은 없습니다.

## 실패와 1회 보완 제한

| ID | 원인 | 1회 보완/결과 | 현재 상태 |
|---|---|---|---|
| DATA03 | 공통 DataMarkup의 template 태그가 기존 TemplateMarkupPolicy에 차단됨 | 허용되는 hidden div로 출력, publicHydration 전에 분리·캐시하고 공통 경로에서 복제. 관련 검사 및 실패 단계 이후 실제 미리보기/발행 성공 | main 통합, 이 원인 해소 |
| DATA04 | 공통 pagination이 hidden만 설정하여 작성된 inline display가 숨김을 덮음 | 원래 display 복구를 추가했으나 dispose 시 DOM 동결 불변식을 깨뜨려 기존 publicArchiveControls 시험 2/3 실패 | 1회 소진, 후보 동결·main 제외, 제품 결함 미해결 |

DATA03 제출 6922b1e877bc89b73f95316ecce63cd7a0e21d96 / 통합 3a60b05ef33c4df596c8897851ddb63605b49e22. DataMarkup.php, publicDataTemplates.ts, publicHydration.ts, 기존 publicDataRuntime/DocumentV3Compiler 시험, CHANGELOG.md의 정확 6파일입니다. 블록별 코드나 G7 sanitizer 완화는 없습니다. 원형은 컨트롤/임베드 실행 전에 분리하고 재요청에 재사용합니다. 관련 PHP/TS·타입·구조·Pint·PHPStan은 성공했습니다. 선택된 자동 브라우저/runtime 검사는 IMPLEMENTATION=1로 미실행 인계했으며 위 실제 수동 흐름만 별도 근거로 삼습니다. 전체 acceptance=false입니다.

변경 자산은 runtime lease 아래 한 번 빌드했습니다. fingerprint acf91fde23f79e2c5d76ad3bc5fc4c72005275f813e79387f0697a9dfc580d45. DATA04 후보는 빌드/런타임/배포에 넣지 않았습니다.

DATA04 보존 SHA 32e65372c9f7bcfe248ae80afc1f3409b3035b86, branch codex/ip7-dynamic-parts-report-20261014, worktree /Users/neojins/.codex/worktrees/ip7-inquiry-live-handoff/g7-page-builder. 공식 preserve-failed로 failed-implementation 이력을 만들었고 삭제·강제 lease 해제·재제출·통합하지 않았습니다. 실제 실패 보고서:

```text
.git/g7pb-coordination-v1/python-checks/implementation-handoffs/
ip7-data-visibility-fix-20261014/submission-1ccc3f922d184fe880a10ffca14580e2.json
```

기존 publicArchiveControls.test.ts의 두 실패는 dispose 전후 outerHTML 불일치입니다. 후보가 hidden은 남긴 채 display만 복원한 것이 원인입니다. 기존 assertion을 바꾸지 않았으며 두 번째 수정이나 실패 시험 재실행은 없습니다. 별도 재감사에서 표시·재요청·정리 시 DOM 보존을 함께 다뤄야 합니다.

## 캡처와 실행 보조 문제

output/playwright 아래 파일과 SHA256:

- ip7-dynamic-template-failure-20261014.png: 8e10c6242ab2f7dae99d053092098d615486c29723335984e4898391c92b5017
- ip7-dynamic-preview-20261014.png: 3f92d9a7dc4071602f843637a802e19574d9c411eb64c5b71a6f2ec8d4aeb826
- ip7-dynamic-publish-confirm-20261014.png: 84d28720384b55d116d12636ce01fc82ed2408c6c3f3764db1223c00a8a4c6c2
- ip7-dynamic-public-20261014.png: 56ba7394f6e5bd826df96ff3d2068f722c9eb04455b8887df089f9b19bd6860e

미리보기 전체 캡처를 직접 보고 과다 표시를 발견한 뒤 computed style로 원인을 확인했습니다. 단위시험만으로 화면이 정상이라고 보고하지 않습니다.

실행 보조 오류: CLI run-code 형식/반환값, wrapper bash 호출, 일치하지 않는 zsh glob, Python CLI 진입점/-B 누락을 정정했습니다. 자체 untracked pycache는 정확한 소유 범위를 확인한 뒤 /var/folders/xf/jdln7xp96rs_yyl5c03rl68c0000gn/T/g7pb-own-bytecode-20261014-4zm092bj/__pycache__로 이동·보존했습니다(삭제 없음). 문서함 카드가 article이라는 잘못된 선택기는 시간 초과 후 실제 DOM 부모로 한 번 정정했습니다. 이 보조 오류를 제품 성공이나 제품 시험 반복 사유로 삼지 않았습니다.

## 다음 경계

IP7은 in_progress입니다. DATA04가 남았고 전체 데이터 권한/반응형/실패 행렬·IP8 미디어/구성·IP9 복원·IP10 수용은 완료되지 않았습니다. 기존 문서 처리는 독립 프로세스입니다. DATA04 재개는 별도 재감사에서 실패 커밋/두 불변식/정확한 공통 파일과 추가 수정 권한을 먼저 확정해야 합니다. 성공 입력 반복·전체 검증을 재개하지 않습니다.

이번 통합은 로컬 소스 수정입니다. 온라인은 앞서 배포한 0.37.0-dev.20261014 / a84b8eb4edfffa2f0aecb90f39605624a7394c39이며 새 배포를 주장하지 않습니다. 문서 정합성·scoped 통합·NO_RELEASE 종료는 제품 전체 합격을 뜻하지 않습니다.
