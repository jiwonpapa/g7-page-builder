# Staging deployment harness

## 결론

온라인 스테이징은 로컬 개발을 대신하지 않습니다. 로컬 Docker와 CI 게이트를 통과한 버전 아티팩트만 `g7devops.com`에 배포합니다.

배포 하네스는 구현되어 있습니다. 로컬 전체 게이트를 통과하고 깨끗한 Git commit으로 만든 모듈 아티팩트만 단일 스테이징 서버에 배포합니다.

## 대상

| 항목 | 값 |
|---|---|
| SSH 별칭 | `g7devops` |
| G7 루트 | `/home/g7devops/public_html` |
| 공개 기준 주소 | `https://www.g7devops.com` |
| 관리자 로그인 | `https://www.g7devops.com/admin/login` |
| 페이지 빌더 문서함 | `https://www.g7devops.com/admin/page-builder` |

apex 도메인이 `www`로 이동하는 경우 하네스는 최초 응답과 최종 HTTPS 주소를 모두 검증합니다. 리다이렉트 정책을 배포 스크립트가 임의로 변경하지 않습니다.

## 인증과 비밀정보

배포 스크립트는 비대화식 SSH와 호스트 키 검증을 사용합니다. 저장소에는 SSH 키, 관리자 계정, DB 비밀번호, 세션 또는 API 토큰을 저장하지 않습니다.

인증 E2E가 필요하면 다음 값은 CI secret 또는 로컬 비추적 환경 파일에서만 전달합니다.

```text
G7PB_STAGING_ADMIN_EMAIL
G7PB_STAGING_ADMIN_PASSWORD
```

로그에는 자격증명, 쿠키, Authorization 헤더와 `.env` 내용이 출력되면 안 됩니다.

## 배포 단위

배포 단위는 G7 전체 checkout이 아니라 Page Builder 모듈의 버전 아티팩트입니다. 아티팩트에는 다음 항목만 포함합니다.

- `module.json`, `module.php`, `CHANGELOG.md`
- `src`, `schemas`, 필요한 `resources`
- 검증된 프론트엔드 `dist`
- 설치·업그레이드에 필요한 migration과 manifest
- `BUILD-INFO`, `SHA256SUMS`

개발 dependency, 테스트 캐시, `.env`, 로컬 인증서, `node_modules`, G7 코어 소스는 포함하지 않습니다. 서버에서 Node 빌드를 수행하지 않습니다.

`BUILD-INFO`에는 최소한 다음 값을 기록합니다.

- Page Builder Git commit과 버전
- `schema_version`, `compiler_version`
- 지원 G7·Laravel·PHP 범위
- Node·npm·Composer 빌드 버전
- 생성 시각과 CI 실행 식별자

## 하네스 단계

### 1. Doctor

- 작업 트리와 빌드 입력 확인
- 빌드 환경의 Node·npm·Composer 버전 확인
- 대상 서버의 PHP·PHP-FPM·DB 버전 확인 (Node 런타임은 요구하지 않음)
- 필요한 G7 capability 확인
- 테스트 서버 SSH, 디스크, PHP-FPM, MySQL 상태 확인
- Redis·Queue·Reverb는 G7 구성 상태로 기록하되 Page Builder 필수조건으로 간주하지 않음
- 대상 모듈 경로와 기존 버전 확인
- 동일 release id의 중복 배포 차단

G7 전체 checkout의 기존 사용자 변경을 수정하거나 정리하지 않습니다. 모듈 대상 경로에 예상하지 못한 변경이 있으면 배포를 중지합니다.

### 2. Gate

- 모든 Worktree task 통합 완료와 active integration task 단독 상태 확인
- integration task가 소유한 단일 Local runtime에서 coordination 회귀시험 실행
- SemVer 문법, 네 버전 원본 일치, Keep a Changelog 형식과 현재 버전 항목 검사
- 릴리스 시 `Unreleased`가 비어 있는지 검사
- Composer validate·audit
- PHPUnit, Pint `--test`, PHPStan/Larastan
- TypeScript strict, Vitest, production build·asset manifest 검사
- 아키텍처 경계 검사
- Playwright 로컬 생성→편집→미리보기→발행
- 과거 Fixture 재컴파일과 결정적 출력 비교

### 3. Package

- 깨끗한 임시 디렉터리에서 프론트엔드 빌드
- 허용 파일만 아티팩트에 포함
- sourcemap·비밀정보·개발 파일 검사
- `BUILD-INFO`, `SHA256SUMS` 생성
- 압축 해제 후 체크섬 재검증

### 4. Temporary file rollback

