"""Package a proven build once; deploy and resume without rerunning product tests."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import subprocess
import sys
import tempfile
from tarfile import TarError
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from . import artifacts

ROOT = Path(__file__).resolve().parents[2]
ASSETS = [f"dist/{kind}/{name}.{extension}" for kind, extension, names in [
    ("js", "iife.js", ["page-builder-editor", "page-builder-manager", "page-builder-site-part", "page-effects"]),
    ("css", "css", ["page-builder-editor", "page-builder-manager", "page-builder-site-part", "page-builder-public"]),
] for name in names]


def command(root: Path, argv: list[str]) -> str:
    return subprocess.run(argv, cwd=root, check=True, capture_output=True, text=True).stdout.strip()


def approved_identity(root: Path, task: str) -> dict:
    if not task:
        raise ValueError("--task or TASK is required; use the existing verified integration task")
    command(root, ["bash", "scripts/coord-harness.sh", "release-guard", "--task", task])
    head = command(root, ["git", "rev-parse", "HEAD"])
    version = json.loads((root / "module.json").read_text())["version"]
    package = json.loads((root / "package.json").read_text())
    lock = json.loads((root / "package-lock.json").read_text())
    if (not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?", version)
            or package.get("version") != version or lock.get("version") != version
            or lock.get("packages", {}).get("", {}).get("version") != version):
        raise ValueError("Release version is invalid or module/package/lock versions differ")
    return {"commit": head, "version": version, "tree": command(root, ["git", "rev-parse", "HEAD^{tree}"]),
            "timestamp": int(command(root, ["git", "show", "-s", "--format=%ct", "HEAD"]))}


def build_proof(root: Path, runtime: str, task: str) -> str:
    from . import environment
    if runtime + ":build" not in environment.read_state(root):
        raise ValueError(f"No build proof. Run environment build --runtime {runtime} --task {task} --apply; no product tests will be started automatically")
    result = environment.build(environment.Runtime(root, runtime, task), apply=False)
    if result["build"] != "reused":
        raise ValueError("Build inputs or dist differ from the successful build. Run the selected environment build; no full validation is started")
    return result["fingerprint"]


def verify_payload(archive: dict, files: dict[str, Path], proof: str) -> None:
    packaged = {name: value for name, value in archive["files"].items() if name != "BUILD-INFO"}
    if archive["info"].get("build_fingerprint") != proof or packaged != artifacts.inventory(files):
        raise ValueError("Archive payload does not match the currently proven source and complete dist")


def package(root: Path, identity: dict, proof: str) -> dict:
    files = artifacts.payload(root)
    release_id = f"g7-page-builder-v{identity['version']}-{identity['commit'][:12]}"
    path = root / "output/releases" / (release_id + ".tar.gz")
    if path.exists():
        result = artifacts.inspect_archive(path, identity["commit"], identity["version"])
        verify_payload(result, files, proof)
        result["reused"] = True
        return result
    compiler_path = root / "src/Application/Compilation/HtmlDocumentCompiler.php"
    compiler = re.search(r"COMPILER_VERSION\s*=\s*'([^']+)'", compiler_path.read_text())
    schema = json.loads((root / "schemas/page-builder-document.schema.json").read_text())
    info = {"release_id": release_id, "version": identity["version"], "git_commit": identity["commit"],
            "git_tree": identity["tree"], "git_dirty": "false", "validated_commit": identity["commit"],
            "build_fingerprint": proof, "schema_version": schema.get("$id", "g7-page-builder/v1"),
            "compiler_version": compiler.group(1) if compiler else "unknown", "g7_version": ">=7.0.7",
            "php_version": "^8.5", "created_at_epoch": str(identity["timestamp"])}
    if info["compiler_version"] == "unknown":
        raise ValueError("Missing compiler version in release source")
    return artifacts.write_archive(path, files, info, identity["timestamp"])


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class Transport:
    def __init__(self, root: Path, ssh: str, app_root: str, base_url: str) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_.@-]+", ssh) or ssh.startswith("-"):
            raise ValueError("Invalid SSH target")
        if not re.fullmatch(r"/[A-Za-z0-9_./-]+", app_root) or ".." in PurePosixPath(app_root).parts or len(PurePosixPath(app_root).parts) < 4:
            raise ValueError("Expected a concrete absolute G7 application directory")
        parsed = urlparse(base_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ValueError("Expected an HTTPS staging origin")
        self.root, self.ssh, self.app_root, self.base_url = root, ssh, app_root, base_url.rstrip("/")
        self.target = {"ssh": ssh, "app_root": app_root, "base_url": self.base_url}

    def ssh_run(self, remote: str, data=None) -> str:
        result = subprocess.run(["ssh", "-o", "BatchMode=yes", self.ssh, remote], cwd=self.root,
                                input=data if isinstance(data, bytes) else None,
                                stdin=data if data is not None and not isinstance(data, bytes) else None,
                                stdout=subprocess.PIPE, check=True)
        return result.stdout.decode().strip()

    def remote(self, operation: str, archive: dict) -> str:
        args = [operation, self.app_root, self.remote_archive(archive), archive["sha256"],
                archive["info"]["release_id"], archive["inventory_sha256"], archive["info"]["version"], self.base_url]
        return self.ssh_run("sudo -n -u g7devops bash -s -- " + shlex.join(args),
                            (self.root / "scripts/remote-deploy-staging.sh").read_bytes())

    def remote_archive(self, archive: dict) -> str:
        return str(PurePosixPath(self.app_root).parent / ".g7pb-releases" / archive["info"]["release_id"] / archive["sha256"] / "module.tar.gz")

    def status(self, archive: dict) -> bool:
        return self.remote("status", archive).splitlines()[-1:] == ["matched=true"]

    def doctor(self, archive: dict) -> None:
        required = archive["expanded_bytes"] + Path(archive["path"]).stat().st_size
        args = [self.app_root, str((required + 1023) // 1024)]
        self.ssh_run("sudo -n -u g7devops bash -s -- " + shlex.join(args),
                     (self.root / "scripts/remote-staging-doctor.sh").read_bytes())

    def upload(self, archive: dict) -> None:
        target = self.remote_archive(archive)
        parent = str(PurePosixPath(target).parent)
        script = f"umask 077; mkdir -p {shlex.quote(parent)} && cat > {shlex.quote(target + '.uploading')} && mv {shlex.quote(target + '.uploading')} {shlex.quote(target)}"
        with Path(archive["path"]).open("rb") as stream:
            self.ssh_run("sudo -n -u g7devops sh -c " + shlex.quote(script), stream)

    def apply(self, archive: dict) -> None:
        self.remote("apply", archive)

    def reload(self, archive: dict) -> None:
        self.ssh_run("sudo -n systemctl reload php8.5-fpm")

    def smoke(self, archive: dict) -> None:
        self.remote("smoke", archive)
        opener = build_opener(NoRedirect())
        paths = ["/up", "/admin/login", "/admin/page-builder"]
        paths += [f"/api/modules/assets/{artifacts.MODULE}/{path}" for path in ASSETS]
        for path in paths:
            request = Request(self.base_url + path, method="HEAD" if "/assets/" in path else "GET")
            try:
                with opener.open(request, timeout=20) as response:
                    if response.status != 200:
                        raise ValueError(f"Staging smoke HTTP {response.status}: {path}")
            except HTTPError as error:
                raise ValueError(f"Staging smoke HTTP {error.code}: {path}") from error


def state_path(root: Path, transport: Transport, archive: dict) -> Path:
    key = hashlib.sha256(json.dumps(transport.target, sort_keys=True).encode()).hexdigest()[:20]
    return root / ".runtime/harness/deployments" / f"{key}-{archive['sha256']}.json"


def save_progress(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, prefix="deployment-", delete=False) as stream:
        json.dump(value, stream, sort_keys=True)
        temporary = stream.name
    os.replace(temporary, path)


def deploy(root: Path, transport: Transport, archive: dict, force: bool = False, smoke_only: bool = False) -> dict:
    path = state_path(root, transport, archive)
    try:
        state = json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        state = {}
    identity = {"artifact": archive["sha256"], "target": transport.target}
    if not isinstance(state, dict) or any(state.get(key) != value for key, value in identity.items()):
        state = {**identity, "phase": "new"}
    matched = transport.status(archive)
    if smoke_only and not matched:
        raise ValueError("Remote module does not match this verified artifact; smoke did not run")
    if not matched:
        state = {**identity, "phase": "new"}
        transport.doctor(archive)
        transport.upload(archive)
        transport.apply(archive)
        state["phase"] = "applied"
        save_progress(path, state)
    if not smoke_only and state.get("phase") not in ("reloaded", "smoked"):
        transport.reload(archive)
        state["phase"] = "reloaded"
        save_progress(path, state)
    # An explicit check observes current DB/runtime readiness, not only file identity.
    reused = state.get("phase") == "smoked" and not force and not smoke_only
    if not reused:
        if state.get("phase") == "smoked":
            # A failed recheck must not leave reusable success; reload is still valid.
            state["phase"] = "reloaded"
            save_progress(path, state)
        transport.smoke(archive)
        state["phase"] = "smoked"
        save_progress(path, state)
    return {"artifact": archive["sha256"], "target": transport.target, "smoke": "reused" if reused else "passed"}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["package", "deploy", "smoke"])
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--task", default=os.environ.get("TASK", ""))
    parser.add_argument("--build-runtime", choices=["local", "docker"], default="docker")
    parser.add_argument("--artifact", type=Path, default=os.environ.get("G7PB_RELEASE_ARTIFACT"))
    parser.add_argument("--ssh", default=os.environ.get("G7PB_STAGING_SSH", "g7devops"))
    parser.add_argument("--app-root", default=os.environ.get("G7PB_STAGING_ROOT", "/home/g7devops/public_html"))
    parser.add_argument("--url", default=os.environ.get("G7PB_STAGING_URL", "https://www.g7devops.com"))
    parser.add_argument("--force", action="store_true", help="repeat only the required smoke for this artifact")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        identity = approved_identity(root, args.task)
        proof = build_proof(root, args.build_runtime, args.task)
        if args.operation == "package":
            print(package(root, identity, proof)["path"])
        else:
            path = args.artifact or root / "output/releases" / f"g7-page-builder-v{identity['version']}-{identity['commit'][:12]}.tar.gz"
            archive = artifacts.inspect_archive(path, identity["commit"], identity["version"])
            if archive["info"].get("validated_commit") != identity["commit"]:
                raise ValueError("Archive is not tied to the current validated commit")
            verify_payload(archive, artifacts.payload(root), proof)
            transport = Transport(root, args.ssh, args.app_root, args.url)
            print(json.dumps(deploy(root, transport, archive, args.force, args.operation == "smoke"), indent=2))
        return 0
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError, TarError) as error:
        print(f"release: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
