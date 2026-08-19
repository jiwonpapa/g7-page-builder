# G7 Page Builder

그누보드7의 공개 JSON UI 편집 계약을 이용해 일반 페이지를 블록 방식으로 제작하는 독립 모듈입니다.

## 결정된 방향

- G7 레이아웃 편집기를 복제하지 않습니다.
- G7 코어에는 범용 `JsonUiDocumentEditor` 공개 API만 제안합니다.
- 이 저장소는 페이지 문서, 블록 프리셋, 발행, 유료 Block Pack과 AI 기능을 소유합니다.
- Page Builder 원본 문서를 G7 JSON UI로 컴파일합니다.
- `sirsoft-page`의 공개 계약에만 의존하며 Model·테이블을 직접 사용하지 않습니다.

```text
PageBuilderDocument
        |
        v
Block Compiler
        |
        v
G7 JSON UI document
        |
        v
Public JsonUiFragmentRenderer
```

## 현재 상태

초기 아키텍처 골격입니다. 현재 G7에는 필요한 Page Document/Block Registry 공개 계약이 아직 없으므로 판매 가능한 기능 구현 전 해당 계약을 먼저 확정합니다.

## 저장소 역할

| 저장소 | 소유 범위 |
|---|---|
| `gnuboard7` | 범용 문서 편집기·JSON UI 렌더링 공개 계약 |
| `g7-page-builder` | 페이지 문서·Block Pack·발행·AI·라이선스 |

## 개발 환경

- PHP 8.2+
- Laravel 12 host
- React 19.2
- Vite 7
- TypeScript strict
- dnd-kit, Zustand, Immer
- Vitest, PHPUnit 11, Playwright

## 다음 단계

1. G7 코어 공개 계약 초안 확정
2. `PageBuilderDocument v1` 양방향 검증
3. Page Document Provider 구현
4. Hero·Features·Gallery·Contact·Product Grid 5개 POC 블록
5. 생성→미리보기→발행 E2E

자세한 내용은 [아키텍처](docs/architecture.md)와 [코어 계약 제안](docs/core-contracts.md)을 참고합니다.

