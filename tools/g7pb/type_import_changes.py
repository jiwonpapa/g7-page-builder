"""Exclude proven type-import-only consumer edits from browser selection only."""
import json
from pathlib import Path
import subprocess


def browser_sources(root: Path, sources: list[str], base: str) -> list[str]:
    script = Path(__file__).resolve().parents[2] / "scripts/lib/typeImportChanges.mjs"
    pairs = []
    for path in sources:
        # New/deleted files and domain declaration changes keep their mapping.
        if path.startswith("resources/js/documents/"):
            continue
        try:
            before = subprocess.run(["git", "-C", str(root), "show", f"{base}:{path}"],
                                    capture_output=True, text=True, check=True, timeout=10).stdout
            after = (root / path).read_text()
            if before != after:
                pairs.append({"path": path, "before": before, "after": after})
        except (OSError, UnicodeError, subprocess.SubprocessError):
            continue
    if not pairs:
        return sources
    try:
        result = subprocess.run(["node", str(script)], input=json.dumps(pairs),
                                capture_output=True, text=True, check=True, timeout=20)
        unchanged = json.loads(result.stdout)
        eligible = {pair["path"] for pair in pairs}
        if not isinstance(unchanged, list) or not all(isinstance(path, str) and path in eligible for path in unchanged):
            return sources
        return [path for path in sources if path not in unchanged]
    except (OSError, ValueError, subprocess.SubprocessError):
        return sources
