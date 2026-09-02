"""Read-only content selection and technical checks; never edits a product or ledger."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Sequence

PACK = "resources/block-packs/builtin-core/manifest.json"
KITS = "resources/store/source/page-kits/manifest.json"
SHELL_IDS = ("shell", "mobile", "editor")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def catalog(root: Path) -> dict[str, list[str]]:
    pack, kits = read_json(root / PACK), read_json(root / KITS)
    result = {
        "kit": [item["slug"] for item in kits["kits"]],
        "block": [f"block:{item['block_id']}@{item['block_version']}" for item in pack["blocks"]],
        "preset": [f"preset:{pack['pack_id']}:{item['preset_id']}" for item in pack["presets"]],
        "site-shell": list(SHELL_IDS),
    }
    for kind, ids in result.items():
        if not ids or len(set(ids)) != len(ids):
            raise ValueError(f"Empty or duplicate {kind} inventory")
    return result


def select(root: Path, kind: str, ids: str | None, all_items: bool) -> list[str]:
    available = catalog(root)[kind]
    if all_items == (ids is not None):
        raise ValueError("Choose exactly one of --ids and --all")
    selected = available if all_items else (ids or "").split(",")
    if any(not value or value.strip() != value for value in selected) or len(set(selected)) != len(selected):
        raise ValueError("Target IDs must be nonempty, unique and have no surrounding whitespace")
    unknown = sorted(set(selected) - set(available))
    if unknown:
        raise ValueError(f"Unknown {kind} IDs: {', '.join(unknown)}")
    return selected


def select_changes(root: Path, base: str, paths: list[str]) -> list[dict]:
    """Resolve declared content ownership. Unknown paths require an explicit plan."""
    inventories = catalog(root)
    pack = read_json(root / PACK)
    selected: dict[str, set[str]] = {}

    def add(kind: str, ids: Sequence[str]):
        selected.setdefault(kind, set()).update(ids)

    def old_json(path: str):
        result = subprocess.run(["git", "show", f"{base}:{path}"], cwd=root, text=True,
                                capture_output=True, check=False)
        if result.returncode:
            raise ValueError(f"Cannot inspect content baseline: {base}:{path}")
        return json.loads(result.stdout)

    for path in paths:
        if path == PACK:
            old = old_json(path)
            for kind, field, key in [("block", "blocks", "block_id"), ("preset", "presets", "preset_id")]:
                before = {item[key]: item for item in old[field]}
                for item in pack[field]:
                    if before.get(item[key]) != item:
                        identity = (f"block:{item[key]}@{item['block_version']}" if kind == "block"
                                    else f"preset:{pack['pack_id']}:{item[key]}")
                        add(kind, [identity])
                        if kind == "preset" and before.get(item[key], {}).get("props") != item.get("props"):
                            first = next(preset for preset in pack["presets"] if preset["block_id"] == item["block_id"])
                            if first[key] == item[key]:
                                owner = next(block for block in pack["blocks"] if block["block_id"] == item["block_id"])
                                add("block", [f"block:{owner['block_id']}@{owner['block_version']}"])
                removed = sorted(set(before) - {item[key] for item in pack[field]})
                if removed:
                    raise ValueError(f"Deleted {kind} IDs require an explicit inventory scope: {', '.join(removed)}; select --ids or --all")
        elif path == KITS:
            old, current = old_json(path), read_json(root / KITS)
            before = {item["slug"]: item for item in old["kits"]}
            ids = [item["slug"] for item in current["kits"] if before.get(item["slug"]) != item]
            removed = sorted(set(before) - set(inventories["kit"]))
            if removed:
                raise ValueError(f"Deleted kit IDs require an explicit inventory scope: {', '.join(removed)}; select --ids or --all")
            if old.get("page_kit_version") != current.get("page_kit_version"):
                raise ValueError("Shared Page Kit version changed; select explicit --ids or --all")
            add("kit", ids)
        elif path.startswith("resources/store/source/page-kits/"):
            slug = path.split("/")[4]
            if slug not in inventories["kit"]:
                raise ValueError(f"Unknown Kit path: {path}")
            add("kit", [slug])
        elif path.startswith("resources/store/source/screenshots/"):
            names = [slug for slug in inventories["kit"] if Path(path).name.startswith(slug + "-")]
            if not names:
                raise ValueError(f"Unowned Kit screenshot: {path}")
            add("kit", names)
        elif path in {"src/Application/Compilation/HtmlDocumentCompiler.php", "resources/css/page-builder-public.css",
                      "resources/css/page-builder-core.css", "resources/css/page-builder-editor-wysiwyg.css"}:
            # Shared code alone does not prove which rendered products changed.
            # Neither a representative sample nor automatic full promotion is evidence.
            raise ValueError(f"Shared content input has no proven target scope: {path}; select explicit --ids or --all")
        elif any(token in path.lower() for token in ("site-shell", "siteshell", "mobileNavigation".lower(), "sitepart")):
            raise ValueError(f"Site Shell input requires an explicit evidence scope: {path}; select --ids or --all")
        elif path.startswith("resources/js/editor/") and (root / path).is_file():
            source = (root / path).read_text(encoding="utf-8")
            blocks = [item for item in pack["blocks"] if item["block_id"] in source
                      or re.search(r"\b" + re.escape(item.get("editor_component", "\0")) + r"\s*:", source)]
            if not blocks:
                raise ValueError(f"No proven block ownership for {path}")
            block_ids = {item["block_id"] for item in blocks}
            add("block", [f"block:{item['block_id']}@{item['block_version']}" for item in blocks])
            add("preset", [f"preset:{pack['pack_id']}:{item['preset_id']}" for item in pack["presets"] if item["block_id"] in block_ids])
        else:
            raise ValueError(f"Unclassified content input: {path}; select explicit targets")
    return [{"kind": kind, "ids": sorted(ids)} for kind, ids in sorted(selected.items()) if ids]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_store(root: Path, ids: list[str], all_items: bool = False, run=subprocess.run) -> dict:
    """Build only into an owned temporary directory and compare; never repair dist."""
    with tempfile.TemporaryDirectory(prefix="g7pb-store-check-") as temporary:
        output = Path(temporary)
        command = ["php", str(root / "scripts/build-official-store.php"), "--output-dir", temporary]
        if not all_items:
            command += ["--kits", ",".join(ids)]
        run(command, cwd=root, check=True)
        generated = sorted(path for path in output.rglob("*") if path.is_file())
        if not generated or not (output / "catalog.json").is_file():
            raise ValueError("Store checker produced no catalog")
        changed = [str(path.relative_to(output)) for path in generated
                   if not (root / "resources/store/dist" / path.relative_to(output)).is_file()
                   or digest(path) != digest(root / "resources/store/dist" / path.relative_to(output))]
        if changed:
            raise ValueError("Store artifacts are stale (not modified): " + ", ".join(changed))
        return {"status": "passed", "kind": "kit", "ids": ids, "files_checked": len(generated), "product_written": False}


def plan(root: Path, kind: str, ids: list[str], all_items: bool = False) -> dict:
    command = (["node", "scripts/check-site-shell-product-quality.mjs", "--ids", ",".join(ids)]
               if kind == "site-shell" else ["node", "scripts/check-block-quality-evidence.mjs", "--technical", "--ids", ",".join(ids), "--json"])
    return {"kind": kind, "ids": ids, "mode": "technical", "product_written": False,
            "ledger_written": False, "browser_executed": False,
            "command": (["php", "scripts/build-official-store.php", "--output-dir", "<owned-temp>"]
                        + ([] if all_items else ["--kits", ",".join(ids)])) if kind == "kit" else command,
            "browser_followup": {"spec": "tests/E2E/editorLayoutParity.spec.ts", "env": {"G7PB_PAGE_KIT_IDS": ",".join(ids)}} if kind == "kit" else None}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["inspect", "check"])
    parser.add_argument("--kind", choices=["kit", "block", "preset", "site-shell"], required=True)
    parser.add_argument("--ids")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args(argv)
    try:
        root = args.root.resolve()
        ids = select(root, args.kind, args.ids, args.all)
        result = plan(root, args.kind, ids, args.all)
        if args.action == "check":
            if args.kind == "kit":
                result = check_store(root, ids, args.all)
            else:
                subprocess.run(result["command"], cwd=root, check=True, env=os.environ.copy())
                result["status"] = "passed"
        else:
            result["status"] = "planned-not-executed"
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
