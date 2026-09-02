"""Read-only planning and explicit project execution."""
import argparse
import importlib
import json
from pathlib import Path
import subprocess
import sys
from .planner import build_plan, changed_paths
from .runner import execute


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] in {"coord", "content", "environment", "release"}:
        return importlib.import_module("tools.g7pb." + argv[0]).main(argv[1:])
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("plan", "run"))
    parser.add_argument("--base", default="HEAD")
    parser.add_argument("--head")
    parser.add_argument("--phase", choices=("submission", "integration", "verification", "ci"), default="submission")
    parser.add_argument("--task", default="")
    parser.add_argument("--paths")
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    root = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
    paths = changed_paths(root, args.base, args.head)
    if args.paths is not None and sorted(filter(None, args.paths.split(","))) != paths:
        parser.error("Explicit scope does not match actual changes")
    plan = build_plan(root, paths, base=args.base, phase=args.phase, full=args.full)
    if args.action == "plan":
        print(json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))
        return 2 if plan.unresolved else 0
    print(f"PLAN phase={args.phase} changed={len(paths)} gates={len(plan.gates)} full={plan.full}", flush=True)
    try:
        return execute(root, plan, task=args.task)[0]
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"g7pb: {error}", file=sys.stderr)
        return 2
