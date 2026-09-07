# NE2 — 내용·스타일·미디어 편집 마감

NAT-02: **로컬 구현·통합·실제 브라우저 검증 통과**. 현행 6차 계획 중 2차다. 운영 배포·stock G7 지원 완료를 뜻하지 않는다.

## 기준과 구현

| 항목 | 검증한 값 |
|---|---|
| PB 기준 | `8036f5176acdd4416c3852fdec48181b727d5b7f` |
| PB 구현 제출 | `1e29e89a04c1e4a75472c9938126d571ea57f915` |
| PB 제품 통합 | `45ae4152d8321726e14eeea6daa0f8ad35c7f9a9` |
| G7 선행 후보 | `9260d521ab3d69761a428b3d1c54df1297ecf6eb` |
| G7 NE2 후보 | `c9e59a55223dadb039d9e20fb0726623d25619b1` · engine-v1.66.0 |
| 지원 실측 조합 | sirsoft-basic 1.1.3, 일반 페이지 `/e2e-sandbox`, `_user_base` 상속 |
| 환경 | 로컬 `g7pb-dev`, `https://g7pb.test`, Node 24.19.0, PHP 8.5.9, Chromium desktop 1600×1000 |

G7 변경은 별도 `codex/native-editor-content-ne2-20260907` 후보에 커밋했다. G7 main/upstream 반영·push·운영 배포는 수행하지 않았다. PB는 기존 독립 Puck 문서/저장을 건드리지 않고 `adapters/gnuboard7`에서 공개 host를 검증한다. native domain/port/UI는 G7 내부 import나 별도 저장·Undo를 사용하지 않는다.

- 현재 병합 spec이 선언한 내용 필드와 유한 스타일 프리셋을 `snapshot.fields`로 전달한다. `setControl`은 실행 시점의 문맥·출처·spec을 다시 확인하고 기존 recipe와 문서/이력에 한 번 반영한다.
- 링크·이미지 URL·alt, 짧은 라디오 옵션, 많은/긴 옵션의 Select, 개별 값/기본값 상속/사용자 값 표시와 초기화를 제공한다. 비율/맞춤은 G7이 소유한 표준 Img 프리셋이며 기존 템플릿 파일에 새 spec을 덮어쓰지 않는다.
- 빈 alt 입력은 명시적인 `alt: ""`, 초기화는 해당 override 제거다. 바인딩·불투명 props/style·수정하지 않은 class/style·다크/반응형·미지 필드를 보존한다. 단순히 다른 클래스가 있다는 이유로 기본값을 사용자 값으로 표시하던 문제도 회귀 시험 후 수정했다.
- 기존 인증 첨부 클라이언트에 페이지/템플릿 범위와 AbortSignal을 연결한다. 업로드는 현재 layout에 귀속되며 파일 선택이 있어야 src를 변경한다. 취소·오래된 문맥·늦은 응답을 host와 UI에서 차단한다. 참조 초기화·취소는 파일 삭제가 아니다. 서버가 이미 받은 업로드는 이후 정상 목록에 남을 수 있다.

## 검증 결과

| 검사 | 명령/대상 | 결과 |
|---|---|---|
| PB 관련 단위 | `npx vitest run tests/Unit/nativeFields.test.tsx tests/Unit/nativeMedia.test.tsx tests/Unit/nativeHost.test.tsx tests/Unit/nativeNodeChange.test.ts` | 59 통과 |
| G7 공개 host/필드 | `npx vitest run` + `layout-editor/__tests__/hooks/extensionFields.test.ts`, `extensionHost.test.tsx` | 최종 소스 66 통과 |
| G7 기존 소비 경로 | `dimension-and-attachments.test.tsx`, `recipeEngine.test.ts`, `recipeEngine.scope.test.ts` | 86 통과; 변경 없는 성공 입력 재사용 |
| PB 필수 gate | `make task-submit`, `make task-integrate-scoped` | strict TypeScript, 관련 단위, 구조, CSS, 빌드/asset 검사 통과 |
| 실제 브라우저 | `tests/E2E/nativeEditorContract.spec.ts` desktop | NE1+NE2 2개 통과, 27.3초 |
| G7 빌드 | Node 24, `G7_BUILD_SOURCEMAP=0 NODE_ENV=production npm run build:core`, `build:core-editor`, `build:core-devtools` | 생산용 3번들 빌드 통과; 변경 번들 커밋 |
| G7 strict 진단 비교 | 동일 strict tsc probe를 선행 후보와 NE2 후보의 확장 import 경로에 적용 | 기존 진단 19개 동일, 추가 진단 0; 전체 G7 strict 통과 주장은 아님 |
| 번들 경계 | native JS gzip 약 4.82KB, 기존 8KB 상한 | React/Puck/Tiptap 재번들 없음 |

