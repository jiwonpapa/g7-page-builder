"""Bounded Git subprocess operations and compensation for owned clean worktrees."""
from __future__ import annotations

import os
from pathlib import Path
import signal
import subprocess

from .state import CoordError, require


def execute(args: list[str], cwd: Path, *, data: bytes | None = None,
            env: dict[str, str] | None = None, check: bool = True, stream: bool = False) -> subprocess.CompletedProcess:
    """A child cannot outlive an interrupted coordinator and continue writing state."""
    process = subprocess.Popen(args, cwd=cwd, env=env, stdin=subprocess.PIPE if data is not None else subprocess.DEVNULL,
                               stdout=None if stream else subprocess.PIPE,
                               stderr=None if stream else subprocess.PIPE, start_new_session=True)
    try:
        stdout, stderr = process.communicate(data)
    except BaseException:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        raise
    result = subprocess.CompletedProcess(args, process.returncode, stdout, stderr)
    if check and result.returncode:
        detail = (stderr or b"").decode("utf-8", "replace").strip() or (stdout or b"").decode("utf-8", "replace").strip()
        raise CoordError(f"명령 실패 ({result.returncode}): {' '.join(args)}\n{detail}")
    return result


class Git:
    def __init__(self, cwd: Path, runner=execute) -> None:
        self.runner = runner
        self.root = cwd.resolve()
        self.root = Path(self.text("rev-parse", "--show-toplevel")).resolve()
        self.common = Path(self.text("rev-parse", "--path-format=absolute", "--git-common-dir")).resolve()
        worktrees = self.text("worktree", "list", "--porcelain")
        self.main = Path(worktrees.splitlines()[0].removeprefix("worktree ")).resolve()

    def run(self, *args: str, data: bytes | None = None, check: bool = True):
        return self.runner(["git", *args], self.root, data=data, check=check)

    def text(self, *args: str) -> str:
        return self.run(*args).stdout.decode("utf-8", "surrogateescape").strip()

    def head(self) -> str:
        return self.text("rev-parse", "HEAD")

    def commit(self, ref: str) -> str:
        require(ref and not ref.startswith("-"), "유효한 commit ref가 필요합니다.")
        return self.text("rev-parse", "--verify", f"{ref}^{{commit}}")

    def branch(self) -> str:
        result = self.run("symbolic-ref", "--quiet", "--short", "HEAD", check=False)
        return result.stdout.decode().strip() if result.returncode == 0 else ""

    def clean(self) -> bool:
        return not self.text("status", "--porcelain")

    def ancestor(self, base: str, head: str) -> bool:
        result = self.run("merge-base", "--is-ancestor", base, head, check=False)
        require(result.returncode in (0, 1), "Git ancestry를 판정할 수 없습니다.")
        return result.returncode == 0

    def paths(self, base: str, head: str | None = None) -> list[str]:
        args = ["diff", "--no-renames", "--name-only", "-z", base]
        if head:
            args.append(head)
        raw = self.run(*args, "--").stdout
        if head is None:
            raw += self.run("ls-files", "--others", "--exclude-standard", "-z").stdout
        return sorted(set(raw.decode("utf-8", "surrogateescape").strip("\0").split("\0")) - {""})

    def submitted(self, meta: dict[str, str], *, allow_ancestor: bool = False) -> Git:
        require(Path(meta["worktree"]).is_dir(), "제출 worktree가 없습니다. Codex snapshot을 복구한 뒤 통합하십시오.")
        other = Git(Path(meta["worktree"]), self.runner)
        require(other.common == self.common and other.branch() == meta["branch"] and other.clean(),
                "제출 worktree 계약이 metadata와 일치하지 않습니다.")
        require(other.head() == meta["submitted_sha"] or (allow_ancestor and other.root == self.root
                and self.ancestor(meta["submitted_sha"], other.head())), "제출 뒤 task branch HEAD가 변경되었습니다.")
        require(self.ancestor(meta["base_sha"], meta["submitted_sha"]), "submitted commit ancestry가 올바르지 않습니다.")
        return other


class GitTransaction:
    """Only start after the owning operation lock and a clean checkout check."""

    def __init__(self, git: Git) -> None:
        require(git.clean(), "깨끗한 worktree에서만 Git transaction을 시작할 수 있습니다.")
        self.git = git
        self.start = git.head()
        self.branch = git.branch()
        self.committed = False

    def __enter__(self) -> GitTransaction:
        return self

    def commit(self) -> None:
        self.committed = True

    def __exit__(self, *_: object) -> None:
        if not self.committed:
            self.git.run("merge", "--abort", check=False)
            self.git.run("rebase", "--abort", check=False)
            require(self.git.branch() == self.branch, "rollback 전 branch가 변경되었습니다. 자동 reset을 중단합니다.")
            self.git.run("reset", "--hard", self.start)
