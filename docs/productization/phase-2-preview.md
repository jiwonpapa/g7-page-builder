# 2-D 후속: 태블릿 미리보기 패널 겹침

Task `productization-preview-20260831`, 기준 `5b6d546f54b8faec913e3cbcf80006d8990f58b8`, frontend/shared-contract.

- 실제 2-D 통합 화면에서 768px 태블릿 미리보기에 양쪽 편집 패널이 기본으로 열려 본문을 가리는 문제를 확인했습니다. 기존 조작시험 3 PASS를 시각 합격으로 표시하지 않습니다.
- UX-01/G7R-04: PC 전용 편집/태블릿·모바일 미리보기 정책을 유지합니다. 원인은 제품 PC 기준 1024px과 Puck 기본 패널 축소 기준 638px 사이의 불일치입니다. Puck의 공개 `ui`/`setUi` 패널 상태만 사용하고 private CSS·별도 레이아웃 엔진을 도입하지 않습니다.
- 좁은 기기 진입 시 패널을 접고 PC로 복귀하면 기존 PC 패널 설정을 복원합니다. PC에서 선택한 모바일 캔버스 미리보기와 실제 호스트 폭을 구분합니다. 사용자 문서·선택·Undo/Redo·저장 상태를 변경하지 않습니다.
- 회귀시험에 패널 비표시와 iframe 좌우/중앙이 실제로 가려지지 않는지 hit-test를 추가합니다. reload 없는 PC→태블릿→PC 전환, 기존 삭제→재입력→저장→재진입→발행도 확인합니다.
- 기존 공개 CSS·v1 썸네일/승인·제품 API/schema는 변경하지 않습니다. v2 원장에서는 실제 변경 영향만 pending으로 갱신합니다.

## 구현 및 제출 전 검증

- `PuckHeaderLayer`는 공개 selector로 패널 상태를 읽고, 호스트 지원 여부가 바뀔 때만 `setUi`를 실행합니다. 기존 PC 패널 상태를 ref로 보존하며 `recordHistory:false`로 문서 이력과 분리합니다. 사용자가 PC에서 패널을 닫아 둔 경우에도 복귀 시 임의로 열지 않습니다.
- 회귀시험을 먼저 보강하고 기존 main에서 태블릿 패널이 visible이라 실패하는 RED를 확인했습니다. 이후 worktree 빌드를 브라우저 요청에만 주입한 candidate에서 **desktop/tablet/mobile 3 PASS, 33.8초, retries=0**입니다. 패널 접기/복원, 사용자가 접어 둔 PC 설정 유지, iframe 좌우/중앙 hit-test, 삭제·재입력·저장·reload·발행을 포함합니다.
- TypeScript strict·production build PASS. 전체 Vitest V8 **37 files/329 tests PASS**, 14.68초. 기존 coverage 대상·하한을 그대로 유지합니다.
- 실제 PHP/실파일 하네스 PASS, v1 source 변화 0. v2 갱신은 **content 0 / rights 0 / render 0 / editing 140**, 560 pending을 유지합니다. 기존 승인 객체는 변경하지 않았습니다.
- 비교 화면: Local `output/playwright/phase2d-20260831`(발견), `phase2d-preview-red-fixedrunner-20260831`(재현), `phase2d-preview-preferences-20260831`(수정 후보). 768px 화면에서 본문을 가리던 좌우 패널이 사라지고 캔버스가 가용 폭을 사용하는 것을 확인했습니다. 첫 RED 실행의 서로 다른 Playwright 설치 경로 오류는 실행 실패로 분리했으며, 동일 worktree CLI로 맞춘 후 제품 실패를 재현했습니다.
- 자동 제출/통합 후에는 request-local candidate 설정 없이 Local Docker의 실제 빌드를 같은 3개 설정으로 다시 검증합니다. 결과는 통합 SHA와 브라우저 산출물을 함께 확인하며 후보 시험을 통합 시험으로 대신하지 않습니다.

## 남은 범위

이 수정은 태블릿 본문 가림 회귀이며 편집 UI 전체 재설계나 콘텐츠 제품 승인 완료가 아닙니다. 미통합 `rich-boundary` 공개 CSS는 영향 화면과 썸네일/렌더 증거를 별도 검증해야 합니다. v1 gate를 우회하거나 560개 새 기준 심사를 자동 승인하지 않습니다.
