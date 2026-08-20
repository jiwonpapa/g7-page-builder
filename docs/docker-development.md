# Docker local development

## 결론

Mac mini의 로컬 개발환경은 **Compose 프로젝트 1개, 실제 컨테이너 1개**로 구성합니다.

```text
g7pb-dev container
├── Nginx HTTPS :443
├── PHP 8.5.9 FPM/CLI + Xdebug
├── MariaDB 10.11
├── Redis 7
├── G7 Queue/Scheduler/Reverb 실행 래퍼
├── Node 24.19.0 + npm 11.17.0 + Vite
├── Composer 2.10.2 + PHPUnit 13 + Pint + PHPStan
└── Playwright 1.62.1 + Chromium (시험할 때만 실행)
```

Nginx·PHP·DB·Redis를 서비스별 컨테이너로 분리하지 않습니다. `supervisord`가 한 컨테이너 안의 장기 프로세스를 관리합니다. 이 올인원 구성은 로컬 개발 전용이며 스테이징·운영 배포 구조로 재사용하지 않습니다.

## 현재 설치 기준

| 항목 | 값 |
|---|---|
| Compose 프로젝트 | `g7pb-dev` |
| 컨테이너 | `g7pb-dev` 1개 |
| 로컬 도메인 | `https://g7pb.test` |
| PHP | 공식 이미지 `8.5.9-fpm-bookworm` |
| Laravel | G7 lock 기준 `12.62.0` |
| G7 | `7.0.7`, commit `0e8b625436df7fb30cf1632f42d9d6bcb39ac37b` |
| Node | 24.19.0, npm 11.17.0 |
| Composer | 2.10.2 |
| DB | MariaDB 10.11, `utf8mb4_unicode_ci` |
| Cache 도구 | Redis 7, 내부 localhost 전용 |
| 공개 포트 | `127.0.0.1:443`만 |

PHP 8.5.9는 2026-08-19 구성 당시 PHP 8.5의 최신 안정 보안 릴리스입니다. 패치 버전을 변경할 때는 Dockerfile, 설치 시험과 이 문서를 함께 갱신합니다.

## 호스트에 필요한 두 가지 예외

다음 두 작업은 macOS 브라우저가 사용하므로 Docker 내부에서 처리할 수 없습니다.

1. `/etc/hosts`의 `127.0.0.1 g7pb.test`
2. macOS 신뢰 저장소의 mkcert 로컬 CA

leaf 인증서와 키는 `.runtime/tls`에 생성하고 컨테이너 Nginx에 읽기 전용으로 마운트합니다. mkcert 루트 CA 개인키는 컨테이너에 전달하지 않습니다.

```text
.runtime/tls/g7pb.test.pem
.runtime/tls/g7pb.test-key.pem
```

현재 인증서 SAN은 `DNS:g7pb.test`이며 HTTP 우회 주소를 제공하지 않습니다.

## 소스와 영속 데이터

G7 코어는 제품 Git과 분리된 `.runtime/gnuboard7` checkout을 bind mount합니다. Page Builder 저장소는 G7 활성 모듈 경로에 별도 bind mount합니다.

```text
host .runtime/gnuboard7
  -> /var/www/g7

host g7-page-builder
  -> /var/www/g7/modules/jiwonpapa-page_builder
```

Linux 전용 의존성과 데이터는 다음 전용 named volume에 둡니다.

| 볼륨 | 용도 |
|---|---|
| `g7pb-dev-state` | MariaDB와 Redis 데이터 |
| `g7pb-dev-g7-vendor` | G7 Composer vendor |
| `g7pb-dev-g7-node-modules` | G7 Linux node_modules |
| `g7pb-dev-module-node-modules` | Page Builder Linux node_modules |
| `g7pb-dev-module-vendor` | Page Builder Composer dev vendor |
| `g7pb-dev-module-runtime` | 모듈 안에서 재귀 노출되는 `.runtime` 차단 |

Mac의 `node_modules`를 Linux 컨테이너와 공유하지 않습니다. 다른 프로젝트 컨테이너·볼륨·BuildKit 캐시는 정리하지 않습니다.

## 최초 설치

```bash
make dev-bootstrap
make dev-doctor
make dev-up
make dev-install
make dev-verify
make dev-infra-e2e
```

각 단계의 책임은 다음과 같습니다.

- `dev-bootstrap`: 무작위 로컬 자격증명과 mkcert leaf 인증서 생성
- `dev-doctor`: Docker, G7 tag, hosts, 인증서, 443, Compose 검사
- `dev-up`: 올인원 이미지 빌드 후 컨테이너 1개 기동
- `dev-install`: Composer dev 의존성 설치 후 G7 공식 `/install` 흐름 실행
- `dev-verify`: TLS·버전·확장·DB·Redis·G7·관리자 인증·모듈 상태 검사
- `dev-infra-e2e`: 같은 컨테이너의 Playwright/Chromium으로 공개·로그인 화면을 세 viewport에서 assertion

`dev-install`은 직접 `migrate + db:seed`를 조합하지 않습니다. 공식 설치 API를 같은 세션으로 수행하고 마지막 `finalize-env`까지 호출합니다.

설치되는 G7 기본 확장은 다음과 같습니다.

