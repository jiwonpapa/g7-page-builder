# 1차 커밋·통합 후속 증거

일자: 2026-08-31. 검증 대상 main SHA: `d0c853c9310b105d750035e7780662cdd1da62eb`.
이 기록은 [최초 기준선](phase-1-evidence.md)을 대체하지 않는 후속 실행 기록입니다.

## 결과와 커밋

정책 문서와 선행 미디어/편집 CSS 변경을 하네스로 main에 통합했습니다. 통합 SHA에서 frontend gate, 핵심 lifecycle, 포인터 편집 시험이 통과했습니다. **1차 전체 종료·전수 시각 합격·운영 배포는 아닙니다.**

| 대상 | 제출 SHA | main 통합 SHA |
|---|---|---|
| 1차 정책·목록·차수 계획 | `d31d914a04363ac4b241f5e9ad1034b60f20310d` | `823bec3830fb2f2db1b51b6d880eebf41e8072de` |
| 선행 미디어·편집 CSS | `cab45fc9544ef91766a2c2f52b14887e85807309` | `d0c853c9310b105d750035e7780662cdd1da62eb` |

미디어 task의 최초 제출 `5ffd5a0`와 fixture 보정 `a4e5ec4`를 보존한 채 `task-resubmit`으로 수정했습니다. Hero route 시험은 실제 CTA를 fixture에 넣어 클릭 대상의 전제를 바로잡았습니다. 빈 버튼을 제품 코드에 되살리거나 시험을 생략하지 않았습니다.

썸네일 로딩 실패 시 실제 블록과 다른 도형 미리보기를 보여주던 대체 출력을 명시적 실패 문구로 변경하고 해당 장식 CSS를 제거했습니다. 정상 이미지 경로·검색·삽입 동작은 유지합니다. 추가 회귀 assertion의 실패를 먼저 확인한 뒤 구현하고 전체 256개 시험을 실행했습니다. CSS/JS 예산을 올리지 않았습니다.

## 실행 결과

Docker 통합 runtime은 Node 24.19.0·PHP 8.5.9입니다. 통합 작업은 `wysiwyg-media-integration-20260831`의 integration/runtime lease로 실행했습니다.

| 검사 | 결과 | 범위 |
|---|---|---|
| Docker frontend gate | PASS | version/store/편집 계약/레이아웃 계약/TS strict/CSS lint/coverage/G7 의존성/경계/build/assets/budgets |
| Vitest V8 coverage | 32 files, 256 tests PASS | lines 76.07%, statements 73.45%, branches 68.37%, functions 68.55%; 설정 하한 통과 |
| 최신 렌더 원본 검사 | 140 items PASS | main의 현행 public CSS 기준; 미통합 rich-boundary CSS 승인이 아님 |
| Desktop lifecycle | 1 PASS, 1.3분 | 문서 생성·편집·이미지 교체·저장/새로고침·미리보기·발행·복원·재발행·발행 취소 |
| 실제 포인터 편집 | 2 PASS, 14.5초 | ActionBar 도달성, 드래그 글자 선택, font/size/color, 저장·재진입·발행 표현 |

포인터 시험 이름의 `nested`는 Features 반복 항목 내부 리치텍스트 필드를 뜻하며 새 Section/Columns 중첩 레이아웃 구현 증거가 아닙니다. lifecycle은 이 실행에서 builder/none 경로를 검증했으며 별도 active G7 User Template·임시 홈 시험은 선택하지 않았습니다. 재시도는 0회, 최종 선택된 세 시험에 skip은 없습니다. 첫 lifecycle 실행의 시작 앵커 grep은 전체 시험명과 맞지 않아 0건으로 종료했고, 이를 성공으로 세지 않고 올바른 이름으로 다시 실행했습니다.

| 용량 | 실측 / 한도 |
|---|---|
| editor CSS 원본 | 153,473 / 157,000 bytes |
| editor CSS gzip | 41,583 / 45,000 bytes |
| Site Part CSS gzip | 29,964 / 32,000 bytes |
| editor JS gzip | 479,048 / 500,000 bytes |

이 표는 Docker 최종 통합 빌드 값입니다. 수정 전 macOS 측정의 editor CSS 원본 170,866 bytes·Site Part CSS gzip 32,514 bytes와 환경을 구분하며, 성능 향상률로 환산하지 않습니다.

## 실제 브라우저 관찰

