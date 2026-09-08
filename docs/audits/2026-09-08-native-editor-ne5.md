# NE5 편집 흐름 연결 — NAT-05

현행 계획 `native-editor-20260907`의 5차 구현·로컬 통합 증거입니다. 운영 배포나 전체 제품 완성 선언이 아닙니다. 다음이자 마지막 차수는 NE6 호환·회귀·릴리스입니다.

## 범위와 결과

- 확장 패널을 상세 편집 / 삽입·구성 / 내 조합으로 분리했습니다. 노드 이름은 **선택 항목**으로 표시하며 layout 식별자를 문서 제목처럼 표시하지 않습니다.
- G7이 제공한 내부 위치 안에서 기존 항목 앞 또는 맨 뒤에 삽입합니다. 짧은 위치·설정은 기존 공통 라디오를 재사용하고, 긴 목록·구조 경로만 Select를 사용합니다.
- 내 조합은 열 때 목록을 조회하고, 현재 조회한 30개 목록의 이름 검색·페이지 이동을 제공합니다. 전체 저장소 검색으로 표현하지 않습니다. 선택이 바뀌어도 이미 조회한 목록은 유지하고 진행 요청·삽입 위치·입력은 초기화합니다.
- 문구 입력 취소, 진행 중인 조합 요청 취소, 실패 후 다시 시도, 미지원 위치의 상위 구역 선택 안내를 제공합니다. 요청 취소는 서버에 이미 완료된 개인 조합 저장/삭제까지 되돌린다는 의미가 아닙니다.
- G7의 캔버스/트리 선택, 페이지 설정, 미리보기, 저장을 사용합니다. 기존 호스트 API만 소비하며 추가 API·별도 원본·저장 UI·라우트/메뉴 생성기를 만들지 않았습니다. 상단 저장이 공개 페이지에 반영됨을 패널의 짧은 안내에 표시합니다.
- 페이지 이름/주소는 기존 G7 페이지 설정과 라우트 문맥에서 확인합니다. 미리보기는 G7의 임시 미리보기를 사용하며 본문 저장이나 공개를 대신 실행하지 않습니다. 본문·배경·Header/Footer 폭은 `sirsoft-basic`의 렌더 결과를 유지합니다.

## 코드 기준과 환경

- 시작 PB SHA: `c17468190c53c98affe0e8ef568f8fc45d502134`.
- 기존 테스트의 첫 input/button 가정을 내용 필드 컨테이너로 좁힌 제출: `3fbe055c8f9d23efd52425fdcc44a60ecf7091b4`, 통합 `e47ab74ce9cf7753544d5790df42810b19e211ca`.
- 기능 제출: `ed79b0ca3dea8795da5b9216fda0812a53e181fe`, task `native-ne5-editor-r3-20260908`. 이전 active/submitted 변경은 하네스 replacement 기록으로 보존했습니다.
- Local integration/runtime: `native-ne5-integration-20260908`. 별도 기능 worktree의 정확 13개 파일 claim 중 실제 변경 12개, 별도 테스트 보정 1개. 마감 문서는 별도 4개 파일입니다.
- G7 후보는 NE4의 `d264405fd09b70ac85aebe4f4a857cadbe22981e` / engine 1.68.1 그대로입니다. 이번 차수에 G7 코어·테마·DB 스키마·공개 계약·버전을 수정하지 않았습니다.
- 실제 로컬 runtime G7 `layout-editor.min.js` SHA256: `7cbd8fd7b5db8cccfee9f13c4d9a18749cd2b7003c499698e2d233b43dbc253b`; `LayoutService.php`: `3e9c30d2c6d42291d8f156aac5f305439ad7ea4ffd96131df875ed32136d8f24`. NE4 후보와 일치합니다. stock G7 전체 지원 증거가 아닙니다.
- Node 24, TypeScript strict, Vitest, Vite; 단일 `g7pb-dev`와 실제 `https://g7pb.test`, Chromium desktop 1600×1100, G7 `sirsoft-basic` 1.1.3. 모듈 소유 `/e2e-sandbox`만 사용하고 원본과 개인 조합을 finally에서 복구/정리합니다.

## 필요한 검사와 실행 결과

