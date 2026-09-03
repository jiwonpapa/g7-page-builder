# 3차 관리·카탈로그·공개 runtime 마감 기록

[전체 차수와 완료 조건](2026-09-02-structure-remediation-phases.md). **3차 제품 구현·관련 검증·동일 기준 재감사를 완료했다.** 기준은 2차 정식 마감 SHA `23beb94abdaba28038073c2116020440eb29eb79`, 제품 통합 SHA는 `cbe955a6c9f10cd131d7b7ce5ef588e1c14bed26`다. 문서 통합 뒤의 최종 검증과 정식 종료는 아래 `phase3-final-close.json` 영수증으로 확인한다. 소유권 확인 당시 다른 작업은 README 소개 작업 하나이며 이 차수에 포함하지 않는다.

## 범위와 마감 조건

관리 화면의 목록·리비전·메타데이터·스토어 및 업무 흐름, 카탈로그의 공통 Frame·codec·필드·렌더, 공개 데이터와 효과의 초기화·해제 책임을 분리한다. 본체와 새 소유자에 같은 크기 기준을 적용하고, 새 거대 파일·순환·역참조·예외 증가를 허용하지 않는다.

문서 변환이 React 렌더러를 경유하지 않아야 하며 공개 runtime은 관리자·관리 API를 import하지 않는다. 실제 DOM·상태·API 응답·listener·timer 수명과 재초기화를 관련 코드 회귀로 확인한다. 2차에서 이관한 foundation 카탈로그의 명시 `spacing=normal`→기본 `compact` 왕복 결함과 다른 family의 동일 정규화 정책도 이 차수에서 처리한다.

기존 블록 문구·이미지·상품성·프리셋 품질 전수 검증은 범위가 아니다. 합성 입력으로 코드 동작을 확인한다. 브라우저의 전송 fixture를 쓰는 검사는 실제 서버 설치·실상품 승인과 구분한다. 운영 배포·운영 데이터 변경·전체 Visual UI Editor 완성은 포함하지 않는다.

차수 안의 모든 순차 구현 단위, 필수 보완, 정식 제출·통합·관련 검증, 동일 기준 재감사, 문서와 `NO_RELEASE` 정식 종료까지 이어서 마감한다.

## 변경 전 기준

| 항목 | 3차 시작 |
| --- | ---: |
| Manager 비공백 줄 / AST | 1,597 / 11,987 |
| catalogBlocks 비공백 줄 / AST | 851 / 13,392 |
| pageEffects 비공백 줄 | 1,163 |
| 제품 소스 검사 파일 | 255 |
| 전체 정적 부채 | 1,066 |
| 크기 진단 / 실제 파일 | 7 / 5 |
| 신규 위반 / 남겨 둔 해소 예외 / TS 우회 단언 규칙 위반 | 0 / 0 / 0 |
| 정적 runtime 모듈 / 내부 참조 선언 | 91 / 243 |
| 정적 runtime 순환 / 문서 계층 역참조 | 0 / 0 |

CSS 색 908·important 135·specificity 16과 PHP compiler·편집기 CSS 크기 예외는 이번 차수의 해소 건수에 포함하지 않는다. TypeScript 기본 크기 한도는 비공백 800줄·AST 10,000이다.

## 순차 실행 단위

선행 하네스는 새 소유자를 실제 코드 동작 검사에 연결하며 관련 없는 콘텐츠 검증으로 확대하지 않는다. 아래 각 제품 단위는 정확 파일 24개 이내로 claim하고, 앞 단위 통합·검증 후 다음 단위로 진행한다.

K2 구현 중에는 기존 export 계약을 유지하는 K5의 registry·responsive 순수 값 추출만 서로 겹치지 않는 각 3파일 작업으로 병렬 준비한다. 각 제출은 보존하고 K4 이후 순차 통합한다. 이후 K5의 canonical consumer 연결·Node 경계 회귀·변경 기록을 마감한다. 외부 동작이 없는 내부 추출이며, 3차 소유 범위나 최종 경계 조건은 축소하지 않는다.

| 단위 | 책임 | 주요 코드 검증 |
| --- | --- | --- |
| Manager M1 | 스토어·Page Kit, Block Pack/GitHub, 문의함의 상태·명령·화면 | 합성 응답의 요청 대상·실패 후 입력 보존·늦은 응답·문의별 pending 상태 |
| Manager M2 | 문서 목록·생성/복제·보관, 메타데이터/미디어, 리비전/미리보기 | A→B 문서 전환, 목록 필터 전환, popup 소유권, StrictMode·unmount |
| Catalog K1 | 여섯 Frame의 단일 소유자 | 선택 ID·field path·context 우선순위·자식 상태·motion 연결 |
| Catalog K2 | 공통 순수 정규화와 Foundation 데이터/codec | 명시·누락·잘못된 appearance, 요소 외형, Buttons 명령→Undo |
| Catalog K3 | Phase2·3·4·Production 데이터/codec | 배열·boolean·숫자·선택적 링크/pageSize/slider 설정의 왕복 |
| Catalog K4 | 큰 catalog의 타입·데이터·codec·필드·렌더 | 실제 필드 callback과 interactive preview·입력/상태 보존, 크기 예외 제거 |
| Catalog K5 | registry와 responsive 순수 데이터 경계 | 등록 저장소 단일성, 외부 payload 보존, 상속/reset, 변환의 UI import 차단 |
| Public P1 | 공개 응답 렌더, archive/filter, visibility와 요청 수명 | pending 중복 방지·오래된 응답 차단·필터 listener |
| Public P2 | hydration·tabs/accordion·문의, G7 shell 상태와 액션·알림 요청 | 응답 세대, 재초기화, subscription과 listener 해제 |
| Public P3 | counter/parallax/observer, Embla, 최상위 runtime | destroy/disconnect·RAF 취소·노드 제거·동일 노드 재삽입 |

Manager 선행 합성 browser 시나리오는 실제 Manager UI→API client→전송 fixture를 사용한다. 기존 `officialStore`의 고정 상품·이미지 수량과 고정 팩 삭제는 이 코드 검증에 포함하지 않는다. 실제 문서 생성·편집·발행 흐름은 기존 PAGE 시나리오를 유지한다. 하네스만 변경한 단계의 수집 성공은 제품 브라우저 실행 성공으로 보고하지 않는다.

