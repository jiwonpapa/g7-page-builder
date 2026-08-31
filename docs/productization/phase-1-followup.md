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
