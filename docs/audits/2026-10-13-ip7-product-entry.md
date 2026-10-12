# IP7 실제 공통 요소 편집 화면 연결

## 최종 제품 진입 통합 증거

Local 통합 SHA는 `7dfc397bf1bd687126aeb6c291f37f23b6a4e78e`다. API·제품 entry·빌드 검사 등록·기존 카탈로그 압축의 네 제출을 공식 batch로 통합했다. 공유 Blade 진입점을 변경했으므로 요청한 FULL 검사가 성공했다. 이는 IP7 전체 또는 운영 배포 완료가 아니다.

- 새 인증 제품 시나리오 3개, 실패/skip/flaky 0: `output/playwright/gates/integration-ip7-20261012/eebc6815634cbcbe6b774d22a8bc2e70a56320a424d3de08dd81c22c805811e7/86e4f224e0e94cf89d7dbf24c47765bb/`. 실제 빈 v3 생성·중첩 요소 편집·Undo/Redo·한국어 직접 입력·API 저장·재열기·세 폭과 63개 데이터 자산 응답을 확인했다. 실제 발행은 이 시험에 포함되지 않는다.
- Inspector UX 2개 및 asset identity 2개도 통과했다. FULL 제품 브라우저 49개와 공통영역 브라우저 45개가 통과했다. PHP 단위 395개, 통합 포함 coverage 471개 및 별도 G7 통합 76개가 통과했다. 기존 PHPUnit notice 1개는 별도 경고로 남으며 실패로 숨기거나 제품 수용 증거로 사용하지 않는다.
- Linux gzip: 새 JS 489,746 bytes, 분리 JSON 22,535 bytes, 기존 JS 508,432 bytes. 기존 JS 한도 508,500 bytes는 그대로다. 분리 자산까지 포함한 총 전송량 감소를 주장하지 않는다.
- FULL Site Part journal은 `output/playwright/gates/integration-ip7-20261012/53de021a76eeca28ed3b22ceeb3c8a6be79ccdaa4a3fac62ecb539ce16be882e/c99008c7a61244a9be18af53cb0809bf/site-part-state.json`이며 closed=true, 16개 세션 모두 restored=true다.
- 종료 시 jwsoft-business01 0.3.1 활성화·sirsoft-basic 1.1.4 비활성화를 확인했다. 관련 테마 1,667개 파일의 SHA256은 전후 동일한 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`이다.

이후 실제 v3 발행 compiler·서버 binding을 별도 작업으로 진행한다. 기본 문서함 생성 경로, 미디어·재사용, 공통영역 전체, 명시 이행·복원 및 최종 E2E/UX 수용은 남아 있다. 원장의 IP7은 in_progress를 유지한다.

상태: 구현 중, 미통합. IP7 전체 완료 증거가 아니다.

API/버전 분기 작업 `ip7-editor-entry-api-20261013`은 `386b77fa44ae58982c17c75b3642e82dc934f5e8` 기준에서 제출 `c2e517bf24b5d8bf7f340b16c1cc60dbccbad070`까지 진행했다. 공식 제출의 관련 단위·타입·구조 검사를 통과했으며 브라우저 검증은 통합 단계로 유보됐다.

제품 화면 작업 `ip7-product-entry-20261013`은 해당 제출 SHA에서 시작했다. 제품 번들 검사에서 불필요한 관리자 API 메서드의 포함을 확인하여 원 제출을 보존하고 동일 PATHS의 `ip7-editor-entry-api-slim-20261013`으로 정식 교체했다. 문서 전용 클라이언트와 기존 관리자 클라이언트는 인증·오류·HTTP 처리를 그대로 공유한다. 교체 제출은 `4a9918bbc35ed90bc5b28fcbe836ecbdde6ab876`이며 관련 단위·타입·구조 gate를 통과했다.

화면 작업도 원본 dirty/index/branch를 보존하는 `task-replace-active`로 `ip7-product-entry-slim-20261013`에 이관했다. 기준은 위 `4a9918bb`다. API/화면 두 작업은 실제 entry 연결에 기능 의존성이 있으므로 공식 batch로 함께 통합한다. 기존 두 관리자 경로를 늘리지 않고 고정된 `editor=structure` 선택으로 한 개의 편집 번들만 로드한다. Blade에서 비공개 문서를 조회하지 않으며 인증 API 응답의 버전·ID 검증 뒤 해당 편집기로 연결한다. 기존 문서 자동 변환은 하지 않는다.

## 구현과 검증 범위

- 새 빈 페이지는 v3 생성 API로 만들고 기존 StructureEditor의 요소·트리·Puck 명령·저장 포트를 사용한다. 새 블록별 편집기·두 번째 원본/Undo를 추가하지 않는다.
- 호스트는 문서 제목·초안/발행 구분·오류·미저장 이탈 보호를 표시한다. 저장 중 발생한 추가 입력은 `edited` 응답으로 전달하여 미저장 상태를 유지한다.
- frontend 스킬은 작업면 중심의 얇은 문서 바, 기존 레이어/캔버스/Inspector, 공통 토큰에 적용했다. 장식·새 디자인 시스템은 추가하지 않았다.
- 실제 E2E는 관리자 로그인 → UI에서 빈 페이지 생성 → 기본 컨테이너/내부 제목 → Undo/Redo → 직접 한글 입력 → 실제 서버 저장 → 새로고침/재조회 → 세 캔버스 폭 → 구 URL의 버전 분기를 검사한다. 단위 시험·수집 성공을 실제 E2E 성공으로 기록하지 않는다.
- 발행 compiler, 전체 최소 시나리오의 미디어 연결, Manager의 새 기본 생성 경로, Site Part·기존 문서 이행·IP8~IP10은 아직 남아 있다.

## 현재 확인 결과와 남은 작업

새 Vite 구성의 미분류를 해소하는 하네스 작업 `ip7-product-build-plan-20261013`은 `0146d06892c95c9a8e52a7a32dc290b99b4f642e`로 제출했다. 합격 기준을 변경하지 않고 정확한 빌드 입력을 등록했으며 관련 하네스 gate를 통과했다. 화면 작업은 같은 공식 보존 이관으로 이 기준의 `ip7-product-entry-registered-20261013`에서 계속한다. API·하네스·화면 3개 제출분을 의존 batch로 통합한다.

Blade의 공용 편집 진입점 변경은 하네스가 공유 runtime 범위로 분류하므로 제출·통합에 명시적으로 `FULL=1`을 사용한다. 이는 미분류 경로를 전체 검증으로 숨기는 대체가 아니다. 위 Vite 경로 등록과 실제 entry의 인증 단위 시험을 먼저 보완했다.

초기 관련 단위 25개는 통과했다. 이후 늦은 저장 응답 회귀·실제 제품 번들 검사를 포함한 28개 및 타입 검사가 통과했다. 실제 진입점 인증 요청 검사를 추가한 호스트 10개도 통과했다. 브라우저 등록 하네스 52개, 번들 하네스 13개, 새 제품 시나리오 desktop 수집 1개를 확인했다. 이는 브라우저 실행 성공이 아니다.

새 번들은 처음 510,490 gzip bytes로 기존 508,500-byte 기준을 초과했다. 공용 API 구현을 문서 전용 진입점과 관리자 확장으로 나눈 뒤 JS 508,170 / 508,500, CSS 18,422 / 45,200 gzip bytes로 통과했다. 내장 데이터·기능·의존성 버전·용량 기준을 줄이거나 완화하지 않았다. 기존 Inter 4.1 로컬 글꼴을 그대로 사용한다. 제품 브라우저 실행·최종 UI 육안 검수·통합 SHA는 아직 없다.

G7 코어·테마 원본·운영 서버는 변경하지 않았으며 배포하지 않았다. 원장 IP7은 `in_progress`를 유지한다.

## 실제 제품 브라우저 검사 보완

제출 `21bd800fdfe16e8c892095126006c872332fe274`의 첫 공식 통합은 새 제품 시험에서 중단되어 Local이 원복됐다. 세 프로젝트 모두 생성 전 `getByLabel`의 정확 일치가 중첩 select의 label 전체 텍스트와 맞지 않았다. 같은 실행의 접근성 snapshot에는 `combobox "페이지 출력 방식"`이 있고 화면에서도 선택 상자가 정상 표시된다. 해당 컨트롤을 접근성 역할과 정확한 이름으로 선택하도록 수정한다. 필드·선택값·저장 시나리오·검사 기준은 유지한다. 원 제출은 `ip7-product-entry-browser-20261013`의 공식 submitted replacement로 보존했다. 실패 증거는 `output/playwright/gates/integration-ip7-20261012/1d71cf2512dda38ef40562166b1051fcc83f66ea6475e55f629b0a02fac10e48/0dc713a14c7d4084878d3127b9fc80b1/`이며, 종료 trap으로 원래 로컬 테마의 활성 상태를 복구했다.

교체 제출 `b12999e363cd0f2effc1249430d473f101e5d199`의 실제 제품 시험은 desktop/tablet/mobile 프로젝트 3개 모두 통과했다. 빈 페이지 UI 생성, 컨테이너/제목 삽입과 중첩, Undo/Redo, 한글 전체 교체, 실제 API 저장/재조회/새로고침, 세 캔버스 폭과 구 북마크 분기를 확인했다. 증거는 `output/playwright/gates/integration-ip7-20261012/466c72c6cc46cecf30731beda0737b69d389e826bb65e8f32766f6ea1a153177/9a4881dd1f7a4c69990e03b7d73e0994/`다. 1280/360px 캡처에서 문구·레이어·작업면을 확인했으나 최종 선택/Inspector/이미지/발행 UX 수용을 의미하지 않는다. 발행은 이 시나리오에 없다.

후속 FULL에서 PHP 395개와 프런트 1,630개는 통과했으나 구조 진입점의 Linux gzip 510,164바이트가 508,500 한도를 넘어 통합은 다시 원복됐다. 동일 JS 바이트가 macOS zlib 1.2.12에서는 508,170, Linux zlib 1.3.2.1-motley에서는 510,164로 측정된다. 기준을 바꾸지 않는다. FULL의 Site Part journal은 closed=true, sessions=0으로 실제 Site Part 시험 전에 종료됐으며 로컬 테마는 복구됐다.

`ip7-product-entry-assets-20261013`은 원 제출을 보존하고 구성 목록을 내용 버전이 포함된 정적 JSON 자산으로 분리한다. 모든 63개 원본 데이터를 유지하며 공통 편집기는 목록 성공을 기다리지 않는다. 로딩/실패 안내, 늦은 도착 시 생성 폼 보존, unmount 시 취소를 검사한다. JSON은 공백만 제거하고 구조·값·배열 순서는 동일해야 한다. 자산 유실/변질과 30,000 gzip bytes 초과도 검사한다. 초기 분리 측정은 구조 JS Linux 489,746바이트이며 별도 JSON 전송량을 함께 기록한다. 이는 전체 전송량이 그만큼 감소했다는 주장이 아니다.

별도 `ip7-catalog-compression-20261013`은 `vite.config.ts`와 `tests/Unit/catalogBundle.test.ts` 두 파일만 소유한다. 기존 데이터의 중복 하위 구조를 매번 새 객체를 반환하는 생성 코드로 공유하여 제품 데이터·편집 기능·의존성·한도를 유지한다. 값 동일성/순서/자기 prototype 키/독립 가변 객체/-0/Infinity 검사와 실제 빌드를 확인했다. 기존 편집기 Linux gzip은 508,432바이트이며 제출·통합 결과는 후속 증거로 기록한다.
