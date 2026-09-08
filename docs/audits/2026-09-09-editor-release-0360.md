# 0.36.0 릴리스 범위와 빌드 예산

운영 0.35.1 (`499e8361052ace420b1ed7e750bcd2177908d767`) 이후 독립 PB UI1~UI6 개선을 0.36.0으로 묶는다. 배포 전 준비 기록이며 실제 운영 성공 증거는 배포 하네스의 artifact/target/smoke 영수증 및 서버 BUILD-INFO를 따른다.

UI6 마감 기준은 `ca40da2db815962e05790b1d7c5e76056ec3af43`다. 관련 브라우저 19건 및 소스 검증은 이미 완료했고 버전 포장 때문에 전체 기능/콘텐츠 검증을 반복하지 않는다. 배포 변경에는 새 DB migration이 없다.

배포 전 실제 gzip 검사에서 editor JS는 508,050 bytes로 기존 507,500 bytes 상한을 550 bytes 초과했다. Hero·ImageText 버튼 소유권 전환 구현이 포함된 측정값에 따라 상한을 508,500 bytes로 1,000 bytes(약 0.20%)만 조정한다. JS 이외의 자산·원본 CSS 상한은 변경하지 않으며 자동 예산 갱신은 추가하지 않는다.

0.36.0의 module/package/lock 버전을 일치시키고 Unreleased를 날짜 있는 릴리스 항목으로 이동한다. 현재 검증된 SHA와 빌드 입력·전체 dist가 일치하는 단일 artifact를 포장하고 push 후 배포한다. 운영 확인은 artifact 파일 체크섬·모듈 활성/등록 버전·필수 route·migration·공개 자산의 최소 smoke로 제한한다. 이전 모듈은 하네스가 출력한 복구 디렉터리에 보존한다.
