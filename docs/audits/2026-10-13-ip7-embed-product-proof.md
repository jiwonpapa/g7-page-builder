# IP7 공통 임베드 동작 검증

상태: 보완 소스·브라우저 시험·승인된 편집기 JS 측정 정책을 `a7f9d6734bbdfc1510c6f20813f052a61a33d0b8`로 통합했다. 독립 267개·설치형 30개가 통과했다. 캡처 준비 보완 후 desktop/template 단일 시나리오와 세 폭의 공개 화면을 추가 확인했다. 초기 프레임 반복 교체의 실제 외부 서비스 영향은 미검증이며 IP7 전체 완료나 UI 최종 승인은 아니다.

소스 제출의 계획은 128개 gate이며 runtime/browser gate는 통합으로 이관했다. 사전 관련 프런트 테스트 34개, PHP 2개·284개 단언, 타입·구조 검사를 통과했다. 제품 실행 증거로 합산하지 않는다.

## 검사 범위

- 독립 편집기: 빈 카탈로그에서 삽입, 미설정 안내, 잘못된 영상 ID의 무변경 거부, 제공자 설정, 단일 Undo/Redo, 외부 프레임의 포인터/키보드 차단, 공통/모바일 크기, 포트 저장·재열기, readonly.
- 동일 빌드의 임의 구성 데이터: 네 제공자와 좌표 경계 fixture, 기본 종횡비·직접 크기를 PC/태블릿/모바일에서 React 캔버스·미리보기·PHP 출력과 1px 이내 비교한다.
- 설치 제품: 실제 인증 UI에서 네 제공자를 작성·저장·재열기·미리보기·명시 발행한다. `none`·`template`·`builder` 셸의 세 폭에서 marker 복원, 정확한 주소·설명·전체화면 권한과 작성 크기를 비교한다. 검사 소유 문서만 기존 정식 archive API로 정리한다.
- 외부 제공자의 HTML은 결정적인 시험 대역으로 응답한다. 본 제품의 iframe·공개 복원·CSP·크기·입력 경계 검증이며 원격 서비스 재생 가용성의 증거가 아니다.

## 통합 경계

`ip7-common-embed-element-20261013`의 문서 계약·소스와 `ip7-embed-product-proof-20261013`의 검사·원장을 서로 겹치지 않는 task로 제출한다. 공유 문서 계약과 공개 runtime 변경이므로 공식 batch 통합에 `FULL=1`이 필요하다. IP7은 진행 중이며 동적 데이터·폼·시스템 연결과 명시적 기존 문서 이행, IP8~IP10은 별도 남은 요구다.

## 첫 통합의 실제 결과와 보완

설치형 30개가 실패·skipped·flaky 없이 통과했다. 결과는 `output/playwright/gates/integration-ip7-20261012/f3535a63bda007d1599490430e516ad17cf1f7b8e50583696d45e50bdb549095/b94ee3b8a86e4f909a54c7455f976867/results.json`이다. 그러나 독립 편집기 번들의 gzip 512,084바이트가 승인 상한 512,000을 넘어서 beforeAll에서 실패했고 264개는 실행되지 않았다. 실패 기록은 `output/playwright/gates/integration-ip7-20261012/64144a895daeaa4f5e97d62343d284a72104a8361abd976a04d3f88b83321120/fa84e8c18df541de91a0093dddb21c3d/results.json`이다. Local은 기준 SHA로 원복됐고 `jwsoft-business01` 0.3.1 활성·`sirsoft-basic` 비활성을 확인했다.

Node 24.19.0은 같지만 macOS zlib는 1.2.12, Docker는 1.3.2.1-motley-3246f1b여서 macOS의 509,856바이트 측정만으로 통합 환경의 합격을 보장하지 못했다. Inspector의 반복 옵션/좌표 코드를 공통 입력 컨트롤로 정리하고 관련 테스트는 통과했지만 별도 Linux 사전 측정도 512,060바이트로 종전 상한을 넘었다.

이후 사용자가 편집기 JS를 측정·경고로 전환하도록 명시 승인했다. 독립 시험도 실제 JS의 raw/gzip을 기록하며 종전 512,000바이트 초과는 경고만 남긴다. 비어 있지 않은 실제 번들, 금지 런타임 의존성 부재, 폰트/자산 무결성, 기존 성능·동작·출력 비교는 유지한다. 별도 `editor-js-size-observability-20261013`의 빌드 검사·정책과 함께 통합한다. 수정 후 실제 재실행 결과는 아직 확인 전이다.

