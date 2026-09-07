# 네이티브 편집 확장 규칙 개정 기록

기준: 2026-09-07. 활성 계획 `native-editor-20260907`. PB 기준 SHA `280567cc650253a5d6538696fbc3383c587eaf4e`. 이번 소유 범위는 규칙·문서·하네스 23개 파일이다. 제품 소스·G7 코어·사용자 페이지·릴리스 버전은 이 작업의 변경 대상이 아니다.

## 결정과 적용 경계

[개발 헌법](../development-constitution.md), [편집 정책](../productization/editing-policy.md), [실행 계획](../productization/editor-plan.md)에 다음을 반영한다.

1. 기존 PB는 PageBuilderDocument/Puck/PB 저장·발행을 유지한다. 신규 native 모드는 G7 JSON·선택·트리·Undo·저장을 소유자에게 두고 공개 adapter로 편집을 확장한다. 원본 이중 저장·자동 변환·private import는 금지한다.
2. 네이티브 TS 도메인/포트/사용 사례/UI/adapter 의존을 명시하고 확인된 공개 editor 메서드만 adapter에서 사용한다. 직접 I/O·호스트 객체 유출·확인되지 않은 API와 Puck/기존 PB API 혼용을 정적 검사한다.
3. 원본 출처·표현식·번역·반복·알 수 없는 필드 보존, 비동기 문맥·허용 구조·참조·Undo·재열기를 차수별 동작 수용 기준으로 둔다. 문서 작성만으로 충족 처리하지 않는다.
4. G7 기존 첨부·페이지 설정·저장을 재사용한다. 테마 원본 스타일을 보존하고 짧은 옵션의 공통 컨트롤·모듈 CSS scope를 규정한다. 콘텐츠/판매 킷 증설은 후순위다.
5. EP 원장·계획은 바이트 그대로 archive하고 당시 4/11 완료와 증거를 유지한다. NE1~NE6은 0/6 planned다. 이 규칙 정비는 NE1 제품 기능 완료가 아니다.

## 코드 조사 근거와 한계

G7 조사 기준은 `fde750cede7fda68329cea42fb706a00d4546bd3`이다. 당시 로컬 `upstream/main`은 `bc0b47b12bdca0b65edefb1968c5cde147a2d42f`이며 조사한 editor 디렉터리·LayoutService·TemplateService·Admin LayoutController·API routes는 양쪽에서 같았다. 원격 최신 조회나 운영 브라우저 재현 결과로 해석하지 않는다. 아래 G7 경로는 별도 G7 저장소 기준이다.

