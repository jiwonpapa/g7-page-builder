# 2-D 작업 카드: 상태별 fixture와 공급 경계

기준 `330f3bdade0d6c1358df6374ea5e9bc510152bc1`, task `productization-phase2d-20260831`, mixed/shared-contract.

- 요구사항 QA-02, G7R-05: 기본/긴 문구/반응형/저장 재진입/미디어 없음/목록 최소·최대/동적 empty·error·capability 부재를 버전된 fixture와 공급 함수에 연결합니다.
- 기존 manifest·계획 inventory·canvasEditingContract의 필드/목록 상한, 현재 runtime의 `bootDynamicData(root, fetcher)` 주입 경계를 재사용합니다. 전역 fetch나 인증 상태를 교체하지 않습니다.
- 각 catalog ID에 필수/비적용 상태와 이유, fixture ID·파일/공급자/시험 경로를 연결하고 실제 파일 digest를 검증 의존성으로 포함합니다. 필수 fixture·공급자·시험 파일 누락은 실패입니다.
- 먼저 자료 삭제/중복/미등록 상태·잘못된 공급자·목록 범위·샘플 요청 누출의 RED를 작성하고 구현합니다. 실제 시험 결과와 단순 case 생성은 따로 집계합니다.
- 변경 없음: 사용자 PageBuilderDocument schema/서버 API/DB, Puck, 기존 승인과 썸네일, 공개 CSS. 신규 자산이나 네트워크 샘플을 받지 않습니다. 상태 fixture는 개발 전용이며 자동 합격을 생성하지 않습니다.
- 제출 전에 140개 v2 원장의 영향 범위만 갱신하고 strict/unit/실파일 하네스 및 mixed 통합 gate를 통과시킵니다. 전체 시각 심사·실제 저장/발행/G7 데이터 연동 성공은 해당 브라우저·통합 증거 없이는 주장하지 않습니다.

## 구현 결과와 근거

- 9개 상태를 `g7pb-quality-states/v1` fixture/schema로 고정했습니다. 공급자는 canonical·long-copy·viewport·roundtrip·media-response·collection-boundaries·dynamic-response입니다. manifest/계획 ID 일치, 실제 편집 선언과 계획의 필드·목록·capability 일치, preset 필수 상태와 definition capability 일치를 시험합니다.
- 45개 정의와 95개 preset에 **필수 731건 / 비적용 529건**을 연결합니다. 이는 catalog×상태의 적용 관계이며 시험 실행 수나 제품 합격 수가 아닙니다. fixture·schema·공급 함수·두 시험 파일의 실제 bytes를 의존성으로 수집합니다.
- 모든 95개 preset에 같은 canonical props로 기본·긴 한국어·반응형·JSON 왕복 입력을 생성합니다. 정해진 리치텍스트/가시 label만 바꾸고 URL·미디어·구조 값은 유지합니다. 문자열 배열의 말단 wildcard도 변환합니다. JSON 왕복 입력 생성은 실제 저장 API/reload 시험이 아닙니다.
- 반응형은 기존 정책대로 **캔버스 1280/768/360, 브라우저 1440/768/390**을 구분합니다. 현재 57개 목록 preset의 min/max는 `collectionLimit()`과 대조하고 허용 경계/범위 밖 입력을 생성합니다. 입력의 expected 표시는 이 공급기의 기대값이며 PHP 저장 검증 결과로 세지 않습니다.
- 실제 공개 데이터 런타임 `bootDynamicData(root, fetcher)`에 독립 응답을 주입하여 6종×empty/error/capability-missing **18개 상태의 DOM 처리**를 시험했습니다. 전역 fetch·인증 저장소는 그대로이며, 지정한 읽기 endpoint 외의 URL/POST·PUT·PATCH·DELETE/본문 있는 요청은 실패합니다. live network fallback은 없습니다. 404 모사는 실제 G7 모듈 비활성화 통합 시험이 아닙니다.
- 파일 삭제, schema 위반, 중복 상태, 공급자/응답 불일치, 필수 상태 누락, source 변조·경로 이탈, 잘못된 metadata/JSON, 샘플 요청 누출의 실패 사례를 포함합니다. 공급 모듈 부재와 문자열 배열 말단 누락의 RED를 확인한 뒤 구현했습니다.

## 제출 전 검증

- TypeScript strict PASS. 전체 Vitest V8 **37 files / 329 tests PASS**, 14.71초(macOS Node 24).
- 상태 공급기 coverage **100/100/100/100%**, 실제 inventory 수집기 **97.66/95.37/100/100%**(statements/branches/functions/lines). 새 공급기에 95/90/95/95 하한을 추가했고 기존 하한/분모는 축소하지 않았습니다.
- 현재 PHP 출력/실파일 기반 CLI와 contract harness PASS: 140개, v1 source 변화 0, shadow 오류 0. 원장은 **content 0 / rights 0 / render 140 / editing 140** 범위만 refresh했습니다. 과거 review·새 pending 상태는 보존했고 승인/합격을 추가하지 않았습니다.
- 갱신 후 **560 pending, ready=false**입니다. 외부 iframe 2개와 런타임 다운로드 주소(`/`)도 여전히 미확인입니다. 표본 CLI 1회는 renderer 187ms/collector 46.32ms/전체 261ms이며 성능 보장값이 아닙니다.
- 실제 저장→재진입→발행의 브라우저 회귀와 전체 140개 시각 심사는 위 수치와 별개입니다. 제출/통합 SHA와 해당 gate 결과는 Git/coordination 기록으로 확인합니다. 이 배치 자체는 사용자 화면이나 서버 API를 변경하지 않습니다.

## 다음 진입 조건

`rich-boundary`의 미통합 공개 CSS와 v1 렌더 증거 갱신 범위를 다음 별도 task에서 다룹니다. 콘텐츠 심사 재사용과 화면 재검증을 구분하되 v1 gate를 삭제하거나 stale hash를 승인으로 덮어 통합하지 않습니다. 상태 fixture의 전 편집/미리보기/공개 화면 실행은 해당 기능을 완성하는 6~8차의 실제 증거가 필요합니다.