Browser 스킬로 새 로컬 확인 탭에서 기존 문서를 읽고 갤러리 열기·검색·닫기만 수행했습니다. 원래 사용자 탭은 건드리지 않았고 기존 문서를 수정·저장·발행하지 않았습니다.

- 목록은 신규 선택 가능 블록 44개와 완성 섹션 95개를 표시했습니다.
- `캐러셀` 검색 결과 네 항목의 실제 썸네일이 모두 320×200으로 로딩됐습니다. 초기 lazy-loading 미완료와 최종 완료를 구분했습니다.
- 스크린샷으로 정상 이미지와 선택창 레이아웃을 확인했습니다. 현재 이미지 캐러셀 기본 썸네일에는 대표 이미지 미지정 영역이 남아 있으므로 완성 콘텐츠 품질 승인으로 취급하지 않습니다.
- 확인 탭의 오류 로그는 0건이고 갤러리를 닫은 뒤 문서 상태는 `저장됨`이었습니다. 로딩 실패 대체 문구의 근거는 단위시험이며 실제 네트워크 실패를 이 브라우저에서 강제로 재현한 것은 아닙니다.
- 자동 E2E는 별도 소유 시험 문서/미디어를 사용하고 기존 하네스의 소유권 검사 후 자체 정리를 마쳤습니다.

## 아직 닫히지 않은 조건

1. **빈 텍스트 보정:** `wysiwyg-optional-20260831`은 renderer 세 파일만 소유한 active dirty 작업입니다. 구 기준의 시험 fixture가 빈 CTA를 클릭하므로 제출 시험 1건이 실패합니다. fixture 수정은 main에 통합됐지만 active dirty task의 기준/시험 소유권을 자동 재편하는 절차는 아직 적용하지 않았습니다. 기존 변경과 이력을 보존하는 범위 재편 승인을 요청한 상태입니다. 수동 merge·metadata 수정·강제 lease 해제를 하지 않습니다.
2. **공개 CSS 경계:** `rich-boundary-20260831`의 제출 `57037cc8c5d1a76c16a6f3fb5fb1f0fb840c2cd7`은 미통합입니다. 해당 worktree의 새 public CSS로 렌더 원본을 검사하면 140개 전부 stale source로 실패합니다. 공개 CSS 전체 hash가 모든 항목의 렌더 source와 일괄 승인 digest에 결합되어 있기 때문입니다. 내용/권리 승인과 렌더 검증을 분리할 필요성이 확인됐지만 시각 재검증을 면제하거나 승인 hash를 임의 갱신하지 않았습니다.
3. **대표 콘텐츠의 제품 확인:** 최초 기준 화면과 새 콘텐츠 기준의 사용자 확인, 미완료 편집/공개 동등성, PC·태블릿·모바일 전수 시각 회귀는 남았습니다. G7 템플릿의 SVG/details 손실은 기존 작업 기록이며 이번 선택된 시험으로 재현/해소했다고 주장하지 않습니다.
4. **전체 통합/배포:** 두 선행 task가 남아 있으므로 최종 `integration-verify`·릴리스 조건은 충족되지 않았습니다. 원격 push·스테이징·운영 배포를 하지 않았습니다. 제품 버전은 0.30.0을 유지합니다.

## 재현 명령

main Local에서 runtime lease를 확인하고 실행합니다. `.env.docker.local`의 자격증명을 출력하지 않습니다.

```bash
make runtime-guard TASK=wysiwyg-media-integration-20260831
docker compose --project-name g7pb-dev --env-file .env.docker.local -f compose.yaml exec -T --user "$(id -u):$(id -g)" dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npx playwright test tests/E2E/pageBuilderLifecycle.spec.ts --project=desktop --grep "manages, publishes, restores" --retries=0 --reporter=list --output=output/playwright/media-integration-20260831'
docker compose --project-name g7pb-dev --env-file .env.docker.local -f compose.yaml exec -T --user "$(id -u):$(id -g)" dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npx playwright test tests/E2E/editorInteractionQuality.spec.ts --project=desktop --retries=0 --reporter=list --output=output/playwright/media-pointer-20260831'
```

후속 기록 task는 문서 두 파일만 소유한 `productization-phase1-followup-20260831`입니다. 제출/통합 SHA는 하네스와 Git 기록으로 확인하며, 이 문서 자신의 미래 commit SHA를 미리 만들지 않습니다.

## 빈 텍스트 보정 후속 제출 (2026-08-31)

