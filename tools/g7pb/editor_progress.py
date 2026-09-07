"""Read-only editor development records, not product acceptance or deployment."""
import argparse
from datetime import date
import json
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.parse import unquote, urlsplit


LEDGER = "docs/productization/editor-progress.json"
DASHBOARD = "docs/productization/editor-progress.md"
PLAN = "docs/productization/editor-plan.md"
POLICY = "docs/productization/editing-policy.md"
MANAGED_FILES = (LEDGER, DASHBOARD, PLAN, POLICY)
STATES = ("planned", "in_progress", "blocked", "done")
LABELS = dict(zip(STATES, ("계획", "진행", "차단", "완료")))
NOTICE = "이 계획의 작업 진척이며 전체 제품 완성률이 아닙니다. 문서 검사와 제품 검증은 다릅니다. 이 명령은 배포를 실행하지 않습니다."
LIMIT = "완료 증거의 경로·형식·충족 관계를 검사하며 실제 시험 결과의 진실성이나 현재 HEAD의 제품 동작을 자동 보증하지 않습니다. Git SHA는 형식과 필수 기록만 검사합니다."


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text(value, name):
    require(isinstance(value, str) and bool(value.strip()), f"{name}: non-empty text required")
    return value


def identifier(value, name):
    require(isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", value), f"{name}: invalid ID")
    return value


def sha(value, name):
    require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value), f"{name}: 40-character commit required")


def strings(value, name, *, empty=False):
    require(isinstance(value, list) and (empty or value), f"{name}: list required")
    for entry in value:
        text(entry, name)
    require(len(value) == len(set(value)), f"{name}: duplicates")
    return value


def records(value, name, *, empty=False):
    require(isinstance(value, list) and (empty or value), f"{name}: records required")
    require(all(isinstance(entry, dict) for entry in value), f"{name}: object required")
    return value


def keys(value, expected, name):
    require(isinstance(value, dict) and set(value) == set(expected.split()), f"{name}: unexpected or missing fields")


def repo_file(root, value, *, exists=True):
    text(value, "path")
    path = PurePosixPath(value)
    require(path.parts and not path.is_absolute() and value == path.as_posix() and ".." not in path.parts
            and not any(char in value for char in ("\\", "\0", "\n", "\r", "#", "?", ":")), f"Unsafe repository path: {value}")
    target = root / value
    require(target.resolve().is_relative_to(root.resolve()), f"Path escapes repository: {value}")
    if exists:
        require(target.is_file(), f"Missing file: {value}")
    return target


def local_links(root, source, *, allow_missing=()):
    """Check local Markdown file destinations; no web requests or anchor inference."""
    content = re.sub(r"```[\s\S]*?```", "", source.read_text())
    for raw in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", content):
        target = raw.strip()
        target = target[1:target.find(">")] if target.startswith("<") else target.split(' "', 1)[0]
        parsed = urlsplit(target)
        if parsed.scheme in {"https", "http", "mailto"} or target.startswith("#"):
            continue
        require(not parsed.scheme and not parsed.netloc, f"Unsupported document link: {target}")
        name = unquote(parsed.path)
        if not name:
            continue
        name = re.sub(r":\d+$", "", name)
        require(not Path(name).is_absolute() and "\\" not in name, f"Non-portable document link: {target}")
        linked = (source.parent / name).resolve()
        require(linked.is_relative_to(root.resolve()) and (linked.exists() or linked in allow_missing), f"Missing or escaping document link in {source.name}: {target}")


def indexed(entries, name):
    result = {}
    for entry in records(entries, name):
        key = identifier(entry.get("id"), name)
        require(key not in result, f"{name}: duplicate ID {key}")
        result[key] = entry
    return result


def input_files(root):
    """Declared local inputs only; malformed records remain the checker's failure."""
    found = set(MANAGED_FILES)
    source = Path(root) / LEDGER
    if not source.is_file():
        return tuple(sorted(found))
    try:
        data = json.loads(source.read_text())
        candidates = [entry["path"] for entry in data["documents"]]
        candidates += [name for entry in data["baseline"] for key in ("source_paths", "historical_evidence") for name in entry[key]]
        candidates += [entry["path"] for item in data["items"] for entry in item["evidence"]]
        for name in candidates:
            repo_file(Path(root), name, exists=False)
            found.add(name)
    except (ValueError, OSError, TypeError, KeyError):
        pass
    return tuple(sorted(found))


