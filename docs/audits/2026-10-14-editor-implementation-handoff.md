# 편집 구현 종료·실패·독립 재감사 인계

2026-10-14 · 제품 수용 미완료 · 운영 미배포

## 판정

이번 제한된 구현 실행의 통합 결과와 과거 실패를 인계합니다. **전체 정밀 편집 기능 완료라고 선언하지 않습니다.** IP8 미디어·사용자 구성, IP9 새 문서/새 Site Part 리비전 복원은 소스 구현·통합했습니다. IP7 공통 컨트롤과 동적 게시글/상품 연결도 통합했습니다. 동적 후보의 DATA02는 최초 허용 보완 후 실패로 보존했으며, 이후 사용자가 해당 문제만 별도 재감사·추가 수정 1회를 승인하여 문자열 ID 검증으로 차단을 해소했습니다. 검색/필터/페이지 실행 UI와 최종 제품 수용은 여전히 미완료입니다.

기존 v1/v2·기존 Site Part 문서 전환/처리는 실행하지 않았습니다. 기존 변환 도우미 제출 2건은 별도 프로세스로 분리 보존했습니다. 새로운 E2E/UI·UX/접근성/성능/전체 제품 감사는 추가 실행하지 않았습니다. 검사를 생략한 사실을 성공으로 기록하지 않습니다.

## 실제 통합 범위

| 기능 | 제출 SHA | 통합 SHA | 범위/검증 경계 |
|---|---|---|---|
| 구현 인계와 수용 분리 | 9e8fbfe12e2f3c50d05190357221a6ded2814f21 | da1ef5aabcf77151ecaa556ec539b98af22a2b68 | runtime/downstream은 deferred, acceptance=false; 릴리스 사용 금지 |
| 기존 공통 문의 관련 제출 12건 | 각 task 원장 | a84f371a07ae2878cb826cd916ee5e704ee11805 | 새 문의 연결·공통 입력/라벨과 5개 시작 문서; 추가 실제 제출 검사는 인계 |
| 이미지·미디어 | e4958b21cd737227c16214c2c38b31d45e990972 | e1acc6d4358a83bd7f2644114064dc1c1bdf1005 | 목록/업로드/교체/alt/fit/초점, atomic 자산+노드 명령 |
| 사용자 구성 라이브러리 | d2cd5435df4caa93973b0769898fa3560fba82cb | f8250116b088ea5e2bbdb9edd5b9316f371574d0 | 선택 저장/검색/새 ID 재삽입/삭제; 기존 사용자별 저장소 재사용 |
| 새 페이지 리비전·문서함 | ed07208920f69b3a82b46c3675937d4542a6bbe4 | 3c02566748a0e57877017ac7a14f3ae9f1311acf | v3만 명시 새 초안 복원, CAS/마지막 발행본 보존, 정밀 화면 진입 |
| 빈 페이지 첫 이미지 | 54b3f3e77402de34cca4401b9c1393555a92ec82 | fc752e9180f4846eed3572b602c1ccc20c9ee539 | 주소/목록/업로드로 첫 자산+이미지 삽입, 한 Undo |
| G7 고정 실행 컨트롤 | 288d76ad649583680030f1d9275ee64601084760 | 19ad920c59a8ee609077cdbb0a0016629b513d4a | 공통 컨테이너의 검색/계정/알림/장바구니/화면/언어/통화; 인증 실행·live DOM 외부 소유 |
| 새 Header·Footer 리비전 | a570d746f178f995700bf8d65ed94506383183c5 | 728e0e1fc800dfa27ab9277d43debb5e8fdf5c51 | 기존 revision read/CAS save 재사용, 복원 대상만 새 세션 |
| 실패·별도 프로세스 보존 | b3d5be0abf217acd858674b4b5f788bd8ec63257 | 9b1298887a8ae8a787397dd738c00b75ac82b3cb | 실패/보류 SHA·branch·worktree 보존; 성공/릴리스 기준 유지 |
| DATA02 승인된 추가 수정·동적 연결 | 3cb8a20d0e53a17b60392e5924f62d1b6b5fb236 | c8baed6cc4fbd2df1a1b735b916aa1665ff0cb9b | 후보 대비 ID 검증 3줄만 수정; 공통 data 명령/원형 복제; 기존 관련 검사 통과·수용 보류 |

