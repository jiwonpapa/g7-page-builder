# MVP functional specification

상태: implementation baseline
대상: 1인 관리자·사이트 제작자

현재 구현: 12종 테스트 block 카탈로그와 별도 문서함·메타수정·최근 20개 리비전 조회·미리보기·새 초안 복원·재발행 rollback·공개 해제 완료. Gallery는 URL 기반 시험형이며 자체 MediaPort와 복구 가능한 문서 보관·삭제는 미구현입니다.

## 목표

코드를 편집하지 않고 G7 관리자에서 한 페이지를 만들고, 완성 블록을 끌어 배치하고, 반응형으로 확인한 뒤 안전하게 발행합니다.

전체 MVP 목표 흐름은 다음 한 줄입니다.

```text
로그인 -> 페이지 생성 -> 블록 추가/편집/정렬 -> 저장 후 reload -> 반응형 preview -> 발행 -> 공개 확인 -> 이전 revision 복원
```

## 공개 방식

- MVP 문서 스키마 v1은 `canvas`만 허용합니다.
- G7 공통 Header·Footer를 강제로 주입하지 않는 전체 canvas를 `/pages/{slug}`로 공개합니다. 발행본 하나를 홈으로 지정하면 `/`에서 응답하고, 지정이 없으면 G7 기본 홈을 보존합니다. 전용 Header·Footer block은 현재 slice 범위가 아닙니다.
- G7 User Template, SPA layout, Layout Editor와 번들 모듈을 요구하지 않습니다.

## 편집기 기능

### 필수

- 좌측: block category·검색·추가
- 중앙: drag/drop canvas와 빈 상태
- 우측: 선택 block의 typed property field
- block 이동·복제·삭제·선택·부모 선택
- undo/redo
- 360·768·1280 px preview
- dirty/saving/saved/conflict/publish 상태 표시
- 2초 debounce autosave와 명시적 저장
- 다른 revision을 기반으로 저장하면 HTTP 409와 비교/새로고침 안내
- 키보드 focus, label, alt text, 색 대비 기본 검사
- 블록 추가 전 이름·용도·축약 화면을 보여주는 preview gallery
- 각 블록의 `surface`와 `spacing`은 검증된 preset만 선택

### 저장과 복구

- reload 후 block 순서와 props가 동일해야 합니다.
- 네트워크 실패는 draft를 지우지 않고 재시도 가능 상태로 둡니다.
- compile 실패는 공개 페이지를 바꾸지 않습니다.
- 마지막 20개 revision을 조회·미리보기·복원합니다.

## 1차 테스트 block 12종

| Block | 필수 props | 규칙 | 제외 |
|---|---|---|---|
| Hero | eyebrow, title, body richtext, primary CTA, image, alignment | H1 1개, CTA URL allowlist, image alt 필수 | video background |
| Features | title, 2~6 items(icon/title/body) | icon allowlist, 동일 높이 responsive grid | 자유 중첩 layout |
| Contact | heading, address, phone, email, CTA/map link | 연락처 표시와 link만 제공 | 제출 form·메일·spam 처리 |
| CTA | eyebrow, heading, body, primary/secondary link, theme | URL allowlist, heading level 검사 | form·임의 HTML·animation timeline |
| Hero Split | eyebrow, title, body, CTA, image, media position | hero family 1개, URL·image allowlist | 자유 grid |
| Hero Slider | 2~5 slides(title/body/CTA/image) | focus 가능한 CSS scroll-snap, hero family 1개 | autoplay·외부 slider runtime |
| Logo Cloud | heading, 2~12 logos(name/image/link) | URL·image allowlist | 자동 수집 |
| Stats | heading, 2~8 items(icon/value/label/detail) | icon allowlist | 실시간 analytics query |
| Pricing | heading, 2~4 plans(features/CTA/featured) | URL allowlist, featured boolean | 결제·구독 처리 |
| Team | heading, 2~12 members(role/bio/image/link) | profile URL·image allowlist | 조직도·계정 연동 |
| Gallery | heading, 2~12 images, columns | URL·alt 검증, mobile 1열 | 업로드는 MediaPort 전까지 제외 |
| Bar Chart | heading, 2~8 values/unit/tone | 0~100, semantic progress, tone allowlist | 자유 chart script·실시간 query |

