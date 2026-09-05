"""Task coordination over the existing Git worktrees and v1 TSV state.

All product validation is delegated to the common planner CLI. This module owns
only task/lease transitions, not a second gate or dependency policy.
"""
from __future__ import annotations

import argparse
from contextlib import nullcontext
import os
from pathlib import Path, PurePosixPath
import signal
import sys

from .gitops import Git, GitTransaction, execute
from .state import CoordError, MetadataTransaction, Store, defer_interrupts, new_task, require, task_id, timestamp


PROFILES = {"scoped", "frontend", "php", "mixed", "g7", "docs", "full"}
AREAS = {"integration", "runtime", "migration", "shared-contract", "version"}
COMMANDS = ("claim status check submit resubmit restack restack-squash replace-active replace-submitted "
            "replace-submitted-expanded integrate integrate-scoped integrate-batch verify "
            "finish release runtime-guard release-guard").split()


class Interrupted(CoordError):
    def __init__(self, code: int = 143) -> None:
        super().__init__("작업이 중단되었습니다. 미완료 상태를 복구합니다.")
        self.code = code


def note(message: str) -> None:
    print(f"coord-harness: {message}", flush=True)


def csv(value: str) -> list[str]:
    return value.split(",") if value else []


def overlaps(left: str, right: str) -> bool:
    return any(a == b or a.startswith(b + "/") or b.startswith(a + "/")
               for a in csv(left) for b in csv(right))


def validate_paths(value: str, profile: str, root: Path) -> None:
    paths = csv(value)
    require(len(paths) == len(set(paths)), "PATHS에 중복 파일을 허용하지 않습니다.")
    for path in paths:
        require(path and not path.startswith("/") and path not in (".", "..")
                and ".." not in PurePosixPath(path).parts and not any(c.isspace() for c in path)
                and not any(c in path for c in "*?[\\") and not path.startswith("-"),
                f"PATHS에는 공백·glob·상위경로가 없는 저장소 상대 prefix만 허용합니다: {path}")
        require((root / path).resolve().is_relative_to(root.resolve()), f"PATHS가 저장소를 벗어납니다: {path}")
    if profile == "scoped":
        require(0 < len(paths) <= 24, "scoped PROFILE은 1~24개의 정확한 파일 PATHS가 필요합니다.")
        for path in paths:
            require(not (root / path).is_dir() and not path.endswith("/"),
                    f"scoped PROFILE은 디렉터리 PATHS를 허용하지 않습니다: {path}")


def owned_paths(git: Git, meta: dict[str, str], base: str | None = None) -> None:
    validate_paths(meta["paths"], meta["profile"], git.root)
    bad = [path for path in git.paths(base or meta["base_sha"])
           if not any(path == prefix or (meta["profile"] != "scoped" and path.startswith(prefix + "/"))
                      for prefix in csv(meta["paths"]))]
    for path in bad:
        print(f"OUT_OF_SCOPE\t{path}", file=sys.stderr)
    require(not bad, "claim한 PATHS 밖의 변경이 있어 제출을 중단했습니다.")


def legacy_batch_label(profiles: list[str]) -> str:
    """Retain old reporting/hook labels only; never selects product commands."""
    kinds = set(profiles)
    if kinds == {"harness"}:
        return "harness"
    require("harness" not in kinds, "harness PROFILE은 실제 integration PROFILE과 batch로 섞을 수 없습니다.")
    if "full" in kinds or ("g7" in kinds and kinds != {"g7"}):
        return "full"
    if "mixed" in kinds:
        return "mixed"
    return next(iter(kinds)) if len(kinds) == 1 else "mixed"


