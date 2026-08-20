# Changelog

이 프로젝트의 모든 주요 변경사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
[Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

## [0.7.0] - 2026-08-20

### Added

- 독립 블록 정의·프리셋·설치 패키지의 식별자와 상태를 정의하는 Block Pack v1 manifest·PHP/TypeScript Registry 계약을 추가했습니다.
- 블록 검색·분류·관리자별 즐겨찾기와 Data Preset 복사 카탈로그를 추가했습니다.
- ZIP Block Pack 설치·활성화·비활성화·문서/리비전 사용량 확인·사용 중 제거 차단을 추가했습니다.
- GitHub 안정 Release 목록에서 exact ZIP asset의 크기와 SHA-256 digest를 확인한 뒤 명시적으로 설치하는 업데이트 흐름을 추가했습니다.
- 발행자에 귀속된 Ed25519 서명, 파일 digest, 정확한 provider/compiler/schema/editor 등록을 요구하는 Code Pack runtime을 추가했습니다.

### Changed

- 기존 12개 블록을 `jiwonpapa/builtin-core` 내장 Pack으로 이관하고 compiler dispatch와 Puck gallery를 같은 manifest에서 파생하도록 변경했습니다.
- Block Pack 비활성화는 신규 추가만 숨기고 기존 문서의 편집·재컴파일 구현은 유지하도록 했습니다.

### Fixed

- 외부 Code Pack이 내장 Puck component를 덮어쓰거나 manifest에 없는 component를 등록하지 못하도록 차단했습니다.
- 신뢰 서명키를 publisher namespace에 귀속해 다른 발행자로 위장한 Pack에 재사용하지 못하도록 차단했습니다.
- 사용 중인 과거 block version을 누락하거나 기존 version 정의를 바꾸는 업데이트가 활성화되지 않도록 차단했습니다.

## [0.6.0] - 2026-08-20

### Added

- G7 코어와 기존 페이지 관리를 수정하지 않는 Page Builder 전용 공통 Header·Footer 설정과 사이트 이름·로고·메뉴·강조 버튼·푸터 문구 편집을 추가했습니다.
- 같은 메뉴 모델을 사용하는 데스크톱 내비게이션과 키보드·Escape·초점 복귀를 지원하는 모바일 메뉴를 추가했습니다.
- 인트로·캠페인 페이지에서 공통 Header·Footer를 끌 수 있는 문서별 `shell_mode` 계약을 추가했습니다.

### Changed

- 미리보기, `/pages/{slug}` 공개본과 선택형 홈(`/`)이 발행 시점의 `shell_mode`에 따라 공통영역을 일관되게 렌더합니다.
- 공통영역 변경도 공개 HTML ETag에 반영해 이전 Header·Footer가 304 응답으로 남지 않게 했습니다.

### Fixed

- 비어 있는 로고·푸터·메뉴를 정상 설정으로 저장하지 못하던 Laravel 입력 정규화 문제를 수정했습니다.
- 선택형 생성자 의존성 때문에 공개 뷰어와 홈 미들웨어에 공통영역 서비스가 주입되지 않던 문제를 수정했습니다.
- 브라우저 회귀시험이 관리자 언어와 다른 공통 설정을 복구하거나 실패 시 원래 오류를 가릴 수 있던 정리 절차를 수정했습니다.

## [0.5.2] - 2026-08-20

### Added

- Hero·분할 Hero·Slider Hero의 화면상 문구를 Puck 인라인 편집으로 직접 수정하고 Slider Hero의 편집 장면을 이전·다음·점 버튼으로 고정 선택할 수 있게 했습니다.
- 프런트엔드 V8 coverage와 PHP Unit+G7 integration Xdebug coverage를 로컬 품질 게이트와 CI 하한선으로 추가했습니다.

### Changed

- Hero 계열 중복 안내를 문서·블록 수 기준으로 닫아둘 수 있게 하고 일반 편집 알림에도 닫기 동작을 추가했습니다.
- Playwright 액션과 내비게이션에 fail-fast timeout을 적용해 무기한 대기 대신 회귀 지점을 즉시 보고하도록 변경했습니다.
- Slider Hero는 편집 중 자동재생을 중지하고 공개 발행본에서만 Embla 자동재생과 반복을 실행합니다.

### Fixed

- 성공·실패 여부와 관계없이 Page Builder E2E 문서와 업로드 이미지를 정리해 로컬 문서함에 테스트 데이터가 누적되지 않도록 수정했습니다.
- 대문자 시각 효과가 인라인으로 입력한 Hero 보조 문구의 실제 저장값까지 대문자로 바꾸던 문제를 수정했습니다.
- 문서 보관 통합 테스트가 존재하지 않는 속성을 읽어 PHP warning을 내던 문제를 수정했습니다.

## [0.5.1] - 2026-08-20

### Added

- G7 관리 화면에서 버전별 변경사항을 읽을 수 있도록 확장용 changelog 메타데이터와 자동 검사를 도입했습니다.
- 공개 API의 범위와 주·부·수 버전 선택 기준을 프로젝트 버전 정책으로 명문화했습니다.

### Changed

- 릴리스 패키지에 `CHANGELOG.md`를 포함하고, 버전 파일 불일치·잘못된 SemVer·누락된 현재 버전·정리되지 않은 Unreleased 항목이 있으면 패키징을 중단하도록 변경했습니다.

## [0.5.0] - 2026-08-20

### Added

- 생성·수정·발행 시각과 상태를 보여주는 독립 문서함, 공개 해제, 보관, 복원, 확인형 영구 삭제를 추가했습니다.
- JPG·PNG·WebP·AVIF·GIF 직접 업로드와 최근 이미지 재사용을 지원하는 모듈 전용 미디어 라이브러리를 추가했습니다.
- Embla 기반 Hero 슬라이더의 반복·자동재생·이동 버튼·상태 표시를 추가했습니다.
- 블록별 권장 효과를 한 번에 적용하거나 모두 해제하는 일괄 효과 기능을 추가했습니다.

### Changed

- Hero 계열 블록을 여러 개 배치해도 저장과 발행을 막지 않고 집중도 저하 가능성만 안내하도록 변경했습니다.
- 모바일에서도 효과·기기 미리보기·블록 추가 도구를 항상 사용할 수 있도록 상단 도구막대를 고정했습니다.

### Fixed

- 문서함의 빠른 상태 전환 중 오래된 목록 응답이 최신 상태를 덮을 수 있던 문제를 수정했습니다.
- 모바일에서 캔버스 블록 선택 후 속성 패널이 이전 블록을 가리키던 문제를 수정했습니다.

## [0.4.0] - 2026-08-20

### Added

- 12종 블록의 축소 미리보기와 분류·설명을 제공하는 블록 라이브러리를 추가했습니다.
- 블록을 캔버스의 원하는 위치로 끌어 놓고 순서를 바꿀 수 있는 편집 흐름을 추가했습니다.
- 모바일·태블릿·PC 캔버스 폭 전환 도구를 추가했습니다.

### Changed

- 텍스트 목록형 블록 추가 메뉴를 미리보기 카드가 있는 좌측 드래그 라이브러리로 변경했습니다.

### Fixed

- 블록 본문이 편집 화면에서 `[object Object]`로 표시될 수 있던 Rich Text 변환 문제를 수정했습니다.
- 블록 추가 메뉴가 내용 없는 축약 표시로 보이던 문제를 미리보기 카드 기반 라이브러리로 수정했습니다.

## [0.3.0] - 2026-08-20

### Added

- reveal·stagger·parallax·counter·chart 효과 프리셋과 움직임 줄이기 대응을 추가했습니다.

### Changed

- 임의 CSS·JavaScript 입력 대신 검증된 surface·spacing·motion 프리셋을 문서 스키마로 저장하도록 변경했습니다.

## [0.2.0] - 2026-08-19

### Added

- Hero 분할·Hero 슬라이더·로고·통계·가격표·팀·갤러리·막대그래프를 추가해 블록 카탈로그를 12종으로 확장했습니다.

### Changed

- 확장된 블록의 props를 문서 스키마와 PHP compiler에서 동일하게 검증하고 렌더링하도록 변경했습니다.

### Fixed

- 모듈 재설치 없이도 신규 migration과 선언형 권한이 동기화되도록 개발 설치 절차를 보강했습니다.

## [0.1.0] - 2026-08-19

### Added

- 독립 G7 Page Builder 모듈 골격과 코어 비수정 Adapter 경계를 추가했습니다.
- `PageBuilderDocument` v1 JSON Schema, Block SDK 타입, HTML compiler 계약을 추가했습니다.
- Puck 기반 독립 WYSIWYG 편집기와 Hero·Features·CTA·Contact 블록을 추가했습니다.
- 문서 목록·메타데이터 수정·revision 조회·미리보기·복원·공개 해제와 마지막 정상 발행본 유지 흐름을 추가했습니다.
- 기존 G7 페이지 관리와 분리된 관리자 메뉴, `/pages/{slug}` 공개 주소, 선택형 홈 페이지 연결을 추가했습니다.
- 과거 모듈 공개 주소를 canonical 공개 주소로 영구 이동하도록 구성했습니다.
- PHP 8.5·G7 7.0.7·MariaDB·Redis·HTTPS를 포함하는 단일 통합 Docker 개발환경을 추가했습니다.
- 체크섬·BUILD-INFO·백업·스모크 검증을 포함한 로컬 및 온라인 배포 하네스를 추가했습니다.
- 생성·편집·미리보기·2단계 발행을 검증하는 첫 브라우저 수직 테스트를 추가했습니다.

### Changed

- Page Builder가 draft·revision·publication을 직접 소유하고 G7 의존성을 공개 모듈 lifecycle·route·permission·asset 계약으로 제한하도록 저장·연동 경계를 확정했습니다.

### Fixed

- 공개 해제 후 오래된 발행 토큰으로 다시 공개할 수 있던 경쟁 조건을 차단했습니다.
