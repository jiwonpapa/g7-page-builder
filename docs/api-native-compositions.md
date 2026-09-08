# 네이티브 사용자 조합 API

인증된 사용자 본인의 재사용 스냅샷 저장소다. G7 페이지 저장이나 기존 PB Section 패턴 API와 분리한다. 아래 모든 경로는 `/api/modules/jiwonpapa-page_builder/admin/native-compositions` 기준이며 기존 admin 인증과 `core.templates.layouts.edit` 권한을 적용한다. actor ID는 인증 사용자에서만 읽는다.

| 메서드 | 경로 | 입력 / 응답 |
|---|---|---|
| GET | `?page=1` | 30개씩 `data.items[{id,title,schema_version,created_at}]`, `has_more`; payload는 목록에 포함하지 않음 |
| POST | 기본 경로 | `{title,schema_version,snapshot}`; 201과 저장한 metadata |
| GET | `/{uuid}` | 본인 조합 metadata와 원문 `snapshot` |
| DELETE | `/{uuid}` | 본인 조합 삭제; 페이지에 삽입한 사본·첨부 파일은 유지 |

`schema_version`은 `g7-page-builder/native-composition/v1`이다. `snapshot`은 G7 공개 내보내기가 생성한 `g7.editor-composition/v1` JSON **문자열**이다. 문자열로 보관해 빈 객체·미지 필드·배열을 바꾸지 않는다. 제목은 공백 제거 후 1~120자, snapshot은 최대 256KiB/JSON 깊이 64다. 목록 page는 1~10000 정수다.

예시 요청은 `{"title":"소개 구역","schema_version":"g7-page-builder/native-composition/v1","snapshot":"<공개 호스트 내보내기의 JSON 문자열>"}`이다. 실제 snapshot을 임의 HTML·Puck Data·PB Section으로 대체할 수 없다. 정상 응답은 `{"success":true,"data":{"id":"<uuid>","title":"소개 구역","schema_version":"g7-page-builder/native-composition/v1","created_at":"<ISO date>"}}` 형식이다.

잘못된 입력은 422, 다른 사용자 소유/없는 UUID는 같은 404, 인증·권한 거부는 기존 middleware의 401/403이다. 서버 검증은 저장 형식/소유권 경계이며 G7 원본을 컴파일하거나 자산·renderer 호환을 승인하지 않는다. 삽입할 때 공개 호스트가 현재 문맥·스키마·spec·컴포넌트·자산·출처·참조를 다시 검증해야 한다. 저장본을 불러왔다는 이유로 문서를 수정하지 않는다.

