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

## 5. 제출 task 재적층

한 task의 새 제출 SHA를 기준으로 이미 제출된 후속 task를 다시 쌓아야 할 때는 후속 task의 소유 Worktree에서 `task-restack`을 사용합니다. 기준은 branch 이름보다 검토한 commit SHA를 지정하는 편이 안전합니다.

```bash
make task-restack \
  TASK=editor-lifecycle-e2e \
  NEW_BASE_REF=<new-submitted-sha>
```

하네스는 다음 조건을 모두 강제합니다.

1. task별 작업 잠금으로 `resubmit`·`restack`·`integrate`를 직렬화한 뒤, task가 `submitted` 상태이고 현재 Worktree와 branch의 소유자가 일치하는지 다시 확인합니다. 잠금에는 host·PID·process 시작 식별자를 기록하며 같은 host에서 종료된 process의 stale 잠금만 안전하게 회수합니다.
2. Worktree가 깨끗하고 HEAD가 기록된 submitted SHA와 정확히 같아야 합니다.
3. 새 기준 commit은 기존 base SHA의 후손이어야 하며 기존 submitted SHA를 이미 포함하지 않아야 합니다.
4. 기존 base 이후 task commit만 새 기준 위에 rebase합니다. 충돌·scope·profile 검증 실패 또는 metadata commit 전 중단 신호에는 기존 submitted SHA로 원상복구하고, 원자 metadata 기록이 끝난 뒤 받은 신호에는 기록된 새 base·submitted SHA와 HEAD를 함께 유지합니다.
5. 새 기준 대비 변경이 기존 claim PATHS 안에만 있는지 확인하고 원래 submission profile을 다시 통과해야 합니다.
6. 성공할 때만 `base_sha`와 `submitted_sha`를 원자적으로 갱신하며 직전 base·submitted SHA, 재적층 시각과 누적 이력을 metadata에 남깁니다.

수동 rebase 뒤 coordination metadata를 고치거나, scope 검사를 피하려고 후속 task에 선행 task의 PATHS를 추가해서는 안 됩니다.

선행 작업을 통합하면서 후속 task의 이전 commit 역사가 중복되어 일반 rebase가 불필요한 충돌을 만들 때는 `task-restack-squash`를 사용합니다.

```bash
make task-restack-squash \
  TASK=editor-lifecycle-e2e \
  NEW_BASE_REF=<descendant-base-sha>
```

이 명령은 기존 base와 검증된 submitted SHA 사이의 **최종 tree delta**만 새 base에 3-way 적용하고, 하네스가 단일 commit을 만듭니다. 새 base는 기존 base의 후손이어야 하며, 기존 submitted SHA를 이미 포함하면 실패합니다. 새 base 자체의 변경은 task delta로 재제출하지 않습니다.

소유 PATHS 범위, 기존 submission profile, task 잠금, metadata ancestry 검사는 일반 `task-restack`과 동일하게 유지됩니다. 충돌·scope 위반·profile 실패·metadata commit 전 중단 신호에서는 HEAD와 index·worktree를 이전 submitted SHA로 원자적 복구합니다. 성공할 때만 base/submitted SHA와 이전 SHA, 재적층 시각, 누적 이력을 갱신합니다.

### 의미 충돌 task 교체

최종 tree delta 자체가 통합된 선행 작업을 중복하거나, 자동 3-way 적용으로 의미를 판단할 수 없으면 충돌을 자동 해결하지 않습니다. 검토한 새 base에서 빈 Codex-managed worktree와 명시적 branch를 만든 뒤 submitted task를 교체합니다.

```bash
make task-replace-submitted \
  TASK=editor-lifecycle-e2e-v2 \
  SUPERSEDES=editor-lifecycle-e2e \
  BASE_REF=<reviewed-base-sha>
```

하네스는 다음을 하나의 coordination mutex 트랜잭션으로 강제합니다.

1. 기존 task가 `submitted`이고, 소유 worktree·branch·HEAD가 metadata와 일치하며 worktree가 clean인지 재검증합니다.
2. 새 task는 별도 clean worktree의 현재 HEAD 또는 `BASE_REF`에서 시작하며, 기존 task의 `PATHS`·`AREAS`·`PROFILE`을 정확히 상속합니다. 범위를 넓히거나 profile을 낮출 수 없습니다.
3. 기존 active metadata는 `superseded` history로 이동하고 `superseded_by`·`superseded_at`을 남기며, 이전 worktree·branch·commit은 수정하거나 삭제하지 않습니다.
4. overlap 해제와 새 active metadata 생성은 함께 commit됩니다. 검증 실패나 commit 중단 신호에서는 새 metadata를 남기지 않고 기존 task를 `submitted`로 원상복구합니다.

