# 버전 및 변경 이력 정책

## 기준

이 프로젝트는 [Semantic Versioning 2.0.0](https://semver.org/lang/ko/)과
[Keep a Changelog 1.1.0](https://keepachangelog.com/ko/1.1.0/)을 따릅니다.
G7 7.0.7의 확장 changelog 규정과 동일하게 한국어, ISO 8601 날짜(`YYYY-MM-DD`),
역순 버전 배치와 `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
카테고리만 사용합니다.

## 공개 API

SemVer 판단에서 다음을 공개 API로 봅니다.

- `module.json`의 identifier·의존성·지원 G7 버전
- `/api/modules/jiwonpapa-page_builder/**`, `/pages/{slug}`, 모듈 user route/layout과 홈 연결 동작
- `PageBuilderDocument` JSON Schema와 canonical block type·props
- 모듈이 공개하는 PHP Contract와 발행·미리보기 응답 형식
- 이미 저장된 문서·revision·publication을 읽고 재발행하는 호환성

편집기 내부 컴포넌트, 빌드 스크립트와 테스트 전용 selector는 공개 API가 아닙니다.
다만 사용자 동작이나 배포 호환성에 영향을 주면 changelog에는 기록합니다.

## 버전 선택

- `MAJOR`: 1.0.0 이후 공개 API의 비호환 변경
- `MINOR`: 하위 호환 기능 추가
- `PATCH`: 하위 호환 버그·보안·문서·배포 도구 수정
- `0.y.z`: 초기 개발 단계입니다. 비호환 공개 계약 변경은 `MINOR`, 호환 수정은 `PATCH`를 올립니다.
- 정식 배포 전 검증판은 `0.6.0-alpha.1`, `0.6.0-rc.1`처럼 표기합니다.
- 빌드 메타데이터는 진단용으로만 쓰며 버전 우선순위를 바꾸지 않습니다.

한 번 배포한 버전의 내용은 바꾸지 않습니다. 변경이 필요하면 반드시 새 버전을 만듭니다.
G7 최소 요구 버전 `g7_version`은 제품 버전과 별개이며 실제 사용 API의 최초 G7 버전을 하한으로 둡니다.

## 단일 버전 원본

`module.json.version`이 제품 버전의 원본입니다. 다음 값은 항상 같아야 합니다.

- `module.json.version`
- `package.json.version`
- `package-lock.json.version`
- `package-lock.json.packages[""].version`

G7 관리 화면은 module manifest의 버전과 모듈 루트 `CHANGELOG.md`를 표시합니다.
릴리스 ZIP에도 두 파일을 모두 포함합니다.

## 변경 이력 작성

개발 중 사용자에게 의미 있는 변경은 `Unreleased`에 바로 기록합니다. 커밋 로그를 그대로 복사하지 않습니다.
릴리스할 때 다음 순서를 따릅니다.

1. 변경 성격에 맞는 다음 SemVer를 결정합니다.
2. `Unreleased` 항목을 `## [X.Y.Z] - YYYY-MM-DD` 아래로 이동합니다.
3. 네 버전 원본을 같은 값으로 갱신합니다.
4. `npm run check:version`과 전체 품질 게이트를 통과시킵니다.
5. 깨끗한 커밋에서 릴리스 패키지를 생성합니다.
6. 공개 릴리스에는 동일 버전의 annotated Git tag `vX.Y.Z`를 사용합니다.

릴리스 패키징은 `Unreleased`에 남은 항목이 있거나 현재 manifest 버전의 changelog 섹션이 없으면 실패합니다.
심각한 문제로 회수한 버전은 `## [X.Y.Z] - YYYY-MM-DD [YANKED]`로 남깁니다.