- 관리자 템플릿 `sirsoft-admin_basic`
- 사용자 템플릿 `sirsoft-basic`
- 모듈 `sirsoft-board`, `sirsoft-ecommerce`, `sirsoft-page`
- 플러그인 `sirsoft-daum_postcode`
- 개발 중인 `jiwonpapa-page_builder` 설치·활성화

앞의 번들 확장은 `sirsoft-basic` 기본 사이트를 함께 시험하기 위한 로컬 fixture입니다. Page Builder의 `module.json` 의존성은 module/plugin 모두 비어 있으며, 제품 코드는 이 확장들을 import하거나 호출하지 않습니다. 별도 최소 설치 profile은 첫 공개 viewer 구현과 함께 통합 게이트에 추가합니다.

## 접속

| 용도 | 주소 |
|---|---|
| 공개 화면 | `https://g7pb.test/` |
| 상태 확인 | `https://g7pb.test/up` |
| 관리자 로그인 | `https://g7pb.test/admin/login` |
| 모듈 관리 | `https://g7pb.test/admin/modules` |
| Page Builder 편집기 | `https://g7pb.test/modules/jiwonpapa-page_builder/admin/editor` |

관리자 자격증명은 Git에서 제외된 `.env.docker.local`에만 있습니다.

```bash
make dev-credentials
```

이 명령은 사용자가 명시적으로 요청할 때만 로컬 비밀번호를 표시합니다. 일반 로그와 검증 출력에는 비밀번호·쿠키·토큰을 남기지 않습니다.

## 일상 명령

| 명령 | 책임 |
|---|---|
| `make dev-status` | 컨테이너와 Supervisor 프로세스 상태 |
| `make dev-logs` | `g7pb-dev` 로그만 추적 |
| `make dev-shell` | 통합 컨테이너 shell |
| `make dev-build-assets` | 컨테이너 Node로 Page Builder IIFE 빌드 |
| `make dev-sync` | asset 빌드 후 모듈 migration·권한 선언·G7 cache 동기화 |
| `make dev-deps` | 컨테이너 안에 모듈 Composer/npm 의존성 설치 |
| `make quality-php` | Composer validate·Pint·PHPStan·PHPUnit |
| `make quality-frontend` | TypeScript·Vitest·경계·build·asset 검사 |
| `make quality-g7` | TLS·DB·G7 설치·모듈·관리자 인증 검사 |
| `make quality-gate` | 위 세 품질 게이트 실행 |
| `make dev-check` | PHP·Frontend 품질 게이트 |
| `make dev-browser-smoke` | 공개·로그인 화면 증거 캡처 |
| `make dev-infra-e2e` | 공개·로그인 실제 browser assertion |
| `make dev-e2e` | 페이지 빌더 제품 lifecycle E2E(PC·태블릿·모바일) |
| `make dev-down` | 컨테이너 종료, 데이터 유지 |

G7의 기본 `drivers.json`은 cache=file, session=file, queue=sync, websocket off입니다. Redis와 Reverb 실행 환경은 준비되어 있지만 Page Builder 필수 런타임으로 만들지 않습니다. Scheduler는 설치 후 실행하고, Queue/Reverb 래퍼는 유효 설정이 켜질 때만 실제 worker/server를 시작합니다.

## 초기화

`dev-down`은 데이터를 삭제하지 않습니다. 전용 로컬 DB와 의존성 볼륨을 전부 초기화할 때만 아래 명시적 확인값을 사용합니다.

```bash
CONFIRM=RESET_G7PB_DEV make dev-reset
```

이 명령은 `g7pb-dev`와 `g7pb-dev-*` 볼륨만 대상으로 합니다. 다른 Docker 프로젝트, 익명 볼륨 또는 BuildKit cache는 삭제하지 않습니다.

## 완료 판정과 제품 경계

로컬 환경 설치 완료 판정은 다음 증거를 사용합니다.

1. 컨테이너가 정확히 1개이고 `127.0.0.1:443`만 공개
2. PHP 8.5.9와 필수 16개 확장 로드
3. Nginx·PHP-FPM·MariaDB·Redis 정상
4. 신뢰된 `g7pb.test` HTTPS
5. G7 installer lock·migration·기본 확장 정상
6. 관리자 API 로그인 성공
7. Page Builder 모듈 설치·활성
8. 컨테이너 내부 Playwright 인프라 E2E assertion

환경 완료와 Page Builder 제품 완료는 다릅니다. 현재 별도 관리자 메뉴, 12종 block의 schema·editor·compiler·renderer, MediaPort 업로드, 문서 보관/복원, 핵심 편집·미리보기·발행·복원·공개 해제 E2E, 릴리스 패키징과 스테이징 배포 하네스는 구현됐습니다. 기본 SEO와 시각 baseline 보강은 다음 제품 범위입니다.

## 문제 확인 순서

```bash
make dev-doctor
make dev-status
make dev-verify
docker logs --tail 200 g7pb-dev
```

확인 순서는 hosts → mkcert SAN → 443 충돌 → Supervisor → PHP-FPM → DB → G7 `.env`와 installer marker입니다. 오류가 나도 HTTP 우회, 다른 DB 포트 공개 또는 타 프로젝트 볼륨 삭제로 해결하지 않습니다.