class Coordinator:
    def __init__(self, cwd: Path | None = None, runner=execute, *, fixture_root: Path | None = None) -> None:
        self.git = Git(cwd or Path.cwd(), runner)
        self.runner = runner
        default_state = self.git.common / "g7pb-coordination-v1"
        state_root = Path(os.environ.get("G7PB_COORD_STATE_DIR", str(default_state))).resolve()
        self.testing = fixture_root is not None
        if self.testing:
            fixture = fixture_root.resolve()
            controller = Path(__file__).resolve().parents[2]
            require(fixture.is_dir() and self.git.root.is_relative_to(fixture)
                    and self.git.common.is_relative_to(fixture) and state_root.is_relative_to(fixture)
                    and not controller.is_relative_to(fixture) and not fixture.is_relative_to(controller),
                    "테스트 fixture는 controller·실제 Git/state와 분리된 임시 저장소여야 합니다.")
        else:
            require(os.environ.get("G7PB_COORD_TESTING") not in {"1", "true"}
                    and not any(key.startswith("G7PB_COORD_TEST_") and value for key, value in os.environ.items()),
                    "정식 coordination 명령에는 테스트 모드·fault hook을 허용하지 않습니다.")
            require(state_root == default_state.resolve(), "정식 coordination state 경로는 Git common directory에 고정됩니다.")
        self.store = Store(state_root, self.fault)

    def fault(self, name: str) -> None:
        if not self.testing:
            return
        if name.startswith("AFTER_TASK_LOCK_COUNT="):
            key, wanted = "TERMINATE_AFTER_TASK_LOCK_COUNT", name.split("=", 1)[1]
        else:
            key, wanted = name if name.startswith("FAIL_") else "TERMINATE_" + name, "1"
        if os.environ.get("G7PB_COORD_TEST_" + key) == wanted:
            if key.startswith("FAIL_"):
                raise CoordError(f"TEST_MODE {name.lower()} failure")
            raise Interrupted()

    def profile(self, value: str) -> None:
        require(value in PROFILES or (self.testing and value == "harness"), f"지원하지 않는 PROFILE입니다: {value}")

    def owner(self, meta: dict[str, str], status: str | None = None) -> None:
        require(Path(meta["worktree"]).resolve() == self.git.root, "task 소유 worktree가 아닙니다.")
        require(meta["branch"] == self.git.branch(), "task branch가 바뀌었습니다.")
        require(status is None or meta["status"] == status, f"{status} task만 허용합니다: {meta['status']}")

    def integration_owner(self, name: str) -> dict[str, str]:
        meta = self.store.load(name)
        self.owner(meta, "active")
        require(self.git.root == self.git.main, "통합/runtime은 기본 Local worktree에서만 허용합니다.")
        require({"integration", "runtime"} <= set(csv(meta["areas"])), "integration 및 runtime AREA가 필요합니다.")
        return meta

    def conflicts(self, paths: str, areas: str, exclude: str = "", *, unique_owner: bool = False) -> None:
        for _, other in self.store.entries():
            if other["task"] == exclude:
                continue
            require(not overlaps(paths, other["paths"]), f"PATHS가 task {other['task']}와 겹칩니다: {other['paths']}")
            require(not set(csv(areas)) & set(csv(other["areas"])), f"AREAS가 task {other['task']}와 겹칩니다: {other['areas']}")
            if unique_owner:
                require(other["worktree"] != str(self.git.root) and other["branch"] != self.git.branch(),
                        f"새 worktree 또는 branch를 task {other['task']}가 이미 소유하고 있습니다.")

    def quality(self, phase: str, base: str, *, task: str = "", head: str = "", areas: str = "",
                profile: str = "scoped", full: bool = False, scoped_hook: bool = False,
                submitted: str = "", tree: str = "", plan=None) -> None:
        if self.testing:
            if phase == "submission":
                self.fault("FAIL_SUBMISSION_PROFILE")
                return
            if phase == "integration":
                self.fault("FAIL_INTEGRATION_PROFILE")
                key = "SCOPED_INTEGRATION_HOOK" if scoped_hook else "INTEGRATION_PROFILE_HOOK"
                args = [base, submitted, task, areas, tree] if scoped_hook else [profile, task, areas]
            else:
                key, args = "SCOPED_VERIFY_HOOK", [base, head, task, areas]
            hook = os.environ.get("G7PB_COORD_TEST_" + key)
            if hook and not full:
                require(os.access(hook, os.X_OK), "TEST_MODE hook is not executable")
                self.runner([hook, *args], self.git.root)
            if phase == "integration":
                self.fault("INTEGRATION_PROFILE")
            return
        controller = Path(__file__).resolve().parents[2] / "scripts/g7pb.py"
        command = [sys.executable, str(controller), "run", "--base", base, "--phase", phase]
        for option, value in (("--head", head), ("--task", task)):
            if value:
                command += [option, value]
        if full:
            command.append("--full")
        if plan is not None:
            from .plan_snapshot import save
            snapshot = self.git.root / ".runtime/harness/plans" / (task + ".json")
            save(self.git.root, snapshot, plan, base=base, head=self.git.head())
            command += ["--plan", str(snapshot)]
        result = self.runner(command, self.git.root, stream=True)
        if result.stdout:
            print(result.stdout.decode("utf-8", "replace"), end="", flush=True)

    def claim(self, args) -> None:
        task_id(args.task)
        self.profile(args.profile)
        validate_paths(args.paths, args.profile, self.git.root)
        require(set(csv(args.areas)) <= AREAS, "지원하지 않는 독점 AREA입니다.")
        require(args.paths or args.areas, "PATHS 또는 독점 AREAS 중 하나는 필요합니다.")
        require(self.git.clean(), "깨끗한 worktree에서만 task를 시작할 수 있습니다.")
        base = self.git.commit(args.base_ref)
        require(self.git.head() == base, "현재 HEAD와 BASE_REF가 다릅니다.")
        integration = "integration" in csv(args.areas)
        if not self.testing:
            require(integration == (self.git.root == self.git.main), "구현은 별도 worktree, 통합은 기본 Local에서만 시작합니다.")
        with self.store.mutex():
            require(not self.store.path(args.task).exists(), f"이미 활성 task가 있습니다: {args.task}")
            self.conflicts(args.paths, args.areas, unique_owner=not self.testing)
            branch = self.git.branch()
            if not branch:
                branch = f"codex/{args.task}"
                self.git.run("switch", "-c", branch)
            meta = new_task(task=args.task, worktree=str(self.git.root), branch=branch, base_sha=base,
                            paths=args.paths, areas=args.areas, profile=args.profile)
            self.store.save(meta)
        note(f"CLAIMED task={args.task} branch={branch} base={base} paths={args.paths or 'none'} areas={args.areas or 'none'} profile={args.profile}")

    def status(self, args) -> None:
        print("KIND\tTASK\tSTATUS\tPROFILE\tBRANCH\tAREAS\tPATHS\tWORKTREE")
        for history, label in ((False, "ACTIVE"), (True, "HISTORY")):
            if history and not args.history:
                continue
            for _, meta in self.store.entries(history):
                print("\t".join([label, *(meta[key] for key in ("task", "status", "profile", "branch", "areas", "paths", "worktree"))]))

    def check(self, args) -> None:
        meta = self.store.load(args.task)
        self.owner(meta, "active")
        owned_paths(self.git, meta)
        note(f"SCOPE_OK task={args.task}")

    def submit(self, args) -> None:
        self.store.lock(args.task)
        meta = self.store.load(args.task)
        revised = args.command == "resubmit"
        self.owner(meta, "submitted" if revised else "active")
        require(not revised or self.git.head() == meta["submitted_sha"], "재제출 전 HEAD가 기존 submitted SHA와 일치해야 합니다.")
        before = self.git.head()
        owned_paths(self.git, meta)
        self.quality("submission", meta["base_sha"], task=args.task, profile=meta["profile"])
        self.store.unchanged(meta)
        require(self.git.head() == before, "제출 검증 중 task branch HEAD가 변경되었습니다.")
        owned_paths(self.git, meta)
        require(not revised or not self.git.clean(), "재제출할 변경이 없습니다.")
        committed = False
        try:
            if not self.git.clean():
                self.git.run("add", "-A", "--", ".")
                message = args.message or f"task({args.task}): {'revise submitted changes' if revised else 'submit worktree changes'}"
                self.git.run("commit", "-m", message)
            head = self.git.head()
            require(self.git.clean() and head != meta["base_sha"] and self.git.ancestor(meta["base_sha"], head), "제출할 변경 또는 올바른 submitted ancestry가 없습니다.")
            require(not revised or self.git.ancestor(meta["submitted_sha"], head), "재제출 SHA가 이전 제출 SHA의 후손이 아닙니다.")
            with self.store.mutex(), defer_interrupts():
                self.store.unchanged(meta)
                self.store.save(dict(meta, status="submitted", submitted_sha=head, submitted_at=timestamp()))
                committed = True
        except BaseException:
            if not committed and self.git.branch() == meta["branch"] and self.git.head() != before:
                # Retain the user's complete working contents when metadata cannot commit.
                require(self.git.text("rev-parse", "HEAD^") == before, "제출 실패 후 예상 밖 commit이 발견되어 자동 복구를 중단합니다.")
                self.git.run("reset", "--soft", before)
            raise
        note(f"{'RESUBMITTED' if revised else 'SUBMITTED'} task={args.task} sha={head} profile={meta['profile']}")

    def restack(self, args) -> None:
        require(args.new_base_ref, "--new-base-ref가 필요합니다.")
        self.store.lock(args.task)
        meta = self.store.load(args.task)
        self.owner(meta, "submitted")
        self.git.submitted(meta)
        owned_paths(self.git, meta)
        base = self.git.commit(args.new_base_ref)
        require(base != meta["base_sha"] and self.git.ancestor(meta["base_sha"], base), "새 기준은 기존 base와 다른 후손이어야 합니다.")
        require(not self.git.ancestor(meta["submitted_sha"], base), "새 기준 commit에 기존 submitted SHA가 이미 포함되어 있습니다.")
        squash = args.command == "restack-squash"
        with GitTransaction(self.git) as transaction:
            if squash:
                patch = self.git.run("diff", "--binary", "--full-index", "--no-ext-diff", meta["base_sha"], meta["submitted_sha"], "--").stdout
                require(patch, "기존 submitted SHA에 재적층할 최종 task delta가 없습니다.")
                self.git.run("reset", "--hard", base)
                self.git.run("apply", "--index", "--3way", "--whitespace=nowarn", data=patch)
                require(not self.git.text("diff", "--name-only"), "squash delta 적용 후 index와 worktree가 일치하지 않습니다.")
                owned_paths(self.git, meta, base)
                self.git.run("commit", "-m", f"task({args.task}): squash restack submitted delta")
                self.fault("AFTER_RESTACK_SQUASH_COMMIT")
            else:
                self.git.run("rebase", "--onto", base, meta["base_sha"])
            head = self.git.head()
            require(head != base and self.git.ancestor(base, head), "재적층 결과 task delta가 비었습니다.")
            owned_paths(self.git, meta, base)
            self.quality("submission", base, task=args.task, profile=meta["profile"])
            owned_paths(self.git, meta, base)
            require(self.git.head() == head and self.git.clean(), "재적층 검증 중 task worktree가 변경되었습니다.")
            at = timestamp()
            entry = f"{meta['base_sha']}:{meta['submitted_sha']}:{base}:{head}:{at}"
            updated = dict(meta, previous_base_sha=meta["base_sha"], previous_submitted_sha=meta["submitted_sha"],
                           base_sha=base, submitted_sha=head, submitted_at=at, restacked_at=at,
                           restack_history=";".join(filter(None, [meta["restack_history"], entry])))
            with self.store.mutex(), defer_interrupts():
                self.store.unchanged(meta)
                self.store.save(updated)
                transaction.commit()
                self.fault("AFTER_RESTACK_METADATA")
        note(f"{'RESTACKED_SQUASH' if squash else 'RESTACKED'} task={args.task} previous_base={meta['base_sha']} previous={meta['submitted_sha']} base={base} sha={head} profile={meta['profile']}")

    def replace(self, args) -> None:
        task_id(args.task)
        task_id(args.supersedes)
        require(args.task != args.supersedes, "새 task ID와 supersedes task ID는 달라야 합니다.")
        expanded = args.command == "replace-submitted-expanded"
        require(not args.areas and not args.profile and (expanded or not args.paths), "교체는 PATHS·AREAS·PROFILE을 정확히 상속합니다.")
        require(not expanded or args.paths, "승인된 범위확장 교체에는 PATHS가 필요합니다.")
        require(self.git.root != self.git.main and self.git.clean() and self.git.branch(), "깨끗한 별도 새 worktree와 명시적 branch가 필요합니다.")
        base = self.git.commit(args.base_ref)
        require(self.git.head() == base, "현재 HEAD와 BASE_REF가 다릅니다.")
        self.store.lock(args.supersedes)
        self.store.lock(args.task)
        old = self.store.load(args.supersedes)
        require(old["status"] == "submitted", "submitted task만 교체할 수 있습니다.")
        other = self.git.submitted(old)
        require(other.root != self.git.root and other.branch() != self.git.branch(), "기존 submitted task와 다른 새 worktree/branch가 필요합니다.")
        self.profile(old["profile"])
        require(set(csv(old["areas"])) <= AREAS, "기존 AREA가 유효하지 않습니다.")
        owned_paths(other, old)
        paths = args.paths if expanded else old["paths"]
        if expanded:
            require(set(csv(old["paths"])) < set(csv(paths)), "범위확장 PATHS는 기존 PATHS 항목을 정확히 모두 포함하고 새 항목이 있어야 합니다.")
        validate_paths(paths, old["profile"], self.git.root)
        with self.store.mutex():
            self.store.unchanged(old)
            self.git.submitted(old)
            require(self.git.head() == base and self.git.clean(), "새 task worktree가 교체 검증 중 변경되었습니다.")
            require(not self.store.path(args.task).exists(), "새 task ID가 이미 활성 상태입니다.")
            self.conflicts(paths, old["areas"], old["task"], unique_owner=True)
            replacement = new_task(task=args.task, worktree=str(self.git.root), branch=self.git.branch(),
                                   base_sha=base, paths=paths, areas=old["areas"], profile=old["profile"])
            archived = dict(old, status="superseded", superseded_by=args.task, superseded_at=timestamp())
            with defer_interrupts(), MetadataTransaction() as transaction:
                self.fault("FAIL_REPLACE_BEFORE_COMMIT")
                transaction.write(self.store.history_path(old["task"]), archived)
                transaction.delete(self.store.path(old["task"]))
                self.fault("AFTER_REPLACE_ARCHIVE")
                transaction.write(self.store.path(args.task), replacement)
                transaction.commit()
                self.fault("AFTER_REPLACE_METADATA")
        note(f"{'REPLACED_SUBMITTED_EXPANDED' if expanded else 'REPLACED_SUBMITTED'} task={args.task} supersedes={args.supersedes} base={base} paths={paths or 'none'} areas={old['areas'] or 'none'} profile={old['profile']}")

    def replace_active(self, args) -> None:
        from .active_replacement import replace_active
        evidence = replace_active(self, args, owned_paths=owned_paths, validate_paths=validate_paths, allowed_areas=AREAS)
        note(f"REPLACED_ACTIVE task={args.task} supersedes={args.supersedes} base={self.git.head()} evidence={evidence}")

    def integrate(self, args) -> None:
        batch = args.command == "integrate-batch"
        names = sorted(csv(args.tasks)) if batch else [args.task]
        require(not batch or len(names) >= 2, "batch 통합에는 서로 다른 submitted task가 2개 이상 필요합니다.")
        require(len(names) == len(set(names)), "batch TASKS에 중복 ID가 있습니다.")
        for name in names:
            task_id(name)
        require(args.integration_task not in names, "통합 task 자신을 submitted task로 지정할 수 없습니다.")
        self.integration_owner(args.integration_task)
        self.store.lock(args.integration_task)
        owner = self.integration_owner(args.integration_task)
        require(self.git.clean(), "깨끗한 통합 worktree에서만 병합할 수 있습니다.")
        tasks: list[dict[str, str]] = []
        for name in names:
            self.store.lock(name)
            meta = self.store.load(name)
            require(meta["status"] == "submitted", "submitted task만 병합할 수 있습니다.")
            self.profile(meta["profile"])
            other = self.git.submitted(meta, allow_ancestor=not batch)
            if batch or other.root != self.git.root:
                owned_paths(other, meta)
            if batch:
                require(other.root != self.git.root and not self.git.ancestor(meta["submitted_sha"], self.git.head()), "이미 HEAD에 포함되거나 같은 Local인 task는 단일 통합으로 정리하십시오.")
                for previous in tasks:
                    require(not overlaps(meta["paths"], previous["paths"]), "batch task PATHS가 겹칩니다.")
                    require(not set(csv(meta["areas"])) & set(csv(previous["areas"])), "batch task AREAS가 겹칩니다.")
            tasks.append(meta)
        start = self.git.head()
        already = not batch and self.git.ancestor(tasks[0]["submitted_sha"], start)
        label = legacy_batch_label([meta["profile"] for meta in tasks]) if batch else tasks[0]["profile"]
        areas = ",".join(sorted({area for meta in tasks for area in csv(meta["areas"])}))
        expected_tree = ""
        if not already:
            synthetic = start
            for meta in tasks:
                output = self.git.text("merge-tree", "--write-tree", "--messages", synthetic, meta["submitted_sha"])
                expected_tree = output.splitlines()[0]
                self.git.run("cat-file", "-e", expected_tree + "^{tree}")
                if batch:
                    synthetic = self.git.run("commit-tree", expected_tree, "-p", synthetic, "-p", meta["submitted_sha"],
                                             data=f"g7pb batch preflight: {meta['task']}\n".encode()).stdout.decode().strip()
        with (nullcontext(None) if already else GitTransaction(self.git)) as git_transaction:
            if not already:
                self.git.run("merge", "--no-ff", "--no-commit", *(meta["submitted_sha"] for meta in tasks))
                require(self.git.text("write-tree") == expected_tree, "임시 병합 결과가 사전검사 결합 트리와 다릅니다.")
            candidate = self.git.text("write-tree")
            # A task's old base must not pull unrelated prior integrations into this gate.
            self.quality("integration", start, task=args.integration_task, areas=areas, profile=label,
                         scoped_hook=args.command == "integrate-scoped", submitted=tasks[0]["submitted_sha"], tree=candidate)
            require(self.git.head() == start and self.git.text("write-tree") == candidate
                    and not self.git.text("diff", "--name-only"), "통합 검증 중 Local candidate가 변경되었습니다.")
            self.store.unchanged(owner)
            self.integration_owner(args.integration_task)
            for meta in tasks:
                self.store.unchanged(meta)
                self.git.submitted(meta, allow_ancestor=already)
            if not already:
                message = "merge(batch): integrate submitted worktrees" if batch else f"merge({args.task}): integrate submitted worktree"
                command = ["commit", "-m", message]
                if batch:
                    command += ["-m", "Tasks: " + ",".join(names)]
                self.git.run(*command)
            integrated = self.git.head()
            with self.store.mutex(), defer_interrupts(), MetadataTransaction() as metadata_transaction:
                for meta in tasks:
                    self.store.unchanged(meta)
                    self.git.submitted(meta, allow_ancestor=already or Path(meta["worktree"]).resolve() == self.git.root)
                self.fault("FAIL_INTEGRATION_FINALIZE")
                for index, meta in enumerate(tasks):
                    archived = dict(meta, status="integrated", integration_sha=integrated, integrated_at=timestamp())
                    metadata_transaction.write(self.store.history_path(meta["task"]), archived)
                    metadata_transaction.delete(self.store.path(meta["task"]))
                    if index == 0:
                        self.fault("AFTER_FIRST_INTEGRATION_ARCHIVE")
                metadata_transaction.commit()
                if git_transaction:
                    git_transaction.commit()
                self.fault("AFTER_INTEGRATION_METADATA")
        note(f"{'INTEGRATED_BATCH' if batch else 'ALREADY_INTEGRATED' if already else 'INTEGRATED'} task={','.join(names)} integration={integrated} profile={label}")

    def runtime_guard(self, args) -> None:
        self.integration_owner(args.task)
        note(f"RUNTIME_OK task={args.task}")

    def release_guard(self, args) -> dict[str, str]:
        meta = self.integration_owner(args.task)
        self.only_task(args.task)
        require(meta["verified_sha"], "integration-verify 기록이 없습니다.")
        require(meta["verified_sha"] == self.git.head(), "검증 이후 HEAD가 바뀌었습니다. integration-verify를 실행하십시오.")
        require(self.git.clean(), "릴리스 전 worktree가 깨끗해야 합니다.")
        note(f"RELEASE_OK task={args.task} sha={meta['verified_sha']} mode={meta['verified_mode'] or 'legacy-full'}")
        return meta

    def only_task(self, name: str) -> None:
        pending = [meta["task"] for _, meta in self.store.entries()
                   if meta["task"] != name and meta["status"] == "submitted"]
        require(not pending, f"미통합 submitted task가 남아 있어 검증을 중단합니다: {','.join(pending)}")

    def latest_verified(self, head: str) -> dict[str, str] | None:
        candidates = []
        for _, meta in self.store.entries() + self.store.entries(True):
            sha = meta["verified_sha"]
            if not sha:
                continue
            if self.git.run("cat-file", "-e", f"{sha}^{{commit}}", check=False).returncode or not self.git.ancestor(sha, head):
                continue
            candidates.append((int(self.git.text("rev-list", "--count", f"{sha}..{head}")), meta))
        return min(candidates, key=lambda item: item[0])[1] if candidates else None

    def verify(self, args) -> None:
        self.store.lock(args.task)
        meta = self.integration_owner(args.task)
        self.only_task(args.task)
        require(self.git.clean(), "검증 전 통합 worktree가 깨끗해야 합니다.")
        head = self.git.head()
        previous = self.latest_verified(head)
        require(previous is not None or args.full, "신뢰할 검증 기준이 없습니다. 전체 검증이 필요하면 --full을 명시하십시오.")
        base = previous["verified_sha"] if previous else ""
        # A historical release receipt establishes trust, but must not widen this
        # integration's delta to unrelated work completed before its clean start.
        # Keep a newer verified descendant for reuse; explicit full stays full.
        if previous and not args.full and self.git.ancestor(base, meta["base_sha"]):
            base = meta["base_sha"]
        full = bool(args.full)
        paths = self.git.paths(base, head) if base else []
        policy_full = full
        plan = None
        if not self.testing and (full or paths):
            from .planner import build_plan
            plan = build_plan(self.git.root, paths, base=base or head, phase="verification", full=full)
            policy_full = plan.full
        mode = "full" if policy_full else "scoped"
        if previous and not paths and not full:
            mode = "reuse"
            note(f"VERIFY_REUSED task={args.task} sha={head} source_mode={previous['verified_mode'] or 'full'}")
        else:
            reason = " trigger=explicit-full" if args.full else " reason=no-trusted-baseline" if previous is None else ""
            note(f"VERIFY_SELECTED task={args.task} mode={mode} base={base or 'none'} head={head} changed={len(paths) if previous else 'unknown'}{reason}")
            self.quality("verification", base or head, task=args.task, head=head, areas=meta["areas"], full=full, plan=plan)
        require(self.git.head() == head and self.git.clean(), "검증 중 통합 worktree가 변경되었습니다.")
        with self.store.mutex():
            self.store.unchanged(meta)
            self.only_task(args.task)
            self.store.save(dict(meta, verified_sha=head, verified_at=timestamp(), verified_mode=mode, verified_base_sha=base))
        note(f"VERIFIED task={args.task} sha={head} mode={mode} base={base or 'none'}")

    def finish(self, args) -> None:
        self.store.lock(args.task)
        if args.without_release:
            meta = self.integration_owner(args.task)
            require(self.git.clean(), "개발 통합 완료 전 worktree가 깨끗해야 합니다.")
            self.only_task(args.task)
            self.archive(meta, "complete-unreleased", integration_sha=self.git.head(), integrated_at=timestamp())
            note(f"FINISHED_UNRELEASED task={args.task}; no release verification or deployment claimed")
            return
        meta = self.release_guard(args)
        self.only_task(args.task)
        self.archive(meta, "complete")
        note(f"FINISHED task={args.task}")

    def release(self, args) -> None:
        self.store.lock(args.task)
        meta = self.store.load(args.task)
        self.owner(meta, "active")
        require(self.git.clean() and self.git.head() == meta["base_sha"], "미커밋 변경 또는 기준 SHA 이후 커밋이 있어 lease를 해제하지 않습니다.")
        self.archive(meta, "cancelled")
        note(f"RELEASED task={args.task}")

    def archive(self, meta: dict[str, str], status: str, **updates: str) -> None:
        with self.store.mutex(), defer_interrupts(), MetadataTransaction() as transaction:
            self.store.unchanged(meta)
            if status in ("complete", "complete-unreleased"):
                self.only_task(meta["task"])
            transaction.write(self.store.history_path(meta["task"]), dict(meta, status=status, **updates))
            transaction.delete(self.store.path(meta["task"]))
            transaction.commit()

    def dispatch(self, args) -> None:
        command = args.command
        method = {"resubmit": "submit", "restack-squash": "restack", "replace-submitted": "replace",
                  "replace-submitted-expanded": "replace", "integrate-scoped": "integrate", "integrate-batch": "integrate"}.get(command, command.replace("-", "_"))
        getattr(self, method)(args)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="coord-harness")
    result.add_argument("command", choices=COMMANDS)
    for name in ("task", "tasks", "paths", "areas", "profile", "message", "integration-task", "new-base-ref", "supersedes"):
        result.add_argument("--" + name, default="")
    result.add_argument("--base-ref", default="HEAD")
    result.add_argument("--history", action="store_true")
    result.add_argument("--full", action="store_true")
    result.add_argument("--without-release", action="store_true")
    return result


def main(argv: list[str] | None = None, *, fixture_root: Path | None = None) -> int:
    args = parser().parse_args(argv)
    coordinator = None
    handlers = {}
    def interrupt(signum, _frame):
        raise Interrupted(128 + signum)
    try:
        for signum in (signal.SIGINT, signal.SIGTERM):
            handlers[signum] = signal.signal(signum, interrupt)
        coordinator = Coordinator(fixture_root=fixture_root)
        coordinator.dispatch(args)
        return 0
    except Interrupted as error:
        print(f"coord-harness: {error}", file=sys.stderr)
        return error.code
    except (CoordError, OSError) as error:
        print(f"coord-harness: {error}", file=sys.stderr)
        return 1
    finally:
        if coordinator:
            coordinator.store.close()
        for signum, handler in handlers.items():
            signal.signal(signum, handler)


if __name__ == "__main__":
    raise SystemExit(main())
