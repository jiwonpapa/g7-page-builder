# G7 3차 데이터 block capability 계약

상태: 구현 기준
기준 버전: `0.16.0`

## 결론

페이지 빌더는 G7 게시판·쇼핑몰의 Model, Repository, DB table을 직접 읽지 않습니다. 콘텐츠 아카이브와 상품 쇼케이스는 설치된 선택 모듈의 공개 API capability만 사용하며 capability가 없거나 응답이 실패하면 마지막 정상 발행본의 다른 콘텐츠는 그대로 유지하고 해당 block 안에 실패 또는 빈 상태를 표시합니다.

## Capability 표

| Block | 필요한 capability | 공개 endpoint | 공개 상세 연결 |
|---|---|---|---|
| G7 콘텐츠 아카이브 | `g7.module.sirsoft-board`, `public.dynamic-data` | 최근글 또는 기간별 인기글 | `/board/{board_slug}/{id}` |
| G7 상품 쇼케이스 | `g7.module.sirsoft-ecommerce`, `public.dynamic-data` | 최신·신규·인기 상품 | 검증된 `detailBasePath/{product_code}` |

## 저장 계약

- 문서에는 공개 API 선택값, 표시 수, 노출 대상, 레이아웃과 빈 상태 문구만 저장합니다.
- endpoint 전체 URL, 인증 토큰, SQL, table 이름, 임의 callback 또는 응답 HTML은 저장하지 않습니다.
- 콘텐츠 아카이브 검색·게시판 필터는 최초 공개 응답에서 생성한 text node와 data attribute만 사용하며 재요청하지 않습니다.
- 응답의 제목·상품명은 `textContent`로만 삽입하고 이미지 URL은 same-origin 상대경로 또는 HTTPS만 허용합니다.

## 권한·상태 계약

- `audience=all|guest|member`는 공개 인증 API 결과로만 판정합니다.
- 대상이 아닌 방문자에게는 block을 숨기고 데이터 endpoint를 호출하지 않습니다.
- capability 부재, HTTP 실패, 비정상 payload는 공통 실패 문구로 닫고 다른 block과 발행 상태를 변경하지 않습니다.
- 정상 응답이 비었거나 필터 결과가 0개이면 관리자가 저장한 `emptyMessage`를 표시합니다.
- 편집 캔버스는 실제 운영 데이터를 요구하지 않고 구조 미리보기와 capability 설명을 제공합니다.

## 회귀 게이트

- PHP compiler가 고정 endpoint와 안전한 상세 경로만 생성하는지 검사합니다.
- 브라우저 단위시험이 응답 HTML 비주입, 이미지 URL 제한, 로컬 검색·필터, 빈 상태와 노출 대상을 검사합니다.
- Playwright가 PC·태블릿·모바일에서 block 추가→저장→미리보기→발행→복원 흐름을 검사합니다.
