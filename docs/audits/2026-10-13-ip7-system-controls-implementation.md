# IP7 보호된 G7 실행 컨트롤 인계

기준 SHA: fc752e9180f4846eed3572b602c1ccc20c9ee539. task: editor-system-controls-20261013.

새 블록별 편집기를 만들지 않고 공통 layout.container의 typed system capability를 사용한다. 계정(로그인·회원가입·마이페이지·로그아웃), 검색, 알림, 장바구니, 화면 모드, 언어·통화 컨트롤의 호스트 배치·크기·스타일·반응형을 같은 문서·명령·Puck 이력으로 편집한다.

문서는 kind만 소유한다. endpoint/handler/인증 상태/실시간 알림·장바구니 값/런타임 내부 DOM을 소유하지 않는다. 기존 공개 Site Shell runtime와 고정 UI markup을 재사용하며 기존 테마 및 G7 코어는 수정하지 않는다. 기존 컨테이너 자식·동작·문의 연결과 동시에 capability를 붙이는 것은 PHP·TS 공통 schema/policy 및 의미 검증에서 거부한다. 실행 내부 요소는 보호된 외부 소유 영역이다.

편집/구조 미리보기는 inert 표시용 컨트롤을 보여 주고 실제 동작은 공개 runtime가 수행한다. 실제 로직을 흉내내거나 두 번째 상태·Undo를 저장하지 않는다. 생성 CSS와 호스트를 따르는 runtime 크기 보정은 모듈의 생성 결과이며 raw CSS 입력 필드는 아니다.

## 별도 재감사 필요성

7종의 실제 G7 작동, guest/member/admin 상태, commerce/locale/currency capability 부재, 공개/템플릿/builder shell 및 Footer, 배치·리사이즈·3폭·Undo/저장/재열기, 1px 비교, 보호된 내부 입력·키보드·팝업·focus·취소와 G7 업그레이드 조합을 확인한다. 기존 Site Shell 컨트롤의 화면과 동작 회귀도 대상이다. 신규 시험 정의·E2E를 확대하지 않는다.

최초 실패와 문제별 허용 1회 재구현을 보존하며 추가 실패는 반복하지 않고 최종 인계에 기록한다. 제출/통합 SHA는 공식 task metadata 및 최종 보고서에 연결한다.

SYSPLAN01: 최초 제출은 공유 schema/policy 변경의 명시 범위 flag가 없어 계획 단계에서 중단됐고 검사는 실행되지 않았다. FULL=1은 해당 계약 변경을 분류하는 데만 사용한다. IMPLEMENTATION=1을 함께 적용하여 runtime/종합 수용 검사를 실행하지 않고 재감사로 인계한다. 제품 코드 재구현 횟수는 아직 0회다.
