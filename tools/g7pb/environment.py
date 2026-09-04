"""Local/CI dependency preparation and scoped development-runtime operations.

Planning never installs, builds, starts containers, or changes runtime state.
Only --apply executes a plan. Docker writes require the existing runtime lease.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import asdict, dataclass
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shlex
import subprocess
import sys
import tempfile
from typing import Iterator

ROOT = Path(__file__).resolve().parents[2]
MODULE = "/var/www/g7/modules/jiwonpapa-page_builder"
INSTALL = {
    "npm": ["npm", "ci"],
    "composer": ["composer", "install", "--no-interaction", "--no-progress", "--prefer-dist"],
}
SENTINELS = {
    "npm": ["node_modules/.package-lock.json"],
    "composer": ["vendor/autoload.php", "vendor/composer/installed.json"],
}
BUILD_OUTPUTS = [
    "dist/js/page-builder-editor.iife.js", "dist/js/page-builder-manager.iife.js",
    "dist/js/page-builder-site-part.iife.js", "dist/js/page-effects.iife.js",
    "dist/js/page-sliders.iife.js",
    "dist/css/page-builder-editor.css", "dist/css/page-builder-manager.css",
    "dist/css/page-builder-site-part.css", "dist/css/page-builder-public.css",
    "dist/meta/editor-modules.json", "dist/meta/manager-modules.json",
    "dist/meta/site-part-modules.json", "dist/meta/public-effects-modules.json",
    "dist/meta/public-sliders-modules.json",
]
SYNC_MODULE = (
    '$manager = app(\\App\\Extension\\ModuleManager::class); '
    '$manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); '
    'if ($module === null) { throw new \\RuntimeException("Page Builder module is not loaded."); } '
    '$manager->syncDeclarativeArtifacts($module);'
)
SYNC_REGISTRY = (
    '$manager = app(\\App\\Extension\\ModuleManager::class); '
    '$manager->loadModules(); $module = $manager->getModule("jiwonpapa-page_builder"); '
    'if ($module === null) { throw new \\RuntimeException("Page Builder module is not loaded."); } '
    '$updated = app(\\App\\Contracts\\Repositories\\ModuleRepositoryInterface::class)'
    '->updateByIdentifier("jiwonpapa-page_builder", ["vendor" => $module->getVendor(), '
    '"version" => $module->getVersion(), "github_url" => $module->getGithubUrl(), '
    '"metadata" => $module->getMetadata(), "config" => $module->getConfig(), '
    '"update_available" => false, "updated_at" => now()]); '
    'if ($updated !== 1) { throw new \\RuntimeException("Page Builder registry was not updated."); }'
)


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def npm_script_inputs(root: Path, scripts: dict, names: tuple[str, ...]) -> dict:
    """Track literal local build/install entry points, not an inferred whole repo."""
    selected, files, pending = {}, {}, [name for name in names if name in scripts]
    while pending:
        name = pending.pop()
        if name in selected:
            continue
        body = scripts[name]
        if not isinstance(body, str) or any(marker in body for marker in ("$", chr(96), "*")):
            raise ValueError(f"new build-input evidence required for dynamic npm script: {name}")
        selected[name] = body
        lexer = shlex.shlex(body, posix=True, punctuation_chars=";&|")
        lexer.whitespace_split, lexer.commenters = True, ""
        commands, current = [], []
        for token in lexer:
            if token in ("&&", "||", ";"):
                if current:
                    commands.append(current)
                    current = []
            elif token == "|":
                raise ValueError(f"new build-input evidence required for piped npm script: {name}")
            else:
                current.append(token)
        if current:
            commands.append(current)
        for argv in commands:
            while argv and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", argv[0]):
                argv.pop(0)
            if not argv:
                continue
            if argv[0] == "npm" and len(argv) >= 3 and argv[1] in ("run", "run-script"):
                target = argv[2]
                if target not in scripts:
                    raise ValueError(f"new build-input evidence required: missing npm script {target}")
                pending.extend(hook for hook in ("pre" + target, target, "post" + target) if hook in scripts)
                continue
            if argv[0] in ("vite", "echo", "printf"):
                continue  # Vite configuration/helpers and project sources are build_inputs.
            entry = argv[1] if argv[0] in ("node", "bash", "sh", "python", "python3", "php") and len(argv) > 1 else argv[0]
            path = (root / entry).resolve()
            if entry.startswith("-") or not path.is_relative_to(root.resolve()) or not path.is_file():
                raise ValueError(f"new build-input evidence required for npm script entry: {entry}")
            files[str(path.relative_to(root.resolve()))] = file_digest(path)
    return {"scripts": dict(sorted(selected.items())), "entry_files": dict(sorted(files.items()))}


def dependency_inputs(root: Path, kind: str) -> dict:
    """Version labels do not change installed dependencies; install configuration does."""
    manifest = json.loads((root / ("package.json" if kind == "npm" else "composer.json")).read_text())
    lock = json.loads((root / ("package-lock.json" if kind == "npm" else "composer.lock")).read_text())
    manifest.pop("version", None)
    if kind == "npm":
        install_fields = ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies",
                          "peerDependenciesMeta", "overrides", "workspaces", "engines", "devEngines",
                          "os", "cpu", "libc", "packageManager", "bundledDependencies", "bundleDependencies",
                          "allowScripts", "config")
        lifecycle = npm_script_inputs(root, manifest.get("scripts", {}), (
            "preinstall", "install", "postinstall", "prepublish", "preprepare", "prepare", "postprepare"))
        manifest = {key: manifest[key] for key in install_fields if key in manifest}
        manifest["lifecycle"] = lifecycle
        lock.pop("version", None)
        lock.get("packages", {}).get("", {}).pop("version", None)
    configs = [".npmrc"] if kind == "npm" else ["auth.json"]
    return {"manifest": manifest, "lock": lock,
            "configuration": {name: file_digest(root / name) for name in configs if (root / name).is_file()}}


@dataclass(frozen=True)
class Action:
    name: str
    argv: list[str]
    reason: str


def sync_plan(paths: list[str], restart_fpm: bool = False) -> dict:
    """Select only public G7 operations affected by these paths, in execution order."""
    changed = set(paths)
    has = lambda *prefixes: any(p == prefix or p.startswith(prefix + "/") for p in changed for prefix in prefixes)
    metadata = has("module.json", "module.php")
    routes = has("routes", "resources/routes", "src/Providers")
    layouts = has("resources/layouts")
    views = has("resources/views")
    actions = []
    def add(name: str, argv: list[str], reason: str) -> None:
        actions.append(asdict(Action(name, argv, reason)))
    if metadata or has("composer.json", "composer.lock"):
        add("autoload", ["composer", "dump-autoload", "--no-interaction", "--no-ansi"], "module/autoload metadata changed")
    if has("database/migrations"):
        add("migrate", ["php", "artisan", "migrate", "--path=modules/jiwonpapa-page_builder/database/migrations", "--force", "--no-ansi"], "module migration changed")
    if metadata or routes:
        add("declarative", ["php", "artisan", "tinker", "--execute=" + SYNC_MODULE, "--no-ansi"], "module declarations/routes changed")
    if layouts:
        add("layouts", ["php", "artisan", "module:refresh-layout", "jiwonpapa-page_builder", "--no-interaction", "--no-ansi"], "module-owned layouts changed")
    if metadata or routes or views or has("config"):
        add("application-cache", ["php", "artisan", "optimize:clear", "--no-ansi"], "configuration, routes, providers or views changed")
    if metadata or routes:
        add("module-cache", ["php", "artisan", "module:cache-clear", "--no-ansi"], "module declarations/routes changed")
    if layouts or views:
        add("template-cache", ["php", "artisan", "template:cache-clear", "--no-ansi"], "module-owned layouts/views changed")
    if has("module.json"):
        add("registry", ["php", "artisan", "tinker", "--execute=" + SYNC_REGISTRY, "--no-ansi"], "module registry metadata changed")
    if restart_fpm:
        add("fpm", ["supervisorctl", "restart", "php-fpm"], "explicit --restart-fpm; normal PHP edits use timestamp validation")
    rebuild = [p for p in paths if p == "compose.yaml" or p.startswith("docker/")]
    return {"paths": sorted(changed), "actions": actions, "requires_runtime_rebuild": rebuild}


class Runtime:
    def __init__(self, root: Path, kind: str, task: str = "") -> None:
        self.root, self.kind, self.task = root, kind, task
        self.compose = ["docker", "compose", "--project-name", "g7pb-dev", "--env-file",
                        str(root / ".env.docker.local"), "-f", str(root / "compose.yaml")]

    def call(self, argv: list[str], capture: bool = False) -> str:
        result = subprocess.run(argv, cwd=self.root, check=True, text=True,
                                stdout=subprocess.PIPE if capture else None)
        return result.stdout.strip() if capture else ""

    def command(self, argv: list[str], g7: bool = False, user: str = "") -> list[str]:
        if self.kind == "local":
            if g7:
                raise ValueError("G7 sync is Docker-only")
            return argv
        return self.compose + ["exec", "-T", "--user", user or f"{os.getuid()}:{os.getgid()}",
                               "-w", "/var/www/g7" if g7 else MODULE,
                               "-e", "NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache",
                               "-e", "COMPOSER_HOME=/tmp/g7pb-composer-home",
                               "-e", "XDG_CONFIG_HOME=/tmp/g7pb-psysh-config", "dev"] + argv

    def guard(self) -> None:
        if self.kind == "docker":
            if not self.task:
                raise ValueError("--task is required for the singleton Docker runtime")
            self.call(["bash", "scripts/coord-harness.sh", "runtime-guard", "--task", self.task])

    def identity(self, kind: str) -> dict:
        tools = [["node", "--version"], ["npm", "--version"]] if kind == "npm" else [["php", "-r", "echo PHP_VERSION;"], ["composer", "--version", "--no-ansi"]]
        identity = {"runtime": self.kind, "root": str(self.root.resolve()),
                    "tools": [self.call(self.command(argv), capture=True) for argv in tools]}
        if self.kind == "docker":
            container = self.call(self.compose + ["ps", "-q", "dev"], capture=True)
            if not container:
                raise ValueError("g7pb-dev is not running")
            identity["container"] = self.call(["docker", "inspect", "--format", "{{.Id}} {{.Image}}", container], capture=True)
        else:
            identity["platform"] = [platform.system(), platform.machine()]
        return identity

    def sentinels(self, kind: str) -> dict:
        if self.kind == "local":
            return {p: file_digest(self.root / p) for p in SENTINELS[kind] if (self.root / p).is_file()}
        result = {}
        for path in SENTINELS[kind]:
            try:
                result[path] = self.call(self.command(["sha256sum", path]), capture=True).split()[0]
            except subprocess.CalledProcessError:
                return {}
        return result


def read_state(root: Path) -> dict:
    try:
        state = json.loads((root / ".runtime/harness/environment.json").read_text())
        return state if isinstance(state, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(root: Path, state: dict) -> None:
    target = root / ".runtime/harness/environment.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=target.parent, prefix="environment-", delete=False) as stream:
        json.dump(state, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
        temporary = stream.name
    os.replace(temporary, target)


@contextmanager
def state_lock(root: Path) -> Iterator[None]:
    target = root / ".runtime/harness/environment.lock"
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError("environment preparation is already running; no parallel install/build started") from error
        yield


def prepare(runtime: Runtime, kinds: list[str], apply: bool = False) -> list[dict]:
    state = read_state(runtime.root)
    results = []
    for kind in kinds:
        key = runtime.kind + ":" + kind
        fingerprint = digest({"inputs": dependency_inputs(runtime.root, kind),
                              "environment": runtime.identity(kind), "command": INSTALL[kind]})
        sentinels = runtime.sentinels(kind)
        previous = state.get(key, {})
        reusable = (len(sentinels) == len(SENTINELS[kind]) and previous.get("fingerprint") == fingerprint
                    and previous.get("sentinels") == sentinels)
        status = "reused" if reusable else "required"
        if apply and not reusable:
            runtime.call(runtime.command(INSTALL[kind]))
            sentinels = runtime.sentinels(kind)
            if len(sentinels) != len(SENTINELS[kind]):
                raise ValueError(f"{kind} completed without expected installed metadata; no success recorded")
            state[key] = {"fingerprint": fingerprint, "sentinels": sentinels}
            save_state(runtime.root, state)
            status = "installed"
        results.append({"dependency": kind, "status": status, "fingerprint": fingerprint})
    return results


def build_inputs(root: Path) -> dict:
    paths = [p for folder in ("resources/js", "resources/css") for p in (root / folder).rglob("*") if p.is_file()]
    paths += [p for pattern in ("vite*.ts", "tsconfig*.json", "index.html") for p in root.glob(pattern) if p.is_file()]
    # These JSON files are imported by layoutPolicy.ts and builtinCatalog.ts.
    paths += [root / p for p in ("schemas/layout-policy-v1.json", "resources/block-packs/builtin-core/manifest.json") if (root / p).is_file()]
    paths += [root / p for p in (".env", ".env.local", ".env.production", ".env.production.local") if (root / p).is_file()]
    return {str(path.relative_to(root)): file_digest(path) for path in sorted(set(paths))}


def build(runtime: Runtime, apply: bool = False) -> dict:
    manifest = json.loads((runtime.root / "package.json").read_text())
    wiring = npm_script_inputs(runtime.root, manifest.get("scripts", {}), ("prebuild", "build", "postbuild"))
    dependencies = prepare(runtime, ["npm"], apply)
    fingerprint = digest({"sources": build_inputs(runtime.root), "dependencies": dependencies[0]["fingerprint"],
                          "environment": {key: value for key, value in os.environ.items() if key.startswith("VITE_")},
                          "command": ["npm", "run", "build"], "build_wiring": wiring})
    outputs = lambda: {str(p.relative_to(runtime.root)): file_digest(p) for p in (runtime.root / "dist").rglob("*") if p.is_file()}
    state, artifacts = read_state(runtime.root), outputs()
    key = runtime.kind + ":build"
    complete = all(p in artifacts and (runtime.root / p).stat().st_size > 0 for p in BUILD_OUTPUTS)
    reusable = complete and state.get(key) == {"fingerprint": fingerprint, "artifacts": artifacts}
    if not reusable and apply:
        runtime.call(runtime.command(["npm", "run", "build"]))
        artifacts = outputs()
        if not all(p in artifacts and (runtime.root / p).stat().st_size > 0 for p in BUILD_OUTPUTS):
            raise ValueError("build is missing required JS/CSS/inventory outputs; no success recorded")
        state[key] = {"fingerprint": fingerprint, "artifacts": artifacts}
        save_state(runtime.root, state)
    return {"dependencies": dependencies, "build": "reused" if reusable else "built" if apply else "required",
            "fingerprint": fingerprint}


def changed_paths(root: Path, base: str) -> list[str]:
    result = subprocess.run(["git", "diff", "--name-only", "-z", base, "--"], cwd=root, check=True, capture_output=True)
    untracked = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=root, check=True, capture_output=True)
    return sorted({p.decode() for p in (result.stdout + untracked.stdout).split(b"\0") if p})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["deps", "build", "sync", "status"])
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--runtime", choices=["local", "docker"], default="local")
    parser.add_argument("--task", default=os.environ.get("TASK", ""))
    parser.add_argument("--only", choices=["npm", "composer", "all"], default="all")
    parser.add_argument("--base")
    parser.add_argument("--paths", nargs="+")
    parser.add_argument("--restart-fpm", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    runtime = Runtime(args.root.resolve(), args.runtime, args.task)
    try:
        if args.operation == "status":
            result = {"records": read_state(runtime.root), "note": "Stored preparation receipts, not live runtime health."}
        elif args.operation == "sync":
            if args.base and args.paths:
                raise ValueError("choose --base or --paths, not both")
            if not args.base and not args.paths:
                raise ValueError("sync requires an explicit --base REF or --paths; no implicit full sync")
            result = sync_plan(args.paths or changed_paths(runtime.root, args.base), args.restart_fpm)
            if args.apply:
                if runtime.kind != "docker":
                    raise ValueError("runtime sync requires --runtime docker")
                if result["requires_runtime_rebuild"]:
                    raise ValueError("Docker configuration changed; rebuild/up is required, not a misleading cache refresh")
                runtime.guard()
                for action in result["actions"]:
                    runtime.call(runtime.command(action["argv"], g7=True, user="root" if action["name"] == "fpm" else "www-data"))
                result["applied"] = True
        else:
            kinds = ["npm", "composer"] if args.only == "all" else [args.only]
            if args.apply:
                runtime.guard()
                with state_lock(runtime.root):
                    result = build(runtime, True) if args.operation == "build" else prepare(runtime, kinds, True)
            else:
                result = build(runtime) if args.operation == "build" else prepare(runtime, kinds)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"environment: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