모바일 template 공개 PNG의 네 프레임은 렌더됐지만 시험 대역에 charset을 빠뜨려 한글이 깨졌다. 제공자 시험 응답에 UTF-8을 명시하고 공개/미리보기의 네 프레임 본문이 실제 로드됐는지도 검사한다. 제품 문자 인코딩 문제로 확대하거나 이 이미지로 UI 최종 승인을 주장하지 않는다.

## 보완 후 공식 통합 결과

실행은 `make task-integrate-batch TASKS=editor-js-size-observability-20261013,ip7-common-embed-element-20261013,ip7-embed-product-proof-20261013 INTEGRATION_TASK=integration-ip7-20261012 FULL=1`이다. 기준 `b421b4282f7382299fea8fc19afb0a6f31219524`, 제출은 정책 `a2cdc4afcc9aeebbd2452dff1484868b4a70feaa`·소스 `70f724696f0a2146d139e02942895f49c925a1b7`·시험 `7954e1301a4a272e1c246f45ae54ddf791142f82`다. 공유 schema·공개 runtime 변경을 이유로 전체 통합 검사를 실행했고 종료 코드 0을 확인했다.

- 독립 편집기 267개: 실패·skipped·flaky 0. `output/playwright/gates/integration-ip7-20261012/f4733c987952657ba7461e6f6edf8b27d4bff0b9075338150f46803058cb7478/030b82dabd2a42dcaf61fd3759b5ad67/results.json`.
- 설치형 30개: 실패·skipped·flaky 0. `output/playwright/gates/integration-ip7-20261012/358a015d1e2672ef8af69adaeeb9eba158b4097b1a5f4f0fa064a4df286818b0/106065cc7be54fd79fdea9d2923c919b/results.json`.
- 공개 runtime 4개 통과. `output/playwright/gates/integration-ip7-20261012/27cd9bef27df603ffab7bfd05dd0ed2441cddb80d2376ba8fe0c562499cc775d/c47165b399e34c0480909468016f7078/results.json`.
- 전체 gate의 기존 제품 회귀 49개, 공통영역·실제 G7 인증/로그아웃 45개 통과. PHP 431개·6,861개 단언, 통합 포함 coverage 519개·7,677개 단언과 하한선 통과. 기존 PHPUnit notice 1개는 남아 있다. 프런트 타입·단위/coverage·CSS·production build·자산/구조 검사도 통과했다.
- 기존 100블록 성능: 준비 1,210.2ms/8,000ms, 입력 p95 121ms/180ms, 드래그 1,033.5ms/1,500ms, gallery 224.5ms/650ms. 용량 정책 변경이 성능 기준을 완화하지 않았다. 이 수치를 새 v3 500노드 수용 결과로 대체하지 않는다.
- Docker Node 24.19.0·PHP 8.5.9·G7 7.0.11, 검증 중 `sirsoft-basic` 1.1.4. 종료 trap에서 원래 `jwsoft-business01` 0.3.1 활성과 `sirsoft-basic` 비활성을 확인했다. G7 7.1 호환 또는 운영 배포의 증거는 아니다.

## 캡처 준비 상태 보완과 실패 이력

성공 JSON의 desktop 프로젝트 `embeds-template-public-360` 캡처에서 첫 프레임이 빈 것으로 보였다. 같은 실행의 tablet/mobile 프로젝트와 독립 preview/PHP의 한글 프레임은 표시됐다. 프레임 본문·주소·치수 단언은 통과했지만 이것만으로 화면의 그리기 완료까지 입증하지 않는다. 제품 결함 또는 compositor 문제라고 아직 단정하지 않는다.

`ip7-embed-paint-readiness-20261013`에서 해당 spec과 이 증거·원장만 소유한다. 외부 시험 프레임의 실제 표시, 내부 글꼴 준비, 자식과 부모 창의 연속 animation frame, 고정 시험 배경과 본문을 관찰한 뒤 같은 치수 비교·캡처를 수행한다. 제품 소스·실제 성능·1px 기준은 변경하지 않는다. 수집 검사는 제품 실행으로 보고하지 않으며, 통합 뒤 문제가 관찰된 desktop/template 시나리오를 runtime lease 아래 별도 실행한다.

