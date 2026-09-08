# NE4 사용자 조합 저장·재삽입 감사 — NAT-04

계획 `native-editor-20260907`, 수용 기준 `NAT-04`. 현재 차수는 구현·관련 시험·로컬 통합 범위이며 운영 배포를 수행하지 않는다. 다음은 NE5 편집 흐름 연결, 마지막은 NE6 호환·회귀·릴리스다.

## 기준과 변경 소유

- PB 시작 SHA: `8077958276c1e0c8e47318bc0a9a868290cc5344` (NE3 마감).
- 개인 저장소 task: `native-ne4-store-r3-20260908`, 제출 `5082fe1fee56fb09fe8bd835d18518463a546e59`, 통합 `f6ba386ee3e85517e996aac8abf217dcfa50ac09`.
- 원 제출/r2는 보존 replacement 이력으로 남겼다. schema_version 조회 보존과 G7 통합 PHPStan에서 확인한 조회 결과/기본값 타입 문제를 수정했다.
- 편집기 task: `native-ne4-editor-20260908`. 확정 제출·통합 SHA는 아래 최종 결과에 기록한다.
- 진척/감사 task: `native-ne4-close-r2-20260908`. 이전 active `native-ne4-close-20260908`의 문서 변경은 새 제품 기준에서 `task-replace-active`로 보존 이전했다. 원본 파일·index·diff 증거를 유지한다.
- Local 독점 runtime/integration: `native-ne4-integration-20260908`.
- G7 별도 후보: `codex/native-editor-compositions-ne4-20260908`, NE3 기준 `da064086eacf9071afb81fa703121b9c69a4c89c`. G7 main/upstream/운영에 반영하지 않았다.

## 제품 변경

**내 조합**에서 선택한 일반 페이지 항목과 지원 하위 구성을 이름으로 보관한다. 목록 재조회·페이지 이동·허용 위치 선택·독립 사본 삽입·삭제 확인을 제공한다. 삽입은 G7 기존 Undo/Redo 한 건이며 기존 저장으로 공개 페이지에 반영한다. 원본 페이지를 PB 문서로 변환하거나 두 번째 페이지 저장소에 동기화하지 않는다.

PB 원문 저장소와 G7 내보내기 포맷을 구분했다. 실제 로그인 사용자만 자기 목록·상세·삭제에 접근하며 클라이언트가 소유자를 지정하지 않는다. JSON snapshot을 문자열로 저장해 빈 객체/배열과 미지 필드를 보존한다. 구버전/미래 버전 메타를 현재 버전으로 위장하지 않는다.

G7이 템플릿·실제 renderer·spec/nesting·출처·첨부 존재·문맥을 검증한 뒤 새 ID를 발급하고 내부 링크를 연결한다. 거부 시 원본과 이력을 변경하지 않는다. 바인딩/외부 DOM 참조는 원래 layout에 제한한다. 반복 템플릿/미선언 구조의 조합 이식, 전체 페이지 포장, 판매 킷, 공유 전역 컴포넌트는 지원으로 확대하지 않는다.

기본 네이티브 entry의 gzip 8 KiB 한도를 유지했다. **내 조합 열기**에서 별도 6 KiB 한도의 라이브러리 번들을 로딩하며 G7 React를 공유한다. 로딩 실패 재시도와 이전 응답 취소를 제공한다.

## 실제 브라우저에서 발견·처리한 문제

1. 호스트가 관리자 셸의 singleton 컴포넌트 목록을 조회해 편집 대상 템플릿을 거부했다. PreviewCanvas의 실제 격리 renderer 정보를 전달하고 두 템플릿이 다른 회귀를 추가했다.
2. G7 LayoutService가 슬롯 본문의 출처 layout을 부모 이름으로 기록했다. 부모 wrapper/base와 자식 route/layout을 구분했다. 보호 출처 잠금을 완화하거나 `__source`를 삭제하지 않았다.
3. 시험의 첨부 정리 경로를 실제 G7 delete API로 수정했다. 정리 오류가 본래 실패를 가리지 않도록 실패 첨부도 기록했다. 최종 성공 흐름은 실제 API를 사용한다.

## 증거와 실행 범위

환경: macOS Node 24, Vitest/Vite; 단일 `g7pb-dev`의 PHP 8.5.9, 실제 로컬 G7와 `sirsoft-basic`, Chromium desktop 1600×1100. E2E는 모듈이 소유한 `/e2e-sandbox` 기술 fixture의 원본을 보존하고 시험 종료 시 최신 lock_version으로 복구한다.

- G7 조합/구조 단위: 최초 32건(조합 15 + 구조 17). renderer 수정 후 조합 15건 재통과. 기존 호스트·필드 66건 통과. 새 PHP 출처 시험 1건/7단언 통과. DB를 만들지 않고 실제 LayoutService와 이벤트 dispatcher를 실행한다.
- PB 신규 프런트 단위: 3파일/12건. 호스트 계약·순서/취소·라이브러리 UI 삭제 확인·HTTP 권한 오류·로그인 변경·잘못된 응답·지연 번들 실패와 재시도를 검증한다.
- PB 실제 SQLite migration/repository/controller 통합: 2건. 사용자 7/9의 목록/조회/삭제 격리, 원문 바이트·미래 버전 보존, 잘못된 입력, 실제 route의 인증/편집 권한 middleware를 확인한다. 서비스 단위 3건/22단언도 통과했다.
- G7 타입은 변경 소비 경로의 기존 진단과 비교한다. 전체 G7 오류 0을 주장하지 않는다. 확정 후보의 비교 결과는 최종 기록에 명시한다.
- 브라우저 독립 사전 시험: `npx --no-install playwright test tests/E2E/nativeEditorContract.spec.ts --project=desktop --retries=0 --grep 'native private compositions'`: **1건 통과**. 개인 저장→재로드한 목록→다른 부모에 삽입→Undo→Redo→G7 저장→재열기→목록 삭제를 실제 API로 검증했다. 삽입 외 원본 diff 0, 새 ID 4개, 내부 href 재연결, 이미지 참조 유지, 삭제 후 페이지/이미지 유지, pageerror 0.
- 사전 browser는 제품 제출 전 진단 증거다. 정식 통합 gate의 실행 결과와 별도로 기록한다.

