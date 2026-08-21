# Changelog

이 프로젝트의 모든 주요 변경사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르며,
[Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### Changed

- 현재 Page Builder 내부 Official Store를 독립 마켓 완료본이 아닌 정적 배포 시험 하네스로 정정하고, 향후 `g7devops.com` 전용 단일 발행자 마켓 모듈의 착수 게이트·관리자·DB·API·보안·TDD·이관 완료 기준을 별도 스펙으로 고정했습니다.

## [0.13.0] - 2026-08-21

### Added

- 로고 캐러셀, 후기 슬라이더, 이벤트 일정, 다운로드 자료, G7 검색·필터 콘텐츠 아카이브, G7 상품 쇼케이스를 추가했습니다.
- 콘텐츠 아카이브는 최초 공개 API 응답을 브라우저에서 제목·게시판 기준으로 즉시 필터링하고 키보드 입력과 빈 상태를 지원합니다.

### Changed

- 내장 Block Pack과 검색 가능한 블록 라이브러리를 23종에서 29종으로 확장하고 내장 Pack 버전을 0.10.0, HTML compiler를 0.9.0으로 올렸습니다.
- Hero, 로고, 후기 슬라이더가 같은 접근성·자동재생 중지·reduced-motion 계약을 공유하도록 공개 경량 런타임을 확장했습니다.

### Security

- 다운로드와 일정 링크는 기존 허용 URL 정책을 적용하고 G7 데이터 variant는 공개 API endpoint·허용된 상세 기본 경로만 컴파일합니다.
- G7 capability가 없거나 응답이 실패해도 임의 HTML을 삽입하지 않고 블록별 실패·빈 상태만 표시합니다.

## [0.12.0] - 2026-08-21

### Added

- 고객 후기, FAQ 아코디언, 프로세스·타임라인, 탭 콘텐츠, 비교표, 에디토리얼 목록, 안전한 YouTube·Vimeo 영상 블록을 추가했습니다.
- FAQ 단일 열림 제어와 탭의 방향키·Home·End 탐색, 자동 ARIA 연결을 공개 경량 런타임에 추가했습니다.

### Changed

- 내장 Block Pack과 검색 가능한 블록 라이브러리를 16종에서 23종으로 확장하고 내장 Pack 버전을 0.9.0, HTML compiler를 0.8.0으로 올렸습니다.
- 새 반복 블록의 화면상 문구는 캔버스 인라인 편집, 이미지·라우트·구조·표시 방식은 typed 속성으로 편집하도록 통일했습니다.

### Security

- 영상 블록은 임의 iframe·URL·스크립트를 저장하지 않고 YouTube·Vimeo 제공자와 검증된 영상 식별자만 컴파일합니다.
- 공개 CSP의 `frame-src`를 OpenStreetMap·Google Maps·YouTube Privacy Enhanced·Vimeo로 명시 제한했습니다.

## [0.11.0] - 2026-08-21

### Added

- 라이트·다크·기기 설정 테마를 문서 토큰으로 저장하고 편집 캔버스와 공개 페이지에서 즉시 확인하는 전역 테마 기능을 추가했습니다.
- Page·Header·Footer를 한 캔버스에서 확인하고 Page Builder 소유 Site Part를 같은 작업 화면에서 편집하는 전체 사이트 편집 흐름을 추가했습니다.
- 선택 블록의 글자 크기·정렬, 주요 버튼의 G7 route 연결, Hero 이미지 업로드·비우기를 캔버스 문맥 도구에서 직접 실행할 수 있게 했습니다.
- 좌·우 drawer 또는 dropdown을 선택하는 모바일 메뉴와 초점 고정·Escape·backdrop 닫기 접근성을 추가했습니다.
- 문의·견적·예약·신청·뉴스레터 폼 블록, DB 선저장·메일 전달·재시도·관리자 문의함과 OpenStreetMap·Google·지도 숨김을 지원하는 찾아오기 블록을 추가했습니다.

### Changed

- 내장 Block Pack과 검색 가능한 블록 라이브러리를 14종에서 16종으로 확장하고 주요 반복 콘텐츠도 캔버스에서 직접 문구를 편집하도록 개선했습니다.
- 페이지 디자인 속성에 제목과 짧은 설명을 붙이고 Header·Footer 템플릿 소유권을 캔버스에서 명확히 구분하도록 개선했습니다.

### Fixed

- 미디어·라우트 카탈로그 API 실패 시 선택기가 무한 재요청하던 문제를 수정했습니다.
- 문서 안에서 Header·Footer 편집기로 전환할 때 Site Part 상태 콜백이 반복되던 문제와 다크/기기 테마의 기본 surface 우선순위 문제를 수정했습니다.

### Security

- 공개 문의는 발행본에 존재하는 정확한 Form block UUID만 허용하고 honeypot·최소 작성 시간·rate limit·CSRF·IP HMAC을 적용합니다.
- 문서에는 수신 메일 주소·임의 form action·지도 script를 저장하지 않으며 문의 데이터는 메일 실패 전 DB에 먼저 보존합니다.

## [0.10.0] - 2026-08-20

### Added

- 지원소프트 단일 발행자의 공식 무료 Block Pack·Page Kit 카탈로그와 immutable ZIP·미리보기 배포 endpoint를 추가했습니다.
- 문서함에서 공식 무료 마켓을 검색·필터·미리보기하고 Block Pack을 바로 설치하거나 Page Kit을 새 미발행 초안으로 적용하는 흐름을 추가했습니다.
- 현재 페이지와 Page Builder 소유 이미지를 휴대 가능한 Page Kit ZIP으로 내보내는 운영자 배포 기능을 추가했습니다.
- 공식 마켓·Page Kit JSON Schema, SHA-256·호스트 allowlist·zip-slip·파일 선언·이미지 실형식·블록/라우트 호환성 검증을 추가했습니다.

### Changed

- 외부 Block Pack 설치 source에 공식 `store`를 추가하되 기존 archive·호환성·Code Pack 서명·사용량 보호 절차를 그대로 적용합니다.
- Page Kit 적용 시 문서와 모든 블록 identity를 새로 만들고 활성 사이트 템플릿을 사용하도록 고정했습니다.

### Security

- 브라우저가 임의 다운로드 URL을 제출할 수 없으며 카탈로그에 선언된 지원소프트 상품과 허용된 HTTPS 호스트만 설치할 수 있습니다.
- Page Kit은 기존 문서·발행·홈·G7 템플릿·Header·Footer·Site Shell을 덮어쓰지 않고 검증 또는 컴파일 실패 시 문서 생성을 중단합니다.

## [0.9.0] - 2026-08-20

### Added

- 활성 G7 User Template의 Header·Footer·navigation을 그대로 사용하는 기본 출력과 모듈 소유 user route 2개·layout 3개를 추가했습니다.
- 로그인·회원가입·로그아웃·게시판·쇼핑몰·마이페이지·Page Builder 화면을 검색하고 route parameter 대상을 골라 링크를 완성하는 G7 서비스 연결 선택기를 추가했습니다.
- 임시 문서를 활성 템플릿 안에 발행하고 `/` 홈을 연결한 뒤 원래 홈을 복구하는 실제 브라우저 회귀시험을 추가했습니다.

### Changed

- 새 문서의 기본 `shell_mode`를 `template`으로 바꾸고, Page Builder Header·Footer는 선택형 `builder`, 공통영역 없는 인트로는 `none`으로 분리했습니다.
- 공개 CSS와 효과 runtime만 G7 asset manifest로 주입하고 `.g7pb-page` 아래에 scope했으며 무거운 Puck editor bundle은 독립 편집기에서만 로드하도록 변경했습니다.
- 테스트 스테이징 배포에서 DB dump와 영구 모듈 백업을 제거하고, 배포 중에만 유지되는 임시 파일 rollback으로 제한했습니다.

### Fixed

- G7 사용자 인증·로그아웃 공개 API 경로를 7.0.7 계약에 맞추고 로그아웃 링크를 POST typed action으로 처리했습니다.
- G7 `HtmlContent` 정화 과정에서 제거되는 Slider 조작 버튼을 공개 runtime이 안전하게 복원하도록 수정했습니다.

## [0.8.0] - 2026-08-20

### Added

- Codex Git worktree별 path·독점 AREA lease, 범위 밖 변경 차단, profile 검증, 자동 제출 커밋과 Local 순차 병합을 제공하는 coordination 하네스를 추가했습니다.
- 현재 draft의 블록·토큰·공통영역 표시 방식을 새 UUID·slug·revision 1 초안으로 복제하는 독립 문서함 기능을 추가했습니다.
- Header와 Footer를 각각 Puck 캔버스에서 드래그·인라인 편집하고 PC·태블릿·모바일로 확인하는 독립 Site Part 문서·리비전·발행 기능을 추가했습니다.
- Header 내비게이션·공지 바, 기본 Footer·다단 Footer 블록과 로고 직접 업로드를 추가했습니다.
- 브랜드 색상·글꼴·모서리·콘텐츠 폭·글자 크기를 안전한 문서 디자인 프리셋으로 저장하고 편집 캔버스와 공개 페이지에 동일 적용하는 기능을 추가했습니다.
- Hero·Features·CTA·Contact의 주요 문구와 버튼 문구를 캔버스에서 직접 편집하고, 선택한 Hero 계열 이미지의 미디어 선택·비우기를 캔버스 액션으로 실행하는 기능을 추가했습니다.
- G7 공개 API로 최신·인기 게시글과 최신·신규·인기 상품을 불러오고 전체·비회원·회원 노출을 선택하는 데이터 블록 2종을 추가했습니다.
- 현재 PageBuilderDocument JSON과 서버 검증을 통과한 HTML 산출물을 비교하는 읽기 전용 원본 보기 진단 화면을 추가했습니다.

### Changed

- 고정 `g7pb-dev` runtime과 release·staging 명령은 active Local integration task, 전체 품질 검증 SHA와 clean 상태를 통과해야 실행되도록 변경했습니다.
- 문서함 작업을 `편집`·`공개 보기`·`더보기` 계층으로 정리하고 ISC 라이선스 Lucide 아이콘을 적용해 한글 버튼이 세로로 깨지지 않도록 변경했습니다.
- 기존 공통 메뉴 설정 모달 진입점을 `Header 편집`·`Footer 편집` 시각 편집기로 교체하고, Site Part 발행 전 compile·URL 검증을 필수화했습니다.
- 사용되지 않던 구형 공통영역 설정 모달 코드를 제거하고 SiteShell API는 최초 Site Part 생성과 미발행 fallback 호환 경로로만 한정했습니다.
- 편집기 상단의 디자인·효과·기기·블록 동작을 Lucide 아이콘과 가로 고정 버튼으로 정리하고 임의 CSS 대신 allowlist 디자인 토큰만 컴파일하도록 변경했습니다.
- 내장 Block Pack과 검색 가능한 블록 라이브러리를 12종에서 14종으로 확장했습니다.

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
- 릴리스 아티팩트에 Block Pack 신뢰 설정 파일을 필수 포함하도록 패키저를 보완했습니다.

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