위 1번 차단은 범위 재편이나 하네스 변경 없이 해결할 제출 경로를 검증했습니다. 원래 dirty patch를 별도 복구 산출물로 보존한 뒤 Hero 버튼 보정 두 줄만 최종 적용 단계로 보류하고 독립 보정을 `26a6f1a`로 제출했습니다(247 tests PASS). 정식 `task-restack`으로 main `ba04c88`에 올리고 Hero 보정도 모두 복구·재제출했습니다(256 tests PASS). 부분 보정을 최종 완료로 처리하지 않았으며 수동 merge·metadata 수정·lease 강제 해제는 없었습니다.

최종 코드 제출은 `wysiwyg-optional-20260831`의 `eacd8d4f3bd3722763fa4860ecafb8f2d1991cb1`입니다. 기존 원래 PATHS를 유지합니다. 비중복 시험 task `wysiwyg-optional-tests-20260831`은 이 코드 SHA를 기준으로 단위/E2E 시험, Unreleased, 후속 문서만 소유합니다. 두 task는 `task-integrate-batch`에서 함께 검증·통합하며 최종 통합 SHA는 Git/coordination 기록으로 확인합니다.

추가로 확인·보정한 조건:

- Puck 0.23.0의 편집 필드는 `value`, 읽기 전용 richtext는 `content`, Puck Render는 Suspense의 자식으로 값을 전달합니다. 원래 helper가 읽기 전용 정상 본문을 빈 값으로 오판하는 assertion 실패를 먼저 재현하고 보정했습니다.
- 일반 텍스트의 `<안내>`나 `&nbsp;`는 문구 자체입니다. HTML 빈 문단과 같은 기준으로 지우지 않도록 plain/richtext 모드를 구분합니다.
- CTA 본문은 별도 sidebar richtext 필드가 없는 canvas-only 편집 대상입니다. 비어도 PC 편집 입력칸을 유지해 내용을 다시 넣을 수 있게 하고, 읽기 전용 미리보기에서는 빈 본문을 제외합니다. 입력 칸은 문서 콘텐츠나 발행본에 추가하지 않습니다.
- `optionalCanvasText.test.tsx`는 빈 값/정상 값/태그 모양 문구, Hero 두 레이아웃, CTA/Contact/Heading 및 실제 Puck Render/Suspense를 검증합니다.
- `optionalCanvasText.spec.ts`는 1440/768/390 host 폭의 표시, 빈 본문 재입력, 미리보기 전환, 저장/새로고침, 실제 PHP 발행본을 검증합니다. 이 제출 시점의 소스 존재를 실제 E2E 통과로 표시하지 않습니다. 통합 runtime에서 실행 후 결과를 별도로 보고합니다.

이 후속 제출로 이전의 **작업 범위 재편 승인 요청은 불필요해졌습니다.** 공개 CSS의 렌더 증거 갱신, 대표 콘텐츠 사용자 확인, 최종 통합/릴리스 조건은 그대로 남습니다.

## 빈 텍스트 통합·실제 입력 검증 결과 (2026-08-31)

코드 `eacd8d4`와 시험 `1e379db`는 배치 통합 SHA **`6fe0900b743c0bdd425dca9760cb7fcda4c19a3f`**에 반영되었습니다. 통합 frontend gate는 **33 files / 269 tests PASS**이며 TypeScript strict, CSS lint, production build, asset/용량/경계 검사와 최신 렌더 원본 140개 검사가 통과했습니다. 기존 public CSS 기준으로, 미통합 `rich-boundary`의 검증 결과가 아닙니다.

후속 시험 보정은 clean `6fe0900b`에서 시작한 `optional-input-verification-20260831`에서 수행했습니다. main runtime의 제품 코드는 그대로 두고, 소유 worktree의 Playwright 시험으로 실제 로그인·문서 API·브라우저·PHP 발행본을 확인했습니다. 시험 문서만 기존 소유권 확인/정리 하네스로 생성·폐기했으며 사용자 문서는 변경하지 않았습니다.

### 실패의 원인과 정정

