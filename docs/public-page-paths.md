# 페이지 주소 할당

2차는 기존 `/pages/:slug` 발행 기능에 사용자가 선택한 추가 주소를 연결한다. 기본 주소는 기존 링크·문의 전송·canonical 호환을 위해 유지한다. 예: 페이지 식별자 `company`에 `/about` 또는 `/company/about`을 할당할 수 있다.

- 관리 API: `GET|PUT /api/modules/jiwonpapa-page_builder/admin/documents/{uuid}/path`.
- PUT: `{ "path": "/about", "expected_lock_version": 0 }`. 최초 버전은 0, 성공할 때마다 1 증가한다. `path: null`은 연결 해제이며 문서/발행본은 보존한다.
- 응답 data: `path`, `lock_version`, `active`, `reason`. 주소 수정은 페이지 초안과 독립된 사이트 설정이다. 발행된 페이지의 주소를 변경/해제하면 즉시 적용된다.
- 활성 조건: 문서가 보관되지 않았고 해당 문서의 active publication pointer와 `status=active`, `shell_mode=template`인 발행본이 일치한다. 초안·실패한 발행·이전 발행본·독립 셸 페이지는 새 주소의 근거가 되지 않는다.
- 충돌: 시스템 prefix, G7의 활성 정적/매개변수/와일드카드 경로, 다른 PB 문서의 예약 주소를 거부한다. G7 경로가 나중에 추가되면 충돌한 PB 주소는 비활성화하고 G7 경로를 우선한다.
- 경로는 앞뒤 공백·슬래시·영문 대소문자를 정규화하고, 나머지는 ASCII 세그먼트/길이로 검증한다. query/hash/percent encoding/중복 슬래시는 허용하지 않는다.
- 인증: 관리자 인증과 기존 PB `documents.read`/`documents.manage` 권한을 적용한다. 보관된 문서의 변경, 오래된 저장 버전, 중복 주소는 409다.
- 저장소: 모듈 소유 `g7pb_page_routes`만 추가한다. 문서 UUID FK로 물리 삭제 시 함께 정리한다. 주소 해제에도 버전 행을 유지해 오래된 요청의 덮어쓰기를 차단한다.
- G7 연동: 공개 route merge filter에서 기존 `page_builder_public` layout과 정적 `params.slug`를 재사용한다. 현재 G7 Router는 선언의 params와 path 매개변수를 합친다. 별도 내부 런타임 import, 코어 파일 변경, 새 사용자 layout 복제는 없다.
- 메뉴: 할당한 주소를 복사하여 G7의 기존 메뉴 관리에서 링크로 연결한다. PB는 G7 메뉴 테이블을 직접 수정하지 않는다.

편집기 저장 혼입 수정은 향후 저장을 보호한다. 이미 1차 실험 등에서 오염된 G7 원본은 자동 삭제하거나 재작성하지 않는다. 복구는 소유한 원본과 변경 내용을 비교하는 별도 작업으로 수행한다.
