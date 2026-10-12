# IP2 통합 선행 번들 최적화

상태: 승인된 번들 최적화 구현·통합·관련 검증 완료. IP2 전체 완료·운영 배포 증거가 아니다.

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
- 제출 `ef7c5ce3abc9950aeec1436a187a3bd9caa46e72`, Local 통합 `0ad15fdfe1ddd4b40ac9822d83fb58180f348894`.
- 동등성 5개·기존 Puck 이력 4개·TypeScript 검사 통과. 동등성 시험은 실제 Vite JSON 파이프라인과 미사용 export 제거·다른 JSON 보존도 확인한다.
- production 8개 번들, asset manifest·공식 Store 6개 검사, Linux 전체 frontend budget 검사 통과. 최종 편집기 raw 1,729,505 bytes, gzip **508,253 / 508,500 bytes**. raw 42,345 bytes·gzip 1,777 bytes 감소이며 한도 여유는 247 bytes다. 후속 기능 추가 용량까지 확보한 것은 아니다.
- desktop `editorInspectorUx.spec.ts` 2개 통과(16.7초). Inspector·키보드·빠른 Undo/Redo·저장·재열기 동작을 확인했고 page/block Inspector 이미지도 직접 확인했다.
- 브라우저 원본 증거는 Local `output/playwright/gates/integration-ip2-resume-20261012/defd9246db079eb3dbb877a769e188a249dcbafc751aa8cd8b9521a397cf660f/0ec869e6a82c452fb8729eba27ba7654/`의 `results.json`과 `results/**/page-inspector.png`, `block-inspector.png`에 있다.
- 첫 동등성 시험은 jsdom과 esbuild의 서로 다른 Uint8Array realm 때문에 실행 전 실패하여 빌드 도구 시험을 Node 환경으로 지정했다. Vite 가상 entry가 lib 경로로 정규화되던 시험 설정은 명시적 Rollup input으로 바로잡았다. 제품 동작·검사 기준을 변경해 통과시킨 것이 아니다.

## IP2 전체 검증과 구분

후속 IP2 임시 통합은 하네스 463개·프런트엔드 1,016개·PHP/프런트 커버리지·전체 썸네일 현재 source·번들 한도를 통과했다. 이후 로컬 G7 모듈 등록 버전 0.35.1 / 파일 버전 0.36.0 불일치에서 멈췄다. 기존 `environment sync --runtime docker --task integration-ip2-resume-20261012 --paths module.json --apply`로 로컬 등록 메타데이터와 캐시를 동기화한 뒤 `make dev-verify`가 통과했다. 소스·버전 파일·운영 서버는 변경하지 않았다.

동기화 후 전체 검증은 G7 정적 검사와 통합 시험 73개/632 assertions도 통과했으나, 제품 브라우저에서 Card 품질·레이아웃 측정, 카탈로그 개수, 현재 활성 테마의 Site Shell 호환 전제와 관련된 별도 실패가 확인됐다. 이 파일은 해당 실패를 해결하거나 IP2를 완료 처리하지 않는다. 상세 결과는 IP2 소유 감사 기록으로 인계한다.

Playwright 스킬에 따라 실제 브라우저 증거를 확인했으며, write-page 원칙에 따라 번들 최적화 완료·IP2 수용·배포를 별도 상태로 기록했다. 품질 승인 원장·제품 기능·의존성·버전·용량 기준에는 변경이 없다.
