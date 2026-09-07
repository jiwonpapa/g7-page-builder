# EP2-01 마감 후 감사 방향 인계

상태: **방향 인계·현행 코드 경계 확인·후속 검증 제안**. 다음 제품 작업은 착수하지 않았습니다. EP2-01은 2/4차의 세부 작업 1/3 완료, 전체 4/11입니다. [실행 증거](2026-09-07-editor-ep2-01.md)와 [진척 원장](../productization/editor-progress.json)의 완료 수는 유지합니다.

## 인계 출처와 증거 수준

사용자 지시를 받은 ‘감사’ 작업에서 일반 페이지·미디어·슬라이더·확장 SDK 조사 결과를 전달했습니다. 그 작업의 Edge/API 관찰을 이 문서가 새로 재실행한 브라우저 증거로 취급하지 않습니다. 이번 마감에서는 현재 checkout의 편집/패턴/페이지킷 코드, G7 로컬 공개 확장점 코드, 실제 coordination 상태를 읽어 확인했습니다.

## 제품 역할과 바로잡은 사실

페이지 빌더의 역할은 **그누7 일반 페이지의 디자인 제작·상세 편집 보완**입니다. 완성 디자인 구역 삽입, 동작형 블록 전용 편집, 미디어 적용, 제한된 내부 구성, 개인 구성·페이지킷 재사용이 중심입니다. 블록 수보다 삽입→실제 편집→저장·재열기→재사용 흐름으로 가치를 판단합니다.

- 감사 인계: G7은 `routes.json`의 경로·레이아웃 선언으로 일반 페이지를 추가하고 기본 레이아웃 편집기로 편집할 수 있습니다. 생성 버튼 유무로 이 능력을 부정하지 않습니다. G7DevOps의 프로젝트 route 10개와 대표 공개 레이아웃 API 200·네이티브 JSON 트리를 관찰했다고 전달받았습니다.
- 감사 인계: 이미지 업로드 자체와 배경 선택기의 업로드 후 적용은 이미 있습니다. 확인한 본문 `Img.src`는 주소/데이터 연결이고, 레이아웃 업로드 첨부 관리함과 배포 템플릿 이미지가 분리되어 있어 연결 UX가 문제입니다. ‘이미지 기능 없음’으로 표현하지 않습니다.
- 감사 인계: 조사한 `sirsoft-basic`·`jiwonpapa-devops`에서 페이지용 Hero/Carousel은 확인하지 못했습니다. ImageGallery 확대창 슬라이드쇼와 장면별 문구·버튼·이미지를 편집하는 페이지 슬라이더를 구별하며, 숫자 입력 widget:slider를 콘텐츠 슬라이더로 세지 않습니다. 모든 G7 템플릿에 없는 것으로 일반화하지 않습니다.
- 감사 인계: G7에 목록·표·탭 내부 편집 기반은 있습니다. 이름·썸네일을 가진 영구적인 개인 패턴 라이브러리는 이번 감사에서 확인하지 못한 상태이며 부재가 증명된 것은 아닙니다.
- 로컬 확인: 공개 `G7Core.layoutEditor`는 `registerWidget`, `registerNodeEditor`, `registerCanvasOverlay`, `onReady`를 노출합니다. 전체 문서 get/save·전역 선택/삽입 SDK로 확대 해석하지 않습니다. 렌더 컴포넌트·팔레트·편집 명세의 템플릿 소유 경계와 지원 템플릿 어댑터 필요성은 감사 인계를 따릅니다.

G7 원천 경로: 별도 `gnuboard7` checkout의 `resources/js/core/template-engine/layout-editor/spec/exposeLayoutEditorGlobals.ts:47`, `spec/nodeEditorRegistry.ts:32`, `components/property-controls/ImagePickerControl.tsx:109`, `templates/_bundled/sirsoft-basic/editor-spec/controls.json:10493`, `docs/extension/editor-spec.md:69`. 내부 코드는 연구 근거이며 제품 import·복사·런타임 의존성으로 추가하지 않았습니다.

## 유지하는 투자와 남은 경계

기존 HeroSlider/Embla, 미디어 선택·업로드 후 적용, 개인 Section, Page/Site Kit를 활용합니다. 제품 코드를 새로 작성하거나 편집 엔진을 교체할 근거로 이 인계를 사용하지 않습니다.

