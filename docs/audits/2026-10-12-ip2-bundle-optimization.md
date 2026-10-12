# IP2 통합 선행 번들 최적화

상태: 구현 및 검증 중. IP2 완료·운영 배포 증거가 아니다.

## 승인과 범위

- 사용자 승인: 용량 기준·기능·의존성 버전을 유지하는 별도 번들 최적화.
- 기준 SHA: `85c353a01a5d424f31716d8a156dc0a5e05dfbef`.
- task: `ip2-bundle-optimization-20261012`, `PROFILE=scoped`.
- 소유 파일: `vite.config.ts`, `tests/Unit/catalogBundle.test.ts`, 이 기록.
- 카탈로그 JSON·블록/프리셋·품질 승인 원장·의존성·용량 기준은 변경하지 않는다.
- CHANGELOG와 IP2 진척 원장은 기존 IP2 task 소유자에게 인계한다.

## 원인과 변경

같은 편집기 JS(1,771,850 bytes, SHA-256 `15d3c74d65e83682d168f5b7ed229b944f9b161943a95ca6de83340f77803949`)를 Node 24.19.0으로 측정했다. macOS의 zlib 1.2.12는 gzip 508,054 bytes, Linux 검증 환경의 zlib 1.3.2.1-motley-3246f1b는 510,030 bytes였다. 기존 508,500 bytes 기준은 유지한다. 검사 환경·압축 옵션을 바꾸지 않는다.

편집기 빌드에서 내장 manifest의 반복 문자열과 동일한 키 순서의 객체 생성 코드를 공유한다. 객체/배열 인스턴스는 매번 새로 만들고 원본 JSON의 모든 필드·값·순서를 보존한다. 일반 ESM 내보내기로 미사용 항목 제거를 유지하며 브라우저에 별도 디코더·eval·네트워크 요청을 넣지 않는다. 다른 JSON과 개발 서버에는 적용하지 않는다. 새 파일이나 의존성 없이 기존 빌드 설정만 사용하므로 빌드 입력 지문에 포함된다.

## 검증

- 동등성: 실제 manifest 전체의 직렬화·각 export, 객체/배열 참조 분리, `__proto__` 소유 필드, 특수 문자, 숫자, 결정성, 잘못된 입력 거부.
- 기존 회귀: Puck history 단위 검사, 타입 검사, 구조 검사, production build·asset 검사, Linux gzip 예산 검사.
- 실제 동작: 기존 `editorInspectorUx.spec.ts` desktop의 Inspector 변경·Undo/Redo·저장·재열기. 통합 runtime lease에서 실행한다.
- 최종 측정·실행 결과·커밋은 검증 후 기록한다.