새 구성마다 편집기를 등록하지 않습니다. 기본 11종 요소·typed 스타일·공통 명령·Puck 이력을 재사용합니다. 시작 구성은 버전이 있는 문서 데이터이며 사용자 구성도 같은 paste 경로입니다. 과거 블록별 도우미를 현재 정밀 편집기 번들에 연결하지 않습니다.

[IP8 미디어](2026-10-13-ip8-media-implementation.md), [첫 이미지](2026-10-13-ip8-empty-image-insert.md), [사용자 구성](2026-10-13-ip8-user-compositions-implementation.md), [새 페이지 복원](2026-10-13-ip9-revision-recovery-implementation.md), [Site Part 복원](2026-10-13-ip9-site-part-recovery-implementation.md), [고정 컨트롤](2026-10-13-ip7-system-controls-implementation.md)의 소스/범위를 확인합니다. 이 기록은 기능별 추가 제품 수용 증거가 아닙니다.

## 실패 원장과 제한

| ID | 관찰·원인 | 한 번 보완한 내용 | 최종 상태/영향 |
|---|---|---|---|
| ENV01 | 새 worktree의 postcss/Node 의존성 부재 | 동일 lock의 기존 node_modules 연결 | 해결, 제품 소스/버전 변경 없음 |
| COMP01 | API 계층에서 schema JSON 직접 import, 구조 gate 거부 | 기존 도메인 freshId 검증 재사용 | 해결 1/1; 구성 제출·통합 성공, 제품 수용 미실행 |
| MEDIA02 | 빈 문서는 자산이 없어 이미지 Inspector 진입 불가 | 공통 atomic image-insert와 삽입 화면 | 해결 1/1; 별도 제출·통합 성공 |
| SYSPLAN01 | 공유 schema/policy 변경의 명시 scope 플래그 누락 | FULL=1 분류 명시, IMPLEMENTATION=1 유지 | 해결, 제품 재구현 아님; runtime/full-product 미실행 |
| ENV02 | Local 통합을 Node 24 PATH 없이 실행하여 localStorage 6건 실패 | 승인된 Node 24 PATH로 환경만 보완 | 해결; 실패/downstream만 처리, 성공 입력 재사용 |
| DATA01 | 새 DataInspector JSX 닫기 괄호 오류로 기존 시험 수집 실패 | 괄호 한 곳 보완 | 해결 1/1, 해당 기존 unit 통과 |
| DATA02 | DataBindings ID 인덱스의 by-ref 타입 계약과 PHPStan 추론 불일치 | 최초 param-out 보완 후 실패 보존; 이후 별도 재감사와 추가 수정 1회 명시 승인 | 기존 Bindings와 동일한 문자열 ID 검증 3줄로 해소·통합; PHPStan 통과, 과거 실패는 보존 |
| INT01 | 이전 batch의 270건 이후 후속 실행을 사용자 지시에 따라 중단, Git 후보 원복 영향 | 공식 transaction/EXIT 복구 | 의도된 중단, 이후 폼 오류·미실행을 제품 성공/실패로 확대하지 않음 |
| LIMIT01 | 마지막 integration-verify에 FULL=1을 지정해 오래된 신뢰 기준부터 315개 변경/247개 gate로 비런타임 확인 범위를 확대함 | 범위 확대를 확인하고 coordinator PID 56791에 SIGINT | 확인 중단(exit 130), 동일 확인 재시도 금지; 사용자 범위 지시 위반을 기록 |

