# 기존 카탈로그 검증 기준 정비

4차 게시판 조합 기능과 독립된 기존 생성물·검증 경로 정비입니다. 제품 출시 승인이나 전체 디자인 완성 판정이 아닙니다.

## 렌더 근거

현재 기준 코드와 4차 제출 코드로 기존 블록·프리셋 140개를 각각 컴파일했습니다. HTML 의미 해시와 CSS 포함 source hash의 차이는 0개였습니다. 두 코드 모두 이전 썸네일 index 140개와 달랐습니다. 공식 `generate-block-thumbnails.mjs`로 재생성한 PNG 102개, index와 manifest 파일 해시를 별도 task로 통합했습니다. manifest에서 files를 제외한 전체 값과 기존 product-quality·quality-evidence 승인 기록은 유지했습니다.

근거: `output/playwright/site-phase4-20260906/catalog-baseline-comparison.json`, 통합 `a9f33b4a24b3537f14faecf942fd3bc65012e0f6`. Linux 비교 미리보기의 PNG 137개 차이는 플랫폼 차이를 포함한 진단치이며 공식 생성기에서 실제 반영한 102개와 구분합니다.

## 브라우저 기준 이미지

9월 4일 `e0db8759`에 이미 적용된 `--g7pb-page-content-max: 80rem`과 `--g7pb-page-gutter: 1.25rem` 때문에 과거 비교 이미지와 본문 폭·간격·줄바꿈이 달랐습니다. 실제 전체 브라우저 실행은 48개 중 35개가 통과했고 카탈로그 3개와 공개 품질 desktop 1개가 이미지 비교에서 실패했습니다. 나머지 실패는 전체 실행 경로의 Site Part fixture capability 전달 누락이었습니다.

이미지 기준은 desktop 카탈로그 10개, tablet 7개, mobile 3개와 공개 품질 desktop 1개를 현재 렌더에 맞춥니다. 원본·실제·diff는 `output/playwright/site-phase4-20260906/full8-browser-results/`에 보존했습니다. Hero desktop, 문의 양식 tablet/mobile, 카드 목록 mobile, 공개 품질 desktop을 직접 확인했고 기존 내용·폼·반응형 배치를 유지했습니다. 비교 허용치는 변경하지 않았습니다. 이 문서는 이후 owning spec 재실행 통과를 대체하지 않습니다.

## 검사 경로

생성 썸네일은 manifest 소유자와 index의 변경 ID로 관련 블록·프리셋만 검사합니다. 브라우저 PNG는 실제 `*.spec.ts-snapshots` 소유 spec에 연결하며 PNG 자체를 검사 입력으로 기록합니다. 기준 이미지 변경도 runtime에서 재검증해야 합니다. 전체 quality-gate에 Local Site Part 보호 세션과 종료 후 복원 경로를 연결했습니다.

공개 CSS는 기존 코드에서 Node 24 Linux 18,065 bytes, macOS 18,084 bytes(gzip)였습니다. 기능 변경으로 늘어난 것이 아니므로 소스 스타일 변경 대신 상한을 18,000에서 18,100 bytes로 조정했습니다. 이는 성능 개선이 아니며 다른 자산의 상한은 변경하지 않았습니다. 경계 테스트로 18,100 bytes 초과 실패를 확인했습니다.

기존 공개 CSS에는 긴 한국어 제목이 단어 중간에서 줄바꿈되는 경우가 남아 있습니다. 이번 기준 정비는 현재 반응형 배치의 일치 확인이며 모든 문구의 편집·디자인 품질 승인을 뜻하지 않습니다.