- `g7devops.com`은 테스트 스테이징이므로 배포 하네스가 DB dump를 만들지 않음
- 기존 Page Builder 모듈 디렉터리는 파일 교체가 끝날 때까지만 임시 rollback 경로에 유지
- 배포 중 오류가 나면 임시 디렉터리로 즉시 복원
- 배포 성공 후 임시 rollback·업로드·작업 디렉터리를 삭제하며 영구 백업을 누적하지 않음
- 데이터 보존이 필요한 운영 배포 하네스는 스테이징과 분리하여 별도로 설계

### 5. Deploy

- 배포 잠금 획득
- 새 릴리스 디렉터리에 업로드
- 서버에서 체크섬 검증
- 원자적 활성 경로 전환
- 필요한 경우에만 명시된 migration 실행
- Laravel 캐시와 G7 확장 캐시는 문서화된 범위만 갱신

기존 G7 템플릿, 레이아웃, 코어 파일과 다른 모듈은 수정하지 않습니다.

### 6. Verify

- TLS와 canonical redirect
- 공개 화면과 관리자 로그인 화면 HTTP 상태
- 모듈 설치·활성 상태 및 버전
- 정적 자산 200, MIME, 캐시 헤더
- 인증된 생성→편집→미리보기→발행 흐름
- 발행 결과 공개 렌더링
- PHP·Nginx 오류 로그의 신규 오류

자동 게이트 통과와 사람의 시각·제품 승인은 별도로 기록합니다.

### 7. Rollback

스모크가 실패하면 신규 활성화를 중지하고 직전 파일 아티팩트와 마지막 정상 발행본으로 돌아갑니다. 비가역 DB migration이 있으면 자동 배포하지 않습니다.

롤백 후 동일 스모크를 다시 실행하고 결과를 release 기록에 남깁니다. 실패한 릴리스는 자동 재시도하지 않습니다.

## 실행 명령

| 명령 | 책임 |
|---|---|
| `make staging-doctor` | 대상·버전·접속·상태 확인 |
| `make integration-verify TASK=<id>` | 전체 로컬 품질 게이트, 실제 포인터 편집을 포함한 3 viewport 제품 E2E, 검증 SHA 기록 |
| `make release-package TASK=<id>` | 검증 SHA와 clean 상태 확인 후 버전 아티팩트·체크섬 생성 |
| `make deploy-staging TASK=<id>` | release guard 재확인, 임시 파일 rollback을 둔 단일 스테이징 배포 |
| `make smoke-staging TASK=<id>` | release guard 재확인, 공개·관리자 shell·asset·route·migration 스모크 |

`release-package`는 `integration-verify`가 기록한 SHA와 현재 HEAD가 다르거나 dirty 상태이면 즉시 거부합니다. 이후 버전 정책을 검사하고 `CHANGELOG.md`, `BUILD-INFO`, 파일별 `SHA256SUMS`, 압축 아티팩트 SHA-256을 만듭니다. `Unreleased`에 항목이 남아 있으면 새 SemVer 섹션과 버전 원본을 확정하기 전까지 패키징할 수 없습니다. `deploy-staging`은 같은 release guard와 서버 Doctor를 다시 실행하고, DB dump 없이 기존 모듈 디렉터리만 임시 rollback 경로로 옮긴 뒤 새 모듈을 교체합니다. 파일 교체 중 실패하면 이전 모듈 디렉터리를 자동 복원하고, 성공하면 임시 파일을 제거합니다.

스테이징에는 DB 복구본이 없으므로 destructive migration을 배포하지 않습니다. migration은 additive·forward-only여야 하며, 데이터 변환이나 컬럼 제거가 필요한 변경은 별도 승인과 운영용 백업 절차가 정의되기 전까지 중지합니다.

## 배포 완료 판정

다음 증거가 모두 있어야 스테이징 배포 완료입니다.

1. 배포 release id와 Git commit
2. 업로드 전후 SHA-256 일치
3. 배포 중 임시 파일 rollback 동작과 성공 후 정리
4. 모듈 설치·활성 버전 확인
5. 공개 HTTPS 스모크
6. 로컬 인증 E2E 생성→실제 포인터 범위 편집→저장·재로드→미리보기→발행 결과와 온라인 route·asset 스모크
7. 신규 서버 오류 없음
8. 실패 시 롤백 재검증

스테이징 관리자 자격증명이 별도 secret으로 제공된 경우에만 온라인 인증 E2E까지 수행합니다. 자격증명이 없으면 기존 관리자 계정을 변경하거나 새 계정을 만들지 않고, 그 제한을 배포 결과에 명시합니다. 소스 코드, 계획 또는 CI 성공만으로 온라인 배포 완료라고 보고하지 않습니다.
