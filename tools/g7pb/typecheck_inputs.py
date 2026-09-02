"""Conservative inputs for the declared npm TypeScript command, without Node at plan time.

Only plain JSON/relative extends and ordinary include/files/exclude are reusable.
Unsupported resolution/config/command forms still run the selected check, without
a receipt. They never widen the plan to full or disable ordinary supported reuse.
"""
from fnmatch import fnmatchcase
import json
from pathlib import Path
import shlex
import shutil
import subprocess
from .inputs import Inputs, source_inputs


def typecheck_inputs(root: Path) -> Inputs:
    root = root.resolve()
    found = {"package.json", "package-lock.json"}
    complete = True

    def local(path):
        nonlocal complete
        path = path.resolve()
        if not path.is_relative_to(root):
            complete = False
            return None
        found.add(path.relative_to(root).as_posix())
        if not path.is_file():
            complete = False
        return path

    config_path = root / "tsconfig.json"
    try:
        package = json.loads((root / "package.json").read_text())
        scripts = package.get("scripts", {})
        argv = shlex.split(scripts.get("typecheck", ""))
        if not argv or argv.pop(0) != "tsc" or any(scripts.get(hook) for hook in ("pretypecheck", "posttypecheck")):
            complete = False
        while argv:
            option = argv.pop(0)
            if option == "--noEmit":
                continue
            if option in ("-p", "--project") and argv:
                config_path = root / argv.pop(0)
            else:
                complete = False
    except (OSError, ValueError, TypeError, AttributeError):
        complete = False

    def config(path, seen):
        nonlocal complete
        path = local(path)
        if path is None or path in seen:
            complete = False
            return {}
        try:
            value = json.loads(path.read_text())
            if not isinstance(value, dict):
                raise ValueError("config must be an object")
            inherited = {}
            extends = value.get("extends")
            if extends:
                if not isinstance(extends, str) or not extends.startswith("."):
                    complete = False
                else:
                    target = path.parent / extends
                    inherited = config(target if target.suffix else target.with_suffix(".json"), seen | {path})
            for key in ("files", "include", "exclude"):
                if key in value:
                    if not isinstance(value[key], list) or not all(isinstance(item, str) for item in value[key]):
                        complete = False
                        continue
                    inherited[key] = [(path.parent, item) for item in value[key]]
            options = {**inherited.get("compilerOptions", {}), **value.get("compilerOptions", {})}
            inherited["compilerOptions"] = options
            if value.get("references") or any(options.get(key) for key in (
                "paths", "baseUrl", "rootDirs", "typeRoots", "moduleSuffixes", "plugins", "allowJs",
                "allowArbitraryExtensions", "customConditions",
            )):
                complete = False
            inherited.setdefault("directory", path.parent)
            return inherited
        except (OSError, ValueError, TypeError):
            complete = False
            return {}

    selected = config(config_path, set())
    compiler = root / "node_modules/typescript/bin/tsc"
    # CI plans before dependency installation. Once the selected Node tools are
    # ready, ask the actual compiler for its program files (no typecheck or emit).
    # This handles static import syntax, ambient types and config inheritance
    # without treating example imports inside test strings as dependencies.
    if complete and compiler.is_file() and shutil.which("node"):
        try:
            result = subprocess.run(["node", str(compiler), "--noEmit", "--listFilesOnly", "-p", str(config_path)],
                                    cwd=root, capture_output=True, text=True, timeout=30, check=False)
            if result.returncode:
                return Inputs(tuple(sorted(found)), False)
            for value in result.stdout.splitlines():
                path = Path(value)
                if not path.is_absolute() or not path.is_file():
                    return Inputs(tuple(sorted(found)), False)
                # Locked installed package types are represented by the lockfile;
                # workspace/shared source outside the subject cannot be reused.
                if "node_modules" in path.parts:
                    continue
                local(path)
            return Inputs(tuple(sorted(found)), complete)
        except (OSError, subprocess.SubprocessError):
            return Inputs(tuple(sorted(found)), False)
    entries = []
    for directory, value in selected.get("files", []):
        target = local(directory / value)
        if target is not None:
            entries.append(target)
    includes = selected.get("include", [] if "files" in selected else [(selected.get("directory", root), "**/*")])
    exclusions = selected.get("exclude", [(root, name) for name in ("node_modules", "bower_components", "jspm_packages")])
    out_dir = selected.get("compilerOptions", {}).get("outDir")
    if out_dir:
        exclusions += [(selected.get("directory", root), out_dir)]

    def excluded(path):
        for directory, pattern in exclusions:
            try:
                relative = path.relative_to(directory).as_posix()
            except ValueError:
                continue
            if fnmatchcase(relative, pattern) or relative.startswith(pattern.rstrip("/") + "/"):
                return True
        return False

    for directory, pattern in includes:
        if Path(pattern).is_absolute() or ".." in Path(pattern).parts or not directory.is_relative_to(root):
            complete = False
            continue
        try:
            if not any(char in pattern for char in "*?[") and not Path(pattern).suffix:
                pattern = pattern.rstrip("/") + "/**/*"
            entries.extend(path for path in directory.glob(pattern)
                           if path.is_file() and path.suffix in {".ts", ".tsx", ".mts", ".cts"} and not excluded(path))
        except (OSError, ValueError):
            complete = False
    for path in set(entries):
        target = local(path)
        if target is None:
            continue
        if target.suffix in {".mts", ".cts"}:
            complete = False
        graph = source_inputs(root, target.relative_to(root).as_posix(), runtime=False)
        found.update(graph.files)
        complete = complete and graph.reusable
    return Inputs(tuple(sorted(found)), complete)
