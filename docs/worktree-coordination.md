# Worktree coordination harness

## 목적

여러 Codex 채팅이 같은 저장소를 동시에 수정할 때 파일 덮어쓰기뿐 아니라 merge 경쟁, migration 번호 충돌, 고정 Docker runtime 오검증을 차단합니다. Git worktree는 파일 checkout을 분리하지만 병합과 단일 `g7pb-dev` runtime을 자동 직렬화하지 않으므로 이 저장소 하네스가 그 경계를 담당합니다.

coordination 상태는 모든 worktree가 공유하는 Git common directory의 `.git/g7pb-coordination-v1`에 저장합니다. 제품 커밋과 배포 패키지에는 포함하지 않습니다. `coord-status`는 상태 파일을 만들거나 mtime을 갱신하지 않는 읽기 전용 명령입니다.

## 강제 원칙

1. 작업 task는 깨끗한 기준 SHA에서 시작합니다.
2. task마다 수정 가능한 저장소 상대 path prefix를 정확히 claim합니다.
3. 같은 prefix 또는 상·하위 prefix를 다른 task가 claim하면 시작을 거부합니다.
4. `integration`, `runtime`, `migration`, `shared-contract`, `version`은 독점 AREA입니다.
5. Worktree task는 범위검사와 지정 profile 검증을 통과해야 자동 커밋·제출됩니다.
6. 통합은 기본 Local worktree의 integration task만 수행합니다.
7. 통합 전 `git merge-tree --write-tree --messages`로 충돌을 확인하고, `--no-commit` 임시 병합 상태에서 profile gate를 다시 실행합니다.
8. 검증 실패 시 merge를 abort하며 자동으로 의미 충돌을 해결하지 않습니다.
9. 모든 task 통합 뒤 전체 `quality-gate`를 통과한 HEAD만 패키징·스테이징할 수 있습니다.
10. dirty/untracked 파일이나 미통합 커밋이 있는 task lease는 강제로 해제하지 않습니다.

## 작업 profile

| Profile | Worktree 제출 검증 | Local 통합 검증 |
|---|---|---|
| `frontend` | Node 24, typecheck, Vitest unit | Docker `quality-frontend` |
| `php` | PHP 8.5, `composer check` | Docker `quality-php` |
| `mixed` | PHP와 Frontend 제출 검증 | Docker `dev-check` |
| `g7` | 독립 PHP gate | 설치된 G7의 `quality-g7` |
| `docs` | version, boundary, coordination test | coordination + frontend 정책 gate |
| `full` | PHP와 Frontend 제출 검증 | 전체 `quality-gate` |

Worktree의 Node는 반드시 24여야 합니다. Codex Local Environment setup이나 별도 version manager로 Node 24와 `npm ci`, `composer install`을 준비합니다. Worktree가 고정 Docker 컨테이너를 빌려 쓰는 방식은 허용하지 않습니다.

## 1. Local 통합 task 시작

기본 Local checkout이 깨끗할 때 한 번 시작합니다.

```bash
make coord-start \
  TASK=integration-20260820 \
  AREAS=integration,runtime,version \
  PROFILE=full
```

통합 task는 직접 제품 코드를 작성하지 않으므로 보통 `PATHS`가 없습니다. 통합 중 별도의 버전·문서 수정이 필요하면 시작할 때 해당 파일 prefix를 명시하거나 별도 task로 처리합니다.

## 2. Worktree 구현 task 시작

Codex 새 채팅에서 `Worktree`를 선택하고 같은 깨끗한 기준 브랜치에서 시작합니다. managed worktree의 detached HEAD는 하네스가 `codex/<task>` 브랜치로 전환합니다.

```bash
make coord-start \
  TASK=editor-inline-toolbar \
  PATHS=resources/js/editor,resources/css/page-builder.css,tests/Unit/puckEditorSurface.test.tsx \
  PROFILE=frontend
```

Migration이나 공개 계약을 수정하는 작업은 독점 AREA를 추가합니다.

```bash
make coord-start \
  TASK=block-pack-storage \
  PATHS=src/Domain/Blocks,src/Application/Blocks,database/migrations,tests/UnitPhp \
  AREAS=migration,shared-contract \
  PROFILE=php
```