- `make task-submit TASK=native-ne5-editor-r3-20260908`: scoped 검사. 관련 native 단위 5파일 37건(조합 6, 필드 10, 호스트 10, 구조 9, 흐름 2) 통과. 모드 분리, 오래된 라이브러리 로딩, 위치 유효성, 요청 취소 후 늦은 응답 무시와 재시도를 포함합니다. TypeScript·변경 구조·CSS 검사 통과.
- production build: 기본 native gzip 7.77 kB, 조합 gzip 3.72 kB. 기존 8 KiB / 6 KiB 한도 안이며 React를 공유합니다.
- 최초 통합 브라우저에서 기존 NE1~NE4 4건은 통과했습니다. 신규 NE5 시험은 문단 모서리 좌표와 부모 선택 표시가 겹쳐 중단됐습니다. 문단 가운데와 컨테이너 여백 클릭을 구별하고 호스트 닫기 버튼의 안정적인 test ID를 사용했습니다. 제품 출처/선택 검증을 완화하거나 강제 클릭하지 않았습니다.
- 보정 후 NE5만 단독 실행하여 1건 통과했습니다. 이 진단용 실행은 아래 정식 통합 검증과 구분합니다. 증거 `output/playwright/ne5-focused`.
- 최초 통합에서 기존 성공 검사 15개를 재사용했습니다. 이후 실패한 브라우저 spec과 바뀐 검사 입력만 처리했습니다. 전체 coverage·전체 제품 E2E·G7 전체 타입 검사·콘텐츠 감사를 실행하지 않았습니다. 정식 브라우저 gate의 실행 단위는 native spec 한 파일이며 그 안의 5개 시나리오입니다.

## 실제 NAT-05 흐름

개인 조합 저장 → 현재 목록에서 이름 찾기 → 기존 G7에서 부모 선택 → 해당 자식 위치와 첫 항목 앞 순서 선택 → 삽입 → 새 문단 선택 → 문구 입력 취소 → 상세 편집 → 기존 페이지 설정에서 제목 및 route 문맥 확인 → 실제 새 창 미리보기 → 기존 저장 → 새로고침 후 재선택을 검증했습니다.

미리보기 전후 저장 API의 원본이 같고, 저장 이후 차이는 새 문단 삽입/편집뿐임을 비교했습니다. 기존 제목/주소/형제는 유지됐고 pageerror 0입니다. G7 페이지 설정 UI는 조회하여 기존 연결을 입증했으며 이번 차수에 설정 폼 구현이나 번역 저장 로직을 수정한 것은 아닙니다.

## 남은 범위

NE6에서 빈 JSON 객체/배열 보존, 실제 동시 저장, 지원 G7/테마/spec/renderer/CSS 조합, 장애·권한·반응형 회귀와 릴리스·푸시·배포·복구를 처리합니다. 이번 차수는 새 블록 콘텐츠·페이지킷·판매 테마 제작으로 확장하지 않습니다.

## 정식 통합 결과

- `make task-integrate-scoped TASK=native-ne5-editor-r3-20260908 INTEGRATION_TASK=native-ne5-integration-20260908` 통과. 제품 통합 SHA `13d231288269b4f0d4471873a2d4ca04b1c9a651`.
- `nativeEditorContract.spec.ts` 실제 5건 모두 통과(1.3분), 자동 재시도 0. 구조, 문구, 내용/미디어/취소, 개인 조합, NE5 흐름을 포함합니다.
- 정식 브라우저 증거: `output/playwright/gates/native-ne5-integration-20260908/2cf79ac6d0e5d89c58803b89e72ed07c3e97b6b304146ec8532dfc5135cf8905/f854d9870b414944858e027db127f036`. 원본 비교 JSON과 위치 선택/설정/미리보기/재열기 스크린샷을 포함합니다.
- 차수 종료 시 `make editor-plan-check`, `make integration-verify TASK=native-ne5-integration-20260908`, `make integration-finish TASK=native-ne5-integration-20260908 NO_RELEASE=1`을 사용합니다. 최종 결과는 조정 하네스의 보존 이력 및 `.runtime/audits/native-ne5-evidence-20260908` 실행 로그로 확인합니다. NO_RELEASE 종료는 운영 배포나 release 검증 SHA 승격이 아닙니다.
