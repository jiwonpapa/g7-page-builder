# IP7 기존 편집·저장·재열기·발행 흐름 재감사

2026-10-14 · 승인된 기존 흐름 4건만 통과 · IP7 전체/제품 전체 수용 아님

## 범위와 결과

사용자가 기존 편집→저장→재열기→발행 흐름만 재감사하도록 명시 승인했다. 새 spec·시나리오·assertion을 추가하지 않고 tests/E2E/structureDocumentProduct.spec.ts의 기존 desktop 4건만 선택했다. 최초 실패에서 중단하도록 max-failures=1, retries=0, workers=1을 고정했다.

| 기존 시나리오 | 결과 | 실제 확인 |
|---|---|---|
| publishes generic elements … none | 첫 실행 통과, 11.974초 | UI 생성/글자 크기·모바일 override/preview/명시 확인 발행/마지막 정상 발행 유지/재열기 |
| publishes generic elements … template | 첫 실행 통과, 20.304초 | 같은 흐름, 현재 활성 User Template의 공개 출력 |
| publishes generic elements … builder | 첫 실행 통과, 12.546초 | 같은 흐름, 독립 builder 출력 |
| creates an empty page … authenticated save and reload | 첫 실행 통과, 8.078초 | 빈 문서·중첩 컨테이너/제목·Undo/Redo·직접 한글 입력·실제 API 저장/재조회·재열기·세 캔버스 폭·구 URL 분기 |

전체 브라우저 실행 53.540초, expected=4, unexpected=0, skipped=0, flaky=0, 각 retry=0이다. 제품 오류 0건이며 제품 소스 재구현/수정은 0회다. 통과한 브라우저 시험을 다시 실행하지 않는다.

발행 3건은 기존 정의에 포함된 1280/768/360px에서 27/27/21px 글자 크기와 preview/public의 구조·문구·표시 의미 및 치수 차이 1 CSS px 이하를 확인했다. 발행 취소의 초기 초점/Escape, 발행 뒤 추가 본문의 초안 저장이 기존 공개 본문/hash를 바꾸지 않는 동작도 기존 assertion 그대로 통과했다. 추가 폭·전체 카탈로그·성능 시험을 붙이지 않았다.

## 환경과 실행

- 소스 HEAD: 6b64ccd681447e0ef6c706e8cf693c85dd066cbf, 깨끗한 main. 배포 제품 a84b8eb4edfffa2f0aecb90f39605624a7394c39 이후 차이는 기록 문서뿐이다.
- 환경: Local integration/runtime lease integration-ip7-flow-reaudit-20261014, 기존 g7pb-dev Docker, https://g7pb.test, Node v24.19.0 / PHP 8.5.9.
- make dev-build-assets는 기존 입력/전체 dist가 일치한 fingerprint c40bc65e2098c72632e40701e2409dc3a7efcb0fbdb76fffc4acc62f7c45ac7d를 재사용했다. 실제 제품 자산 재빌드는 0회다.
- 기존 Runtime.command의 Docker 사용자/경로/timeout 경로를 사용했다. 새 런타임·fixture·계정·원격 문서를 만들지 않았다.

실행한 기존 Playwright 명령:

```sh
npx --no-install playwright test tests/E2E/structureDocumentProduct.spec.ts \
  --project=desktop --workers=1 --retries=0 --max-failures=1 \
  --global-timeout=600000 \
  --grep='(publishes generic elements through|creates an empty page)' \
  --forbid-only --trace=retain-on-failure --reporter=list,html,json \
  --output=output/playwright/ip7-flow-reaudit-20261014/initial/results
```

별도 출력은 PLAYWRIGHT_HTML_OUTPUT_DIR=output/playwright/ip7-flow-reaudit-20261014/initial/report 및 PLAYWRIGHT_JSON_OUTPUT_FILE=output/playwright/ip7-flow-reaudit-20261014/initial/results.json으로 지정했다.

## 증거와 육안 확인

