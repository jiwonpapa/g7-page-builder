# 6차 코드 재감사와 0.32.0 릴리스 범위

상태: **코드 통합·관련 검증·동일 기준 재감사 완료, 릴리스·배포 판정 대기**. 최종 제품 통합 SHA는 `69f0ede5645b0b3c0acc028e6484ed40137f1588`이다. 이 문서는 0.32.0에 포함할 코드와 검증 범위를 확정하지만, 릴리스 패키지 생성·Git push·원격 apply·사후 smoke 성공 영수증은 아니다. 이 문서의 커밋 이후 최종 gate와 외부 영수증이 모두 생겨야 릴리스·배포 완료로 판정한다.

## 범위와 판정 경계

6차는 PHP·TypeScript·JavaScript·CSS의 코드 구조, 정적 부채 원장, 공개 runtime 자산 분리, scoped 검사 선택, 빌드·릴리스·배포 하네스를 재감사했다. 기존 블록의 문구·이미지·샘플, 프리셋과 Page Kit의 상품성·콘텐츠 품질은 검사하거나 승인하지 않았다. 합성 fixture와 변경 코드에 관련된 검증만 사용했으며 콘텐츠·프리셋 전체 검사로 확대하지 않았다.

정적 gate와 변경 관련 브라우저 성공은 편집 기능 전체, 접근성 전체, 상용 수준 또는 운영 배포 성공을 뜻하지 않는다. 운영 판정은 배포 후 활성 모듈·registry·route·자산·편집기 URL을 외부에서 다시 확인해야 한다.

## 공개 runtime과 용량 계약

Embla 슬라이더를 기본 `page-effects.iife.js`에서 선택형 same-origin `page-sliders.iife.js`로 분리했다. 슬라이더가 없는 페이지는 main만 사용하며, 슬라이더가 있는 페이지는 optional bundle을 한 번 지연 로드한다. 빌드 산출물 계약에는 `dist/js/page-sliders.iife.js`와 `dist/meta/public-sliders-modules.json`을 포함했고, release와 개발 smoke의 자산 목록은 optional JS를 포함한 9개로 갱신했다.

Node 24의 실제 `gzipSync` 결과는 세 한도를 모두 통과했다.

| 자산 | 실제 gzip | 상한 | 판정 |
| --- | ---: | ---: | --- |
| main `page-effects.iife.js` | 20,923 byte | 24,000 byte | 통과 |
| optional `page-sliders.iife.js` | 10,057 byte | 12,000 byte | 통과 |
| main + optional | 30,980 byte | 34,000 byte | 통과 |

개별 bundle만 줄여 기존 부채를 옮기는 우회를 막기 위해 합산 상한도 실제 두 gzip 크기의 합으로 검사한다.

## planner와 하네스 보완

6-B는 예산·빌드 output·release 자산·브라우저 소유 매핑을 보완했다. 제출 SHA는 `b63225ff4e5a40e8d74f40c11fb5d68c8e725da5`, 통합 SHA는 `c69a1bc0d6ccec16ee8a02d703855ab35cc3e02f`다. 첫 제출은 `scripts/dev-verify.sh`가 미분류 입력이라 실행 전에 실패했고, 이 실패 로그를 보존했다. full fallback이나 범위 확대로 우회하지 않았다.

6-C는 별도 정확 범위에서 `scripts/dev-verify.sh`, `scripts/check-assets.mjs`, `scripts/generate-page-kit-screenshots.mjs`, `vite.sliders.config.ts`를 명시 분류했다. 앞의 asset controller는 제출에서 지연되는 `browser-assets`와 후속 `module-assets` 무결성 gate를 선택하고, 개발 smoke는 release 회귀와 shell syntax를 선택한다. 콘텐츠·프리셋 및 `full-product` gate는 자동 선택하지 않는다. 제출 SHA는 `fdbc360abfaf1ccb008fcca2e49f2cddf45da68a`, 통합 SHA는 `36b7942d06a0266d23ce4b800b0a0bfe01b1c329`다.

## 동일 기준 코드 재감사

최종 제품 통합 SHA에서 구조 검사와 기존 부채 지문을 다시 읽었다.

