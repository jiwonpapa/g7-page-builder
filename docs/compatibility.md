# 네이티브 편집 호환 범위

현재 배포 릴리스는 PB **0.35.0**과 G7 호스트 `6dc41eead1a9d14fa7d4c817827dfaccb03cb1db` (engine-v1.68.2)다. G7 공식 배포판 전체나 모든 테마를 지원한다는 뜻이 아니다. 기존 독립 PB의 G7 최소 버전과 네이티브 공개 호스트 지원 조건은 별도다.

| 조합 | 확인 범위 | 제공 경계 |
| --- | --- | --- |
| 위 G7 후보 + sirsoft-basic 1.1.3 + 실제 설치 spec/renderer/CSS | 일반 페이지 원본 편집·Undo/Redo·저장·재열기, 미디어, 중첩 트리, 개인 조합, 페이지 설정·미리보기 | G7이 제공한 필드·허용 자식만 사용 |
| 위 후보 + jiwonpapa-native_lab 0.1.0 기술 fixture | 명시적 PB companion manifest/spec/renderer/CSS, 배열 이미지·셀 트리·반복 원본·Slider 공개 재생 | 테스트 전용이며 고객 테마·상품으로 배포하지 않음 |
| 공개 호스트/선택형 capability 미제공 | 기존 독립 PB 유지, 미제공 네이티브 선택지 비활성 | private hook이나 DOM 조작으로 우회하지 않음 |
| 확장 JS 로딩 실패 | G7 편집 화면 유지·저장 원본 무변경 | 네이티브 패널 제공 실패를 정상 제공으로 표시하지 않음 |
| 저장 오류·동시 저장·이력 복원 | 미저장 입력 보존, 이전 서버 원본 보존, stale write 409 | G7 저장은 공개 페이지에 즉시 영향을 주며 PB 초안을 추가하지 않음 |

PC는 편집 동작을, PC·태블릿·모바일은 공개 출력과 넘침을 확인했다. Slider는 키보드 및 reduced-motion 동작을 포함한다. 기존 PB 문서·발행본·사용자 지정 주소는 별도 공존 시험으로 확인했다.

운영 테마 `jiwonpapa-devops` 0.1.4는 실제 G7 Installer 일반 페이지에서 상세 필드·라디오·Enter 적용·Undo·재열기와 기존 공개 출력을 확인했다. 저장/발행 없이 임시 편집을 되돌렸다. 해당 테마의 전체 구성/Slider 지원을 주장하지 않는다. 파일 지문과 확인 범위는 [NE6 기록](audits/2026-09-08-native-editor-ne6.md)에 기재한다. 고객 테마에 Slider나 새 manifest/spec을 자동 삽입하지 않는다. core main/upstream 반영 여부와 운영 파일 적용을 혼동하지 않는다.