PATHS는 glob이 아니라 파일 또는 디렉터리 prefix입니다. 공백, 절대경로, `..`, `*`, `?`는 허용하지 않습니다.

## 3. 작업 중 상태와 범위 확인

```bash
make coord-status
make coord-status HISTORY=1
make coord-check TASK=editor-inline-toolbar
```

`coord-check`는 task 기준 SHA부터 현재 working tree까지의 커밋·staged·unstaged·untracked 파일을 모두 검사합니다. claim 밖 파일이 하나라도 있으면 실패합니다.

## 4. 자동 제출

```bash
make task-submit TASK=editor-inline-toolbar
```

다음 순서가 자동 실행됩니다.

1. 소유 path 검사
2. profile별 Worktree gate
3. gate가 만든 추가 변경을 포함한 재검사
4. 허용된 변경 전체 stage
5. `task(<id>): submit worktree changes` 커밋
6. 제출 SHA와 시각 기록

제출 뒤 Worktree는 깨끗해야 합니다. 제출된 task는 수동 release할 수 없고 통합해야 합니다.

## 5. Local 순차 통합

Local 통합 채팅에서 실행합니다.

```bash
make task-integrate \
  TASK=editor-inline-toolbar \
  INTEGRATION_TASK=integration-20260820
```

하네스는 제출 Worktree의 존재와 clean 상태, 기준 ancestry, 제출 commit을 확인합니다. 충돌 사전검사 후 임시 merge를 만들고 Docker profile gate를 실행합니다. 성공할 때만 merge commit을 만들고 task lease를 history의 `integrated` 상태로 이동합니다.

충돌이나 gate 실패 시 통합 commit은 생성되지 않습니다. 공유 스키마·Provider·route·CSS 의미 충돌은 통합 담당자가 범위를 재배정한 뒤 새 제출로 해결합니다.

## 6. 전체 검증과 릴리스

모든 구현 task가 통합되어 active task가 통합 task 하나만 남았을 때 실행합니다.

```bash
make integration-verify TASK=integration-20260820
make release-package TASK=integration-20260820
make deploy-staging TASK=integration-20260820
make smoke-staging TASK=integration-20260820
make integration-finish TASK=integration-20260820
```

`integration-verify`는 전체 `quality-gate`를 실행하고 검증 SHA를 기록합니다. 이후 HEAD 또는 tracked/untracked 상태가 바뀌면 release guard가 실패합니다. 변경을 반영한 뒤 전체 검증을 다시 실행해야 합니다.

## 7. 취소와 보존

아무 변경도 만들지 않은 active task만 취소할 수 있습니다.

```bash
make coord-release TASK=unused-task
```

다음 상태에서는 lease를 해제하지 않습니다.

- dirty 또는 untracked 파일 존재
- 기준 SHA 이후 commit 존재
- 이미 submitted 상태
- 다른 worktree에서 소유 task를 release하려는 경우

task 채팅을 먼저 archive하면 Codex-managed worktree가 정리될 수 있습니다. 통합 history가 기록된 뒤 archive합니다. Worktree가 사라진 submitted task는 Codex snapshot을 복구한 후 통합합니다.

## 장애 처리

| 증상 | 처리 |
|---|---|
| PATHS/AREA 충돌 | 기존 task를 통합·취소하거나 경계를 다시 나눕니다. |
| 범위 밖 변경 | 해당 변경을 되돌리지 말고 소유 task를 확인해 이관합니다. |
| merge-tree 충돌 | 자동 해결하지 않고 계약 담당 task를 먼저 통합합니다. |
| profile gate 실패 | 제출 Worktree에서 수정 후 다시 submit합니다. |
| runtime guard 실패 | 기본 Local의 integration+runtime task에서 `TASK=`를 지정합니다. |
| release guard 실패 | active task, dirty 상태, 검증 SHA를 확인하고 `integration-verify`를 재실행합니다. |

하네스 상태를 수동 편집하거나 `.git/g7pb-coordination-v1`을 삭제해 lease를 우회하지 않습니다.