def validate(root, *, check_dashboard=True):
    root = Path(root).resolve()
    data = json.loads(repo_file(root, LEDGER).read_text())
    keys(data, "schema_version plan_id baseline_sha updated_at policy_file plan_file dashboard_file documents acceptance phases baseline items", "ledger")
    require(data["schema_version"] == "g7pb-editor-progress/v1", "Unsupported schema_version")
    require(data["plan_id"] == "editor-maturity-20260907", "Unexpected plan_id")
    sha(data["baseline_sha"], "baseline_sha")
    require(isinstance(data["updated_at"], str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", data["updated_at"]), "updated_at: ISO date required")
    date.fromisoformat(data["updated_at"])
    for key, expected in (("policy_file", POLICY), ("plan_file", PLAN), ("dashboard_file", DASHBOARD)):
        require(data[key] == expected, f"{key}: fixed repository path required")
        repo_file(root, expected, exists=check_dashboard or expected != DASHBOARD)

    documents = records(data["documents"], "documents")
    document_paths = []
    for document in documents:
        keys(document, "path role required_text", "document")
        require(document["role"] in {"current", "historical", "reference"}, "Invalid document role")
        marker = text(document["required_text"], "required_text")
        name = document["path"]
        source = repo_file(root, name, exists=check_dashboard or name != DASHBOARD)
        document_paths.append(name)
        if name == DASHBOARD and not check_dashboard:
            continue
        require(marker in source.read_text(), f"Missing required_text in {name}")
        if source.suffix == ".md" and document["role"] == "current":
            local_links(root, source, allow_missing=() if check_dashboard else ((root / DASHBOARD).resolve(),))
    require(len(document_paths) == len(set(document_paths)), "Duplicate document path")
    require({POLICY, PLAN, DASHBOARD}.issubset(document_paths), "Managed documents must be registered")

    acceptance = indexed(data["acceptance"], "acceptance")
    for entry in acceptance.values():
        keys(entry, "id description required_evidence", "acceptance")
        text(entry["description"], "acceptance description")
        for kind in strings(entry["required_evidence"], "required_evidence"):
            identifier(kind, "evidence kind")
    phases = indexed(data["phases"], "phases")
    for phase in phases.values():
        keys(phase, "id title", "phase")
        text(phase["title"], "phase title")
    for baseline in indexed(data["baseline"], "baseline").values():
        keys(baseline, "id title state source_paths historical_evidence", "baseline")
        text(baseline["title"], "baseline title")
        require(baseline["state"] in {"implemented", "partial", "missing"}, "Invalid baseline state")
        for name in strings(baseline["source_paths"], "source_paths", empty=baseline["state"] == "missing"):
            repo_file(root, name)
        for name in strings(baseline["historical_evidence"], "historical_evidence", empty=True):
            repo_file(root, name)

    items = indexed(data["items"], "items")
    for item in items.values():
        keys(item, "id phase title status depends_on acceptance_ids owner_task implementation_commit integrated_commit evidence blocked_reason scope completion", "item")
        text(item["title"], "item title")
        text(item["completion"], "completion")
        require(item["phase"] in phases, f"Unknown phase: {item['phase']}")
        require(item["status"] in STATES, f"Invalid status: {item['status']}")
        dependencies = strings(item["depends_on"], "depends_on", empty=True)
        require(set(dependencies).issubset(items) and item["id"] not in dependencies, f"Invalid dependency: {item['id']}")
        criteria = strings(item["acceptance_ids"], "acceptance_ids")
        require(set(criteria).issubset(acceptance), f"Unknown acceptance: {item['id']}")
        if item["owner_task"] is not None:
            identifier(item["owner_task"], "owner_task")
        for field in ("implementation_commit", "integrated_commit"):
            if item[field] is not None:
                sha(item[field], field)
        for name in strings(item["scope"], "scope"):
            repo_file(root, name, exists=False)
        if item["status"] == "blocked":
            text(item["blocked_reason"], "blocked_reason")
        else:
            require(item["blocked_reason"] is None, "blocked_reason must be null outside blocked state")
        covered = set()
        for evidence in records(item["evidence"], "evidence", empty=True):
            keys(evidence, "acceptance_id kind commit result path", "evidence")
            require(evidence["acceptance_id"] in criteria, "Evidence acceptance does not belong to item")
            identifier(evidence["kind"], "evidence kind")
            require(evidence["result"] == "pass", "Evidence result must be pass")
            sha(evidence["commit"], "evidence commit")
            repo_file(root, evidence["path"])
            pair = (evidence["acceptance_id"], evidence["kind"])
            require(pair not in covered, "Duplicate evidence kind for acceptance")
            covered.add(pair)
        if item["status"] == "done":
            require(item["implementation_commit"] is not None and item["integrated_commit"] is not None, "Done requires implementation and integration commits")
            require(all(items[dep]["status"] == "done" for dep in dependencies), "Done requires completed dependencies")
            required = {(criterion, kind) for criterion in criteria for kind in acceptance[criterion]["required_evidence"]}
            require(required.issubset(covered), f"Missing completion evidence: {item['id']}")

    visited, active = set(), set()
    def visit(item_id):
        require(item_id not in active, f"Dependency cycle: {item_id}")
        if item_id in visited:
            return
        active.add(item_id)
        for dependency in items[item_id]["depends_on"]:
            visit(dependency)
        active.remove(item_id)
        visited.add(item_id)
    for item_id in items:
        visit(item_id)
    if check_dashboard:
        require((root / DASHBOARD).read_text() == markdown(data), "Dashboard differs from status --markdown; update explicitly")
    return data


def summary(data):
    items = data["items"]
    done = {item["id"] for item in items if item["status"] == "done"}
    return {
        "plan_id": data["plan_id"], "updated_at": data["updated_at"], "baseline_sha": data["baseline_sha"],
        "counts": {state: sum(item["status"] == state for item in items) for state in STATES},
        "total": len(items), "baseline_count": len(data["baseline"]),
        "next": [item["id"] for item in items if item["status"] in {"planned", "in_progress"} and set(item["depends_on"]).issubset(done)],
        "items": items, "notice": NOTICE, "limits": LIMIT,
        "product_verified": False, "deployment_executed": False,
    }


def markdown(data):
    state = summary(data)
    escape = lambda value: str(value).replace("|", "\\|").replace("\n", " ")
    lines = ["# 편집기 개발 진척", "", f"원장 갱신: {data['updated_at']} · 기준 SHA: `{data['baseline_sha']}`", "",
             NOTICE, "", f"계획 작업 완료 **{state['counts']['done']}/{state['total']}** · 기존 기반 {state['baseline_count']}개는 분모에서 제외합니다.", "",
             "[개발 계획](editor-plan.md) · [편집 정책](editing-policy.md) · [진척 원장](editor-progress.json)", "",
             "| 단계 | 작업 | 상태 | 선행 작업 | 담당 task |", "|---|---|---|---|---|"]
    phases = {phase["id"]: phase["title"] for phase in data["phases"]}
    for item in data["items"]:
        lines.append("| " + " | ".join(map(escape, (phases[item["phase"]], item["id"] + " · " + item["title"], LABELS[item["status"]], ", ".join(item["depends_on"]) or "없음", item["owner_task"] or "미배정"))) + " |")
    lines += ["", "다음 진행 가능: " + (", ".join(state["next"]) or "없음"), ""]
    blocked = [item for item in data["items"] if item["status"] == "blocked"]
    lines += [f"- 차단 {item['id']}: {escape(item['blocked_reason'])}" for item in blocked]
    if blocked:
        lines.append("")
    lines += ["조회: `make editor-status` · 정합성 검사: `make editor-plan-check`", "", LIMIT, ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("status", "check"))
    outputs = parser.add_mutually_exclusive_group()
    outputs.add_argument("--json", action="store_true")
    outputs.add_argument("--markdown", action="store_true")
    args = parser.parse_args(argv)
    if args.action == "check" and (args.json or args.markdown):
        parser.error("Output formats apply to status only")
    root = Path(__file__).resolve().parents[2]
    try:
        data = validate(root, check_dashboard=args.action == "check")
        if args.action == "check":
            print("EDITOR_PLAN_OK: 문서·진척 정합성 확인. " + NOTICE)
            print(LIMIT)
        elif args.json:
            print(json.dumps(summary(data), ensure_ascii=False, indent=2))
        elif args.markdown:
            print(markdown(data), end="")
        else:
            state = summary(data)
            print(f"편집기 개발: {state['counts']['done']}/{state['total']} 완료 · 진행 {state['counts']['in_progress']} · 차단 {state['counts']['blocked']}")
            print("다음 진행 가능: " + (", ".join(state["next"]) or "없음"))
            for item in data["items"]:
                print(f"{item['id']} [{LABELS[item['status']]}] {item['title']}")
            print(NOTICE)
            print(LIMIT)
        return 0
    except (ValueError, OSError, TypeError, KeyError) as error:
        print(f"EDITOR_PLAN_ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