변경 전 `23beb94` 기준선에서 변환 경로는 `puckBlockCodec`부터 36개 제품 모듈과 React·ReactDOM·Puck·Tiptap·Lucide의 외부 import 경로 6개에 도달했다(패키지 5개, React와 JSX runtime 경로 별도). 카탈로그 외에도 motion·element appearance·responsive 정규화와 외부 블록 registry가 UI 의존을 연결한다. 이 직접 선행 책임을 분리해야 카탈로그 분리 완료를 주장할 수 있다. 같은 기준의 Manager·공개 runtime 경계 위반은 0이다.

## 실행 기록

| 단위 | 제출 SHA | 통합·검증 SHA | 실제 결과 |
| --- | --- | --- | --- |
| Manager 코드 매핑 선행 | `ebd592998a6c0dd5c82e7d19c2c6d5de59eebd4a` | `40fe6ca01c5749a852d0639372fcc1b025a5ece7` | 정확 3파일, scoped 12 gates 통과·통합/검증에서 동일 입력 재사용. browser 정의 2제목×3기기 수집, 실제 제품 실행 0 |
| 공개 코드 fingerprint 입력 보완 | `d3352c7dca982f2892a99e995ae41541a2c6ff2d` | `29f7f793578df0e79232dcf38eb1b53b84935f92` | 정확 2파일, scoped 10 gates 통과. 연결 helper 변경 시 세 scope 모두 지문 변경. 관련 고립 하네스 30개 통과, 실제 제품 실행 0 |
| helper 소비 회귀 보완 | `d452ffd49fe7fea7358431aaa23fa74ad495041c` | 통합 `c32e17df03382c2133d0fdcbf88d9f07f7b6c369`, 함께 검증 `ffa0cb2c159523f729faba06d1f2f20d051cd298` | 정확 1파일·관련 하네스 41개 통과. 고정 소비 수 대신 실제 spec import와 등록의 정확 일치를 확인 |
| Manager M1 | `19bb65ea1fde1e3004fa2335f3ed9d70a811417b` | `ffa0cb2c159523f729faba06d1f2f20d051cd298` | 관련 Unit 16개·strict·구조 검사 통과. 실제 Manager 합성 2개와 문서 생성/발행/복원 1개 통과. 1,597→1,011줄, AST 11,987→7,254로 AST 예외 제거 |
| 타입 import 회귀 fixture 분리 | `ea3a42ccdecfd4ac08f90f3b9e6eede23a207715` | `4ca9b85be0b34fa8196600e0f7e8a8eabec3f0b5` | 정확 1파일·관련 회귀 4개 통과. generic editor의 고정 PAGE 기대를 사용하고 타입 전용 분류기의 기존 catalog 재현은 유지. 실제 제품 실행 0 |
| Catalog 코드 매핑 선행 | `8105d410538dd7dd4acc6f0d975a8ed4165157e4` | `42421131aeb242039ac3218e843c4a8b8cc7ab50` | 정확 6파일·scoped 14 gates 정상. 제출 7실행/7재사용, 통합·검증 각각 수집 1실행/13재사용. Frame/fields/codec/responsive 합성 PC 4제목 등록, 제품 실행 0 |
| Manager M2 | `83cd26c28722b116cc3b03b463b4c36c73194281` | `1dc84802f7ab34ff4b1862e8eea285b2f16a614d` | 관련 Unit 29개·strict·구조 검사 통과. 실제 Manager 합성 2개와 PAGE 1개 통과. 본체 96줄/844 AST·신규 8개 owner 26~177줄/151~2,170 AST. Manager의 나머지 크기 예외 제거 |
| Public 코드 매핑 선행 | `928ddc6a1b3c8decbc23bf6630d20a4138f2ed1b` | `676199803f5cd298ad08d475aadbe78afb437b71` | 정확 3파일·정식 12 gates 정상. 관련 하네스 37개·strict와 합성 4제목×3기기 수집 통과. 실제 제품 실행 0 |
| Catalog 합성 API·입력 계약 교정 | `f236b295f0a79f47a54cb6d59303882060f2a9df` | 통합 `5df0b3ecc9913aedbdfd079e5d45b62d440d581f` | 정확 1파일·정식 3 gates 정상. 관련 planner 41개·strict·PC 4제목 수집. 제품 브라우저 실행은 K1 통합에서 별도 확인 |
| Catalog Outline native 대상 교정 | `977ad0d4d7317267eb718774acdd81d46c3ce42f` | 통합 `5e2aeccaa1def427f24037d761175de2abe6da51` | 정확 1파일·정식 3 gates 정상. role과 native button 교집합의 단일성을 확인. 실제 제품 실행은 K1에서 별도 확인 |
| Catalog K1 | 원본 `8e04172f0b5df0efe4d30623132f539491483681` 보존 교체 → `4adb9ea003d623566a659dff9f0bf52a037820dd` | 통합 gate 통과 `874565fb9b470c14abc6b784f8e36f706c0c1190` | 관련 Unit 152개·strict·구조 통과. 실제 합성 Frame/fields/중첩 3개와 기존 TEXT/CONTROLS 2개 통과. 여섯 Frame 단일 소유자 및 탭 입력 차단 수정 |
| Catalog K2 | `b5f08b1a92c4c8f9088403b94e4ce6aa25cce5eb` | 통합 gate 통과 `5923f4fb527844bd6288150fc23a5c1cef062f85` | 정확 17파일·41 gates 중 10실행/31재사용. 관련 Unit 32파일 269개·strict·구조 통과. 실제 Catalog 3개·TEXT/CONTROLS 2개·구조/테마 3개·PAGE 1개 통과 |
| Registry 경계 하네스 보완 | `c37e933271f44796aa84009c45d77c0dc0514180` | 통합 gate 통과 `2120c8e882c73b761f27b50a8e348f688f53f9f0` | 정확 5파일·13 gates 통과. 실제 Window 등록 binding과 builtin 충돌 거부→Map 저장 순서를 AST로 확인. 제품 브라우저·콘텐츠 실행 0 |
| Catalog K3 | `eda8b7c2711d21a5896eb36b3a076abe1f02a162` | 통합 gate 통과 `cc4b67f4c0556bf29a7b6adbc8b3b37bca97a85a` | 정확 16파일·27 gates 중 통합 7실행/20재사용. 선택 Unit 21파일 166개·strict·구조 통과, 실제 Catalog 3개 통과 |
| Manager 이력 후속 수정 | `725241257f0e454f52c2c828faafc0af7a213b4a` | 통합 gate 통과 `8f829c1dcf8c99141b0d26c38f1c67e428ebff64` | 정확 2파일·관련 Unit 7파일 31개·strict·구조 통과. 확인창 취소 뒤 이력 갱신·새 확인창 유지 및 실제 PAGE 1개 통과 |
| Catalog K4 | `e79a842fbce3f48a3c93802c3cb1b3a9fe9461b5` | 통합 gate 통과 `dd091a120dd64cbbecdd0dd6d8c745245c0d1b0e` | 정확 16 claim 중 15파일 변경·32 gates 중 통합 10실행/22재사용. 제출 관련 Unit 185개·strict·구조 통과. 실제 Catalog 3개·TEXT 1개·구조/테마 3개·PAGE 1개 통과 |
| Catalog K5 등록 저장소 | `33b767edd50680d84f9d7b41a80767f9aab55a07` | 통합 gate 통과 `b3d8b0d6bc841c061c800d4a850c195446ac93d6` | 정확 3파일·25 gates 통과. 관련 Unit·strict·구조 및 실제 중첩 변환 1개·PAGE 1개 통과. 단일 Map과 Window bridge 등록 시점·외부 기본 props 보존 |
| Catalog Outline 열림 판정 | `ae1f754d4696ced5102446576419e4681aeadb13` | 통합 gate 통과 `344efabcef0611395a7e9a8c3da8dc192c3054be` | 정확 1파일·planner 44개·PC 4제목 수집·strict 통과. 열린 Outline 제목을 확인하며 제품 브라우저 실행 0 |
| Catalog 반응형 필드 범위 | `98ff2d0c84f280d5b3e372729f518910734d180c` | 통합 gate 통과 `a9d5fae239388d530a2761ebce25c8e92400fd87` | 정확 1파일·planner 44개·PC 4제목 수집·strict 통과. 표시된 기기별 group에서 select/reset 단일성을 검사, 제품 브라우저 실행 0 |
| Catalog K5 반응형 데이터 | `c34be9040c342018641e0fbc5a46f2c411d2d394` | 통합 gate 통과 `684834ea841f44189ea09f1ed3aeaae7c95a6c1c` | 정확 3파일·관련 Unit·strict·구조 통과. 두 fixture 교정 뒤 실제 중첩 1개·반응형 상속/초기화 1개 통과. UI 139줄·순수 Data 149줄, 34개 원 선언 보존 |
| Catalog K5 변환 경계 | `be2b25f588614fc885b98aa92496cff120f9456a` | 통합 gate 통과 `762cea3df4c136cbc992f7d65fb9e76a4b1ef6ce` | 정확 2파일·Unit 21파일 159개·strict·구조 통과. 통합 28 gates 중 7실행/21재사용, 실제 중첩 1개·TEXT 1개·구조/테마 3개·PAGE 1개 통과 |
| Public P1 | 원본 `342d2501e30392256461363745c399c1b53f40ab` 보존 교체 → `fbf42fdacc5025f065618804e38a5153c4ef097e` | 통합 gate 통과 `a302ff7cf61d27eff91530d72792c66a17edc725` | 정확 11파일·관련 Unit 50개·strict·구조 통과. 통합 13 gates 중 5실행/8재사용, 실제 합성 12개·PUBLIC 3개 통과. 본체 829줄, 데이터 요청·필터 해제 소유권 분리 |
| Public P2 | `dbae97c2c7d305f756d5270d26aaa0a1b1e84142` | 통합 gate 통과 `6d122d55f653501f6fb5af86af086f50c654ee4b` | 정확 14 claim 중 13파일 변경·Unit 27파일 234개·strict·구조 통과. 통합 35 gates 중 8실행/27재사용, 실제 셸 1개·PUBLIC 3개·합성 4개 통과. 본체 320줄로 크기 예외 제거 |
| Public P3 | `6eafed3e820179d452513ad75ab71d8cc27c03db` | 통합 gate 통과 `cbe955a6c9f10cd131d7b7ce5ef588e1c14bed26` | 정확 11 claim 중 9파일 변경·Unit 28파일 244개·strict·구조 통과. 통합 34 gates 중 7실행/27재사용, 실제 모바일 탐색 9개·PUBLIC 3개·합성 4개 통과. 본체 16줄, 전체 runtime과 개별 효과 해제 소유권 확정 |