교체 명령은 코드 delta를 복사하지 않습니다. 새 task에서 의미가 확인된 최소 변경만 다시 구현한 뒤 일반 `task-submit`으로 전체 상속 profile을 통과해야 합니다. 수동 cherry-pick·metadata 수정·claim 확장은 허용하지 않습니다.

## 6. Local 통합

Local 통합 채팅에서 실행합니다.

```bash
make task-integrate \
  TASK=editor-inline-toolbar \
  INTEGRATION_TASK=integration-20260820
```

하네스는 제출 Worktree의 존재와 clean 상태, 기준 ancestry, 제출 commit을 확인합니다. 충돌 사전검사 후 임시 merge를 만들고 Docker profile gate를 실행합니다. 성공할 때만 merge commit을 만들고 task lease를 history의 `integrated` 상태로 이동합니다.

충돌이나 gate 실패 시 통합 commit은 생성되지 않습니다. 공유 스키마·Provider·route·CSS 의미 충돌은 통합 담당자가 범위를 재배정한 뒤 새 제출로 해결합니다.

서로 기능적으로 의존해 개별 임시 merge만으로는 제품 gate가 성립하지 않지만, claim한 PATHS와 AREAS는 겹치지 않는 submitted task 2개 이상은 한 번에 검증할 수 있습니다.

```bash
make task-integrate-batch \
  TASKS=editor-pointer-controls,editor-lifecycle-e2e,page-kit-manifest \
  INTEGRATION_TASK=integration-20260820
```

batch 통합은 task ID를 정규화해 중복을 거부하고, 모든 제출 metadata·소유 worktree·branch·HEAD·claim 비중첩을 잠근 상태에서 재검증합니다. 충돌 없는 하나의 임시 merge 위에서 포함된 profile 중 가장 강한 gate를 정확히 한 번 실행합니다. gate·Git commit·모든 task의 `integrated` history 기록이 모두 성공해야 완료되며, 실패나 종료 신호가 발생하면 main HEAD와 active `submitted` metadata를 함께 원복합니다. 모든 history 기록이 이미 완료된 뒤 종료된 경우에는 commit과 완결된 history를 함께 보존합니다.

batch는 충돌을 덮거나 검증을 줄이는 수단이 아닙니다. claim이 겹치거나 독립적으로 제출되지 않은 변경은 범위를 재배정하고 다시 제출합니다.

## 7. 전체 검증과 릴리스

모든 구현 task가 통합되어 active task가 통합 task 하나만 남았을 때 실행합니다.

```bash
make integration-verify TASK=integration-20260820
make release-package TASK=integration-20260820
make deploy-staging TASK=integration-20260820
make smoke-staging TASK=integration-20260820
make integration-finish TASK=integration-20260820
```

`integration-verify`는 전체 `quality-gate`를 실행하고 검증 SHA를 기록합니다. 이후 HEAD 또는 tracked/untracked 상태가 바뀌면 release guard가 실패합니다. 변경을 반영한 뒤 전체 검증을 다시 실행해야 합니다.

## 8. 취소와 보존

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
| 제출 task의 기준 SHA 변경 | 소유 Worktree에서 `task-restack TASK=<id> NEW_BASE_REF=<sha>`를 실행합니다. 중복 commit 역사 때문에 rebase가 충돌하면 `task-restack-squash`로 최종 delta만 재적층합니다. 최종 delta도 의미 충돌이면 `task-replace-submitted`로 새 task에 claim을 원자적 이관합니다. |
| profile gate 실패 | 제출 Worktree에서 수정 후 다시 submit합니다. |
| runtime guard 실패 | 기본 Local의 integration+runtime task에서 `TASK=`를 지정합니다. |
| release guard 실패 | active task, dirty 상태, 검증 SHA를 확인하고 `integration-verify`를 재실행합니다. |

하네스 상태를 수동 편집하거나 `.git/g7pb-coordination-v1`을 삭제해 lease를 우회하지 않습니다.
