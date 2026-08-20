# 지원소프트 공식 무료 마켓 구현 배치

기준 버전: `0.10.0`

## B1. 단일 발행자 계약과 배포 서버

- 발행자는 `jiwonpapa` 한 곳으로 고정한다.
- 상품은 `free`, `block_pack`, `page_kit`만 허용한다.
- G7 모듈이 HTTPS 카탈로그·미리보기·불변 ZIP 엔드포인트를 제공한다.
- 카탈로그 URL과 아티팩트 호스트는 서버 설정 allow-list로 제한한다.
- 제3자 등록, 판매자 계정, 결제, 리뷰, 정산 API는 만들지 않는다.

완료 기준: 로컬과 `g7devops.com`에서 카탈로그와 모든 digest 선언 파일을 내려받을 수 있다.

## B2. 빌더 내 마켓 브라우저

- 독립 문서함에서 `무료 마켓`을 연다.
- 이름·설명·태그 검색과 Block Pack/Page Kit 필터를 제공한다.
- 상품 이미지, 무료/종류/버전/태그/호환성/설치 상태를 먼저 보여준다.
- 미리보기는 새 탭에서 크게 열고, 설치·적용은 인증된 관리자만 실행한다.

완료 기준: PC·태블릿·모바일에서 목록, 필터, 이미지, 비활성 사유와 버튼 레이아웃을 확인한다.

## B3. 공식 Block Pack 직접 설치

- 브라우저가 보낸 URL은 사용하지 않고 catalog의 id/version으로 서버가 상품을 다시 찾는다.
- HTTPS host, redirect 금지, byte limit, SHA-256, manifest id/version, 호환성을 검증한다.
- Data Pack은 기존 preset registry에 활성화하고 Code Pack은 기존 신뢰 서명 정책을 그대로 적용한다.
- 설치된 팩은 기존 사용량 보호 규칙으로 비활성화·제거한다.

완료 기준: 마켓에서 설치 후 블록 카탈로그에 preset이 나타나며, manifest 위장·digest 불일치는 설치 흔적 없이 거부된다.

## B4. Page Kit 배포·적용

- 문서별 `Page Kit 배포 ZIP` 내보내기를 제공한다.
- 모듈 소유 이미지는 ZIP에 포함하고 `g7pb-media://` 참조로 바꾼다.
- 사이트 기능 링크는 `g7pb-route://`로 휴대하고 적용 서버의 활성 템플릿 route catalog로 해석한다.
- 적용 시 문서·모든 블록 instance UUID를 새로 만들고 `shell_mode=template`의 미발행 초안 한 개만 생성한다.
- 기존 문서, 공개본, 홈, Header, Footer, Site Shell, G7 기본 페이지 관리는 건드리지 않는다.

완료 기준: `적용 → 새 초안 → 편집기 이동 → 다시 ZIP 내보내기`가 실제 브라우저와 API에서 통과한다.

## B5. 무결성·회귀 하네스

- catalog/Page Kit JSON Schema와 SemVer를 검사한다.
- ZIP traversal, symlink, 중복 경로, undeclared file, 압축 해제 크기, 이미지 MIME·크기·digest를 fail-closed로 검사한다.
- PHP unit/integration, PHPStan, Pint, TypeScript strict, Vitest coverage를 통과한다.
- Playwright가 공식 팩 설치와 정리, Page Kit 적용과 정리, export ZIP, 3개 viewport를 확인한다.
- E2E가 만든 `store-e2e-*` 문서는 성공·실패·재시도와 무관하게 정리한다.

완료 기준: 로컬 `make quality-gate TASK=official-free-marketplace`가 통과한다.

## B6. 버전·패키지·배포

- Keep a Changelog 1.1.0과 SemVer 2.0.0에 따라 `0.10.0`으로 배포한다.
- release ZIP에 config, schemas, catalog, preview, artifact, BUILD-INFO, SHA256SUMS를 포함한다.
- 로컬 설치·브라우저 검증 후 동일 clean artifact를 `g7devops` 테스트 서버에 배포한다.
- 테스트 서버 DB 백업 작업은 수행하지 않는다.

완료 기준: Git commit/push, 로컬 URL, 온라인 catalog/artifact와 관리자 smoke 증거를 남긴다.

## 이번 배치 제외

- 제3자 마켓, 누구나 업로드, 판매자·구매자 계정
- 유료 결제, 라이선스 entitlement, DRM, 정산
- 기존 페이지 덮어쓰기 또는 자동 발행
- G7 코어·기본 페이지 관리·템플릿 레이아웃 수정
