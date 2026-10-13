# 독립 편집기의 누락 시작 데이터 보완

2026-10-14 · 범위: 공통 v3 문서 데이터 17개. 기존 문서 전환이나 새 블록별 편집기 추가가 아닙니다.

기준 SHA: 9da030f50fb8b81c018a06471d59fbcbf58ab606.
Task: editor-missing-starter-data-20261014.

## 구현

기존 68개 시작 문서를 그대로 보존하고 17개를 추가하여 85개로 제공합니다. 생성 결과는 버전·안정 ID·typed 값의 보통 PageBuilderDocument입니다. 편집기 등록/삽입/렌더 함수와 새 요소 종류, vendor, endpoint, Undo를 추가하지 않습니다.

- rich-text-starter · 본문 · 자유 서식
- icon-list-starter · 아이콘 목록
- features-starter · 특징 목록
- contact-starter · 연락처
- stats-starter · 숫자·아이콘 지표
- map-starter · 지도·오시는 길
- faq-starter · FAQ 아코디언
- tabs-starter · 탭 콘텐츠
- video-starter · 영상
- logo-carousel-starter · 로고 캐러셀
- testimonial-slider-starter · 후기 슬라이더
- anchor-menu-starter · 섹션 바로가기
- social-links-starter · 소셜 링크
- image-carousel-starter · 이미지 캐러셀
- icon-starter · 아이콘
- badge-starter · 배지
- hero-slider-starter · 슬라이더 히어로

접기·탭·캐러셀은 기존 공통 behavior와 안정 ID 참조를 사용합니다. 캐러셀의 원형 내부도 보통 요소 트리이며 기본 자동 넘김은 꺼져 있습니다. 지도·영상은 기존 typed embed provider를 사용하고 외부 iframe 내부 편집을 허용하지 않습니다. 영상은 제공자 설정 전 빈 placeholder로 시작합니다. 이미지 시작 구성은 기존 제공 자산을 참조합니다.

기존 문의 회귀 시험의 고정 배열 위치 선택을 binding 보유 원본 선택으로 변경합니다. 기존 5개 문의 대상·검사 내용/합격 기준은 그대로 유지하며 새 제품 시험/시나리오는 추가하지 않습니다.

## 검증 경계

공식 scoped 제출/통합은 관련 기존 비런타임 검사를 선택하거나 같은 입력 성공을 재사용합니다. 브라우저/runtime/종합 제품 감사는 IMPLEMENTATION=1로 인계합니다. 새 데이터가 반영된 산출물 빌드는 입력이 변경됐기 때문에 한 번만 수행하며, 이전 입력의 빌드를 강제로 반복하는 것이 아닙니다.

동적 데이터 후보 DATA02의 e0c34b2e81317284a2d455c350a1635879e73fad와 기존 문서 도우미 2건은 그대로 보존하고 수정/통합하지 않습니다. 일반 시작 데이터 추가로 동적 6종의 미완료를 덮지 않습니다.

관련 실제 입력·Undo/복사·서버 출력·키보드/IME/세 viewport UI 수용은 새 실행 없이 [재감사 인계](2026-10-14-editor-implementation-handoff.md)로 남깁니다. 한 개 sample로 모든 기존 preset 디자인이 일치한다고 주장하지 않습니다.

## 실패 문맥

ENV03: 문서 데이터를 apply_patch로 작성하기 전 임시 orchestration에서 structuredClone 지원 부재를 관찰했습니다. 제품 파일 변경 전에 종료됐으며 JSON 값 복제로 생성 환경만 보완했습니다. 제품 구현 재시도가 아니며 새 의존성과 검사는 추가하지 않았습니다.

최초 제품 구현. 제품 문제가 생기면 동일 문제별 한 번만 보완하고 이후 실패는 source/SHA/영향을 보존하여 동결합니다.

STARTER-TARGET01: 최초 데이터 점검에서 문의 binding이 root가 아닌 자식에 있으므로 root-only 선택은 0건을 반환했습니다. 기존 indexTree로 binding 보유 문서를 선택하도록 한 번 보완하며 기존 5개 대상/합격 기준을 유지합니다. 이후 같은 문제는 추가 보완하지 않습니다.

STARTER-REFERENCE01: 최초 공식 제출에서 기존 v3BuiltinCompositions의 과거 전체 개수 68 고정 단언이 새 85개 데이터와 불일치했습니다. 원본 63개와 기존 5개 문의를 보존하는 reference 회귀 범위는 그대로 68개로 명시하도록 별도 소유 task로 한 번 보완합니다. 대상·기준을 확장하거나 원본 일치 검사를 완화하지 않습니다. 실패 보고서 submission-26fb948c4dd64f7abf96c255baca473a.json을 보존합니다. 추가 제품 브라우저 검증은 실행하지 않습니다.