Manager 선행은 실제 runtime 선택을 desktop 2제목으로 제한한다. 하네스 회귀 내부의 `passed.spec.ts` 같은 fixture 로그는 제품 실행 건수에 포함하지 않는다. 별도 `tsc`와 desktop 2제목 수집도 통과했다. Manager M1과 독립 Catalog 선행은 위 검증 SHA에서 시작한다.

M1 수정 전에는 실제 Manager DOM과 지연 API 응답으로 세 회귀를 실행해 각각 기대한 assertion 실패를 확인했다. 이전 스토어 조회가 최신 창 목록을 덮는 문제, GitHub 확인 중 입력을 바꿔도 이전 결과가 남는 문제, 문의 A 요청 중 B 요청을 시작하면 A 버튼이 다시 켜지는 문제다. `m1-red-inputs/inputs.json`에 기준 SHA·정확 명령·당시 테스트 파일의 SHA256과 원본 로그를 보존했다. 수정 후 새 회귀 9개와 기존 화면 회귀 7개가 통과했다. 최초 strict에서 발견한 합성 fixture enum 오타도 원본과 수정 로그를 구분해 보존했다.

스토어와 팩은 각 창·입력·명령의 수명을, 문의함은 항목별 pending과 창 세대를 소유한다. M1 통합에서는 11 gates 중 5개 실행·6개 재사용, 최종 확인에서는 선행 helper 회귀까지 포함한 13 gates 중 5개 실행·8개 재사용했다. 최종 확인의 browser 입력 목록에는 `tests/Harness/test_planner.py`도 포함됐다. 현재 runner는 상태가 있는 runtime gate의 영수증을 재사용하지 않으므로 정식 통합과 최종 확인에서 같은 시나리오가 실행될 수 있다. 이를 새 시나리오로 중복 집계하지 않으며, 입력이 같은 정적 검사와 빌드 산출물의 재사용과 구분한다. 관리 본체의 남은 줄 수 예외와 문서 작업 책임은 M2에서 처리한다.

