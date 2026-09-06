"""Build the separate evaluation kit; this does not release the free editor or sell a license."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

from .artifacts import safe_name

MANIFEST = "resources/site-kits/professional-services.json"
GUIDE = "docs/kits/professional-services.md"
BETA_GUIDE = "docs/free-beta.md"
PRODUCT = "jiwonpapa/professional-services"


def source_file(root: Path, name: str) -> bytes:
    safe_name(name)
    path = root / name
    if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError("Missing or escaping kit input: " + name)
    return path.read_bytes()


def package_bytes(root: Path) -> tuple[str, bytes]:
    manifest = json.loads(source_file(root, MANIFEST))
    if manifest.get("kit_id") != PRODUCT or manifest.get("kit_version") != "0.1.0":
        raise ValueError("This reviewed package builder supports only the 0.1.0 evaluation kit")
    files = {}
    for item in manifest["media"]:
        original = item["path"]
        data = source_file(root, original)
        if hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError("Kit media checksum mismatch: " + original)
        # The addon owns these new paths; installing it never overwrites free kit images.
        item["path"] = "resources/site-kits/professional-services-media/" + Path(original).name
        name = "module-files/" + item["path"]
        if name in files:
            raise ValueError("Duplicate kit media destination")
        files[name] = data
    files["module-files/" + MANIFEST] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    files["START-HERE.md"] = source_file(root, GUIDE)
    files["FREE-BETA.md"] = source_file(root, BETA_GUIDE)
    metadata = {"product": PRODUCT, "version": manifest["kit_version"], "status": "evaluation-candidate",
                "format": "g7pb-site-kit/v1", "compatibility": manifest["compatibility"],
                "delivery": "module-file-addon", "pages": len(manifest["pages"]),
                "source_sha256": hashlib.sha256(source_file(root, MANIFEST)).hexdigest(),
                "license_status": "commercial-terms-not-finalized"}
    files["PRODUCT.json"] = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode()
    files["SHA256SUMS"] = "".join(f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(files.items())).encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            entry = zipfile.ZipInfo(safe_name(name), date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    return "jiwonpapa-professional-services-0.1.0-evaluation.zip", output.getvalue()


def build(root: Path, output: Path) -> dict:
    name, data = package_bytes(root)
    output.mkdir(parents=True, exist_ok=True)
    target = output / name
    if target.exists():
        if target.is_symlink() or target.read_bytes() != data:
            raise ValueError("Refusing to replace an existing kit artifact; use a new output directory")
    else:
        with target.open("xb") as stream:
            stream.write(data)
    checksum = hashlib.sha256(data).hexdigest()
    sidecar = output / (name + ".sha256")
    expected = f"{checksum}  {name}\n"
    if sidecar.exists():
        if sidecar.is_symlink() or sidecar.read_text() != expected:
            raise ValueError("Refusing to replace an existing kit checksum")
    else:
        with sidecar.open("x") as stream:
            stream.write(expected)
    return {"path": str(target), "sha256": checksum, "bytes": len(data), "status": "evaluation-candidate"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(Path(__file__).resolve().parents[2], args.output), indent=2))
