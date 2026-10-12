# IP7 공통 요소의 실제 발행 경로

작업: `ip7-v3-public-compiler-20261013`. 기준 SHA: `386b77fa44ae58982c17c75b3642e82dc934f5e8`.

현재 상태는 구현 중이며 IP7 완료 증거가 아니다. 원장·표시판은 제품 진입 작업이 소유하므로 이 작업의 제출·통합 결과를 인계한다.

- 편집/초안에서 이미 사용하는 Presentation·BehaviorPresentation·기본 요소 마크업을 재사용한다.
- 구성 이름이나 카탈로그를 조회하지 않는다. 빈 문서와 처음 보는 요소 조합도 같은 컴파일 경로를 사용한다.
- 하나의 DOM 트리에 세 breakpoint의 검증된 생성 스타일을 담는다. 사용자 raw HTML/CSS/JS 필드를 추가하지 않는다.
- 숨김 요소를 발행본에서 제거하지 않으며 모바일/태블릿 값은 각각 base에서 독립적으로 계산한다.
- G7 HtmlContent 정책을 완화하지 않는다. 버튼은 기존 모듈 소유 runtime marker와 hydration을 사용한다.
- 기존 v1/v2 컴파일은 보존하며 스키마별 선택 포트만 추가한다. 서버 binding과 실제 발행 UI 연결은 후속 소유 작업에서 검증한다.
- PHP 계약, 실제 Chromium의 7개 경계 폭 CSS 비교, 기존 초안 렌더 회귀를 확인한다. 격리 CSS 시험은 실제 인증·발행 성공을 대신하지 않는다.

## 구현과 직접 검증

Node 24.19.0·PHP 8.5.3의 소유 worktree에서 PHP 15개 시험(1,812 assertions), 타입·PHP 정적 분석·CSS lint·7개 제품 파일 구조 검사를 통과했다. 이는 공식 제출/통합 결과와 구분한다.

Chromium 비교는 공통 스타일 fixture, 네 가지 동작 구성, 숨김, 이미지→gradient→단색 배경, Flex 축 전환의 18개 문서를 사용한다. 360/639/640/768/1023/1024/1280px마다 같은 문서의 초안과 생성 발행 마크업을 렌더한다. 버튼은 실제 기존 ensureSiteShellButtons로 복원하며 글꼴·이미지 준비 뒤 75개 computed property와 치수를 비교한다. 숨김 노드는 공개 DOM에 보존되므로 표시 텍스트를 비교하고, 초안에서 생략된 노드는 공개 화면의 면적 0을 별도 확인한다.

첫 비교에서 버튼의 CSS-wide inherit를 custom property 값으로 전달하면 무효화되는 문제를 확인해 최종 속성 fallback으로 보존했다. 두 번째 비교에서 소수 max-width가 CSS 정밀도 때문에 640px에 걸치는 문제를 확인해 정책의 정확한 열린 구간으로 변경했다. 보정 후 2개 시험과 모든 폭 비교가 통과했다. 테스트 기준과 허용 오차는 유지했다.

서버 composition root binding, 실제 발행 API·UI, 활성 User Template sanitizer를 거친 최종 동작과 배포는 아직 증명하지 않았다. 이 기록으로 IP7/IP9/IP10을 완료 처리하지 않는다.
