# 3-A3 · canonical 요청·저장·미리보기·공개 SEO 회귀

2026-08-31. 실제 runtime main `321609354b9cc85e71cf23bfcbb0791120f8e99a`. task `productization-phase3a-seo-e2e-20260831`, frontend profile.

## 검증 범위

기존 `optionalCanvasText.spec.ts`의 실제 포인터 선택·Delete/Backspace·저장·reload·재입력·발행 흐름을 확장합니다. 새 인증/미디어/저장 하네스나 다른 비교 문서를 만들지 않습니다.

1. 자신이 생성한 시험 문서에 canonical SEO title/description/og_image_url/robots를 설정합니다.
2. 본문 삭제와 다른 문구 재입력의 저장 응답마다 **실제 PUT 요청 문서의 SEO**를 검사합니다.
3. 서버 GET, 편집 화면 reload 후 원본 문서, 서버가 발급한 preview URL의 본문을 확인합니다.
4. 각 발행 후 실제 공개 페이지의 title·description·robots meta 및 X-Robots-Tag를 검사합니다.
5. desktop/tablet/mobile 브라우저 모사 3개 × Delete/Backspace 2개를 실행합니다. 실제 편집은 모두 1440px PC host에서 수행하고 768/390 host와 1280/768 canvas 전환의 기존 읽기 전용 정책을 유지합니다.

이 시험은 v1 문서의 기존 흐름입니다. 이름의 본문/선택 검사나 read-only canvas를 v2 중첩 레이아웃·모바일 직접 편집 합격으로 표현하지 않습니다. shell_mode=none의 SEO 공개 경로를 검증하며 template 전역 SEO·전체 카탈로그·새 구역 패턴·릴리스는 대상이 아닙니다. OG 이미지 값은 명시적 빈 문자열의 보존이며 실제 공유 이미지 다운로드/플랫폼 반영 시험이 아닙니다.

## 실패와 정정

- 첫 실행: 1 FAIL / 5 미실행, 20.236초. 서버값·title·description은 통과했지만 robots meta의 기대값에 공백을 넣은 시험 오류였습니다. 실제 viewer 계약은 meta `noindex,nofollow`, HTTP header `noindex, nofollow`로 서로 다릅니다. 제품 코드를 변경하지 않고 meta 기대값을 교정했습니다. 실패 자료는 `output/playwright/phase3a-seo-20260831/`에 보존합니다.
- 교정 후 서버값/공개 검사: 6 PASS, 81.337초, retries=0 / flaky=0 / skipped=0. 자료는 `output/playwright/phase3a-seo-verified-20260831/`입니다.
- 그 다음 outgoing PUT 검사를 추가해 전체 6개를 별도로 재실행했습니다. **최종 6 PASS, 85.294초, retries=0 / flaky=0 / skipped=0**입니다. 서버의 SEO 보존 fallback만으로 프런트 누락을 숨기지 않습니다. `output/playwright/phase3a-seo-payload-20260831/report.json`과 같은 경로의 PNG가 근거입니다. 테스트 파일은 이 task worktree에서 읽고 제품 JS/CSS/API는 후보 주입 없는 main `3216093` runtime을 사용했습니다.
- desktop 공개 CTA의 재입력 결과 PNG를 직접 확인했습니다. 이 화면 확인은 테스트 CTA 한 사례이며 전체 카탈로그의 시각 승인이나 template SVG 아이콘 합격으로 확대하지 않습니다.
- source refresh는 editing digest 140개만 변경했고 content/rights/render 및 모든 결정은 기존 객체와 같은지 비교했습니다. 현재 renderer 썸네일 source 변경은 0개이고 pending 560개를 유지합니다.

**분석 정정:** 초기 3-A2 기록은 Service까지만 읽고 서버도 SEO를 복원하지 않는다고 잘못 판단했습니다. 실제 Repository는 누락된 SEO를 이미 보존하고 있었습니다. 프런트 canonical 왕복의 누락은 재현됐지만 DB 유실은 재현된 사실이 아닙니다. 이 차이를 3-A2 기록에도 정정했으며 서버 코드는 그대로 유지합니다.

## 진행 상태와 마지막 승인 목록

| 차수 | 현재 상태 |
|---|---|
| 2차 잔여 | 공개 CSS 후보의 썸네일/증거 140개 갱신과 기존 CSS-only task 범위 조정 필요. template 제목 치수·문단 여백·SVG 아이콘 잔여 유지 |
| 3차 | 3-A1 트리/공통 정책, 3-A2 왕복 변환 분리·프런트 SEO 보존, 3-A3 실사용 회귀. v2 스키마·Puck slot·저장·발행·복원 연결은 미구현 |
| 4~5차 | 구조/반응형 편집과 개인 Section 패턴 미구현 |
| 6~7차 | 대표/전체 콘텐츠 정비와 사람 심사 미완료 |
| 8차 | 최종 통합·전수·업그레이드/복구·릴리스 미완료 |

형님의 연속 추진 지시에 따라 진행 승인을 반복하지 않고 독립 준비 작업을 수행했습니다. 아래 경계는 임의로 해제하지 않았습니다.

1. **작업 범위 조정 승인:** 기존 CSS 제출 SHA·worktree를 보존하면서 CSS와 썸네일/manifest/v2 증거를 함께 제출할 수 있는 정식 인계가 필요합니다. 현행 동일-PATHS replacement를 우회하거나 lease/metadata를 수동 변경하지 않습니다. 검증을 약화하지 않고 동일 이상 profile로 재제출하는 방향입니다.
2. **목표 재개 조작:** 기존 목표는 앱에서 blocked 상태입니다. 새 목표 생성은 기존 미완료 목표 때문에 거부됐고 전용 재개 도구가 없습니다. Computer Use를 통한 Codex 앱 상태 확인도 안전 정책상 거부돼 중단했습니다. 접근 제한을 우회하지 않았고 무인 목표가 재개됐다고 보고하지 않습니다. 형님의 앱 재개 조작이 필요합니다.
3. **사람 승인·배포:** 콘텐츠/권리/시각 결정 560개는 pending을 유지합니다. 운영 배포·파괴적 이행·릴리스 승인은 실행하지 않습니다.

남은 차수 전체를 끝냈다는 보고가 아닙니다. 위 선행 조건을 남긴 채 중첩 기능·콘텐츠 수를 늘려 완료 처리하지 않습니다.