M2는 원본의 mount 교체·목록 필터·메타데이터 업로드·리비전 응답 역전 4건을 DOM 회귀로 재현한 뒤 수정했다. 독립 검토에서는 같은 필터 재클릭의 영구 로딩과 늦은 낮은 lock 응답/목록 snapshot의 행 역행을 추가로 확인했다. 그 후보에서 별도 red 4건을 보존하고, 같은 필터를 no-op 처리하며 저장·복원·목록이 공유하는 최신 확인 버전 경계로 수정했다. 닫힌 창의 서버 성공은 목록에 반영하되 새 창의 입력·기록은 유지하고, pending preview 창과 StrictMode 수명도 검사했다. 새 13개와 기존 16개가 통과했으며 원본 red와 구현 중 발견한 red는 `m2-red-inputs`·`m2-review-red-inputs`로 구분한다. 최초 합성 SEO 타입 누락과 popup fixture 실패도 수정 전후 로그를 보존했다.

이후 `5923f4fb`의 Manager 독립 재감사에서 확인창만 취소하고 같은 문서의 이력창은 열어 둔 경우를 추가로 확인했다. 진행 중인 복원이 완료되어 목록은 revision 21이 되어도 확인창 요청 번호가 달라져 이력은 20에 머무는 잔여 결함이다. 별도 정확 2파일 작업으로 이력 세션과 확인창 요청의 수명을 구분해 보완하며, K3의 CHANGELOG 소유권과 충돌하지 않도록 실제 수정 완료 후 K4 소유 기록에 해당 사용자 변경을 함께 반영한다. 원본 콘텐츠나 공개 계약은 변경하지 않는다.

후속 수정은 실제 DOM에서 revision 21 누락 red를 먼저 보존한 뒤 이력 세션이 유지되면 다시 조회하도록 수정했다. 더 새 확인창의 취소·pending 상태는 이전 응답이 바꾸지 않으며, StrictMode의 후속 복원이 최신 lock_version 8을 보내는 새 회귀도 통과했다. Unit 31개와 통합의 실제 PAGE 흐름이 통과했다. 증거는 `manager-history-followup/red-inputs` 및 `manager-history-followup-integration-summary.json`에 보존한다.

Site Shell fingerprint의 고정 입력 목록은 이전 dist를 유지한 채 helper만 바꿨을 때 `current_sources_checked` 표시와 실제 입력 범위가 어긋났다. 세 scope의 지문이 그대로인 red를 보존한 뒤, 기존 AST/CSS 그래프로 공개 entry의 실제 의존 파일을 공통 입력에 연결해 같은 회귀를 통과했다. 누락·순환·동적·루트 탈출 import는 실패하고 연결 없는 파일은 제외한다. 콘텐츠 품질·브라우저 실행 선택은 확대하지 않았다. 당시 입력과 로그는 `public-evidence-red-inputs`에 보존했다.

Catalog H의 최초 제출은 새 rich-text helper 소비 spec 때문에 `test_planner.py`의 고정 2개 소비자 회귀 4 subtest에서 실패했다. 별도 정확 1파일 작업에서 실제 import 소비자와 등록 명세를 대조하도록 보완한 뒤 정식 active replacement했다. 추가로 실제 spec·전이 입력을 감사 지문에 연결해 등록되지 않은 새 spec이나 helper 변경도 감사가 재실행되도록 보완했다.

H r2 제출에서는 `test_type_import_changes.py`가 runtime 변경에 예전 PARITY만 고정 기대해 실패했다. 타입 import만 바뀌었는지 판정하는 목적과 화면별 매핑 정책을 분리하는 별도 1파일 작업을 통합했다. 타입만 변경 시 Unit/strict/구조 유지·browser 제외, runtime 변경 시 고정 PAGE 유지와 네 실행 단계의 deferred 계약을 검사한다. H의 6파일 밖을 직접 고치지 않았고 두 원본 dirty worktree·최초 실패 로그·정식 교체 snapshot을 보존한다.

Public 선행의 첫 제출은 작업 중 생성한 Python bytecode 12개가 scope 밖으로 검출돼 중단됐다. 정확 경로·크기·SHA256·시작 기준에서의 부재를 기록하고 원본을 외부 증거 폴더로 이동 보존한 후 정식 제출을 통과했다. 기존 파일이나 다른 task 파일을 삭제하지 않았다. 이 실패는 제품 동작 실패가 아닌 작업 산출물 범위 위반으로 별도 기록한다.

K1 첫 제품 브라우저 검증은 합성 3개 시나리오에서 실패하여 통합 후보가 자동 원복됐다. Frame의 선택·외형·motion 확인 이후 원시 seed와 서버가 수락한 문서 표현을 그대로 비교한 오류(빈 문자열→null, 빈 slots 객체→배열), 합성 Buttons의 잘못된 type ID, 탭 조작 후 body가 숨겨진 실패를 각각 분리해 조사한다. 첫 실행의 3실패는 `k1-integration-failed-runtime-summary.json`과 원본 Playwright 결과에 보존한다. 초기에 요약 도구에 제출 task ID를 잘못 넘긴 `k1-integration-first-failed-summary.json`의 비제품 분류는 잘못된 요약이며, 정확한 integration task ID로 만든 전자 기록이 이를 정정한다. 이 시점에 K1 브라우저 성공이나 3차 완료를 주장하지 않는다.

탭 실패의 코드 원인은 Puck contentEditable 라벨의 capture handler가 클릭 전파를 소비하는 현재 편집 계약이다. 블록을 Outline에서 먼저 선택한 뒤 실제 버튼·라벨의 DOM 경계와 padding으로 버튼 자체를 한 번 누르고, 선택 상태와 panel 노출을 확인하도록 합성 시나리오를 교정한다. 화면 좌표 하드코딩이나 강제 이벤트로 통과시키지 않는다. 탭 라벨 클릭은 글자 편집, 버튼 여백 클릭은 탭 전환이라는 현재 UX 제약은 남아 있으며 이번 구조 개선을 이 제약의 해소로 보고하지 않는다.

