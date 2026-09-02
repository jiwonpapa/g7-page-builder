"""Fixed-plan execution. Failure never expands scope or starts an automatic retry."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import tempfile
import time
from .model import Plan


def digest_gate(root, gate):
    files = {}
    for name in gate.inputs:
        path = root / name
        if path.is_dir():
            raise ValueError(f"Gate input must be a file: {name}")
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else "missing"
    body = {"version": 2, "gate": gate.name, "argv": gate.argv, "env": gate.env,
            "platform": platform.platform(), "python": platform.python_version(), "files": files}
    # Preserve receipts for unchanged ordinary checks. Only gates using the new
    # execution/dependency contract get extra fingerprint fields.
    if gate.execution != "runtime":
        body["execution"] = gate.execution
    if gate.depends_on:
        body["depends_on"] = gate.depends_on
    for tool in gate.requires:
        if tool in {"node", "php"}:
            body[tool] = subprocess.check_output([tool, "--version"], text=True).splitlines()[0]
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def receipt_directory(root):
    common = Path(subprocess.check_output(["git", "-C", str(root), "rev-parse", "--git-common-dir"], text=True).strip())
    if not common.is_absolute():
        common = root / common
    return common.resolve() / "g7pb-coordination-v1" / "python-checks"


def execute(root: Path, plan: Plan, *, task="", executor=None, receipts=None):
    if plan.unresolved:
        raise ValueError("Scope unresolved; nothing executed:\n" + "\n".join(plan.unresolved))
    preceding = set()
    for gate in plan.gates:
        if gate.execution not in {"runtime", "controller"}:
            raise ValueError(f"Unknown gate execution location: {gate.execution}")
        if gate.name in preceding or not set(gate.depends_on).issubset(preceding):
            raise ValueError(f"Gate dependency must appear exactly once before {gate.name}: {gate.depends_on}")
        preceding.add(gate.name)
    root = Path(root)
    executor = executor or subprocess.run
    receipts = Path(receipts) if receipts else receipt_directory(root)
    receipts.mkdir(parents=True, exist_ok=True)
    results = []
    for gate in plan.gates:
        if gate.deferred:
            if plan.phase != "submission" or not gate.runtime:
                raise ValueError(f"Only submission runtime gates may be deferred: {gate.name}")
            print(f"DEFERRED gate={gate.name}; required during integration, NOT acceptance", flush=True)
            results.append({"gate": gate.name, "status": "deferred", "executions": 0})
            continue
        completed = {item["gate"] for item in results if item["status"] in {"passed", "reused"}}
        if not set(gate.depends_on).issubset(completed):
            raise ValueError(f"Required predecessor did not pass: {gate.name}")
        if gate.runtime and not task and os.environ.get("CI") != "true":
            raise ValueError(f"Runtime lease required: {gate.name}")
        if gate.runtime and os.environ.get("CI") == "true" and "browser" in gate.requires and not os.environ.get("G7PB_BASE_URL"):
            raise ValueError("CI browser runtime is not configured; this is not a passed/skipped test")
        if gate.runtime and task:
            subprocess.run(["bash", "scripts/coord-harness.sh", "runtime-guard", "--task", task], cwd=root, check=True)
        key = digest_gate(root, gate)
        receipt = receipts / (key + ".json")
        if gate.reusable and not gate.runtime and receipt.exists():
            try:
                previous = json.loads(receipt.read_text())
            except (ValueError, OSError):
                previous = {}
            if previous.get("key") == key and previous.get("status") == "passed":
                print(f"REUSED gate={gate.name}", flush=True)
                results.append({"gate": gate.name, "status": "reused", "executions": 0})
                continue
        environment = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        for name, value in gate.env:
            if value is None:
                environment.pop(name, None)
            else:
                environment[name] = value
        if task:
            environment["TASK"] = task
        started = time.monotonic()
        print(f"RUN gate={gate.name} reason={gate.reason}", flush=True)
        argv = list(gate.argv)
        if gate.runtime and gate.execution == "runtime" and task and os.environ.get("CI") != "true" and argv[0] != "make":
            from .environment import Runtime
            # Docker exec does not inherit host-side env overrides. Carry only
            # the plan's explicit non-secret selectors into the runtime command.
            remove = [part for key, value in gate.env if value is None for part in ("-u", key)]
            assign = [f"{key}={value}" for key, value in gate.env if value is not None]
            selected = ["env", *remove, *assign, *argv] if gate.env else argv
            argv = Runtime(root, "docker", task).command(selected)
        result = executor(argv, cwd=root, env=environment, check=False)
        record = {"key": key, "gate": gate.name, "status": "passed" if result.returncode == 0 else "failed",
                  "executions": 1, "seconds": round(time.monotonic() - started, 3), "inputs": gate.inputs}
        results.append(record)
        if result.returncode:
            print(f"FAILED gate={gate.name}; no retry or escalation", flush=True)
            return result.returncode, results
        if digest_gate(root, gate) != key:
            raise ValueError(f"Inputs changed while {gate.name} ran; no successful receipt recorded")
        if gate.reusable and not gate.runtime:
            fd, staged = tempfile.mkstemp(prefix="receipt-", dir=receipts)
            try:
                with os.fdopen(fd, "w") as stream:
                    json.dump(record, stream)
                os.replace(staged, receipt)
            finally:
                if os.path.exists(staged):
                    os.unlink(staged)
        print(f"PASSED gate={gate.name}", flush=True)
    if not plan.gates:
        print("NO_CHECKS reason=no-executable-input-change (not product acceptance)", flush=True)
    return 0, results
