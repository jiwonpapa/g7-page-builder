# 제한된 구현 시도 종료와 실패/독립 프로세스 보존

사용자의 2026-10-13 직접 지시를 적용합니다. 추가 검증은 확대하지 않으며 문제별 한 번 보완 후 재발한 실패를 동결합니다. 기존 문서 처리는 별도 독립 프로세스입니다.

- `task-preserve-failed`는 소유한 scoped task의 실제 비성공 implementation-handoff 제출 보고서·변경 파일 범위·ancestry를 확인하여 실패 후보를 별도 Git commit과 history로 보존합니다. 제출 성공/통합 성공/제품 수용 receipt는 만들지 않으며 통합 대상으로 선택할 수 없습니다.
- `task-defer-submitted`는 Local integration owner가 명시한 분리 사유와 기존 제출 SHA/branch/clean worktree를 확인하여 별도 프로세스 후보를 보존합니다. 제품에 merge하지 않고 기존 branch/worktree/SHA를 삭제하거나 덮어쓰지 않습니다.
- 두 기록은 원본 paths/base/submitted SHA와 새로운 이유/보고서 digest를 유지합니다. 기존 submit/integrate/verify/release 기준은 바꾸지 않습니다.
- 후속 재감사/문서 처리에서는 보존 SHA를 검토하고 새 clean worktree·새 task·정확 PATHS로만 수정합니다. 실패/보류 원본을 성공으로 승격하거나 metadata를 수동 수정하지 않습니다.
- 새 제품 테스트/브라우저 시나리오는 추가하지 않습니다. 기존 관련 coordinator 시험만 사용합니다. 실패 보존은 실행 검사 없이 증거/소유 경계를 확인하는 보존 동작이며 제품 성공으로 보고하지 않습니다.

분리 예정 대상은 `ip7-contact-composition-20261012`, `ip7-richtext-composition-20261012`의 기존 형식 도우미입니다. 동적 데이터 후보는 `editor-dynamic-elements-20261013`의 DATA02 재발 실패로 보존합니다.
