import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from tools.g7pb import artifacts
from tools.g7pb.site_kit_package import MANIFEST, GUIDE, BETA_GUIDE, build, package_bytes

ROOT = Path(__file__).resolve().parents[2]


class SiteKitPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="g7pb-kit-package-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        manifest = json.loads((ROOT / MANIFEST).read_text())
        for name in (MANIFEST, GUIDE, BETA_GUIDE, *[item["path"] for item in manifest["media"]]):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((ROOT / name).read_bytes())

    def test_archive_is_portable_exactly_checksummed_and_deterministic(self):
        name, data = package_bytes(self.root)
        self.assertEqual((name, data), package_bytes(self.root))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), len(set(names)))
            hashes = dict(line.split("  ", 1)[::-1] for line in archive.read("SHA256SUMS").decode().splitlines())
            self.assertEqual(set(hashes), set(names) - {"SHA256SUMS"})
            for path, sha in hashes.items():
                self.assertEqual(hashlib.sha256(archive.read(path)).hexdigest(), sha)
                self.assertNotIn("..", Path(path).parts)
            manifest = json.loads(archive.read("module-files/" + MANIFEST))
            self.assertEqual(len(manifest["pages"]), 4)
            for media in manifest["media"]:
                self.assertTrue(media["path"].startswith("resources/site-kits/professional-services-media/"))
                self.assertEqual(hashlib.sha256(archive.read("module-files/" + media["path"])).hexdigest(), media["sha256"])
            self.assertFalse(any(path.endswith((".php", ".js", ".html")) for path in names))
            self.assertEqual(json.loads(archive.read("PRODUCT.json"))["status"], "evaluation-candidate")

    def test_existing_artifact_is_reused_only_when_bytes_match(self):
        output = self.root / "out"
        first = build(self.root, output)
        self.assertEqual(first, build(self.root, output))
        (self.root / GUIDE).write_text("changed guide")
        with self.assertRaisesRegex(ValueError, "Refusing to replace"):
            build(self.root, output)
        self.assertEqual(hashlib.sha256(Path(first["path"]).read_bytes()).hexdigest(), first["sha256"])

    def test_missing_corrupted_and_escaping_media_fail_before_writing(self):
        manifest = json.loads((self.root / MANIFEST).read_text())
        media = self.root / manifest["media"][0]["path"]
        media.write_bytes(b"corrupt")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            build(self.root, self.root / "out")
        self.assertFalse((self.root / "out").exists())
        for path in ("../outside.webp", "resources/missing.webp"):
            manifest["media"][0]["path"] = path
            (self.root / MANIFEST).write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                package_bytes(self.root)

    def test_free_module_archive_excludes_paid_candidate_and_keeps_free_kit(self):
        free = "resources/site-kits/company-starter.json"
        names = [*artifacts.ROOT_FILES, free, MANIFEST]
        for name in names:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_text("fixture")
        dist = self.root / "dist/css/public.css"
        dist.parent.mkdir(parents=True)
        dist.write_text("body{}")
        with patch("tools.g7pb.artifacts.subprocess.run") as run:
            run.return_value.stdout = "\0".join(names).encode()
            files = artifacts.payload(self.root)
        self.assertIn(free, files)
        self.assertNotIn(MANIFEST, files)
        self.assertIn("dist/css/public.css", files)