- JSON: output/playwright/ip7-flow-reaudit-20261014/initial/results.json.
- JSON SHA256: f9685d0da437705202771923685e196928d9a7950750d46b9694897cdeb6fb2a.
- HTML/기존 캡처 15개: output/playwright/ip7-flow-reaudit-20261014/initial/report/index.html 및 report/data.
- 육안으로 직접 연 기존 캡처: product-canvas-1280, product-canvas-360, publication-confirm-none, public-output-template-360. 중첩 제목의 표시/작업면 경계, 모바일 캔버스의 200% 맞춤 표시, 확인창의 취소/발행 버튼과 문구, 활성 템플릿 모바일 출력에서 제목의 가림·잘림은 보이지 않았다. 선택한 캡처 범위의 판정이며 전체 정밀 편집 UI/UX 완성 판정이 아니다.
- canonical-publication-none/template/builder 증거는 추가 초안 본문 2개와 기존 발행 hash 보존을 기록한다. 초기 발행 hash는 각각 58d10be81409908bd9722bc99ce6af79dc42256242855dc1bfca3e3a3e9b8e9d / 685f4eaf2ca58a4737a4b00f524f89e4df70b1e3a98492069ce9a2475b31f546 / 9787fd106e490e8c805ecf22d39abb6c71a3b6e0b5b50398dc9a2456c7f13f08이다.

실행이 소유한 문서 4개만 기존 finally로 보관함에 이동했다. permanent purge는 없고 복구 가능한 원본은 보존했다. owned-document-archived 첨부에서 4개 모두 status=archived를 확인했다.

| 시험 소유 문서 ID | 소유 slug |
|---|---|
| 210bb6bd-8d28-48cb-909c-546ddb66f295 | g7pb-public-none-1791939805306-3422d20f |
| fbf04088-67a2-4b65-8942-c2287b933c87 | g7pb-public-template-1791939817277-fc4d16ec |
| bd02d526-052b-45cc-8b31-f5530e729513 | g7pb-public-builder-1791939837671-8e077ddd |
| 534e4c6f-d916-4460-aa17-9514699ba833 | g7pb-product-1791939850071-09ace307 |

## 보존한 실행 문제와 처리

제품 실패와 무관한 실행 보조 문제도 숨기지 않는다.

- SELECT01: 처음 --list에서 제목 앞의 ^가 Playwright 전체 제목과 맞지 않아 0건을 수집했다. 앵커만 한 번 제거해 정확히 4건을 수집한 뒤 첫 실제 브라우저 실행을 시작했다. 0건을 성공 증거로 사용하지 않았다.
- REPORT01: 완료 JSON의 PNG 첨부 body를 JSON으로 읽으려던 증거 요약 명령이 실패했다. contentType을 구분하도록 한 번 보완해 기존 증거만 다시 읽었다. 제품·시험 파일 변경이나 브라우저 재실행은 없었다.
- ENV-META01: 선택적 G7 app.version 조회의 Tinker가 /tmp/g7pb-psysh-config/psysh 쓰기 권한으로 실패했다. cache 권한·사용자·호스트를 바꾸거나 재시도하지 않았다. Node/PHP 버전은 각 바이너리의 읽기 명령으로만 확인했다. G7 app.version의 실제 값 및 전체 호스트 호환성을 이 결과로 단정하지 않는다.

## 판정과 다음 경계

승인한 4건의 실제 흐름 확인은 끝났다. IP7 전체 상태는 in_progress를 유지한다. 동적 6종의 실제 데이터/권한·검색/필터/페이지, 새 Header/Footer 세트의 작성/저장/발행, IP8 미디어/사용자 구성, IP9 복원/충돌과 IP10 종합 수용은 이 4건이 검증하지 않았고 이번에 확대 실행하지 않는다. 기존 v1/v2/Site Part 전환은 별도 프로세스로 유지한다.

코어·테마 파일/활성 상태·기존 사용자 문서·온라인 서버를 변경하지 않았다. 제품 파일 변화가 없으므로 새 버전·자산 빌드·온라인 재배포는 하지 않는다. 보고·진척 문서만 공식 scoped 제출/통합하며, 이 문서 정합성 검사를 제품 브라우저의 추가 성공으로 합산하지 않는다.
