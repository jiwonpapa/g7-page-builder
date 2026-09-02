"""Preserve an active worktree while applying its final delta to a reviewed base.

The source branch, index, working files and existing evidence are never changed.
Only the previously clean destination participates in a Git transaction. This is
a lease transfer to another active task, never a submission or validation result.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import stat
import uuid

from .gitops import Git, GitTransaction
from .state import MetadataTransaction, defer_interrupts, new_task, require, task_id, timestamp


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def snapshot(git: Git, base: str, directory: Path, label: str) -> dict[str, str]:
    """Use an alternate index; even staged/unstaged differences stay at source."""
    head, branch = git.head(), git.branch()
    index_path = Path(git.text("rev-parse", "--path-format=absolute", "--git-path", "index"))
    index = index_path.read_bytes() if index_path.exists() else b""
    status = git.run("status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames").stdout
    require(not git.run("ls-files", "--unmerged", "-z").stdout, "미해결 Git 충돌이 있는 active task는 교체할 수 없습니다.")
    alternate = directory / f"{label}.index"
    environment = dict(os.environ, GIT_INDEX_FILE=str(alternate), GIT_OPTIONAL_LOCKS="0")

    def isolated(*args: str, data=None):
        return git.runner(["git", *args], git.root, env=environment, data=data)

    if index:
        alternate.write_bytes(index)
    else:
        isolated("read-tree", head)
    # Retain staged ignored additions, but expose file changes hidden by flags.
    names = isolated("ls-files", "-z").stdout
    isolated("update-index", "--no-assume-unchanged", "--no-skip-worktree", "-z", "--stdin", data=names)
    isolated("add", "-A", "--", ".")
    tree = isolated("write-tree").stdout.decode().strip()
    patch = git.run("diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", base, tree, "--").stdout
    staged = git.run("diff", "--cached", "--binary", "--full-index", "--no-ext-diff", head, "--").stdout
    unstaged = git.run("diff", "--binary", "--full-index", "--no-ext-diff", "--").stdout
    for suffix, value in (("original-index", index), ("status", status), ("patch", patch),
                          ("staged.patch", staged), ("unstaged.patch", unstaged)):
        (directory / f"{label}.{suffix}").write_bytes(value)
    return dict(head=head, branch=branch, tree=tree, index_sha256=digest(index), status_sha256=digest(status),
                patch_sha256=digest(patch), staged_sha256=digest(staged), unstaged_sha256=digest(unstaged))


def preserve_failed_destination(git: Git, base: str, directory: Path) -> None:
    """Keep conflict markers and any concurrent file writes before compensation."""
    failed = directory / "destination-failure"
    failed.mkdir(exist_ok=True)
    manifest = {}
    for name in git.paths(base):
        file = git.root / name
        # Do not follow a changed parent symlink outside the owning worktree.
        require(file.parent.resolve().is_relative_to(git.root), "실패 증거의 부모 경로가 worktree를 벗어납니다.")
        if file.is_symlink():
            manifest[name] = {"symlink": os.readlink(file)}
        elif file.is_file():
            data = file.read_bytes()
            key = digest(name.encode("utf-8", "surrogateescape"))
            (failed / key).write_bytes(data)
            manifest[name] = {"file": key, "sha256": digest(data), "mode": stat.S_IMODE(file.stat().st_mode)}
        else:
            manifest[name] = {"missing": not file.exists()}
    (failed / "files.json").write_text(json.dumps(manifest, ensure_ascii=True, indent=2) + "\n")
    index = Path(git.text("rev-parse", "--path-format=absolute", "--git-path", "index"))
    if index.exists():
        (failed / "index").write_bytes(index.read_bytes())


def replace_active(coordinator, args, *, owned_paths, validate_paths, allowed_areas) -> Path:
    task_id(args.task)
    task_id(args.supersedes)
    require(args.task != args.supersedes, "새 task ID와 원본 task ID는 달라야 합니다.")
    require(not args.paths and not args.areas and not args.profile, "active 교체는 PATHS·AREAS·PROFILE을 정확히 상속합니다.")
    require(args.base_ref and args.base_ref != "HEAD", "검토한 명시적 BASE_REF가 필요합니다.")
    target, store = coordinator.git, coordinator.store
    base, branch = target.commit(args.base_ref), target.branch()
    require(target.root != target.main and branch and target.clean() and target.head() == base,
            "검토한 기준의 깨끗한 별도 새 worktree/branch가 필요합니다.")
    for name in sorted((args.supersedes, args.task)):
        store.lock(name)
    old = store.load(args.supersedes)
    require(old["status"] == "active" and not old["submitted_sha"], "미제출 active task만 교체할 수 있습니다.")

    def source_runner(command, cwd, **kwargs):
        # `diff` can refresh stat entries even with optional locks disabled.
        # Disable both refresh paths; observing restored files must stay read-only.
        kwargs["env"] = dict(kwargs.get("env") or os.environ, GIT_OPTIONAL_LOCKS="0")
        return coordinator.runner([command[0], "-c", "diff.autoRefreshIndex=false", *command[1:]], cwd, **kwargs)

    source = Git(Path(old["worktree"]), source_runner)
    require(source.common == target.common and source.root == Path(old["worktree"]).resolve()
            and source.root != target.root and source.root != source.main
            and source.branch() == old["branch"] and source.branch() != branch, "원본 worktree/branch 소유권이 일치하지 않습니다.")
    require(base != old["base_sha"] and target.ancestor(old["base_sha"], base)
            and source.ancestor(old["base_sha"], source.head()), "새 기준은 기존 base의 다른 후손이어야 합니다.")
    coordinator.profile(old["profile"])
    require(set(filter(None, old["areas"].split(","))) <= allowed_areas, "원본 task AREA가 유효하지 않습니다.")
    require(not set(old["areas"].split(",")) & {"runtime", "integration"}, "통합/runtime task는 active 교체할 수 없습니다.")
    validate_paths(old["paths"], old["profile"], target.root)
    owned_paths(source, old)
    with store.mutex():
        store.unchanged(old)
        require(not store.path(args.task).exists(), "새 task ID가 이미 활성 상태입니다.")
        coordinator.conflicts(old["paths"], old["areas"], old["task"], unique_owner=True)
    evidence = store.root / "active-replacements" / f"{args.supersedes}--{args.task}--{uuid.uuid4().hex}"
    evidence.mkdir(parents=True)
    captured = snapshot(source, old["base_sha"], evidence, "source")
    paths = source.paths(old["base_sha"], captured["tree"])
    require(paths, "새 기준으로 옮길 active task 변경이 없습니다.")
    # The alternate index exposes changes hidden by assume-unchanged/index flags.
    prefixes = old["paths"].split(",")
    require(all(any(name == p or (old["profile"] != "scoped" and name.startswith(p + "/"))
                    for p in prefixes) for name in paths), "원본 snapshot에 PATHS 밖의 변경이 있습니다.")
    manifest = dict(source_task=old, source_snapshot=captured, destination=str(target.root), destination_branch=branch,
                    base_sha=base, paths=paths, status="prepared")
    manifest_path = evidence / "manifest.json"

    def record(status: str) -> None:
        manifest["status"] = status
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=True, indent=2) + "\n")

    record("prepared")
    require(snapshot(source, old["base_sha"], evidence, "confirmed") == captured,
            "snapshot 중 원본 작업이 변경되었습니다. 원본을 보존하고 교체를 중단합니다.")
    tracked = set(target.run("ls-files", "-z").stdout.decode("utf-8", "surrogateescape").strip("\0").split("\0"))
    require(all(name in tracked or not os.path.lexists(target.root / name) for name in paths),
            "새 worktree의 기존 ignored/untracked 파일을 덮어쓸 수 없습니다.")
    with store.mutex():
        store.unchanged(old)
        coordinator.conflicts(old["paths"], old["areas"], old["task"], unique_owner=True)
        require(not store.path(args.task).exists() and target.head() == base and target.branch() == branch and target.clean(),
                "교체 준비 중 새 task/worktree가 변경되었습니다.")
        with GitTransaction(target) as git_transaction:
            try:
                target.run("apply", "--index", "--3way", "--whitespace=nowarn", data=(evidence / "source.patch").read_bytes())
                coordinator.fault("AFTER_ACTIVE_APPLY")
                owned_paths(target, old, base)
                require(not target.text("diff", "--name-only") and not target.run("ls-files", "--unmerged", "-z").stdout,
                        "새 worktree의 적용 결과가 index와 일치하지 않습니다.")
                require(snapshot(source, old["base_sha"], evidence, "final") == captured,
                        "적용 중 원본 작업이 변경되었습니다. 원본을 보존하고 교체를 중단합니다.")
                require(target.head() == base and target.branch() == branch, "적용 중 새 task HEAD/branch가 변경되었습니다.")
                store.unchanged(old)
                replacement = new_task(task=args.task, worktree=str(target.root), branch=branch, base_sha=base,
                                       paths=old["paths"], areas=old["areas"], profile=old["profile"],
                                       replaced_active_task=old["task"], replacement_evidence=str(evidence))
                archived = dict(old, status="superseded", superseded_by=args.task, superseded_at=timestamp(),
                                preserved_head=captured["head"], preserved_tree=captured["tree"], replacement_evidence=str(evidence))
                with defer_interrupts(), MetadataTransaction() as metadata:
                    metadata.write(store.history_path(old["task"]), archived)
                    metadata.delete(store.path(old["task"]))
                    coordinator.fault("AFTER_ACTIVE_ARCHIVE")
                    metadata.write(store.path(args.task), replacement)
                    coordinator.fault("BEFORE_ACTIVE_COMMIT")
                    record("active-replaced")
                    metadata.commit()
                    git_transaction.commit()
                    coordinator.fault("AFTER_ACTIVE_COMMIT")
            except BaseException:
                if not git_transaction.committed:
                    preserve_failed_destination(target, base, evidence)
                    record("failed-preserved")
                raise
    return evidence
