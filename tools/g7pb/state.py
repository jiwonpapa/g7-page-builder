"""Legacy TSV task state and single-writer locks; no product runtime dependencies."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import time
import uuid


class CoordError(RuntimeError):
    """A rejected operation, with no permission to bypass the failed invariant."""


def require(condition: object, message: str) -> None:
    if not condition:
        raise CoordError(message)


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def defer_interrupts():
    """Keep the durable metadata write and its completion marker indivisible."""
    previous = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGINT, signal.SIGTERM})
    try:
        yield
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, previous)


FIELDS = (
    "version task status worktree branch base_sha paths areas profile created_at "
    "submitted_sha submitted_at integration_sha integrated_at verified_sha verified_at "
    "verified_mode verified_base_sha previous_base_sha previous_submitted_sha restacked_at "
    "restack_history superseded_by superseded_at"
).split()


def new_task(**values: str) -> dict[str, str]:
    result = dict.fromkeys(FIELDS, "")
    result.update(version="1", status="active", created_at=timestamp())
    result.update(values)
    return result


def task_id(value: str) -> str:
    require(re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,62}", value), "TASK는 2~63자의 소문자·숫자·점·밑줄·하이픈만 허용합니다.")
    return value


def read_meta(path: Path) -> dict[str, str]:
    require(path.is_file() and not path.is_symlink(), f"유효한 task metadata가 없습니다: {path}")
    result: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("\t")
        require(separator and key not in result and "\t" not in value, f"잘못된 TSV metadata: {path}")
        result[key] = value
    require(result.get("version") == "1", f"지원하지 않는 metadata version: {path}")
    for field in FIELDS:
        result.setdefault(field, "")
    task_id(result["task"])
    return result


def serialize(meta: dict[str, str]) -> bytes:
    for key, value in meta.items():
        require(not any(c in key + value for c in "\t\r\n"), "metadata에는 TSV 제어 문자를 저장할 수 없습니다.")
    return "".join(f"{key}\t{value}\n" for key, value in meta.items()).encode("utf-8")


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    stage = path.with_name(f".{path.name}.txn-{os.getpid()}-{uuid.uuid4().hex}.stage")
    try:
        with stage.open("xb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(stage, path)
    finally:
        stage.unlink(missing_ok=True)


class MetadataTransaction:
    """Compensate only files touched by this operation; commit survives later signals."""

    def __init__(self) -> None:
        self.originals: dict[Path, Path | None] = {}
        self.committed = False

    def __enter__(self) -> MetadataTransaction:
        return self

    def remember(self, path: Path) -> None:
        require(not path.is_symlink(), f"metadata symlink는 수정할 수 없습니다: {path}")
        if path not in self.originals:
            backup = path.with_name(f".{path.name}.txn-{os.getpid()}-{uuid.uuid4().hex}.backup") if path.exists() else None
            self.originals[path] = backup
            if backup is not None:
                os.replace(path, backup)

    def write(self, path: Path, meta: dict[str, str]) -> None:
        self.remember(path)
        atomic_write(path, serialize(meta))

    def delete(self, path: Path) -> None:
        self.remember(path)
        path.unlink(missing_ok=True)

    def commit(self) -> None:
        self.committed = True

    def __exit__(self, *_: object) -> None:
        for path, backup in reversed(tuple(self.originals.items())):
            if not self.committed:
                if backup is None:
                    path.unlink(missing_ok=True)
                elif backup.exists():
                    os.replace(backup, path)  # Recovery needs no new disk allocation.
            elif backup is not None:
                backup.unlink(missing_ok=True)


def process_start(pid: int) -> str:
    result = subprocess.run(["ps", "-p", str(pid), "-o", "lstart="], capture_output=True, text=True, check=False)
    return "".join(result.stdout.split()) if result.returncode == 0 else ""


def owner_live(owner: str) -> bool:
    fields = owner.split("|")
    if len(fields) != 3 or not fields[1].isdigit() or not fields[2]:
        return False
    if fields[0] != socket.gethostname():
        return True  # Never reclaim a lock held on another host.
    return process_start(int(fields[1])) == fields[2]


class Store:
    def __init__(self, root: Path, fault=lambda _name: None) -> None:
        self.root = root
        self.tasks = root / "tasks"
        self.history = root / "history"
        self.fault = fault
        self.locks: list[tuple[Path, str]] = []

    def ensure(self) -> None:
        self.tasks.mkdir(parents=True, exist_ok=True)
        self.history.mkdir(parents=True, exist_ok=True)

    def path(self, name: str) -> Path:
        return self.tasks / f"{task_id(name)}.meta"

    def load(self, name: str) -> dict[str, str]:
        return read_meta(self.path(name))

    def entries(self, history: bool = False) -> list[tuple[Path, dict[str, str]]]:
        directory = self.history if history else self.tasks
        return [(path, read_meta(path)) for path in sorted(directory.glob("*.meta"))]

    def history_path(self, name: str) -> Path:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        path = self.history / f"{task_id(name)}.{stamp}.meta"
        require(not path.exists(), f"history를 덮어쓸 수 없습니다: {path}")
        return path

    def save(self, meta: dict[str, str]) -> None:
        atomic_write(self.path(meta["task"]), serialize(meta))

    def unchanged(self, expected: dict[str, str]) -> None:
        require(self.load(expected["task"]) == expected, f"task metadata가 작업 도중 변경되었습니다: {expected['task']}")

    @contextmanager
    def mutex(self):
        self.ensure()
        path = self.root / "mutex"
        acquired = False
        try:
            for _ in range(100):
                try:
                    with defer_interrupts():
                        path.mkdir()
                        acquired = True
                    break
                except FileExistsError:
                    time.sleep(0.05)
            else:
                raise CoordError("coordination state 잠금을 5초 안에 얻지 못했습니다.")
            leftovers = [path for directory in (self.tasks, self.history) for path in directory.glob(".*.txn-*.backup")]
            require(not leftovers, f"중단된 metadata transaction의 보존 backup이 있어 쓰기를 중단합니다: {','.join(map(str, leftovers))}")
            yield
        finally:
            if acquired:
                with defer_interrupts():
                    path.rmdir()

    def lock(self, name: str) -> None:
        self.ensure()
        directory = self.root / "task-locks"
        directory.mkdir(exist_ok=True)
        path = directory / f"{task_id(name)}.lock"
        start = process_start(os.getpid())
        require(start, "현재 process 시작 시각을 확인하지 못했습니다.")
        owner = f"{socket.gethostname()}|{os.getpid()}|{start}"
        attempts = 2 if os.environ.get("G7PB_COORD_TESTING") == "1" else 100
        for _ in range(attempts):
            try:
                with defer_interrupts():
                    path.symlink_to(owner)
                    self.locks.append((path, owner))
                self.fault(f"AFTER_TASK_LOCK_COUNT={len(self.locks)}")
                return
            except FileExistsError:
                existing = os.readlink(path) if path.is_symlink() else ""
                if existing and not owner_live(existing):
                    with self.mutex():
                        if path.is_symlink() and os.readlink(path) == existing and not owner_live(existing):
                            path.unlink()
                    continue
                time.sleep(0.05)
        raise CoordError(f"task 작업 잠금을 얻지 못했습니다: {name}")

    def close(self) -> None:
        for path, owner in reversed(self.locks):
            if path.is_symlink() and os.readlink(path) == owner:
                path.unlink()
        self.locks.clear()
