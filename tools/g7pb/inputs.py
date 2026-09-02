"""Small conservative input graphs: incomplete discovery disables reuse, never expands checks."""
from dataclasses import dataclass
import json
from pathlib import Path
import re


@dataclass(frozen=True)
class Inputs:
    files: tuple[str, ...]
    reusable: bool


def source_inputs(root: Path, entry: str) -> Inputs:
    root = root.resolve()
    files: set[str] = set()
    complete = True
    extensions = (".ts", ".tsx", ".js", ".mjs", ".json")
    composer = root / "composer.json"
    namespaces = {}
    if entry.endswith(".php") and composer.is_file():
        config = json.loads(composer.read_text())
        for section in ("autoload", "autoload-dev"):
            namespaces.update(config.get(section, {}).get("psr-4", {}))
        files.add("composer.json")

    def visit(path: Path):
        nonlocal complete
        path = path.resolve()
        if not path.is_relative_to(root):
            complete = False
            return
        name = path.relative_to(root).as_posix()
        if name in files:
            return
        files.add(name)
        if not path.is_file():
            complete = False
            return
        if path.suffix not in (*extensions[:-1], ".php"):
            return
        source = path.read_text()
        if path.suffix == ".php":
            # Dynamic PHP loading and file IO cannot be proven by an import scan.
            if re.search(r"\b(?:require|include|file_get_contents|glob|scandir|ReflectionClass)\b|new\s+\$", source):
                complete = False
            for symbol in re.findall(r"(?<![\w\\])\\?([A-Z][\w]*(?:\\[\w]+)+)", source):
                for namespace, directory in sorted(namespaces.items(), key=lambda item: -len(item[0])):
                    if symbol.startswith(namespace):
                        if not isinstance(directory, str):
                            complete = False
                            break
                        visit(root / directory / (symbol[len(namespace):].replace("\\", "/") + ".php"))
                        break
            return
        if re.search(r"\b(?:readFileSync|readFile|readdirSync|globSync)\s*\(|\bimport\s*\(\s*[^'\"\s]", source):
            complete = False
        imports = re.findall(r"\b(?:from|import)\s*['\"]([^'\"]+)['\"]|\b(?:import|require)\s*\(\s*['\"]([^'\"]+)['\"]", source)
        for pair in imports:
            target = next(value for value in pair if value)
            if not target.startswith("."):
                if target.startswith(("@/", "~/")):
                    complete = False
                continue  # External modules are covered by package-lock.json.
            candidate = path.parent / target
            candidates = [candidate]
            if candidate.suffix in (".js", ".jsx"):
                candidates += [candidate.with_suffix(ext) for ext in (".ts", ".tsx")]
            if not candidate.suffix:
                candidates += [Path(str(candidate) + ext) for ext in extensions]
                candidates += [candidate / ("index" + ext) for ext in extensions]
            resolved = next((item for item in candidates if item.is_file()), candidate)
            visit(resolved)

    visit(root / entry)
    return Inputs(tuple(sorted(files)), complete)