Product Grid는 기본 MVP가 아닙니다. 이후 별도 `sirsoft-ecommerce` Block Pack으로 만들며, 미설치 상태에서는 관련 코드·block·메뉴를 로드하지 않습니다.

## 스타일·코드 편집 정책

- 제목·본문·링크·이미지 같은 의미 있는 항목은 typed field로 모두 편집합니다.
- 구조와 반응형 CSS는 블록이 책임지고, 관리자는 검증된 surface/spacing preset만 선택합니다.
- 임의 Tailwind class, inline style, raw CSS/JS는 문서에 저장하지 않습니다. 테마 호환·XSS·업그레이드·모바일 회귀를 통제하기 위한 제품 경계입니다.
- Monaco 같은 전문 코드 편집기는 MVP에 넣지 않습니다. 향후 전문가용 Custom Code Block Pack으로 분리하며 별도 권한, sanitizer, CSP, 코드 크기 제한, preview sandbox 계약을 먼저 갖춘 뒤 검토합니다.

## Rich Text

- Puck 내장 Tiptap field를 사용합니다.
- 허용: paragraph, H2~H4, bold, italic, link, ordered/unordered list, blockquote, hard break.
- 금지: script, iframe, inline event, 임의 style, raw HTML 입력.
- 내부 링크와 `https`, `mailto`, `tel`만 허용합니다.

## 관리자 API 오류

| HTTP | code | 의미 |
|---|---|---|
| 401 | `G7PB_AUTH_REQUIRED` | 관리자 인증 없음 |
| 403 | `G7PB_PERMISSION_DENIED` | 권한 없음 |
| 400/409 | `G7PB_DOCUMENT_INVALID` | schema/prop/slug 입력 실패 |
| 404 | `G7PB_DOCUMENT_NOT_FOUND` | 문서 없음 |
| 404 | `G7PB_REVISION_NOT_FOUND` | 리비전 없음 |
| 409 | `G7PB_LOCK_CONFLICT` | expected lock 불일치 |
| 409 | `G7PB_PUBLIC_SLUG_CONFLICT` | active 공개 slug 충돌 |
| 409 | `G7PB_PUBLICATION_INVALID` | 만료·사용·무효 발행 후보 |
| 422 | `G7PB_COMPILE_FAILED` | compile/sanitize 실패 |
| 500 | `G7PB_INTERNAL_ERROR` | correlation id로 추적하는 예상 밖 오류 |

모든 오류는 `code`, 사용자 메시지, correlation id를 반환하고 비밀값·stack trace를 노출하지 않습니다.

`G7PB_CAPABILITY_MISSING`, `G7PB_G7_INCOMPATIBLE`는 선택 Adapter와 compatibility doctor를 구현할 때 추가할 예정 코드이며 현재 runtime 응답 계약이 아닙니다.

## 완료 조건

1. 12종 테스트 카탈로그 block 모두 schema·editor·PHP compiler·public renderer·Fixture를 가집니다.
2. 블록 추가 전에 이름·용도·구조 미리보기를 제공합니다.
3. 생성부터 rollback까지 Playwright 제품 E2E가 통과합니다.
4. PC·태블릿·모바일 screenshot baseline을 사람이 확인합니다.
5. G7 7.0.7 fixture 재컴파일 결과가 결정적입니다.
6. 실패 발행 뒤 공개 HTML hash가 직전 정상본과 같습니다.

## MVP 제외

- 실시간 공동 편집, comments, presence
- AI 생성, 원격 AI·라이선스 서버
- 자유 CSS/JS, 임의 HTML block
- 다중 breakpoint별 자유 position
- Contact form backend
- 애니메이션 timeline
- 다국어 문서 동시 편집
- G7 Layout Editor와 양방향 동기화