K1 두 번째 통합에서는 Frame의 전체 문서 보존과 중첩 편집·미리보기·재진입 2개가 통과했다. fields 시나리오는 Outline의 draggable `div[role=button]`과 안쪽 native button이 같은 이름으로 조회되어 strict selector 오류로 중단됐다. 제품 오류와 구분해 native button의 정확한 단일 대상을 선택하는 별도 1파일 하네스 교정을 진행한다. `k1-integration-second-failed-summary.json`에 2통과·1실패를 보존한다.

세 번째 통합은 정확한 native 버튼을 찾은 뒤에도 실제 버튼 여백의 hit 검증에서 실패했다(다른 2개 시나리오는 통과). 설치된 Puck의 `[data-puck-component] *` 기본 pointer 차단과 overlay portal 예외, 슬라이더에는 있고 Tabs에는 없는 예외 선언을 대조해 실제 제품 입력 결함으로 분류했다. K1 제출 원본을 직접 수정하지 않고 동일 범위의 보존 replacement로 탭 조작 경계를 수정한다. `k1-integration-third-failed-summary.json`과 당시 스크린샷을 보존한다. 따라서 앞의 라벨 클릭 설명만으로 탭 전환이 이미 정상이라고 볼 수 없으며, 제품 수정 뒤 실제 입력 검증을 통과해야 한다.

K1 replacement 후 actual pointer hit·탭 전환·라벨/본문 편집·다른 슬라이드 입력 DOM 유지·저장/재진입이 모두 통과했다. 기본 라벨 클릭의 글자 편집 계약은 유지한다. 이후 구현 단위는 각 정식 통합의 관련 gate를 통과한 깨끗한 SHA에서 이어가고, `integration-verify`는 모든 3차 제출을 통합한 뒤 최종 차수 검증으로 수행한다. 상태가 있는 동일 runtime을 중간 단위마다 정식 최종확인 명목으로 추가 실행하지 않는다.

이후 구현·검사 결과와 최초 실패는 실제 실행 후 기록한다.

K2는 원본 기준의 Heading·Buttons `normal` 손실과 ImageText `default` 손실 3건, 실제 Puck Buttons 명령의 `normal` 손실 1건을 red로 보존했다. 공통 appearance가 명시 유효값을 받아들이도록 고치고 motion·요소 외형·Foundation data/codec을 순수 소유자로 추출한 후보에서 관련 46개 Unit과 strict가 통과했다. 버튼 명령→항목 복제→Undo 두 단계의 원본 복원도 포함하며, 최종 정식 통합 결과는 별도로 기록한다.

K2 정식 통합에서는 위 표의 실제 브라우저 9개가 모두 통과했다. Foundation UI 214줄·Data 134줄·Codec 35줄로 분리했으며 공통 appearance 41줄·motion data 42줄·element data 25줄이다. 본 catalog는 844→819줄, AST 13,267→12,934로 기존 상한만 낮췄으며 남은 크기 예외는 K4에서 제거한다. Foundation의 중간 정적 runtime 관찰은 7개 모듈·외부 패키지 0이지만 canonical 전체 경계 완료 판정은 K5 이후 같은 최종 감사로 수행한다.

K5 registry의 첫 strict 실패는 합성 renderer가 요구된 JSX.Element 대신 null을 반환한 테스트 타입 오류였다. 첫 입력과 로그를 보존한 뒤 JSX fixture로 고쳐 Unit·strict를 통과했다. 정식 제출에서는 기존 경계 검사가 builtin 방어 코드가 runtimeRegistry.ts 안에 있어야 한다고 문자열로 고정해 순수 등록소 추출을 거부했다. 해당 실패와 active 원본을 보존하고, 별도 정확 5파일 하네스 작업에서 실제 window 등록 바인딩→검증 함수→builtin 거부→등록 순서를 검사하도록 보완한다. 제품 방어를 없애거나 gate를 생략하지 않는다.

Registry 하네스 통합은 기존 배치와 추출 후보를 모두 허용하고, 주석·사용하지 않는 dummy·다른 함수 연결·descriptor 검사 생략·검사 뒤 조기 break·누락 import를 거부했다. 실행 제어부의 helper와 subject 소스를 각각 입력 지문에 넣으며 subject의 가짜 검사 파일로 대체할 수 없다. 범용 제어 흐름 증명을 주장하지 않고 현 등록 함수의 직접 loop·throw·Set.add·Map.set 구조를 좁게 지원한다. 관련 boundary 9개·planner 44개와 선택된 하네스 검사를 통과했으며 root와 별도 에이전트가 읽기 검토했다.

K3는 기존 UI export 경로에서 네 계열의 명시 default/normal 손실을 red 4개로 확인했다. 네 Data·Codec 소유자로 옮긴 뒤 Node 합성 회귀로 빈 배열·상한·순서·불변성·요소 별칭·외형 생략, 비교표 문자열 변환, 방향별 숫자 처리와 자동재생·URL 보존을 확인했다. UI가 사용하는 필드·렌더와 탭 포인터 경계는 유지한다. main catalog의 중복 AppearanceEditorProps도 K2 소유 타입으로 연결하여 819→808줄, AST 12,934→12,911로 상한을 낮췄다. 네 Codec의 중간 정적 runtime 관찰은 각각 7모듈·외부 패키지/순환/해석 오류 0이며 전체 변환 경계 판정은 K5 뒤 수행한다. 첫 strict 실패 TS2345는 합성 motion 변수의 넓은 string 추론으로, BlockMotion 타입을 명시해 고쳤고 최초 로그를 보존했다.

Registry 원본은 정식 active replacement로 보존 교체했다. `structure-3-catalog-k5-registry-r2-20260903`의 제출 `33b767edd50680d84f9d7b41a80767f9aab55a07`은 관련 Unit·strict·새 경계 22 gates를 통과했고 자산·브라우저 3개는 통합으로 이관했다. 반응형 데이터 추출 제출 `c34be9040c342018641e0fbc5a46f2c411d2d394`과 함께 K4 이후 순차 통합하며, 제출 성공을 실제 브라우저 통과로 계산하지 않는다.

Public P2 사전 읽기에서는 `siteShellControls.ts`의 알림 요청이 caller 해제 뒤에도 목록·읽음 이벤트를 갱신하는 경로를 확인했다. 기존 helper를 복제하거나 호출자만 정리해 해소했다고 계산하지 않고, 아직 claim하지 않은 P2를 해당 파일을 포함한 정확 14파일로 정의한다. 알림 요청 세대·해제와 동일 host 재연결의 늦은 응답 차단을 해당 소유자와 관련 회귀에서 확인한다.