| 판정 | 고정 기준의 코드 위치 | 이번 규칙 반영 |
|---|---|---|
| 일반 페이지 라우트·layout 지원 | `app/Services/TemplateService.php:1243`; 로컬 예제 `templates/_bundled/jiwonpapa-devops/routes.json:343`, `layouts/projects/g7-installer.json` | 메인 전용이라는 전제 폐기. 예제 테마는 로컬 untracked 자료이며 G7 배포 기본물로 주장하지 않음 |
| 공개 editor 메서드 네 개 | `resources/js/core/template-engine/layout-editor/spec/exposeLayoutEditorGlobals.ts:47`; `G7CoreGlobals.ts:853` | registerWidget/registerNodeEditor/registerCanvasOverlay/onReady만 현재 정적 allowlist |
| 공개 문맥·명령·삽입 타입 경계 | 같은 editor 경로의 `spec/widgetRegistry.ts`, `nodeEditorRegistry.ts:32`, `canvasOverlayRegistry.ts:39`; `components/EditorCanvasOverlay.ts:944,1448,2447`; `utils/layoutTreeUtils.ts:374` | H01~H04 선행조건. 콜백 타입 불일치를 현재 운영 장애로 확대하지 않음 |
| 렌더 등록과 spec 병합 | `resources/js/core/template-engine/ComponentRegistry.ts:375,471`; editor의 `spec/editorSpecLoader.ts:218,356` | H05~H06. private registerComponent 우회 금지, 지원 템플릿 연결 필요 |
| 반복 항목 이미지 제약 | editor의 `components/property-controls/ArrayItemsEditor.tsx:55,326` | H07. registerWidget만으로 반복 이미지 편집 완료 선언 금지 |
| G7 첨부·저장·페이지 설정 | `routes/api.php:858,888`; `app/Http/Requests/Admin/Template/UploadTemplateLayoutAttachmentRequest.php:31`; `app/Services/LayoutService.php:1410`; editor의 `components/page-settings/PageSettingsModal.tsx:111` | 기존 기능 재사용. layout_name nullable과 저장 공개 영향 구분 |
| 저장 경쟁 경계 | `app/Http/Controllers/Api/Admin/LayoutController.php:104`; `app/Services/LayoutService.php:1427`; `app/Repositories/LayoutRepository.php:99,335` | H08. 실제 동시 요청 시험 필요; 코드만으로 운영 데이터 유실이나 완전한 잠금 보장 주장 금지 |
| React 공유와 module asset | `resources/js/core/template-engine/G7CoreGlobals.ts:660`; `templates/_bundled/sirsoft-basic/vite.config.ts:41`; `resources/js/core/TemplateApp.ts:790` | 별도 native entry에서 host React 공유, 독립 Puck 번들 중첩 금지 |

PB 소스 근거는 [Puck adapter](../../resources/js/editor/PuckEditorAdapter.tsx), [빌드 entry](../../vite.config.ts), [G7 원본 편집 제외 guard](../../src/Infrastructure/Gnuboard7/Layout/UserTemplateSiteShellDecorator.php), [기존 패턴 서비스](../../src/Application/Patterns/SectionPatternService.php)다. 기존 guard가 `__source` 편집 문맥을 제외하므로 과거 native 저장 오염 의심을 현재 미해결 버그로 전용하지 않는다. 이 자료는 코드 판정이며 실제 native 확장 편집 성공을 보여주는 자료가 아니다.

원장 archive JSON이 기존 검사 계획에서 미분류되는 문제를 확인해, 기존 22개 파일 변경을 해시 checkpoint로 보존한 뒤 정상 lease 종료·23개 정확 파일의 새 scoped task로 재착수했다. 보존 원장에 등록된 archive만 정합성 검사에 연결하며 임의 JSON 파일을 포괄 허용하지 않는다.

## 검사와 마감 기준

- 구조 회귀: 정상 native 계층·공개 메서드 허용, Puck/기존 PB API·역방향 import·미확인 메서드·host alias·UI I/O·규칙 삭제/확대 거부. 기존 PB public Site Shell의 정상 접근은 유지한다.
- 진척 회귀: v1 호환, v2 계획 marker 일치, archive 바이트·완료 수 변경/현행 ID 재사용/현재 파일로 redirect 거부, 문서·원장·표시판 정합성, 조회 무변경.
- scoped 제출·통합의 선택 검사와 전체 제품 정적 구조 검사를 사용한다. 실제 명령·결과·재사용은 coordination의 입력별 실행 기록으로 남긴다. 규칙 변경 때문에 전체 제품 coverage/E2E를 다시 돌리지 않는다.
- 네이티브 제품 기능·G7 공개 계약 구현·브라우저 제품 검증·배포는 이 작업에서 완료 처리하지 않는다. G7 소스 수정과 릴리스는 별도 사용자 지시가 필요하다.

원장 해시 검사는 archive의 보존 확인이며 변경 권한이 있는 사람이 기록과 해시를 함께 바꾸는 행위의 의미적 정당성까지 검증하지 않는다. 동적으로 주입한 호스트 객체의 권한·문맥·원본 무손실도 정적 AST 검사 밖이다. 이 한계는 실제 수용 시험으로 보완한다.