## 남은 한계와 다음 차수

- 기존 G7 content API는 입력 JSON을 associative 배열로 변환하며 빈 객체를 배열로 정규화한다. 브라우저의 원본 비교는 **PB가 실행되기 전 G7 API에 실제 저장된 원본**부터 시작한다. PB 저장소의 `{}`/`[]` 바이트 보존은 별도 통합 시험이다. 두 결과를 G7 전체 JSON 종류의 무손실 주장으로 합치지 않는다. G7 저장의 타입 보존 검증·해결을 NE6에 명시했다.
- 비정규/다른 템플릿 G7 첨부와 삭제된 첨부는 거부한다. 일반 정적/외부 URL은 보존하지만 원격 서버 생존까지 검사하지 않는다.
- 현재 템플릿/spec/manifest 지문과 정확히 일치하는 조합만 삽입한다. 임의 테마 호환·자동 마이그레이션·완전한 페이지킷 관리의 완료 선언이 아니다.
- 패널 전체 배치와 찾기→삽입→설정→미리보기→저장 연결은 NE5다. 실제 동시 저장·전체 호환/장애·배포는 마지막 NE6다.

## 최종 결과

- G7 최종 후보: `d264405fd09b70ac85aebe4f4a857cadbe22981e`, engine `1.68.1`. 직전 기능 커밋 `1936cd0c4b5c381f866277bc7e12285c73558a2e`를 포함한다.
- G7 production editor build: 838.32 kB / gzip 225.53 kB. 소스맵 참조 없는 산출물. 관련 TypeScript strict 소비 경로는 기준 60건/현재 60건, 추가 진단 0. 비교 명령/결과는 `.runtime/audits/native-ne4-evidence-20260908/check-g7-scoped-types.cjs`, `g7-scoped-types-result.json`에 보존한다.
- G7 runtime digest: `app/Services/LayoutService.php` = `3e9c30d2c6d42291d8f156aac5f305439ad7ea4ffd96131df875ed32136d8f24`; `public/build/core/layout-editor.min.js` = `7cbd8fd7b5db8cccfee9f13c4d9a18749cd2b7003c499698e2d233b43dbc253b`. 후보 파일과 Local runtime이 일치한다. 원 runtime 파일과 소유 경로/지문은 `.runtime/audits/native-ne4-runtime-backup-20260908`에 보존한다.
- PB 편집기 제출: `9ae68d58306203949bd658fef6d81920b69921c8`; 통합: `e8f69dc1566797ef10bf97ae6f5a9a9dc347afa5`.
- 정식 제출: `make task-submit TASK=native-ne4-editor-20260908`, scoped 23파일/42 gate 계획. 관련 단위·하네스·TypeScript·구조·CSS 통과. runtime 전용 검사를 통합 단계로 유보한 사실을 제출 성공과 구분한다.
- 정식 통합: `make task-integrate-scoped TASK=native-ne4-editor-20260908 INTEGRATION_TASK=native-ne4-integration-20260908`. 기존 성공 입력 재사용, 필요한 build/asset 검증과 `nativeEditorContract.spec.ts` 실제 **4건 통과(59.2초)**. NE1 문구/저장, NE2 내용/이미지/취소, NE3 구조, NE4 조합을 포함한다.
- 정식 빌드의 PB 기본 native gzip 7.19 kB, 지연 조합 gzip 3.02 kB로 각각 기존 8 KiB/신규 6 KiB 한도 통과.
- 최초 통합 browser 증거: `output/playwright/gates/native-ne4-integration-20260908/f9ec12655f21855ecc076b63b3989258ba85fe7f247a732d3c4b57ff80f9e836/d42da90c369540eab443e484b776f15c`. 원본 비교 JSON과 재열기 스크린샷을 포함한다.
- 시각 확인에서 목록 페이지 번호 줄바꿈을 발견하여 별도 정확 1파일 task `native-ne4-ux-20260908`로 보정했다. 제출 `66f909f28139a626a7e754e24d656c3e36c41c2f`, 통합 `54450ecf86179da01b357fcc3d572ef210aa51fa`. 변경 관련 구조·CSS·빌드·asset 및 native browser 4건(59.9초) 재통과. 최종 스크린샷에서 페이지 번호 한 줄 표시를 확인했다.

- 시각 보정 후 최종 제품 browser 증거: `output/playwright/gates/native-ne4-integration-20260908/3a39afba7684199c27807a94e87db1cbb5a87ec84335e818827a375b869c771a/331a7da6f9c843e1933e5925f64dfee9`.
- 진척 원장·표시판·편집 정책·실행 계획에 NE4 완료와 다음 NE5/마지막 NE6을 연결했다. `make editor-plan-check` 통과. 최종 integration verify/finish 결과는 조정 하네스의 보존 task 이력으로 확인한다. NO_RELEASE 종료는 배포 성공이나 release 검증 SHA 승격이 아니다.