K4는 본체를 모듈 범위의 설정 조합 68줄/468 AST로 줄이고 Data·Codec·Types·Fields·Previews·Thumbnail을 분리했다. 신규 owner 최대 209줄/4,171 AST이며 catalog의 크기 예외 두 개를 제거했다. 독립 AST 비교에서 원 선언 78개와 설정 연결 12개의 동등성을 확인한 후, 슬라이드 축소 시 이전·다음 첫 클릭이 같은 화면에 머무는 문제와 빈 배열 후 재추가 문제를 실제 DOM red 3개로 재현해 별도로 수정했다. 선택값을 현재 표시 가능한 인덱스로 제한하고 빈 배열의 이동을 막았으며 기존 입력 DOM·포커스·ReactNode 본문 보존을 검증했다. `k4-review/comparison.json`은 정적 비교, `k4/red-inputs`는 원본 실패, `k4-integration-summary.json`은 실제 제품 브라우저 증거다. 소스 계약 CLI 두 개의 성공은 브라우저나 콘텐츠 품질 검증으로 집계하지 않는다. Manager 이력 후속 수정의 변경 이력도 실제 통합된 내용으로 함께 기록했다.

K5 responsive 첫 통합에서는 관련 Unit·strict·구조가 통과했으나 실제 반응형 시나리오가 자식 블록 선택 단계에서 실패했다(함께 실행한 중첩 변환 1개는 통과). 동일 helper가 부모 선택 뒤 열린 Outline을 다시 클릭해 패널이 닫힌 스크린샷을 보존했으며, 실제 표시 상태를 확인하는 별도 정확 1파일 하네스 보완 후 실패한 browser gate를 다시 실행한다. 실패한 임시 병합은 자동 원복됐고 제출 원본은 보존한다. `k5-responsive-first-failed-composition.json`에 통합 기준/제출 SHA를 기록하며, 첫 실패 요약의 product_sha는 완료된 병합 SHA가 아니라 통합 기준을 가리킨다.

두 번째 K5 responsive 통합은 부모/자식 Outline 선택을 통과한 뒤 같은 testId의 숨김 Puck 사본과 표시 fieldset을 동시에 찾는 strict selector 오류로 중단됐다. 관련 성공 검사 20개는 재사용했으며 실제 중첩 1통과·반응형 1실패를 별도 보존한다. 표시되는 기기별 fieldset의 select와 reset을 정확히 선택하는 별도 1파일 보완으로 처리하며 제품 정규화 정책이나 기대값을 바꾸지 않는다.

K5C의 실제 변경은 codec import와 경계 Unit 두 파일이며 추가로 제거할 크기 부채가 없으므로 claim 전 정확 2파일로 확정했다. Public P1은 카탈로그와 코드·검사 입력이 독립인 정확 11파일로 `a9d5fae2`에서 병렬 준비하고, 통합은 K5C 이후 순차 수행한다. K5 등록소·반응형·변환 경계의 종합 변경 이력은 실제 통합 뒤 P1이 소유한 CHANGELOG에 함께 기록한다. 공유 경로 충돌 없이 준비 시간을 줄이는 배치이며 P1 완료 조건이나 코드 감사 범위를 줄이지 않는다.

세 번째 K5 responsive 통합은 같은 빌드 산출물을 재사용하고 실제 두 시나리오를 모두 통과했다. PC 1,440px·태블릿 820px·모바일 390px에서 공통/명시 배경의 computed style과 저장 JSON, 태블릿만 초기화한 뒤 모바일 지정값 유지·재진입을 확인했다. 이전 두 실패를 덮어쓰지 않으며 `k5-responsive-integration-summary.json`을 성공 영수증으로 사용한다.

K5C는 codec의 registry/responsive import를 각각 순수 Data 소유자로 연결했다. Node 환경에서 React·JSX·ReactDOM·Puck·Tiptap·Lucide import와 외부 renderer 실행을 거부하는 테스트를 사용한다. 변경 전에는 registry의 React import에서 suite가 실패했으며 이는 UI 경계 실패 1건이다. 수정 뒤 기본/카탈로그·중첩 구조·외부 블록 3개 계약 회귀가 통과했다. 세션별 metadata, 생략 기본값, 순서·ID, 외형·motion·visibility·responsive, 외부 예약 키와 기본 props/입력 불변을 실제 canonical 변환으로 확인한다. 제출·통합 로그와 원본 red는 인접 `phase3-catalog-k5-codec` 및 `k5-codec-integration-summary.json`에 보존한다. 전체 정적 import closure는 Public까지 통합한 최종 SHA에서 별도로 판정한다.

P1 원본은 실제 DOM에서 동시 boot 2요청·새 endpoint 이후 늦은 응답 덮어쓰기·동일 task 제거/재삽입 후 이전 응답 덮어쓰기 3개를 red로 확인했다. 문서/블록 상태 identity, await 이전 claim, pending 인증만 공유, MutationObserver 기록 소진, 응답·JSON·오류 이후 유효성 검사와 해제로 보완했다. 제어부만 교체되면 기존 행으로 listener를 연결하고 유효한 게시판 선택을 보존한다. 후속 리뷰의 queued 인증 시작 차단·필터 보존 회귀도 포함해 관련 Unit 5파일 50개·구조회귀 24개·strict를 통과했다. Values/Rendering 12선언 AST 동등성은 `public-p1/review/extraction-comparison-a9d5fae.json`, 원본 red는 `public-p1/red-inputs`, 최초 제출은 `public-p1/submission`에 보존했다. 본체 1,163→829줄·신규 소유자 최대 261줄이며 상한만 낮췄다.

P1 최초 제출 `342d2501e30392256461363745c399c1b53f40ab`의 통합은 PUBLIC 3개·합성 3개 통과 뒤 데이터 시나리오가 Board 선택자를 찾지 못해 중단됐다. 화면과 접근성 snapshot에는 기대한 Board combobox·옵션이 존재했으므로 역할/이름으로 대상을 정확히 찾는 fixture 교정으로 처리한다. 제출 task가 E2E 경로도 소유하므로 원본을 직접 수정하지 않고 동일 11파일의 정식 보존 replacement를 사용한다. 첫 실패 6통과/1실패와 후보 기준·제출 조합은 `public-p1-integration-first-failed-summary.json`·`public-p1-first-failed-composition.json`에 보존한다.