| 확인 지점 | 현재 사실 | 후속 판단에 미치는 영향 |
|---|---|---|
| [슬라이더 미리보기](../../resources/js/editor/catalogPreviews.tsx)·[미디어 필드](../../resources/js/editor/MediaPickerField.tsx) | 전용 장면/미디어 편집 기반이 이미 있음 | 실제 작업 흐름에서 부족한 조작을 먼저 확인 |
| [내 패턴 UI](../../resources/js/editor/SectionPatternControls.tsx)·[서버 저장](../../src/Application/Patterns/SectionPatternService.php) | v2의 root Section 전체만 저장; 기존 허용 자식 검사 적용 | 현재 Section 안에 HeroSlider를 넣어 개인 패턴으로 저장할 수 없음 |
| [레이아웃 정책](../../schemas/layout-policy-v1.json) | HeroSlider는 root 타입이며 일반 Section/Columns/Stack 자식이 아님 | ‘슬라이더 포함 내 구성’은 현재 지원으로 약속할 수 없음 |
| [페이지킷 관리](../../resources/js/manager/useManagerStore.ts)·[API](../../src/routes/api.php) | 문서 Page Kit 내보내기와 스토어 Page Kit 적용 경로가 있음 | 내보낸 임의 킷을 개인 라이브러리에 등록·재삽입하는 전 과정이 확인된 것은 아님 |
| [원본/엔진 경계](../editor-engine-decision.md) | PageBuilderDocument를 Puck에서 편집하고 HTML을 G7 HtmlContent로 연결 | 네이티브 G7 페이지를 그대로 열어 양방향 편집하는 기능과 구별 |

`AGENTS.md`의 Layout Editor 참조 정책, PageBuilderDocument 원본, 공개 Adapter·템플릿 소유 경계는 유지합니다. 모듈 하나로 모든 템플릿을 즉시 지원하거나 기존 G7 문서를 자동 변환한다고 약속하지 않습니다.

## 기존 계획과 다시 판단할 부분

1. **우선순위:** [현행 계획](../productization/editor-plan.md)의 다음 작업은 EP2-02 단일 카드입니다. 카드의 제한된 내부 구성은 제품 방향에 맞지만, 카드 확장을 시작하기 전에 기존 디자인·슬라이더·미디어·재사용의 대표 흐름을 확인하는 편이 다음 개발의 근거가 됩니다. 계획 순서를 이미 변경한 것으로 기록하지 않습니다.
2. **재사용 단위:** EP4-02는 Section 패턴 재사용이며 슬라이더 포함 페이지 조합을 그대로 저장하는 목표와 범위가 다릅니다. Section 재사용, 페이지킷 내보내기/적용, 개인 라이브러리 등록을 별도 결과로 확인해야 합니다.
3. **통합 검증 시점:** 각 차수의 기존 브라우저 증거는 유지하되, 새로 강조한 대표 제작 흐름을 EP4-03까지 미루지 않고 후속 착수 전 최소 사례로 확인하는 방안을 제안합니다.
4. **네이티브 G7 페이지:** 기본 G7 편집기와의 상세 편집 보완을 논의할 수 있지만, 네이티브 문서를 Puck 원본으로 전환하는 사업은 현재 계획·승인 범위에 없습니다. 그 필요성은 원본 소유권과 지원 템플릿 하나의 증거로 별도 판단해야 합니다.

## 다음 최소 검증 제안

추가 제품 개발이나 외부 배포 없이, 실제 지원 프로필을 확인한 템플릿 **하나**와 Page Builder 소유 일반 페이지 **하나**에서 확인합니다. G7 네이티브 페이지는 비교 대상으로 보존합니다.

1. 기존 디자인 구역과 root HeroSlider를 삽입합니다. Section 안 슬라이더 삽입으로 우회하지 않습니다.
2. 실제 이미지 업로드→대상 장면에 적용→교체/표현 조정→장면·문구·버튼 편집을 수행합니다.
3. 모바일 출력과 저장·재열기 후 이미지·문구·순서·재생 설정 보존을 확인합니다.
4. 허용된 Section을 내 패턴에 저장하고 다른 페이지에 독립 삽입합니다. 재사용 결과와 원본이 서로 덮이지 않는지 확인합니다.
5. 슬라이더 포함 페이지는 기존 Page Kit 내보내기와 재적용 경로를 조사·실행 가능한 범위에서 확인합니다. 개인 라이브러리 등록/재삽입 연결이 없으면 그 지점만 결손으로 기록하며 성공으로 세지 않습니다.

각 단계의 실제 화면·저장 원본·재열기·공개 결과·재사용 결과를 비교합니다. 성공한 같은 입력 검증은 반복하지 않고, 발견한 결손과 관련된 최소 수정만 다음 개발 범위로 제시합니다. 이번 마감에서 이 시나리오를 실행하거나 다음 차수를 자동 착수하지 않았습니다.