실제 브라우저에서는 정렬·href·src·alt·aspectRatio·objectFit을 변경하고 Undo/Redo·G7 저장·재열기를 확인했다. 저장 API의 전체 JSON을 독립 예상 원본과 비교하여 **수정 외 의미 차이 0**, **pageerror 0**을 확인했다. 링크와 이미지의 실제 DOM 속성, 계산된 정렬·비율·맞춤도 확인했다. 기존 템플릿/반응형/미지 필드와 바인딩된 alt가 보존됐다.

이미지 업로드/목록/선택은 실제 G7 첨부 API를 사용했다. 503·취소·선택 전환·일반 페이지 전환 뒤의 늦은 응답은 별도 네트워크 실패 fixture로 검증했다. 이때 src/저장 원본은 변하지 않았고, 오래된 응답의 가짜 자산 URL이 새 목록에 들어오지 않았다. 실패 fixture를 실제 업로드 성공 증거로 집계하지 않았다. 테스트가 소유한 일반 페이지 원본은 종료 시 복원한다.

### 보존 증거

- 원시 브라우저 결과: `output/playwright/gates/native-ne2-integration-20260907/ff41f1daed2d9913c75978e47608e2c8d07f09d4f6866235f381a30a6163ea13/16156bb9474f46c88bcb268fdd6caafe/`
- 해당 결과의 `native-ne2-reopened.png`를 열어 실제 상세 편집 패널과 재열기 상태를 확인했다. `NAT-02-source-and-media` 첨부는 변경 필드, 의미 diff, 실패 시나리오, pageerror를 기록한다.
- 로컬 명령/진단 로그: `.runtime/audits/native-ne2-evidence-20260907/`
- 로컬 G7 runtime의 이전/후보 digest: `.runtime/audits/native-ne2-runtime-backup-20260907/manifest.json`. NE1 bundle digest를 먼저 확인한 뒤 편집기 번들과 새 언어 키만 적용했다. 기존 runtime Git tree를 초기화하거나 설치 템플릿을 덮지 않았다.
- 이전 실패 제출은 정식 replacement history와 원 worktree에 보존했다. 최초 multipart 준비 요청의 JSON Content-Type과 테스트 편집 언어를 수정했다. 취소 시험은 서버 저장 파일의 부재를 요구하는 잘못된 판정 대신 원본 무변경·늦은 응답 오적용 여부를 검증하도록 바로잡았다.

## 남은 범위

NE2는 현재 spec의 지원 필드/유한 프리셋과 공통 스타일 편집이다. 임의 스타일 입력·전 템플릿 renderer 호환·기기/다크 스타일 편집 UI·일반 페이지 생성/메뉴 CRUD·고급 DAM 완료를 주장하지 않는다. 이미지 콘텐츠 품질을 감사하거나 디자인 블록을 늘리지 않았다.

**다음은 NE3 내부 트리·반복·동적 요소 편집**, 이어 NE4 사용자 조합, NE5 편집 흐름 연결이다. **마지막 차수는 NE6 호환·회귀·릴리스**이며 실제 동시 저장/전체 지원 조합과 승인 범위의 push·배포·복구를 확인한다.
