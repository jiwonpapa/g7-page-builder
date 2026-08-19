# Runtime and hosting policy

## 결정

G7 Page Builder의 MVP 공식 지원 환경은 **단일 Ubuntu LTS VPS 기준**으로 제한합니다. 다만 제품 런타임에는 VPS 전용 구성요소를 넣지 않고, PHP 요청 처리와 사전 빌드된 브라우저 자산만 사용합니다.

이 결정은 다음 두 가지를 분리합니다.

- **공식 지원 범위**: 1인 개발자가 설치·장애·업데이트를 책임질 수 있는 환경
- **기술적 설치 가능성**: 필요한 조건을 충족한 공유호스팅에서도 실행 가능한 구조

초기에는 VPS만 공식 지원하지만, 구조적으로는 향후 `Shared Hosting Lite`를 열 수 있어야 합니다.

## 런타임 구성

```text
개발·CI
TypeScript/React --Node + Vite--> dist/js + dist/css
                                      |
                                      v
운영 서버
브라우저 편집기 <--> PHP/Laravel 모듈 <--> MySQL·Storage
                            |
                            v
                  마지막 정상 발행 결과
```

- Node.js와 Vite는 개발·CI 빌드 도구입니다.
- 운영 서버는 TypeScript를 컴파일하지 않습니다.
- 브라우저는 릴리스 ZIP에 포함된 JavaScript와 CSS만 실행합니다.
- Page Builder는 자체 Node.js 서버, SSR 서버, Rust daemon, Redis 또는 WebSocket을 런타임 필수조건으로 만들지 않습니다.
- G7 코어의 Queue·Scheduler·Reverb 사용 여부와 Page Builder의 기본 편집·발행 가능 여부를 분리합니다.