보완 제출 `575a48695ec444c7ba422f29e83070549688dcdc`는 `6b6a41f503801c953849f3c0c0e9f4f08b3fdf62`로 통합됐다. 공식 검사는 30개 수집·타입·관련 planner 82개·계획 정합성이며 실제 제품 재실행과 구분한다.

단일 진단의 첫 명령은 Playwright 전체 제목에 맞지 않는 시작 앵커 때문에 0개가 선택됐다(`output/playwright/audits/ip7-embed-paint-20261013-01/results.json`). 선택식을 고친 `--list`에서 desktop/template 1개를 확인하고 실행한 두 번째 명령은 첫 공개 화면의 본문 확인 후 내부 animation frame 대기 중 `Frame was detached`로 실패했다(`output/playwright/audits/ip7-embed-paint-20261013-02/results.json`). 두 실행 모두 종료 trap으로 원래 테마를 복구했고 실제 생성된 두 번째 실행의 문서는 정식 archive 응답을 보존했다.

후속 `ip7-embed-frame-lifecycle-proof-20261013`은 spec 한 파일만 소유한다. 프레임 생성·이동·제거 시점과 각 캡처의 준비 상태를 기록하고, 10초 안에서 네 프레임 모두의 표시·본문·글꼴·그리기 준비 및 관찰 전후 동일 프레임을 확인한다. 반복하는 것은 읽기 전용 준비 관찰뿐이며 편집·저장·발행은 재시도하지 않는다. 치수/주소/문자 비교는 준비 확인 뒤 별도로 실행하며 기준을 완화하지 않았다. 첫 제출의 Playwright event overload 타입 오류는 명시 이벤트별 구독으로 고쳐 관련 검사를 통과했다. 제출 `1f70befe4e52748678e975e96a14d85bad7edcb4`, 통합 `5b24f3d76ff6159d0a3e7c96e235b11cf54276a7`다.

## 단일 재실행과 화면 확인

위 통합 SHA에서 Local runtime lease를 확인한 뒤 Docker 안에서 `npx --no-install playwright test tests/E2E/structureDocumentProduct.spec.ts --project=desktop --grep 'publishes common embeds with safe providers responsive sizing and persisted settings template$' --retries=0 --forbid-only --reporter=list,json --output output/playwright/audits/ip7-embed-paint-20261013-03/results`를 실행했다. `PLAYWRIGHT_JSON_OUTPUT_FILE=output/playwright/audits/ip7-embed-paint-20261013-03/results.json`에 기록했다. **1개 통과, 실패·skipped·flaky 0**, 전체 실행 약 21초, 종료 코드 0이다. 이 추가 실행을 30개 전체 재실행으로 보고하지 않는다.

360/768/1280px의 canvas·React preview·서버 preview/public 비교가 기존 1px 기준을 통과했다. 각 preview/public에서 네 프레임 모두 `complete`·글꼴 `loaded`·표시 `visible`·예정된 시험 배경/한글을 기록했다. 같은 결과 JSON의 `embeds-template-public-360`, `-768`, `-1280` PNG를 육안 확인했으며 네 프레임이 보이고 빈 첫 프레임·한글 깨짐·해당 프레임의 가로 넘침은 관찰하지 않았다. 샘플 콘텐츠의 제품 디자인 완성도나 전체 편집 UX를 승인하는 검사는 아니다.

추가 로그는 초기 렌더에서 폭/출력별로 프레임 24~28개 생성(네 프레임 세트 6~7회)과 교체를 보여 준다. 최초 새 프레임 생성부터 마지막 프레임 이동 이벤트까지 360~452ms였으며, 준비 관찰 동안 동일한 네 프레임으로 안정화된 뒤 캡처했다. 이것은 지속적인 무한 교체가 관찰됐다는 뜻은 아니지만, 단순 compositor 오류만 있었다고 단정할 근거도 아니다. **실제 외부 제공자의 중복 로딩·재생 영향과 초기 DOM 재생성 원인은 IP10 최종 UX/성능 감사의 미검증 항목으로 유지한다.** G7 코어 또는 제품 runtime을 변경해 이 문제를 해결했다고 보고하지 않는다.

시험 소유 문서는 기존 정식 archive API의 성공 응답을 첨부했다. 종료 후 `jwsoft-business01` 0.3.1 활성·`sirsoft-basic` 1.1.4 비활성을 확인했다. 승인한 JS 정책은 이미 통합 완료됐고, IP7의 폼·동적 데이터·시스템 연결·명시 이행 및 IP8~IP10은 계속 남아 있다.