DATA02 원래 후보: **e0c34b2e81317284a2d455c350a1635879e73fad**, branch `codex/editor-dynamic-elements-20261013`, worktree `/Users/neojins/.codex/worktrees/editor-implementation-handoff/g7-page-builder`. 당시 실패 상태 `failed-implementation`과 원본 worktree를 그대로 보존하며 이 실패 커밋 자체를 main에 merge하지 않았습니다. 첫 실패 `DataBindings.php:63 parameterByRef.type`, 보완 뒤 `:65 paramOut.type`. 후속 명시 승인으로 새 기준·task에서 복원하고 문자열 검증 한 곳을 수정한 제출/통합은 위 표와 [별도 재감사](2026-10-14-data02-reaudit.md)에 기록합니다. 테스트/타입 기준은 완화하지 않았습니다.

최종 실패 보고서: `.git/g7pb-coordination-v1/python-checks/implementation-handoffs/editor-dynamic-elements-20261013/submission-8ad583bbdc524df291cadfb9d18df384.json`. 최초 타입 실패는 `submission-8a8990c888514cb486836e38ef0f5190.json`, JSX 실패는 `submission-947befc4da294a8ca7f59c6e3f9e44f4.json`입니다. 해당 실패 문맥 문서는 후보 커밋의 `docs/audits/2026-10-13-ip7-dynamic-elements-implementation.md`에 있습니다.

후속 통합 영향: 게시글 목록·아카이브·상세 및 상품 목록·쇼케이스·상세 **6종의 일반 원형 데이터 연결 소스와 빌드는 이제 포함됩니다.** 원형은 일반 컨테이너/하위 요소로 작성하여 필드를 연결하며 전용 시작 구성 6개를 추가한 것은 아닙니다. 기존 모드의 고정 데이터 위젯은 보존됩니다. **아카이브 검색/필터/페이지 실행 컨트롤은 아직 구현하지 않았고 실제 동적 데이터 수용도 미확인입니다.** 공통 편집기가 있다는 이유로 이를 완료로 계산하지 않습니다.

## 재감사 필요성 및 순서 (이번에 실행하지 않음)

1. DATA02의 별도 승인 수정·통합·PHPStan 통과 기록을 확인합니다. 이 타입 차단은 다시 수정할 항목이 아닙니다. 남은 것은 동적 6종의 실제 필드/참조/CAS/권한/빈·실패 응답/반복 ID 수용, 아직 없는 페이지·검색/필터 UI 구현과 그 UX 수용입니다.
2. 통합본의 빈 페이지 → 첫 이미지/제목/본문/버튼 → 중첩/레이어/치수/간격/다중 선택/모바일 override → Undo/Redo → 저장/재열기/미리보기/발행을 감사합니다. 기존 270건 성공은 새로운 미디어/구성/복원/컨트롤의 최종 수용을 대신하지 않습니다.
3. 미디어 업로드/취소/지연 응답/선택·문서·잠금·readonly 전환과 자산 중복/파일 보존, 사용자 구성의 사용자별 권한/저장/검색/새 ID·내부 참조/독립 사본/삭제를 감사합니다.
4. 새 페이지와 새 Header/Footer의 revision 조회·명시 복원·409 충돌·문맥 전환·다른 영역 미저장 입력/Undo·마지막 발행본·쌍 발행·사이트 적용을 감사합니다. 기존 버전 변환과 혼합하지 않습니다.
5. G7 실행 컨트롤의 editor/draft/public 표시·폰트/크기 전달·capability 부재·인증·회원/비회원·키보드/포커스 동작을 감사합니다. editor/구조 preview는 inert 표시이며 실제 서비스 내부를 편집하는 것이 아닙니다.
6. [전체 capability 표](2026-10-14-editor-capability-map.md)의 추가 시작 데이터와 보호된 외부 iframe/runtime을 확인합니다. 블록 이름별 코드 추가 없이 새 구성 데이터를 넣고 같은 편집기를 사용하는지 검사합니다.
7. 동일 font/image 준비 조건의 360/768/1280 및 경계 폭에서 캔버스/서버 preview/public의 구조·줄바꿈·computed style·bounding box를 비교합니다. 1 CSS px 기준·키보드/IME·넘침·가림·대비·100/500노드 예산은 유지합니다.
8. G7 없는 대체 포트와 실제 지원 G7/테마 조합을 구분하여 독립성/업데이트 회귀를 판정합니다. 운영 배포는 별도 요청·릴리스 검증 이후에만 합니다.