G7 공식 문서도 배포본에 빌드 산출물과 `vendor`가 포함되면 일반 운영 설치에 Node.js와 Composer가 필요하지 않다고 명시합니다. 참고: [G7 system requirements](https://github.com/gnuboard/g7/blob/main/docs/requirements.md).

## 프론트엔드 빌드·배포 계약

릴리스 빌드는 신뢰할 수 있는 로컬 또는 CI 환경에서만 수행합니다.

1. 고정된 Node·npm 버전으로 의존성을 설치합니다.
2. TypeScript strict, Vitest와 정적 경계 검사를 통과합니다.
3. Vite IIFE JavaScript와 CSS를 생성합니다.
4. `module.json`의 `assets.*.output`과 실제 파일 경로가 일치하는지 검사합니다.
5. sourcemap·비밀정보·`node_modules`를 제외합니다.
6. `dist`, `BUILD-INFO`, `SHA256SUMS`를 릴리스 ZIP에 포함합니다.
7. 대상 서버에서는 체크섬만 검증하며 `npm install`이나 `npm run build`를 실행하지 않습니다.

다음 조건이면 설치·업데이트를 중지합니다.

- 선언된 JS 또는 CSS 출력물이 없음
- `module.json`과 출력 경로가 다름
- 빌드 정보 또는 체크섬 불일치
- 지원 G7·PHP·문서 스키마·컴파일러 버전 불일치

## 호스팅 지원 등급

| 등급 | MVP 지원 | 요구사항 | 제한 |
|---|---|---|---|
| Ubuntu LTS VPS | 공식 지원 | PHP 8.5 최신 안정 패치, 지원 DB, HTTPS, G7 정상 설치 | 최초 기준 환경 하나만 운영 |
| 조건 충족 공유호스팅 | 기술 호환 후보 | SSH·PHP CLI, `public/` 웹루트, 쓰기권한, symlink, G7 설치 게이트 통과 | MVP 공식 지원 아님 |
| 제한형 공유호스팅 | 미지원 | SSH 없음, 차단 함수, 웹루트·symlink 변경 불가 | 설치 거부 |
| Node.js 호스팅 | 불필요 | 해당 없음 | Page Builder는 Node 런타임을 사용하지 않음 |

G7 7.0.7은 공식적으로 Cafe24 공유호스팅 설치 절차를 제공하지만, 모든 웹호스팅을 지원한다는 의미는 아닙니다. 참고: [G7 shared hosting installation](https://github.com/gnuboard/g7/blob/main/INSTALL.md#%EB%B0%A9%EB%B2%95-4-%EA%B3%B5%EC%9C%A0-%ED%98%B8%EC%8A%A4%ED%8C%85).

향후 `Shared Hosting Lite`를 제공하려면 한 개의 실제 대상 환경에서 다음 Doctor를 모두 통과해야 합니다.

- PHP 8.2+ 기술 호환성 및 MVP 기준 PHP 8.5 최신 안정 패치, 필수 확장, 지원 DB와 HTTPS
- SSH·PHP CLI와 G7 설치에 필요한 프로세스 함수
- `public/` 웹루트 또는 안전한 동등 구성
- `storage`, `bootstrap/cache`, 모듈 경로 쓰기권한
- 미디어 공개에 필요한 symlink 또는 공식 Storage 대안
- 사전 빌드된 `dist` 존재와 체크섬

Lite에서는 동기 Queue, 파일·DB Cache, 비실시간 발행을 기본으로 하고 Reverb, 상시 worker, 대량 미디어 변환, 대량 재컴파일은 지원하지 않습니다.

## 발행 성능 원칙

컴파일은 공개 요청마다 실행하지 않습니다.

```text
Draft 저장
  -> 스키마 검증
  -> 한 번 컴파일
  -> 컴파일 결과 검증
  -> Published 결과 원자적 교체
```

- 공개 페이지는 마지막 정상 `Published` 결과만 읽습니다.
- 새 컴파일이 실패하면 기존 발행본을 유지합니다.
- 성능 개선은 공개 렌더 경로의 재컴파일 제거와 캐시 적중을 먼저 확인합니다.
- 컴파일러 교체보다 문서 크기 제한, 결정적 출력과 복구 가능성을 우선합니다.

## 상용 이용·업데이트 경계

- MVP에는 원격 라이선스 서버, 도메인 활성화, 런타임 만료 또는 코드 인코딩을 넣지 않습니다.
- 구매한 릴리스와 이미 발행된 페이지는 기간 만료로 중단하지 않습니다.
- 계약상 허용 사이트 수와 재배포 제한은 상용 이용약관으로 관리하며, 기술적으로 완전한 복제 방지를 보장하지 않습니다.
- 유료 항목은 최초 설치·이관, 지원, 새 릴리스 접근, 호환성 업데이트와 메이저 업그레이드입니다.
- 업데이트 계약이 끝나도 설치된 버전은 계속 실행되며 신규 다운로드와 지원만 종료할 수 있습니다.
- Rust 바이너리, JavaScript 난독화 또는 로컬 서명 파일을 연간 사용료 강제 수단으로 소개하지 않습니다.

## Rust 정책

MVP에서는 다음 Rust 구성을 사용하지 않습니다.

- 상시 daemon 또는 별도 HTTP API
- PHP extension 또는 FFI
- 고객 서버에서 필수 실행되는 native binary
- 원격 컴파일 SaaS
- 라이선스 검사를 위한 Rust 바이너리

Rust 바이너리는 복제·호출 우회가 가능하므로 라이선스 강제 수단으로 간주하지 않습니다. 또한 현재의 JSON 문서 검증·컴파일에는 프로세스·OS·CPU 아키텍처별 배포 부담을 정당화할 성능 근거가 없습니다.

Rust는 PHP 기준 구현과 실제 병목이 존재한 뒤에만 **무상태 선택형 CLI**로 검토할 수 있습니다.

### 재검토 게이트

1. PHP 컴파일러로 10·100·500 블록 Fixture를 반복 측정합니다.
2. 출력 해시, p95 시간과 추가 peak memory를 기록합니다.
3. 500블록 p95가 500ms 이하이고 추가 peak memory가 64MB 이하이면 Rust를 도입하지 않습니다.
4. 기준을 넘으면 먼저 PHP 구현과 문서 구조를 최적화합니다.
5. 그래도 실패할 때만 최대 2일 Rust CLI spike를 허용합니다.
6. Rust가 전체 발행시간을 유의미하게 줄이고 출력이 PHP Fixture와 100% 일치할 때만 선택 기능으로 채택합니다.

허용되는 Rust CLI는 stdin으로 버전이 명시된 `PageBuilderDocument`를 받고 stdout으로 버전이 명시된 `CompileResult`만 반환해야 합니다. DB·G7·파일·네트워크에 접근하지 않으며, 실패·timeout·버전 불일치 시 마지막 정상 발행본을 유지합니다.

## 1인 개발 운영 범위

- 초기 설치·배포·장애 대응은 VPS 기준 한 종류만 문서화합니다.
- 공유호스팅별 예외를 사전 지원하지 않습니다.
- 실제 유료 설치 요청이 발생한 환경만 지원 후보에 추가합니다.
- 새 지원 환경은 동일 릴리스 ZIP으로 설치→편집→미리보기→발행→복구를 통과해야 합니다.
- 서버 종류를 늘리기 전에 제품 기능과 발행 안정성을 우선합니다.

## 현재 저장소의 배포 상태

로컬 asset build·manifest 검사, `dist`·`BUILD-INFO`·`SHA256SUMS` 패키징, 서버 checksum 검증, 전체 DB·기존 모듈 백업, 모듈 단위 배포와 온라인 스모크가 구현되어 있습니다. 1차 지원 대상은 PHP 8.5의 `g7devops` Ubuntu VPS 한 종류입니다.

제품 기능 중 Gallery·자체 MediaPort와 복구 가능한 문서 보관은 아직 미구현입니다. 이는 현재 Hero·Features·CTA·Contact 수직 slice의 배포 가능 여부와 구분합니다.
