# 온라인 작업 사이트 배포

대상: https://www.g7devops.com · 관리 진입: /admin/page-builder · 개발 버전: 0.37.0-dev.20261014.

2026-10-14 사용자가 JS/CSS 용량 차단 폐기와 현재 구현의 커밋·푸시·온라인 배포를 지시했다. 새 기능이나 테마·코어 변경, 기존 문서 전환, 확대 E2E/UX 감사는 추가하지 않는다. 기존 0.36.0 배포의 내용을 덮어 같은 버전으로 주장하지 않으며 개발 버전으로 구별한다.

## 확인된 기존 차단과 한 번의 보완

용량 정책 7파일 제출 ceb51e8901b68cd0aea5ed0d7cd175e7aa79a5ad의 첫 정식 통합에서 module-assets가 실패했다. JS에서 분리된 builtin-v3 JSON의 원본/산출물은 일치했고 gzip 32,154바이트가 종전 30,000바이트 자산 예산을 초과한 것이 원인이었다. 원본 불일치나 문서 검증 실패가 아니다. 첫 통합 실패는 검사 원장에 보존하고, 구현 인계로 18dc288d55139f7a3093ad8d3cdb217fd947b383에 통합했다. 이것을 제품 수용 성공으로 간주하지 않는다.

후속 정확한 8파일에서 정적 구성 자산 byte 차단만 경고로 전환하고 기존 진입점 시험의 같은 assertion도 실측으로 맞춘다. 원본 일치·고유 버전 경로·의존성 경계·문서 입력 한도는 유지한다. 3개 버전 파일과 변경 이력을 일치시킨다. 새로운 최적화 기능이나 브라우저 시나리오를 추가하지 않는다.

## 판정 경계

현재까지의 전체 편집기 소스·통합과 한계는 [잔여 구현 인계](2026-10-14-editor-remaining-implementation.md)를 따른다. 과거 공개 JS 초과 기록은 보존하며 현재는 경고다. 정책 관련 기존 검사와 공식 패키지/배포 guard 및 최소 smoke만 사용한다. 현재 문서를 작성한 시점에는 후속 제출·푸시·원격 적용 전이며, 실제 배포 성공은 원격 BUILD-INFO·artifact checksum·공식 smoke 결과로 별도 확인한다.

## 실제 배포 완료

- 제출 b3037c7aef2b5c19d0f4b39488412d3feee35215, 통합/푸시/배포 SHA a84b8eb4edfffa2f0aecb90f39605624a7394c39. origin/main 푸시 성공을 확인했다.
- 공식 integration-verify는 base 40a3dd708a053887627c833950aa1d429e9dc02c의 이번 변경 12파일만 대상으로 scoped 17개 gate를 완료했다. 전체 제품 E2E/UX 감사가 아니다. 정책 관련 합성 18개·planner 82개·기존 Inter 3개·진입점 빌드 2개·IP1 단위 17개/기존 브라우저 9개·기존 자산 로딩/캐시 브라우저 2개 및 타입/구조·버전·자산 검사를 사용했다. 기존 runtime 판정이 재사용 불가로 보고한 검사만 공식 계획대로 실행했고 새 시나리오나 전체 coverage를 추가하지 않았다.
- production 자산은 입력과 전체 dist가 같은 fingerprint c40bc65e2098c72632e40701e2409dc3a7efcb0fbdb76fffc4acc62f7c45ac7d를 재사용했다. 불필요한 전체 빌드를 하지 않았다.
- 패키지: output/releases/g7-page-builder-v0.37.0-dev.20261014-a84b8eb4edff.tar.gz.
- artifact SHA256: 814e5a374006ca42175e8ae34ab08af1136b28d4163f810f1e9f798b27d9cfe2.
- 공식 make deploy-staging 결과: target g7devops / /home/g7devops/public_html / https://www.g7devops.com, smoke=passed. 원격 BUILD-INFO의 git_commit/validated_commit=a84b8eb4edfffa2f0aecb90f39605624a7394c39와 version=0.37.0-dev.20261014를 다시 읽어 확인했다.
- 최소 smoke는 서버/관리 진입·기존 9자산·원격 checksum·활성/registry/route/migration/canonical origin을 확인했다. 추가로 정밀 편집기의 page-builder-structure.iife.js·page-builder-structure.css·data/builtin-v3-B67l0reO.json의 실제 자산 URL이 모두 HTTP 200이었다. 이것을 인증된 작성/저장/발행 UX 성공으로 부풀리지 않는다.
- 배포 receipt: .runtime/harness/deployments/3d6e03599995afa3a901-814e5a374006ca42175e8ae34ab08af1136b28d4163f810f1e9f798b27d9cfe2.json, phase=smoked. 기존 원격 rollback 사본은 공식 배포 경로로 보존하며 삭제하지 않았다.
- make integration-finish TASK=integration-online-worksite-20261014는 RELEASE_OK / FINISHED로 종료했다.

이번 문서 후속 커밋은 배포 이후의 기록이다. 배포 제품 SHA를 이 문서 커밋 SHA로 바꿔 주장하거나 문서만 반영하려고 제품을 다시 배포하지 않는다.

## 이어갈 기존 범위

IP7~9의 소스 구현은 유지하고 아직 확인하지 않은 실제 데이터·미디어·복원·저장/재열기/발행·세 폭 UI/UX의 수용 판단만 기존 인계로 남긴다. IP10의 전체 제품 수용은 계획 상태다. 사용자 지시대로 추가 감사 실행은 확대하지 않고 필요성 보고로 유지하며, 기존 문서 처리는 별도 독립 프로세스다. 이번 배포를 근거로 기능을 새로 보태거나 미확인을 완료 처리하지 않는다.