1. 최초 시험은 준비 여부를 구분하지 않는 `[contenteditable="true"]`를 조작했습니다. 삭제한 DOM은 비어도 Puck 필드 focus는 `null`, 문서는 기존 값이었습니다. 고정 Puck 0.23.0의 `EditorFallback`은 입력 처리기가 없는 임시 contenteditable이며 실제 Tiptap과 같은 선택자에 잡힙니다. 준비된 `.tiptap[contenteditable="true"]`를 기다리고 실제 클릭 초점과 키보드 삭제를 검증하도록 보정했습니다. 임의 지연, 비공개 상태 수정, DOM을 원본으로 저장하는 우회는 추가하지 않았습니다.
2. 준비된 입력기로는 삭제 직후 기기 미리보기 전환과 PC 복귀·재입력이 통과했습니다. 따라서 최초 실패를 영속 데이터 유실이나 프레임워크 교체 필요의 근거로 확정하지 않습니다. 초기 fallback 자체의 입력 가능 노출은 남은 로딩 UX 검토 항목이며, 이번 준비 완료 후 시험으로 초기 로딩 구간까지 합격했다고 주장하지 않습니다.
3. Contact 주소는 draft에서 비어 있는 표현을 확인할 수 있지만 현행 발행 필수값입니다. 빈 주소를 선택값으로 가정한 시험을 고쳐, 발행 오류를 먼저 확인하고 실제 속성 패널에서 주소를 입력한 뒤 발행합니다. 필수 검증을 완화하지 않았습니다.

### 실제 실행 증거

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| optional E2E 전체 project | **3 PASS / 29.8초** | desktop/tablet/mobile 설정; 각 설정에서 1440·768·390 host 표시와 PC 편집 흐름 |
| desktop 반복, retries=0 | **3 PASS / 27.3초** | 별도 문서로 3회 반복; 엔진 준비·삭제 직후 전환 재확인 |
| 저장·발행 | PASS | 빈 본문 편집 칸 유지, 재입력·저장·reload, 주소 누락 발행 차단, 주소 입력 후 PHP 공개 본문·링크 |
| CTA 캡처 검토 | 제한적 확인 | 세 host 폭의 본문 유지 확인. tablet 캡처에는 축소 캔버스와 겹친 inspector가 포함되어 독립 시각 합격 증거로 사용하지 않음 |

증거는 Local의 `output/playwright/optional-acceptance-20260831`와 `output/playwright/optional-repeat-20260831`입니다. 앞선 실패 증거(`optional-content`, `optional-pointer-diagnostic`, `optional-dirty-diagnostic`, `optional-focus-diagnostic`, `optional-dom-diagnostic`, `optional-events-diagnostic`, `optional-ready-editor`, `optional-ready-lifecycle`의 동일 일자 디렉터리)도 보존했습니다. 초기 탐색용 로그·DOM 이벤트 계측은 최종 코드에 남기지 않았습니다. 별도 candidate bundle 검사는 공유 runtime 덮어쓰기 없이 요청 단위로만 적용하며 위 PASS 실행에는 candidate를 사용하지 않았습니다.

후속 시험/문서 커밋은 하네스로 제출·통합하고 SHA는 Git/coordination 기록에 남깁니다. **1차 전체 완료는 아닙니다.** 공개 CSS 증거 갱신, 대표 페이지 기준의 사용자 확인, 최종 통합 검증은 별도로 남습니다. TypeScript/React/Puck 버전과 공개 문서 계약을 변경하거나 원격 push·배포하지 않았습니다.

### Linux 통합 브라우저의 단축키 차이

위 시험/증거 제출 `e683dd2`는 frontend gate를 다시 통과해 main `9371e2f`로 통합했습니다. 이어 Docker에서 동일 E2E를 실행한 결과 desktop 1 PASS, iPad/iPhone emulation 2 FAIL입니다(`output/playwright/optional-integrated-20260831`, 47.8초). 이 결과는 앞선 macOS의 3 PASS를 덮어쓰지 않는 별도 실행 증거입니다.

실패 위치는 미리보기 전환 전 전체선택·삭제입니다. Tiptap은 iOS emulation에 Mac keymap을 사용하며 `Ctrl-a`를 문단 시작으로 해석합니다. Linux 실행기의 `ControlOrMeta+A`와 일치하지 않으므로 준비된 입력기를 실제 클릭·초점 확인한 뒤 플랫폼 독립적인 Playwright `fill('')` 입력으로 시험을 보정했습니다. 초기 fallback을 건드리지 않도록 `.tiptap` 준비 조건은 유지합니다. 테스트 skip, 제품 키보드 동작 변경, 발행 검증 완화는 없습니다. 보정 task는 clean `9371e2f`의 `optional-browser-portability-20260831`이며 최종 재실행 결과는 제출·통합 증거와 분리해 기록합니다.