| 항목 | 최종값 | 판정 |
| --- | ---: | --- |
| 검사 제품 파일 | 366 | 전체 제품 소스 범위 |
| 신규 오류 | 0 | 통과 |
| 인정된 잔여 부채 | 220 | 미해소 상태 유지 |
| CSS-COLOR | 184 | 미해소 상태 유지 |
| CSS-IMPORTANT | 36 | 미해소 상태 유지 |
| 원장에 남았지만 더 이상 발생하지 않는 항목 | 0 | `unusedDebt=0` |

220개는 해결된 예외가 아니다. COLOR는 의미 토큰화와 실제 테마 검증, IMPORTANT는 접근성·reduced-motion·vendor/runtime 상태와 우선권 사유의 후속 검토가 필요하다. 이번 JS·planner·release 변경으로 이 CSS 부채를 해소했다고 계산하지 않는다.

## 변경 관련 브라우저 결과

인증된 Local G7 runtime에서 선택된 브라우저 묶음 12건과 3건, 합계 15건이 성공했다. skip·fail·flaky는 모두 0이다. 제출 단계의 지연 표시나 hosted CI 수집을 브라우저 성공으로 계산하지 않았다. 이 결과는 optional slider 로드·공개 runtime·관련 자산 경로의 변경 범위를 검증한 것이며 제품 전체 콘텐츠·프리셋 승인이나 상용 수준 판정은 아니다.

hosted CI에는 인증된 G7 runtime과 로그인 상태가 아직 없다. browser requirement를 정적 성공이나 skip으로 바꾸지 않는 fail-closed 정책은 유지하며, hosted 인증 runtime 구축은 미해결 운영 항목이다.

## 배포 전 상태와 rollback 경계

2026-09-04 읽기 전용 사전 감사의 운영 상태는 다음과 같다.

| 대상 | 배포 전 상태 |
| --- | --- |
| 활성 모듈 target | 없음 |
| DB module registry | 해당 row 없음 |
| Page Builder route | 0개 |
| 제공된 editor URL | HTTP 404 |

이는 신규 배포 전 파일·registry·route 부재와 일치한다. 이후 성공한 설치·활성화·route 등록·편집기 응답을 뜻하지 않는다.

배포 하네스는 기존 파일 target의 복구 경로를 가지지만 DB 단위 원자 rollback은 제공하지 않는다. migration, `module:install`, registry·menu·permission row와 activation side effect는 파일 복구와 함께 자동 원복되지 않을 수 있다. apply 실패 뒤에는 같은 검증 archive로 재시도한 후 marker·checksum, 활성 모듈, registry version, route, pending migration, Site Part 준비 상태와 9개 자산을 다시 확인해야 한다.

## 0.32.0 릴리스와 남은 최종 gate

0.32.0은 1~6차 코드 구조 개선과 optional slider 분리를 묶는 minor release다. 이 문서 task는 `module.json`, `package.json`, `package-lock.json` 루트 및 `packages[""]`의 버전을 일치시키고 기존 Unreleased 항목을 2026-09-04의 0.32.0 항목으로 확정한다.

릴리스·배포 완료는 이 문서 커밋 이후 다음 증거로 판정한다.

1. release 모드 버전 정책과 최종 integration gate 성공
2. 검증된 dist의 build fingerprint와 release archive checksum
3. 원격 Git ref가 가리키는 정확한 release SHA
4. 원격 apply·PHP reload·post-deploy smoke 영수증
5. 활성 module·registry version·route와 9개 자산의 외부 확인
6. 인증된 편집기 URL의 실제 응답 확인

현재 확정된 것은 코드 재감사와 0.32.0 릴리스 범위다. package·push·apply·smoke·편집기 복구는 위 외부 영수증이 생기기 전까지 미완료다.

## 외부 증거

6차 증거는 외부 `structure-remediation/phase6-close/` 폴더의 `post-integration-architecture.json`, `post-integration-budget.stdout`, 사전 운영 감사 JSON과 6-A 제출 로그에 보존했다. 6-B·6-C의 계약 red, 최초 제출 실패와 정상 제출 로그도 같은 구조 개선 증거 폴더에 보존했다. 저장소 문서는 확정 수치와 판정 경계만 기록하며 외부 영수증이 없는 release·deploy 성공을 대신하지 않는다.
