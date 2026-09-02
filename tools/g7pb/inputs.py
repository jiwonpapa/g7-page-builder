"""Small conservative input graphs: incomplete discovery disables reuse, never expands checks."""
from dataclasses import dataclass
import json
from pathlib import Path
import re


@dataclass(frozen=True)
class Inputs:
    files: tuple[str, ...]
    reusable: bool


def php_references(source):
    """Conservative lexical class references, independent of installed PHP.

    This is a dependency graph, not PHP validation. PHPStan/the architecture
    tokenizer validate syntax and layering. Unresolved dynamic forms disable
    receipts; same-namespace names and imported aliases are still traversed.
    """
    clean = re.sub(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|/\*[\s\S]*?\*/|//[^\n]*|\#(?!\[)[^\n]*", " ", source)
    complete = not bool(re.search(r"\b(?:require|include|file_get_contents|glob|scandir|ReflectionClass)\b|new\s+\$|<<<", clean))
    name = r"\\?[A-Za-z_][A-Za-z0-9_]*(?:\\[A-Za-z_][A-Za-z0-9_]*)*"
    declarations = list(re.finditer(r"\bnamespace\s+(" + name + r")\s*[;{]", clean))
    regions = [("", clean[:declarations[0].start()] if declarations else clean)]
    regions.extend((match.group(1).strip("\\"), clean[match.end():declarations[i + 1].start() if i + 1 < len(declarations) else len(clean)])
                   for i, match in enumerate(declarations))
    references, imports = set(), set()
    for namespace, body in regions:
        aliases = {}
        for match in re.finditer(r"\buse\s+(?!\()([^;]+);", body):
            statement = match.group(1).strip()
            if statement.startswith(("function ", "const ")):
                continue
            group = re.fullmatch(r"(.+?)\\\s*\{([^{}]+)\}", statement)
            if "{" in statement and group is None:
                complete = False  # Trait adaptation is not an import declaration.
                continue
            prefix, members = (group.group(1).strip("\\") + "\\", group.group(2)) if group else ("", statement)
            for item in members.split(","):
                imported = re.fullmatch(r"\s*(" + name + r")(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*", item)
                if imported is None:
                    complete = False
                    continue
                target = prefix + imported.group(1).lstrip("\\")
                aliases[(imported.group(2) or target.rsplit("\\", 1)[-1]).lower()] = target
                imports.add(target)
        for symbol in re.findall(r"(?<![A-Za-z0-9_$\\])" + name, body):
            if symbol.startswith("\\"):
                references.add(symbol.lstrip("\\"))
                continue
            first, _, tail = symbol.partition("\\")
            if first.lower() == "namespace":
                references.add(namespace + ("\\" + tail if tail else ""))
            elif first.lower() in aliases:
                references.add(aliases[first.lower()] + ("\\" + tail if tail else ""))
            else:
                references.add((namespace + "\\" if namespace else "") + symbol)
    return references | imports, imports, complete


def source_inputs(root: Path, entry: str, *, runtime: bool = True) -> Inputs:
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
            # Resolve the fixture's explicit migration glob without executing PHP.
            # Its dynamic load remains non-reusable; these files select the test.
            pattern = r"glob\s*\(\s*dirname\s*\(\s*__DIR__\s*,\s*([1-9][0-9]*)\s*\)\s*\.\s*['\"](/[^'\"]+)['\"]\s*\)"
            for match in re.finditer(pattern, source):
                directory = path.parent
                for _ in range(min(int(match.group(1)), 100)):
                    directory = directory.parent
                if int(match.group(1)) > 100 or not directory.resolve().is_relative_to(root):
                    complete = False
                    continue
                selected = match.group(2).lstrip("/")
                if ".." in Path(selected).parts:
                    complete = False
                    continue
                for dependency in directory.glob(selected):
                    if dependency.is_file():
                        visit(dependency)
            references, imports, understood = php_references(source)
            complete = complete and understood
            for symbol in references:
                for namespace, directory in sorted(namespaces.items(), key=lambda item: -len(item[0])):
                    if symbol.startswith(namespace):
                        if not isinstance(directory, str):
                            complete = False
                            break
                        candidate = root / directory / (symbol[len(namespace):].replace("\\", "/") + ".php")
                        if candidate.is_file() or (symbol in imports and not candidate.with_suffix("").is_dir()):
                            visit(candidate)
                        break
            return
        if runtime and (re.search(r"\b(?:readFileSync|readFile|readdirSync|globSync)\s*\(|\b(?:import|require)\s*\(\s*[^'\"\s]", source)
                        or re.search(r"['\"](?:node:)?fs(?:/promises)?['\"]", source)):
            # A filesystem import may be aliased/destructured before invocation.
            # Type checking reads syntax/imports, not the program's runtime I/O.
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
