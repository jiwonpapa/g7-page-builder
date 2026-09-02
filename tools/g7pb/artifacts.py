"""Release inventory and safe, deterministic archives; no product test execution."""
from __future__ import annotations

import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile

MODULE = "jiwonpapa-page_builder"
ROOT_FILES = {"CHANGELOG.md", "module.json", "module.php", "composer.json", "composer.lock", "package.json", "package-lock.json"}
DIRECTORIES = {"config", "database", "resources", "schemas", "src"}


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def safe_name(name: str) -> str:
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or ".." in path.parts or "\\" in name
            or any(ord(char) < 32 for char in name) or str(path) != name):
        raise ValueError(f"Unsafe archive path: {name!r}")
    return name


def payload(root: Path) -> dict[str, Path]:
    tracked = subprocess.run(["git", "ls-files", "-z"], cwd=root, check=True, capture_output=True).stdout
    paths = {value.decode() for value in tracked.split(b"\0") if value}
    selected = {name: root / name for name in paths if name in ROOT_FILES or name.split("/", 1)[0] in DIRECTORIES}
    selected.update({str(path.relative_to(root)): path for path in (root / "dist").rglob("*") if path.is_file()})
    if not ROOT_FILES.issubset(selected) or not any(name.startswith("dist/") for name in selected):
        raise ValueError("Missing tracked release inputs or built dist")
    for name, path in selected.items():
        safe_name(name)
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Release inputs must be regular files: {name}")
        if path.suffix == ".map" or path.name == ".env" or path.name.startswith(".env."):
            raise ValueError(f"Forbidden release input: {name}")
    return dict(sorted(selected.items()))


def inventory(files: dict[str, Path]) -> dict[str, str]:
    return {name: sha256(path) for name, path in files.items()}


def parse_info(data: bytes) -> dict[str, str]:
    result = {}
    for line in data.decode().splitlines():
        key, separator, value = line.partition("=")
        if not separator or key in result:
            raise ValueError("Malformed or duplicate BUILD-INFO key")
        result[key] = value
    return result


def write_archive(target: Path, files: dict[str, Path], info: dict[str, str], timestamp: int) -> dict:
    if target.exists():
        raise ValueError(f"Refusing to overwrite a release artifact: {target}")
    metadata = "".join(f"{key}={value}\n" for key, value in sorted(info.items())).encode()
    hashes = inventory(files)
    hashes["BUILD-INFO"] = hashlib.sha256(metadata).hexdigest()
    checksums = "".join(f"{value}  {name}\n" for name, value in sorted(hashes.items())).encode()
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation preserves an existing release even if two callers race.
    with target.open("xb") as output, gzip.GzipFile(fileobj=output, mode="wb", mtime=0, filename="") as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
            for name in sorted(set(files) | {"BUILD-INFO", "SHA256SUMS"}):
                data = metadata if name == "BUILD-INFO" else checksums if name == "SHA256SUMS" else files[name].read_bytes()
                member = tarfile.TarInfo(MODULE + "/" + safe_name(name))
                member.size, member.mtime, member.mode = len(data), timestamp, 0o644
                archive.addfile(member, io.BytesIO(data))
    result = inspect_archive(target, info["git_commit"], info["version"])
    target.with_suffix(target.suffix + ".sha256").write_text(f"{result['sha256']}  {target.name}\n")
    return result


def inspect_archive(path: Path, expected_commit: str, expected_version: str) -> dict:
    with tarfile.open(path, "r:gz") as archive:
        members = {}
        for member in archive.getmembers():
            safe_name(member.name)
            if not member.isfile() or not member.name.startswith(MODULE + "/"):
                raise ValueError(f"Archive may contain only regular module files: {member.name}")
            name = member.name[len(MODULE) + 1:]
            safe_name(name)
            if name in members:
                raise ValueError(f"Duplicate archive member: {name}")
            members[name] = member
        if not {"BUILD-INFO", "SHA256SUMS", "module.json"}.issubset(members):
            raise ValueError("Archive lacks release identity/checksum files")
        read = lambda name: archive.extractfile(members[name]).read()
        info = parse_info(read("BUILD-INFO"))
        if info.get("git_commit") != expected_commit or info.get("version") != expected_version or info.get("git_dirty") != "false":
            raise ValueError("Archive does not match the currently verified clean HEAD/version")
        if info.get("release_id") != f"g7-page-builder-v{expected_version}-{expected_commit[:12]}":
            raise ValueError("Archive release id does not match its verified identity")
        manifest = json.loads(read("module.json"))
        if manifest.get("identifier") != MODULE or manifest.get("version") != expected_version:
            raise ValueError("Archive module identity/version mismatch")
        checksum_bytes = read("SHA256SUMS")
        hashes = {}
        for line in checksum_bytes.decode().splitlines():
            checksum, separator, name = line.partition("  ")
            safe_name(name)
            if not separator or not re.fullmatch(r"[a-f0-9]{64}", checksum) or name in hashes:
                raise ValueError("Invalid/duplicate checksum entry")
            hashes[name] = checksum
        if set(hashes) != set(members) - {"SHA256SUMS"}:
            raise ValueError("Checksum inventory does not exactly cover the archive")
        for name, expected in hashes.items():
            with archive.extractfile(members[name]) as stream:
                if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                    raise ValueError(f"Archive checksum mismatch: {name}")
        return {"path": str(path), "sha256": sha256(path), "info": info, "files": hashes,
                "inventory_sha256": hashlib.sha256(checksum_bytes).hexdigest(),
                "expanded_bytes": sum(member.size for member in members.values())}
