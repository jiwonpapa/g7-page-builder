# IP7 v3 본문 폭 일치

범위는 PB 소유 `page-builder-public.css`의 v3 본문 wrapper와 관련 회귀 시험이다. G7 코어, 테마 파일, 헤더/푸터, 기존 v1/v2 여백은 수정하지 않는다.

G7 없이 PB CSS만 불러온 Chromium 재현에서 360px viewport의 v3 surface가 x=20, width=320으로 측정됐다. 설치형 폼 시험의 40px 차이와 일치하며 외부 테마 변경을 원인으로 가정하지 않는다. 기존 `.g7pb-template-body`의 20px 양측 여백과 최대폭이 canonical v3 surface의 24px padding에 추가 적용됐다.

v3 발행 surface가 포함된 PB wrapper만 편집기 viewport 폭으로 배치한다. 새 v3 문서의 여백은 canonical surface와 사용자 지정 노드 스타일이 소유한다. 기존 wrapper 계산식은 그대로 두고 header/footer 같은 호스트 요소를 선택하지 않는다.

관련 시험은 360/639/640/768/1023/1024/1280/1440/2560px의 surface·내부 노드 폭·호스트 header/footer 무변경·수평 overflow를 검사한다. 기존 구형 문서/중첩 컨테이너 검사를 제거하지 않는다. 격리 시험과 실제 G7 공개/미리보기 검증은 별도 판정한다.