P1은 동일 11파일의 정식 교체 제출 `fbf42fdacc5025f065618804e38a5153c4ef097e`로 마무리했다. 실제 제품 변경은 원본과 같고 E2E의 Board combobox 선택자와 단일성 검사만 교정했다. 통합 SHA `a302ff7cf61d27eff91530d72792c66a17edc725`에서 13 gates 중 5개 실행·8개 재사용, 합성 4제목×PC/태블릿/모바일 12개와 기존 PUBLIC 3개가 모두 통과했다. 첫 실패 자료는 별도로 유지하며 `public-p1-r2-integration-summary.json`을 최종 P1 통합 영수증으로 사용한다.

P2는 P1 통합 SHA `a302ff7c`의 깨끗한 worktree에서 정확 14파일로 시작했다. claim 전 Unit 경로는 기존 `pageEffects.test.ts`와 새 `publicContentControls.test.ts`·`publicInquiryForms.test.ts`·`siteShellRuntime.test.ts` 네 개로 확정했다. 제어·문의·셸 수명주기를 각 소유자에서 검사하고 기존 `siteShellProductQuality.test.ts`는 수정하지 않고 관련 gate로 유지한다. P3 읽기 검토에서 추가한 모바일 toggle/backdrop 교체와 카운터 원문 복구도 기존 P3 11파일 범위의 재초기화 조건이다.

P2 원본에서는 문의 A 전송 뒤 입력한 B가 초기화되는 문제와 동일 셸 host 재연결 뒤 이전 알림이 새 목록을 덮는 문제를 실제 DOM red 2개로 재현했다. 추출 동등성 검토 중 발견한 unknown embed 종류·공백 URL 허용도 원본 red 1개를 별도로 보존한 뒤 차단했다. 단순 파일 이동과 실제 결함 수정을 구분한다.

P2는 native FormData·CSRF·정상 성공 reset·키보드/ARIA·기존 DOM을 유지하며 각 제어부와 문의·셸 요청의 해제를 소유한다. 문의 snapshot 이후 새 입력을 보존하고 marker·입력/submit·action·동일 task 재삽입이 바뀌면 옛 응답을 폐기한다. 독립 검토에서 G7 경로의 storage/pageshow 알림 누락, 계정 전환 뒤 이전 알림/읽음 응답, 이전 로그아웃 응답의 새 토큰 삭제를 추가로 확인해 보완했다. 이 세 후속 항목은 원본 red 3개와 별개의 읽기 검토 및 후보 회귀 증거다.

P2 관련 Unit 첫 실행 52통과/1실패는 브라우징 컨텍스트 없는 `createHTMLDocument`의 포커스 fixture 문제였다. 원 실패를 보존하고 포커스 검사만 실제 document로 연결해 3개를 통과했으며, 기대나 `.focus()` 구현을 모의 처리하지 않았다. 정식 제출 `dbae97c2c7d305f756d5270d26aaa0a1b1e84142`는 정확 14 claim 중 13파일 변경, 35 gates 중 30통과/5runtime 대기다. 관련 Unit 27파일 234개·구조회귀 24개·strict·구조 검사를 통과했고 본체는 829→320줄, 새 소유자 5개 최대 353줄로 크기 예외를 제거했다. `siteShellControls`의 편집기 persona 소비에 관련된 Unit을 포함하되 콘텐츠/프리셋 품질 검사로 확대하지 않았다.

P2는 통합 SHA `6d122d55f653501f6fb5af86af086f50c654ee4b`에서 35 gates 중 8개 실행·27개 재사용으로 마감했다. 실제 셸 1개는 대표 G7 사용자 경로·검색·언어 연결을, PUBLIC 3개는 PC/태블릿/모바일을, 합성 4개는 실제 dist의 데이터·폼·효과·셸을 확인했다. 8개 모두 통과했고 skip은 0이다. 영수증은 `public-p2-integration-summary.json`이며 운영 배포 성공을 뜻하지 않는다. P3는 이 통합 SHA에서 정확 11파일로 시작하며 3차 전체 마감은 P3와 최종 재감사 뒤에 수행한다.

P3 원본 red는 반복 카운터의 옛 프레임 덮어쓰기, 같은 모바일 메뉴에서 교체한 toggle/backdrop 미연결, 실제 Embla에서 교체한 next 버튼 미연결 3건이다. Motion·Sliders·Runtime을 분리하고 개별 owner와 전체 종료에서 RAF/IO·벤더 이벤트/인스턴스·DOM listener·예약된 시작 작업을 폐기한다. 카운터 원문 복구, 명시 종료 때 메뉴 닫힘과 내부 교체 때 snapshot 보존도 구분했다.

P3 후보 검토에서는 취소된 parallax frame의 새 예약 훼손, Text-only counter 갱신마다 전체 boot 반복, 데이터 세션 해제에 따라 문의 fetcher identity까지 달라지는 간접 초기화 경계를 보완했다. 상위 Runtime가 실제 fetch 원함수에 대응하는 안정 연결을 유지해 계정 전환 때 데이터만 다시 읽고 전송 중 문의는 유지한다. P1이 같은 값의 input attribute 기록도 폐기하는 기존 계약과 Runtime 재시작을 맞추고, role/type의 동일값·Text-only 변경과 Slider의 동일 설정은 불필요한 재초기화를 만들지 않도록 했다. pagehide의 새 자동 폐기 정책은 추가하지 않고 기존 persisted pageshow 경로를 유지한다.

정식 P3 제출 `6eafed3e820179d452513ad75ab71d8cc27c03db`는 정확 11 claim 중 9파일 변경, 34 gates 중 30통과/4runtime 대기이며 Unit 28파일 244개·strict·구조 검사를 통과했다. 본체 16줄·Motion 258줄·Sliders 132줄·Runtime 113줄·Mobile 166줄이며 부채 장부와 E2E 정의는 변경하지 않았다. 직접 실행 30개·추가 수명 34개·후속 정합 검사 결과를 합산하지 않는다. 후속 fixture가 post 응답에 잘못된 subject/url을 사용한 첫 실패는 보존하고 실제 id/board_slug/title 계약으로 교정한 한 검사만 재실행했다. 증거는 인접 `phase3-public-p3/submission-summary.json`, `source-snapshot.json`, `red-manifest.json`과 각각의 첫 로그다.

