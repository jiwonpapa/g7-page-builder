# G7 템플릿 sanitizer 호환 계약

상태: compiler 0.16.0 구현. 내장 45종·95개 프리셋과 공식 Page Kit 5종을 대상으로 하며 외부 Code Pack stylesheet 지원은 포함하지 않습니다.

## 문제와 결정

활성 `sirsoft-basic` User Template의 `HtmlContent`는 공개 본문에 DOMPurify를 적용하고 `svg`, `iframe`, `form`, 폼 control, `button`, `style`, `details` 등을 제거합니다. 편집기와 독립 viewer가 정상이어도 template shell의 실제 공개 DOM은 달라질 수 있으므로, 보안 필터를 완화하거나 HTML 허용 목록을 우회하지 않습니다.

`HtmlDocumentCompiler`는 제거 대상 구조 태그 대신 의미와 복원 정보가 제한된 HTML 표식을 출력합니다. `pageEffects`는 sanitizer 이후에 아래 표식만 실제 요소로 복원합니다.

| 기능 | compiler 출력 | 공개 런타임 허용 범위 |
|---|---|---|
| 카탈로그 아이콘 | `data-g7pb-runtime-icon` | `path`, `circle`, `rect`와 도형 속성 allowlist만 SVG로 복원 |
| 지도·영상 | `data-g7pb-embed` | HTTPS와 OSM·Google Maps·YouTube nocookie·Vimeo의 정확한 kind/host 조합만 iframe으로 복원 |
| 문의·검색 control | `data-g7pb-inquiry-host`, `data-g7pb-form-control` | `form`, `input`, `textarea`, `select`, `button` 및 고정 속성 allowlist만 복원 |
| 탭·pagination·slider control | button 표식 또는 보존 wrapper | 고정 data selector만 button으로 복원 |
| FAQ | div/ARIA/data 구조 | Enter·Space·click, 단일 열림 정책을 공개 런타임이 적용 |
| 사용자 palette | root의 검증된 CSS 변수 선언 | 문서 입력으로 임의 selector·property를 받지 않음 |

## Fail-closed 경계

- 내장 renderer와 등록된 외부 compiler 결과에 template 제거 대상 구조 태그가 남으면 `G7PB_TEMPLATE_MARKUP_UNSUPPORTED`로 compile을 중지합니다.
- compile 실패는 새 발행본을 활성화하지 않으며 마지막 정상 발행본을 유지해야 합니다.
- 임의 SVG 자식/속성, 알 수 없는 control 종류, HTTP 또는 승인되지 않은 embed host는 DOM으로 복원하지 않습니다.
- Puck Data나 생성 HTML을 원본으로 저장하지 않고 `PageBuilderDocument`를 계속 canonical 원본으로 사용합니다.

## 검증과 미포함 범위

필수 자동 검증은 TypeScript strict, public bundle budget, 공개 효과 단위시험, PHP compiler 95개 프리셋 전수, 공식 store 재생성, 편집→저장→reload→preview의 동일 문서 비교와 별도 public DOM/시각 검사입니다. 편집 iframe만 보거나 생성 파일 수만 맞는 것은 통과가 아닙니다.

외부 Code Pack의 runtime stylesheet `<link>`는 현행 template 본문에서 제거됩니다. 이번 변경은 외부 stylesheet Pack의 template shell 지원을 선언하지 않습니다. 해당 지원은 CSS 자산을 HtmlContent 밖의 모듈 소유 layout/runtime에서 로드하는 별도 계약·보안·lifecycle 시험이 마련된 뒤 개방합니다.
