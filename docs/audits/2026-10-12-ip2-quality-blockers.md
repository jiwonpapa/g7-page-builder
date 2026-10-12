# IP2 기존 품질 차단 수정

IP2가 없는 기준 fe37e7bbecdc9afe94d6ec4860f5365d6ff565a1에서도 재현된 기존 프런트엔드 실패 19건을 사용자 승인 범위에서 수정한다. IP2 문서 계약이나 품질 하한선은 변경하지 않는다.

## 수정 범위와 근거

- task ip2-quality-blockers-20261012는 테스트 2개, manifest, Card PNG 2개, 생성 index, 이 기록의 정확 7개 경로를 claim했다. index는 기존 source hash와 재생성 결과가 같아 실제 diff에는 포함되지 않는다.
- blockQualityInventory fixture의 preset은 heading을 보유하고 long-copy를 요구했지만 정의의 fields가 비어 있었다. 실제 heading plain 필드를 선언해 상태 계약을 일치시킨다. 기존 필수 상태 거부 시험과 제품 검증 로직은 유지한다.
- Card 블록과 card.empty가 공유하던 SVG 주소를 기존 공개 renderer로 생성한 별도 320×200 PNG 경로로 교체한다. manifest에서 이전 주소의 배포 hash 항목만 제거한다. SVG 원본 파일은 삭제하지 않는다.
- 두 PNG의 SHA-256은 30c4da20abe727faf829629e2b3fa315b5ba47d3da35bb8f41b53cbf15772289다. 기본 블록과 canonical 첫 프리셋의 실제 픽셀은 같아야 한다는 기존 품질 계약을 유지한다. 육안 확인 결과 빈 카드 외곽선의 실제 출력이며 완성 카드 콘텐츠를 새로 만든 것은 아니다.
- Card의 서로 다른 주소, 동일 canonical hash, 이전 주소 미참조를 확인하는 회귀 시험 1개를 추가한다. 전체 카탈로그의 경로 유일성·PNG 규격·hash 검사를 완화하지 않는다.

## 검증

Node 24.19.0, PHP 8.5.3, macOS arm64. 고정된 Playwright Chromium headless shell 1234를 설치해 기존 생성기를 실행했다. 패키지 manifest와 lockfile은 변경하지 않았다.

```sh
npm run build
npm run generate:block-thumbnails -- --catalog-id=block:content.card-01@1 --catalog-id=preset:jiwonpapa/builtin-core:card.empty
npx --no-install vitest run tests/Unit/blockPackManifest.test.ts tests/Unit/blockQualityInventory.test.ts
npm run typecheck
node scripts/check-block-quality-evidence.mjs --technical --ids block:content.card-01@1,preset:jiwonpapa/builtin-core:card.empty --json
```

- production build, 지정 2/148개 썸네일 생성과 candidate 품질 검사 통과.
- 관련 테스트 24개 통과. 기존 실패 19건 해소와 추가 Card 회귀를 포함한다.
- 타입 검사 통과. 최초에는 worktree의 격리 IP1 fixture 의존성이 없어 실패했으며 기존 lockfile의 의존성을 준비한 뒤 확인했다.
- Card 두 항목의 현재 렌더 source 검사 통과. 과거 품질 승인 원장은 수정하지 않았고 release_authorized=false를 유지한다.

## 제출 하네스 선행 보완

manifest에서 이전 썸네일 주소를 제거하면 기존 범위 선택기가 현재 manifest만 읽어 소유자 없음으로 거부했다. 사용자 추가 승인에 따라 별도 task ip2-thumbnail-scope-20261012가 tools/g7pb/content.py와 tests/Harness/test_content.py만 소유했다. 교체 전·후 소유자의 합집합을 선택하되 알 수 없거나 삭제된 소유자는 계속 거부한다. 관련 content 하네스 39개와 선택된 회귀를 통과해 제출 9e241ef477334c158f9ba9a7e48548095bc6b83e, Local 통합 0dbe4c3689a5b6c7a5427ef6fe0f5758db826896으로 기록했다. 원 task는 통합된 Local controller로 제출하며 기존 base와 소유 범위는 유지한다.

위 관련 검증은 IP2 전체 통합·제품 브라우저 성공·배포 증거가 아니다. 통합 결과와 후속 전체 검증은 IP2 전용 감사 기록 및 coordination 제출·통합 SHA로 구분한다.
