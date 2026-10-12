# IP7 v3 발행 포트의 서버 연결

작업: `ip7-v3-public-binding-20261013`. 기준은 공통 컴파일러 제출 `72fe64e836ad1640f3556a01a1a8105c767ffa50`다. 두 task는 서로 다른 소유 파일이며 함께 통합해야 한다.

Provider의 기존 DocumentCompilerPort binding만 스키마별 router로 연결한다. v3는 기존 저장소의 미리보기 토큰·발행 후보·원자적 활성화·revision 복원·마지막 정상 발행본 계약을 그대로 사용한다. 새 route, DB 테이블, G7 코어 수정, 자동 문서 변환은 추가하지 않는다.

기존 블록 runtime과 compiler의 초기화는 v1/v2 문서를 컴파일할 때만 발생한다. optional 카탈로그가 실패해도 v3 원본의 저장·미리보기·발행은 영향을 받지 않아야 한다.

검증 범위는 실제 Eloquent 저장소의 in-memory DB 통합 시험과 실제 Provider의 지연 binding이다. 브라우저 발행 버튼 및 활성 User Template 화면까지의 제품 수용은 별도 실행 증거가 필요하며 이 제출로 완료 처리하지 않는다. 원장·표시판은 현재 제품 진입 task 소유자에게 제출·통합 증거를 인계한다.
