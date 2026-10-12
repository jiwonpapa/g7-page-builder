# IP7 생성 썸네일 소스 동기화

2026-10-13 기준, 기존 공개 CSS와 생성 기록이 달라 실패한 썸네일 148개를 기존 생성기로 다시 만들고 7개 scoped task로 Local에 통합했다. 기준 SHA는 `265f5033729bf6d13a074275590e4d8b5809b44b`, 최종 통합 SHA는 `00af0d6970212a81a5ed19562004f6558cc747f2`다. 이 보완은 생성 자산 정합성 복구이며 공통영역 편집이나 IP7 완료 증거가 아니다.

## 원인과 변경 범위

v3 공개 출력의 CSS 추가 커밋 `0c5f22bba21c8c9605c4e211b11932a99e830caf`에서 `page-builder-public.css`에 v3 스타일 import가 들어갔다. `scripts/render-block-thumbnail-fixtures.php`의 source hash는 카탈로그 ID·props·출력 HTML과 공개 CSS 전체의 SHA256을 포함하므로 이전 생성 기록 148개가 stale 상태가 됐다. 미통합 Site Part 계약을 제외한 Local에서도 재현했다.

기존 `scripts/generate-block-thumbnails.mjs --catalog-id <ID>`로 블록 49개와 프리셋 99개를 실제 PHP renderer·공개 CSS·Chromium으로 재생성했다. 각 task는 manifest/index와 최대 22개 PNG의 정확 경로만 소유했다. 기본 블록과 첫 프리셋은 같은 묶음에서 생성했다.

실제 Git 변경은 PNG 6개와 manifest/index 2개다. 나머지 142개 PNG는 재생성 결과가 기존 bytes와 같았다. 소스 해시만 수동으로 바꾸지 않았으며 제품 소스·생성기·품질 기준·품질 승인 원장·의존성 버전은 변경하지 않았다.

## 제출과 통합

각 행의 task는 `ip7-thumbnail-refresh-<묶음>-20261013`이다. 모두 `make task-submit`과 `make task-integrate-scoped`를 사용했다.

| 묶음 | 생성 수 | 제출 SHA | 통합 SHA |
|---|---:|---|---|
| 1 | 21 | `1c8dc5a1b9a3b879d5a0aad129f847b32e20d477` | `f9ac87f57c50b2dcb35a7143a53616bd4a8a180f` |
| 2 | 22 | `677ba70750abe5e65403f2f30bea2726f073d6c6` | `913aca73b6223ad9bf983bc37a429937570d2c22` |
| 3 | 22 | `0c62964e78b9b696eec96ef04b95825233f4038f` | `ffa930c6e91d5d898715aa38283790d89187e79c` |
| 4 | 22 | `82df6f247896334241e804736ca11b85684362fa` | `ba122c86df28a68f1a5381baded64aab17afde53` |
| 5 | 22 | `9afbd2c7637f760c070f9b910de7cf0e06ac9bc8` | `d7c6082afb96287ef74b57ddbeb5ffaccf6e69b4` |
| 6 | 22 | `c94b0256050eaa1a084f0dc755c31b9f16f6c305` | `b31fa2da93e8590cb252dc4d5ece4d458f1e8158` |
| 7 | 17 | `fb878c3c2b1ee040ea8d955f99ea99830235cee3` | `00af0d6970212a81a5ed19562004f6558cc747f2` |

통합 때 각 선택 항목의 현재 소스 검사가 통과해 148개 모두 확인됐다. 생성기의 전체 148개 candidate 검사도 각 묶음에서 통과했다. 마지막 candidate review digest는 `ed458d8c28b9ed3679b25cd4068a5101a1f54c0284545184545a78a00eee84e7`다.

검사 결과는 `current_sources_checked=true`, `technical_errors=[]`, `ledger_written=false`, `release_authorized=false`다. 기존 품질 원장은 `stored-integrity-valid` 상태를 유지하며, 과거 승인/미승인 결정을 현재 제품 승인으로 승격하지 않았다. 각 gate의 기술 검사는 제품 E2E 실행 성공을 의미하지 않는다.

## 화면 검토

Playwright CLI로 PNG를 모은 로컬 확인 화면을 캡처하고 일곱 묶음 전체를 육안 확인했다. 한글·사진·아이콘·기본 블록과 프리셋 쌍이 표시된다. 기존 960×600 고정 crop을 320×200 PNG로 만드는 계약은 유지하며, 긴 가격표·팀·목록·갤러리의 하단 crop은 전체 페이지의 잘림이나 출력 일치 검증으로 해석하지 않는다. 지도·영상·폼·G7 데이터는 기존 placeholder/sample이며 실제 외부 서비스 실행 증거가 아니다.

증거 위치는 Local `output/playwright/ip7-thumbnail-review-1AQlq9/`다. 유효 캡처는 `batch-1.png`부터 `batch-5.png`, `batch-6-reloaded.png`, `batch-7.png`다. 최초 `batch-6.png`는 로컬 HTTP의 단일 PNG 요청 connection reset으로 한 이미지가 빠졌으므로 합격 캡처로 사용하지 않는다. 재로딩 후 22개 이미지 모두 complete·naturalWidth=320을 확인하고 다시 캡처했다. 마지막 묶음 17개도 같은 로딩 조건을 확인했다. 제품 이미지를 수정해 화면을 보정하지 않았다.

## 후속 검증과 경계

이 보완으로 Site Part 계약 통합의 stale-thumbnail 선행 실패 원인을 제거했다. 공유 계약의 FULL 통합 검증은 별도 실행 결과로 판정한다. 공통 Header/Footer의 API·저장·발행·편집 UI 연결, 보호된 실행 기능, 명시 이행/복원과 IP8~IP10은 남아 있다. IP7은 계속 `in_progress`다.

Playwright의 실제 렌더 확인과 write-page의 주장 범위 원칙을 적용했다. G7 코어·테마 원본·운영 서버·기존 사용자 문서는 변경하지 않았다.