이는 **필요성 인계**이며 새 검사 정의/실행 지시나 성공 증거가 아닙니다. 감사가 검증 지옥으로 변하지 않도록 정확 실패/관련 입력 범위를 먼저 확정하고 성공 입력은 재사용해야 합니다.

## 기존 문서 독립 프로세스

- 이번에 실제 사용자 문서/기존 Site Part를 전환·삭제하지 않았습니다.
- `ip7-contact-composition-20261012`: 7cb765ca03386b8d0e62b194e847f97f6ae123ea.
- `ip7-richtext-composition-20261012`: 92d332e213039d8ae816bb1e39d3575583cc67a9.
- 두 제출은 `deferred-submitted` 보존이며 기존 branch/worktree를 유지합니다. 현재 정밀 편집기 구현/빌드에 merge하지 않았습니다. 이후 문서 처리의 설계·백업·미지원 진단·원본 revision·마지막 발행본·명시 승인 범위를 독립적으로 정해야 합니다.
- 작업 도중 비차단 임시파일/증거/dirty worktree를 삭제하지 않았습니다. 불필요 정리는 요청 결과의 차단 선행조건으로 만들지 않았습니다.

## 빌드 및 검증 경계

최종 제품 소스 기준 `728e0e1fc800dfa27ab9277d43debb5e8fdf5c51`에서 runtime lease 아래 `make dev-build-assets TASK=integration-ip7-20261012`를 한 번 실행하여 production build에 성공했습니다. 빌드 fingerprint: `4d7c98043dbd3e58da903d3dda9b1a4597e77236e709584021eedfb56297925e`. 이후 변경은 구현 보존 하네스·정책/진척/보고 기록이며 브라우저 제품 소스를 변경하지 않습니다.

선택된 기존 non-runtime unit/PHP/type/structure 및 관련 하네스 검사는 공식 task 제출/통합에서 확인하거나 같은 입력 성공을 재사용했습니다. 브라우저·runtime·full-product gate는 `deferred`, phase별 보고서는 `.git/g7pb-coordination-v1/python-checks/implementation-handoffs`에 있습니다. 실패 후보는 추가 빌드에 포함하지 않았습니다.

최종 `integration-verify FULL=1 IMPLEMENTATION=1`은 오래된 신뢰 기준 `2553987c1a08b544dff38a1f4cfe77599ea69254`부터 315개 변경/247개 gate를 선택했습니다. 일부 기존 하네스 확인이 실행된 뒤 이 범위 확대를 확인하고 정상 중단했습니다(exit 130). 사용자 검증 확대 금지 지시에 어긋난 실행 판단이며, 이를 성공이나 필요한 추가 감사로 정당화하지 않습니다. 같은 확인을 재시도하지 않습니다. 실제 제품 브라우저/runtime/full-product는 실행하지 않았고, 출력의 browser fixture 표시는 임시 저장소·mock을 사용하는 기존 하네스 시험입니다. 중단 후 main `aa54cf6b260b073a271163acd18918bcf9b90f56`과 clean 상태 및 자식 coordinator 종료를 확인했습니다.

각 task의 공식 제출·통합과 최종 문서 정합성 기록은 보존합니다. 전체 최종 `VERIFIED` 기록은 만들지 않았습니다. `integration-finish NO_RELEASE=1`로 lease만 종료하며 이는 릴리스 검증 SHA 승격·운영 배포·최종 UX 합격을 의미하지 않습니다. UI/UX가 실제 의도대로 완성됐다는 결론은 이번에 내리지 않습니다.

