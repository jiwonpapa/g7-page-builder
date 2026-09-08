# NE6 — 호환·회귀·릴리스

## 범위와 현재 상태

마지막 차수 NAT-06. 일반 페이지 JSON 종류 보존, 실제 동시 저장, 이력 복원 버전, 확장 버튼 키보드, 번들/저장 장애 및 기존 PB 공존을 검증했다. 릴리스 후보는 PB 0.35.0이다. 이 기록 작성 시 배포와 운영 재열기는 진행 중이며 완료로 표시하지 않는다.

블록 콘텐츠·페이지킷·테마 상품 추가, G7의 새 주소/메뉴/초안 엔진, 전체 소스 재감사는 포함하지 않는다.

## 코드와 증거 경계

- PB 시작: `794c8dd6c32985fefcd9f6ce79619ad60e46c0fb`; 기능/회귀 제출: `a90252c0c3b9b83d3dd460231247ca20fbfb45b9`; 통합: `eff2b9a71a1201539fed7388c3c18f139cba871e`.
- G7 시작: `d264405fd09b70ac85aebe4f4a857cadbe22981e`; NE6: `6dc41eead1a9d14fa7d4c817827dfaccb03cb1db`, engine-v1.68.2. `codex/native-editor-release-ne6-20260908`에 푸시. 상위 main/upstream 병합은 주장하지 않는다.
- G7 운영 대상은 `fde750cede7fda68329cea42fb706a00d4546bd3` 기준의 PHP 8개, core 번들 2개, 언어 2개다. 12개 기존 파일/부재 지문이 기준과 일치했다. 운영 Git HEAD만 보고 전체 checkout을 덮어쓰지 않는다.
- 로컬 런타임: `g7pb-dev`, `https://g7pb.test`, PHP 8.5.9, FPM 복수 worker. 원본 복원은 API 최신 lock_version을 사용했다.
- 상세 로그·화면·배포 후보 manifest: Local `.runtime/audits/native-ne6-evidence-20260908/`. G7 변경 전 backend는 `g7-before-backend.tar`에 보관했다.

## 해결한 결함

1. PHP associative JSON 변환이 `{}`를 `[]`로 바꾸었다. FormRequest의 기존 검증/출처 마스킹 후 종류를 복원하고, API resource·편집 응답·이력 조회/복원에 적용했다. 부모/확장 노드는 변경하지 않고 route 노드를 ID로 대응한다. 삭제된 값/키를 되살리지 않는다.
2. 저장 버전 확인과 쓰기가 분리되어 있었다. Repository의 행 잠금과 Service 트랜잭션으로 같은 원본의 본문·이력을 함께 직렬화했다. 실제 동시 HTTP 저장 8개에서 성공 1개/409 충돌 7개와 승자의 본문·버전 1 증가를 확인했다.
3. 이력 복원이 lock_version을 증가시키지 않았다. 실제 회귀 시험에서 재현 후 수정했고, 복원 전 편집본의 409 거절을 확인했다.
4. G7 전역 Enter 단축키가 확장 버튼의 제출을 가로챘다. 기본 상호작용과 이미 처리된 키 이벤트를 존중하며 수정키 저장 단축키는 유지한다.
5. 기존 주소 공존 시험이 제거된 ‘블록 종류’ 탭을 찾았다. 실제 현재 갤러리와 기존 Heading 선택자로 갱신했다. 제품 기능 버그로 집계하지 않는다.

## 필요한 검사와 실행 결과

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| JSON FormRequest red → green | 1 실패 재현 후 통과 | 빈 객체/목록/숫자 키, 출처 마스킹 |
| G7 PHP 순수 회귀 | 3 tests / 19 assertions 통과 | JSON 종류·노드 ID/출처·상속 슬롯 |
| G7 키보드 Vitest | 23 tests 통과 | 단축키 표/디스패치·기본 버튼 동작 |
| G7 Installation | 2 tests / 29 assertions 통과 | 별도 `g7_native_ne6_smoke_20260908` DB와 `/tmp/g7-native-ne6-smoke`, `composer test-smoke` |
| G7 Pint / production editor build | 통과 | 변경 PHP, `G7_BUILD_SOURCEMAP=0 npm run build:core-editor` |
| 네이티브 실제 브라우저/API | 10 시나리오 통과 | 기존 5개, Slider 2개, NE6 API/병렬/장애 3개 |
| 기존 PB 공존 | 1 시나리오 통과 | 생성·편집·미리보기·발행·주소·기기별 공개·재진입 |
| PB scoped 제출/통합 | 통과 | 정적 규칙·관련 타입·시험 수집; 수집 자체는 제품 동작 증거가 아님 |

실행은 `playwright test tests/E2E/nativeEditorContract.spec.ts tests/E2E/nativeSliderContract.spec.ts --project=desktop --retries=0`에서 이미 통과한 API 2개를 제외하고 진행했다. 복원·키보드 결함은 그 실패 시나리오만 다시 실행했다. 공존은 `pageAddressFlow.spec.ts --project=desktop --retries=0`. 실제 시나리오 결과는 `/tmp/ne6-api.log`, `/tmp/ne6-browser.log`, `/tmp/ne6-remaining.log`, `/tmp/ne6-coexistence-fixed.log` 및 위 증거 디렉터리에 보관한다.

자동 재시도·전체 프런트/coverage/E2E 반복은 하지 않았다. host PHP 수정은 PB 내부 코드 변경으로 숨기지 않으며 PB는 G7 공개 계약만 호출한다.

## 지원과 남은 한계

[호환 표](../compatibility.md)의 조합만 검증했다. 기존 NE1~NE5 원본·readonly·stale 응답·미디어/조합 권한 회귀와 NE6 변경 관련 실제 동작을 연결한다. 임의 테마/stock 호스트 지원으로 확대하지 않는다. Slider companion은 명시적으로 연결한 테마에서만 제공하며 기술 fixture를 운영 사이트에 설치하지 않는다.

## 배포·운영 확인

진행 중. 호스트/모듈 SHA와 버전, 백업 경로, 원격 checksum·공개 응답·로그인된 운영 편집 재열기를 확인한 후 실제 결과로 갱신한다. 운영 원본 콘텐츠를 검증을 위해 발행/덮어쓰지 않는다.
