# 기존 시작 원본 회귀 범위 보존

Task editor-starter-reference-scope-20261014 · 기준 9da030f50fb8b81c018a06471d59fbcbf58ab606.

새 시작 문서 17개 추가 후 과거 reference 68개에 대한 전체 개수 단언이 더 큰 목록을 읽어 실패했습니다. 기존 v3BuiltinCompositions의 원본 63개 정확 일치·문의 5개·68개 clipboard 회귀를 그대로 보존하고 reference 목록만 documents.slice(0, 68)로 명시합니다. 테스트 대상과 합격 기준을 확대/완화하지 않으며 새 시험이나 E2E를 추가하지 않습니다.

신규 시작 데이터는 공통 StructureEditor가 수집하며 기존 관련 unit의 문서 검증을 사용합니다. 실제 UX/출력 수용은 별도 재감사 인계입니다. 이 변경은 제품 편집기나 block 등록 코드가 아닙니다.

STARTER-REFERENCE01의 한 번 보완이며 같은 문제가 다시 발생하면 실패로 동결합니다. 실패 원장은 editor-missing-starter-data-20261014/submission-26fb948c4dd64f7abf96c255baca473a.json입니다.
