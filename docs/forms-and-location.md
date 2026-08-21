# 문의 폼·찾아오기 블록 운영 계약

## 문의 처리

`form.inquiry-01`은 문의·견적·예약·신청·뉴스레터 유형을 지원합니다. 문서에는 표시 문구와 필드 표시 여부만 저장하며 수신 메일 주소나 임의 form action은 저장하지 않습니다.

공개 제출 경로는 `POST /pages/{slug}/inquiries`입니다. 서버는 현재 발행 artifact에 제출된 정확한 Form block UUID가 있는지 확인한 뒤 `g7pb_form_submissions`에 먼저 저장하고 메일을 시도합니다. 메일 실패도 문의 원문을 지우지 않으며 관리자 문의함에서 읽음·보관과 재시도를 수행합니다.

운영 환경 변수:

- `G7PB_FORM_RECIPIENT`: 사이트 공통 수신 이메일. 비어 있으면 문의는 저장되고 메일 상태만 실패로 기록됩니다.
- `G7PB_FORM_IP_HASH_KEY`: abuse 추적용 IP HMAC 키. 운영에서는 `APP_KEY`와 별도 난수를 권장합니다.
- `G7PB_FORM_MINIMUM_FILL_SECONDS`: 자동 제출 억제용 최소 작성 시간. 기본 2초입니다.

보호 수단은 CSRF, 공개 route 분당 10회 throttle, 숨김 honeypot, 최소 작성 시간, 필드 길이·형식 검증, IP HMAC입니다. raw IP는 저장하지 않습니다. 보존기간과 개인정보 처리방침 고지는 사이트 운영자가 정해야 하며 MVP는 자동 삭제 정책을 임의 적용하지 않습니다.

관리자 API:

- `GET /api/modules/jiwonpapa-page_builder/admin/form-submissions?status={all|unread|read|archived}`
- `PATCH /api/modules/jiwonpapa-page_builder/admin/form-submissions/{id}`
- `POST /api/modules/jiwonpapa-page_builder/admin/form-submissions/{id}/retry`

## 찾아오기

`location.map-directions-01`은 주소·좌표·확대 수준·전화·운영시간·주차·길찾기 링크를 typed props로 저장합니다. 지도 provider는 `openstreetmap`, `google`, `none`만 허용하며 사용자 script나 API key를 문서에 넣지 않습니다.

공개 viewer CSP는 OpenStreetMap과 Google Maps iframe만 허용합니다. 외부 지도 iframe이 차단되거나 로드되지 않아도 주소와 길찾기 링크는 항상 남아야 합니다.
