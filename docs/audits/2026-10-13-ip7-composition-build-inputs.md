# IP7 구성 데이터 빌드 입력 보완

작업 `ip7-composition-build-inputs-20261013`은 빌드 재사용 하네스와 관련 회귀 시험만 보완한다. 제품 코드·문서 스키마·테마·코어·검사 합격 기준은 변경하지 않는다. IP7은 진행 중이다.

## 실제 실패와 원인

공식 12개 task 통합 후보에서 설치형 저장·발행 39개와 독립 편집기 270개는 통과했다. 다음 `structureFormCatalogProduct.spec.ts`는 새 구성 선택에서 실패했다. 증거는 `output/playwright/gates/integration-ip7-20261012/98752cdcba26601ce02745a4c00501e904ea63493006bcc194f3851b35af2a78/ce9798ea489d42a6be605920a2bb0a8b/`다. 화면에 `일반 문의` 검색 결과가 없고 선택기가 비활성화된 상태를 확인했다.

후보 소스 `resources/compositions/builtin-v3.json`은 68개지만 실제 `dist/data/builtin-v3-guGKije8.json`은 이전 63개였다. `environment.build_inputs()`가 JS/CSS와 구형 JSON 두 파일만 추적해 새 구성 데이터 변경을 빌드 재사용 판정에 넣지 않았다. 독립 호스트의 자체 빌드 성공은 설치형 제품 자산의 최신성을 증명하지 않는다.

같은 읽기 전용 점검에서 독립 편집기의 직접 JSON import인 v3 문서 schema·design policy·Site Part v2 schema도 입력에 빠져 있었고, 필수 출력 목록에 구조 편집기 JS/CSS/module inventory가 없었다. 해당 정확 경로를 추가한다. 기존 전체 dist digest 비교와 JS/CSS 무결성 검사를 유지하며, 성공 receipt를 수동으로 만들거나 이전 브라우저 실행을 새 자산의 성공으로 승격하지 않는다.

## 검증

새 회귀 두 개를 수정 전에 실행하여 누락 JSON 네 개와 출력 목록 누락으로 실패하는 것을 확인했다. 수정 후에는 각 입력의 변경·삭제 시 빌드가 필요하고, 같은 입력·출력은 재사용하며, 구조 JS/CSS/inventory 누락·빈 파일은 성공으로 처리하지 않는지 검사한다. 데이터 변경으로 의존성을 재설치하지 않는 조건도 유지한다.

이 task의 하네스 통과는 제품 브라우저 통과가 아니다. 공식 Local 통합 후 같은 후보를 다시 검증하여 68개 자산 생성·실제 구성 선택·편집·출력을 확인한다. 기존 39/270개 증거는 해당 실행의 입력에 대해서만 보존한다. 새 빌드 입력이 달라 재사용할 수 없는 시험은 하네스 판정대로 실행한다.