## 목표 재개 중 안전한 잔여 구현 (2026-10-14)

이전 종료 뒤 목표 추진에서 실제 데이터 누락을 확인하여 FAQ·탭·캐러셀·연락처 등 17개 시작 문서를 추가했습니다. 현재 시작 데이터는 85개입니다. 편집기 등록/렌더 코드·schema·vendor·기존 문서 변환은 추가하지 않았습니다. 기존 68개 원본은 그대로 보존합니다. [구현 기록](2026-10-14-editor-starter-data.md)과 업데이트된 [전체 capability 표](2026-10-14-editor-capability-map.md)를 참고합니다.

기존 문의 시험의 대상 선택만 배열 위치에서 binding 보유 문서로 바꾸며 5개 대상과 합격 기준을 유지합니다. 새로운 제품 시험/브라우저 시나리오·최종 종합 확인은 추가하지 않습니다. 데이터 입력이 바뀐 산출물만 한 번 빌드하고 동적 DATA02 후보는 재구현·통합하지 않습니다. 이 보완으로 해당 실패나 최종 UX 수용을 완료로 바꾸지 않습니다.

추가 데이터 제출은 4c13071a44b65974955d0e7da2bfc2eff75c4650, 통합은 e235b399abc8219f2772d3dc45e6a2934c400ef4입니다. 기존 reference 범위 보존은 2b54b65532c9f8de7b6a71844a333e27179ac32b / 3a043291eef19be0e3f0ca6b889b741a49609ff4로 분리 커밋했습니다. 빌드 fingerprint는 6374d857100138bde0e7c8bf0ec94215c9a5e72ce37f1c2b806a1cf9cee18f03입니다. 관련 기존 18건은 같은 입력 성공을 재사용했고 기존 2건/6건과 타입 검사도 성공했습니다. 실제 브라우저/runtime는 deferred로 남깁니다.

최종 scoped 인계의 계획을 먼저 읽어 base 9da030f50fb8b81c018a06471d59fbcbf58ab606부터의 실제 delta와 7개 선택 gate·full=false·미분류 없음만 확인했습니다. 이전의 FULL 범위 확대를 다시 실행하지 않으며 runtime 및 브라우저 2개 gate는 IMPLEMENTATION=1로 미실행 인계합니다. 이는 전체 제품 VERIFIED나 DATA02 복구를 뜻하지 않습니다.

## DATA02 후속 승인 결과 (2026-10-14)

이전 동결 뒤 사용자가 DATA02만 별도 재감사·추가 수정 1회를 허용했습니다. 새 task는 원래 실패 source를 현재 기준에 보존 복원하고 동적 ID를 문자열로 검증하는 3줄만 보완했습니다. 제출 `3cb8a20d0e53a17b60392e5924f62d1b6b5fb236`, 통합 `c8baed6cc4fbd2df1a1b735b916aa1665ff0cb9b`입니다. 기존 선택 145개 gate 중 제출은 40통과/91재사용/14보류, 통합은 32통과/99재사용/14보류입니다. PHPStan·타입·구조·관련 기존 시험은 통과했고 acceptance=false를 유지합니다.

변경 입력에 대한 자산 빌드는 한 번 성공했으며 fingerprint는 `d1a627bad10409fa9eee2654aa378959c5e2908cb53392072eee7cd82e108541`입니다. 추가 E2E/UX·전체 감사·기존 문서 전환·테마/코어 수정·배포는 하지 않았습니다. 상세 원인·소유 범위·원본 실패·검사 보고서·잔여 한계는 [DATA02 재감사](2026-10-14-data02-reaudit.md)에 인계합니다. 과거 FULL 검증 확대는 재개하지 않으며 이 후속도 전체 제품 완료/VERIFIED를 뜻하지 않습니다.
