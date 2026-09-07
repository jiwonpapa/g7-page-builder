# NE3 네이티브 컴포넌트 연결

이 문서는 G7 engine-v1.67.0 공개 확장 후보와 함께 검증하는 **선택형 템플릿 연결**을 정의한다. 기본 테마나 블록 상품 추가가 아니다. G7 main/upstream·운영 배포와 구별한다.

## 실제 등록 경로

G7 `ComponentRegistry.loadComponentBundle`은 템플릿 identifier를 PascalCase 전역 이름으로 바꾸고 `components.json`의 컴포넌트를 그 IIFE export에서 읽는다. `DynamicRenderer`가 `editorAttrs`를 주입한다. 모듈의 manifest만 선언하거나 `registerWidget`만 호출해 JSX 렌더러가 등록되는 구조가 아니다. PB는 새로운 전역 등록 API나 private registry 접근을 추가하지 않는다.

템플릿 제작자가 명시적으로 다음을 연결한다.

1. 사전 빌드된 `dist/js/page-builder-native-components.iife.js`와 `dist/css/page-builder-native-components.css`를 템플릿 자산으로 패키징한다. React·ReactDOM·JSX runtime은 G7의 공유 인스턴스를 사용한다.
2. 템플릿 IIFE에서 `JiwonpapaNativeComponents.PageBuilderSlider`를 `PageBuilderSlider`로 export한다. 편집기 asset API는 `dist/js/components.iife.js`·`dist/css/components.css`를 직접 찾으므로 companion과 템플릿 export/CSS를 이 표준 산출물에 포함해야 한다. `template.json.assets`에 별도 경로만 추가해 편집기에 로드된다고 가정하지 않는다.
3. `dist/native-components/components.json`의 composite 항목을 해당 템플릿 manifest에 병합한다. 템플릿 식별자·기존 component 목록을 보존한다.
4. `dist/native-components/editor-spec.json`의 새 capability/control/palette 항목을 템플릿 spec에 병합하고, 의도한 부모 nesting에 `PageBuilderSlider`를 허용한다. 이름 충돌은 자동 덮어쓰지 않고 통합 오류로 처리한다.
5. 템플릿 설치·선택·페이지 저장은 기존 G7 경로를 사용한다. 현재 G7의 공개 layout API는 활성 템플릿만 제공하므로 비활성 템플릿도 동일하게 편집 가능하다고 가정하지 않는다.

G7 spec 로더의 module → plugin → template 우선순위에서 동일 capability 키는 후순위 값으로 교체된다. 이 묶음은 기존 Div/Img capability를 덮어쓰지 않고 `PageBuilderSlider`와 `g7pb:slider-*` 새 이름만 선언한다. 제품은 설치된 템플릿 파일·기존 layout·활성 템플릿 설정을 자동으로 변경하지 않는다.

## 편집과 공개 동작

- `slides`는 표준 `id`, `src`, `alt`, `caption`을 가진 정적 배열이다. 호스트의 `nodeEditor.kind=array`와 image/text 필드 선언을 네이티브 구성 패널이 소비한다. 삽입·이동·복제·삭제·필드 적용은 NE3 guarded structure command 하나와 G7 기존 history/save로 실행된다.
- 이미지 첨부는 기존 페이지별 API와 미디어 패널을 사용한다. 업로드 완료 자체로 배열 항목을 수정하지 않고 명시적 선택으로 적용한다. 오래된 revision의 응답은 적용하지 않는다.
- `autoplay`, `interval`은 기존 G7 속성 패널의 유한 spec 제어를 사용한다. PB가 임의 prop 경로를 편집하는 범용 입력을 추가하지 않는다.
- 편집 캔버스에서는 전체 항목을 표시하고 자동 재생과 공개 조작 버튼을 중지한다. 공개에서는 한 항목, 이전/다음, Home/End/좌우 키, 명시적 재생/중지, focus/pointer 정지, 비활성 탭 정지, reduced-motion 정지를 제공한다. 타이머와 이벤트는 해제한다.
- 런타임 입력에서 잘못된 배열 항목·중복 식별자·안전하지 않은 이미지 URL은 렌더하지 않는다. 원본 저장 데이터를 자동 정규화하거나 삭제하지 않는다.
- companion은 Puck·Tiptap·PB 문서 저장·G7 private runtime을 포함하지 않는다. native editor 8KB gzip 한도와 별도로 renderer 4KB gzip 한도를 검사한다.

## 시험 범위

`nativeSliderContract.spec.ts`는 로컬 전용 `jiwonpapa-native_lab` 기술 템플릿을 사용한다. manifest/IIFE/spec, 일반 배열과 이미지, prop 셀 트리, 반복 템플릿, Undo/Redo/저장/재열기, PC·모바일 공개 renderer를 검증한다. 인증·정상 G7 API·실제 캔버스를 사용하며 API 응답을 모킹해 기능 성공으로 처리하지 않는다. 전용 파일 소유 표식과 활성 템플릿 복원 원장을 남기고 기존 활성 템플릿을 `finally`에서 복원한다.

사용자 디자인 콘텐츠, 기본 테마 전체 지원, 비표준 배열 식별자, 바인딩 식 자체 편집, 사용자 조합 저장(NE4), 통합 삽입 UX(NE5), 운영 배포(NE6)는 이 renderer의 완료 기준이 아니다. NE3 실제 결과와 제한은 차수 감사에 기록한다.