P3 통합의 실제 브라우저 16개는 모두 통과했으며 skip·flaky는 0이다. 모바일 탐색은 Chromium/WebKit의 drawer·dropdown·선택·키보드·reduced-motion을 확인했다. 합성 검사는 실제 빌드의 데이터·폼·효과·셸 수명을 확인한다. `public-p3-integration-summary.json`에 실행별 결과를 보존했으며 앞 단계와 반복 실행한 시나리오를 합산해 새로운 검사 수로 보고하지 않는다.

## 동일 기준 최종 재감사

기준 `23beb94`와 제품 통합 `cbe955a6`의 Git 소스를 비교했다. 크기·부채 검사 정책, 검사기, package/lock/tsconfig는 동일하다. 정적 runtime 비교도 TypeScript 5.9.3·Node 24.19.0과 두 분석기 SHA를 동일하게 유지했다. 전체 구조 검사, 소유자 크기 비교, 부채 장부 비교, 정적 emit 그래프와 경계 판정을 각각 한 번 실행했다.

| 항목 | 시작 | 최종 |
| --- | ---: | ---: |
| Manager 비공백 줄 / AST | 1,597 / 11,987 | 96 / 844 |
| catalogBlocks 비공백 줄 / AST | 851 / 13,392 | 68 / 468 |
| pageEffects 비공백 줄 / AST | 1,163 / 9,953 | 16 / 139 |
| 전체 제품 소스 검사 파일 | 255 | 302 |
| 전체 정적 부채 | 1,066 | 1,061 |
| 크기 진단 / 실제 파일 | 7 / 5 | 2 / 2 |
| 신규 위반 / 남겨 둔 해소 예외 / TS 우회 단언 규칙 위반 | 0 / 0 / 0 | 0 / 0 / 0 |
| 전체 정적 runtime 모듈 / 내부 ESM 참조 선언 | 91 / 243 | 138 / 344 |
| 순환 / 문서 역참조 / 해석 오류 | 0 / 0 / 0 | 0 / 0 / 0 |
| canonical 도달 모듈 / 외부 import 경로 | 36 / 6 | 28 / 0 |
| canonical 금지 연결 / 도달 동적 참조 | 44 / 2 | 0 / 0 |

변경한 TS/JS 제품 소스 64개(신규 47개) 모두 기본 800줄·AST 10,000 이내다. 새 소유자 최대 줄 수는 `siteShellRuntime.ts` 353줄이고 최대 AST는 `catalogPreviews.tsx` 4,171이다. 새 거대 파일로 옮기거나 예외를 이동·추가하거나 기존 상한을 늘리지 않았다. 세 대상 파일의 부채 항목 3개에 속한 크기 진단 5개를 제거했다.

정적 그래프의 emit 누락·파싱 오류·미해석 내부 import·새 순환은 모두 0이다. canonical 변환, Manager 본체와 실제 진입점, 공개 runtime 경계가 모두 통과했다. 전체 그래프에는 보호 대상 경로 밖의 동적 참조 2개가 계속 남아 있으며 이를 0으로 보고하지 않는다. 이 결과는 소스/emit 분석이며 semantic typecheck·제품 실행을 대신하지 않는다. strict·관련 Unit·실제 브라우저의 통과는 위 제출·통합 기록에 별도로 남긴다.

잔여 1,061건은 CSS 색 908·important 135·specificity 16과 PHP compiler·편집기 CSS 크기 진단 2개다. PHP 컴파일러는 4차, 스타일·테마는 5차, 전체 재감사와 종료는 6차 범위로 남는다. 이번 마감은 블록 콘텐츠 품질 승인, 운영 배포, Visual UI Editor 전체 또는 상용 수준 완성을 뜻하지 않는다.

## 정식 마감 증거

제품 통합 이후 문서 두 파일만 별도 소유 task로 제출·통합한다. 모든 제출분 통합 뒤 `make integration-verify TASK=structure-phase3-integration-20260903`으로 최종 확인하고 `make integration-finish TASK=structure-phase3-integration-20260903 NO_RELEASE=1`로 소유권을 종료한다. 동일 입력의 성공 정적 검사는 재사용하고 runtime gate는 하네스 정책에 따라 실행한다. 기존 블록/프리셋 콘텐츠 전수 검사로 확대하지 않는다.

최종 SHA를 이 문서에 다시 써서 검증 입력을 바꾸지 않도록, 문서 통합 SHA·검증 결과·문서만 변경됐다는 Git 비교·종료 로그와 상태는 증거 폴더의 `phase3-final-close.json`에 기록한다. 해당 영수증의 검증 및 종료 성공이 차수 전체 마감의 근거다. 원본 실패 로그·제출·보존 교체 이력은 유지하며 다른 작업의 파일이나 소유권은 종료하지 않는다. 배포와 release 검증 SHA 승격은 수행하지 않는다.

## 증거 위치

`/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/structure-remediation/phase3-close`

`phase3-baseline-architecture.json`과 `static-runtime-baseline-23beb94.json`은 이 차수 시작 소스에서 새로 읽은 기준선이다. 앞 차수의 성공을 새 변경의 검증 성공으로 대체하지 않는다.

최종 경계 판정의 기준선은 같은 정적 그래프를 재사용한 `runtime-boundaries-baseline-v2-23beb94.json`이다. emit/파싱/미해석 import·순환·문서 역참조를 전체 판정에 포함하고 실제 Manager 진입점도 별도로 확인한다. 기준선 canonical 금지 연결은 44개·동적 참조 2개로 실패하며 Manager 본체·진입점과 공개 runtime은 통과한다. 이전 결과를 덮어쓰지 않았고 각 판정의 감사 script SHA를 기록한다.

최종 측정은 `phase3-final-architecture-cbe955a6.json`, `source-owners-final-cbe955a6.json`, `debt-delta-final-cbe955a6.json`이다. 정적 그래프·경계·비교 요약은 각각 `static-runtime-final-cbe955a6c9f10cd131d7b7ce5ef588e1c14bed26.json`, `runtime-boundaries-final-cbe955a6c9f10cd131d7b7ce5ef588e1c14bed26.json`, `runtime-comparison-final-cbe955a6c9f10cd131d7b7ce5ef588e1c14bed26.json`이다. 분석기·입력·결과 해시와 최초 로그를 함께 보존한다.
