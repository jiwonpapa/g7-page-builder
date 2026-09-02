"""Release infrastructure only: temporary archives and fake transport, never deploy."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from g7pb import artifacts, release

COMMIT = "a" * 40
VERSION = "1.2.3"
PROOF = "b" * 64


class FakeTransport:
    def __init__(self, target="fixture"):
        self.target = {"ssh": target, "app_root": "/fixture/app", "base_url": "https://fixture.invalid"}
        self.matched = False
        self.calls = []
        self.fail_at = ""

    def event(self, name):
        self.calls.append(name)
        if self.fail_at == name:
            raise ValueError("fixture failure: " + name)

    def status(self, archive):
        self.event("status")
        return self.matched

    def doctor(self, archive): self.event("doctor")
    def upload(self, archive): self.event("upload")
    def reload(self, archive): self.event("reload")
    def smoke(self, archive): self.event("smoke")

    def apply(self, archive):
        self.event("apply")
        self.matched = True


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="g7pb-release-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.files = {}
        self.add_file("module.json", json.dumps({"identifier": artifacts.MODULE, "version": VERSION}))
        self.add_file("dist/js/page-builder-manager.iife.js", "ignored manager bundle")
        self.add_file("dist/js/page-builder-editor.iife.js", "editor bundle")
        self.add_file("resources/store/dist/catalog.json", '{"products":[]}')
        self.info = {"git_commit": COMMIT, "version": VERSION, "git_dirty": "false", "validated_commit": COMMIT,
                     "build_fingerprint": PROOF, "release_id": f"g7-page-builder-v{VERSION}-{COMMIT[:12]}"}
        self.path = self.root / "release.tar.gz"

    def add_file(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value)
        self.files[name] = path

    def archive(self):
        return artifacts.write_archive(self.path, self.files, self.info, 12345)

    def raw_archive(self, members):
        with tarfile.open(self.path, "w:gz") as archive:
            for member, content in members:
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))

    def test_archive_covers_ignored_manager_and_every_payload_byte(self):
        result = self.archive()
        self.assertIn("dist/js/page-builder-manager.iife.js", result["files"])
        self.assertEqual(set(result["files"]), set(self.files) | {"BUILD-INFO"})
        release.verify_payload(result, self.files, PROOF)
        self.assertEqual(result["info"]["validated_commit"], COMMIT)

    def test_changed_manager_or_false_build_proof_is_rejected(self):
        result = self.archive()
        with self.assertRaisesRegex(ValueError, "proven source"):
            release.verify_payload(result, self.files, "different proof")
        self.files["dist/js/page-builder-manager.iife.js"].write_text("unverified mutation")
        with self.assertRaisesRegex(ValueError, "proven source"):
            release.verify_payload(result, self.files, PROOF)

    def test_old_commit_or_version_is_rejected_before_transport(self):
        self.archive()
        for commit, version in [("c" * 40, VERSION), (COMMIT, "9.9.9")]:
            with self.assertRaisesRegex(ValueError, "currently verified"):
                artifacts.inspect_archive(self.path, commit, version)
        with patch.object(release, "approved_identity", return_value={"commit": "c" * 40, "version": VERSION}), \
             patch.object(release, "build_proof", return_value=PROOF), patch.object(release, "Transport") as transport, \
             contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(release.main(["deploy", "--root", str(self.root), "--task", "fixture", "--artifact", str(self.path)]), 2)
            transport.assert_not_called()

    def test_unsafe_tar_paths_links_devices_and_duplicate_members_are_rejected(self):
        for name in ["/absolute/file", artifacts.MODULE + "/../escape", artifacts.MODULE + "/a\\b"]:
            self.raw_archive([(tarfile.TarInfo(name), b"x")])
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                artifacts.inspect_archive(self.path, COMMIT, VERSION)
        for member_type in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE]:
            member = tarfile.TarInfo(artifacts.MODULE + "/linked")
            member.type = member_type
            member.linkname = "/etc/passwd"
            self.raw_archive([(member, b"")])
            with self.assertRaisesRegex(ValueError, "regular module files"):
                artifacts.inspect_archive(self.path, COMMIT, VERSION)
        member = tarfile.TarInfo(artifacts.MODULE + "/duplicate")
        self.raw_archive([(member, b"x"), (member, b"x")])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            artifacts.inspect_archive(self.path, COMMIT, VERSION)

    def test_checksum_inventory_cannot_omit_or_add_payload(self):
        self.archive()
        with tarfile.open(self.path, "r:gz") as source:
            members = [(member, source.extractfile(member).read()) for member in source.getmembers()]
        members.append((tarfile.TarInfo(artifacts.MODULE + "/unlisted.php"), b"unexpected"))
        self.raw_archive(members)
        with self.assertRaisesRegex(ValueError, "exactly cover"):
            artifacts.inspect_archive(self.path, COMMIT, VERSION)

    def test_artifact_is_deterministic_and_existing_release_is_not_overwritten(self):
        first = self.archive()
        other = artifacts.write_archive(self.root / "copy.tar.gz", self.files, self.info, 12345)
        self.assertEqual(first["sha256"], other["sha256"])
        with self.assertRaisesRegex(ValueError, "overwrite"):
            self.archive()

    def test_ignored_dist_is_included_but_untracked_source_is_not(self):
        for name in artifacts.ROOT_FILES - set(self.files):
            self.add_file(name, "fixture")
        self.add_file("src/Owned.php", "<?php")
        self.add_file("src/untracked-secret.php", "secret")
        tracked = sorted(name for name in self.files if not name.startswith("dist/") and "untracked" not in name)
        with patch.object(artifacts.subprocess, "run", return_value=SimpleNamespace(stdout="\0".join(tracked).encode())):
            selected = artifacts.payload(self.root)
        self.assertIn("dist/js/page-builder-manager.iife.js", selected)
        self.assertIn("src/Owned.php", selected)
        self.assertNotIn("src/untracked-secret.php", selected)

    def test_package_reuses_exact_archive_without_rebuilding_or_testing(self):
        self.add_file("src/Application/Compilation/HtmlDocumentCompiler.php", "const COMPILER_VERSION = 'v1';")
        self.add_file("schemas/page-builder-document.schema.json", '{"$id":"fixture-schema"}')
        identity = {"version": VERSION, "commit": COMMIT, "tree": "d" * 40, "timestamp": 12345}
        with patch.object(artifacts, "payload", return_value=self.files):
            first = release.package(self.root, identity, PROOF)
            second = release.package(self.root, identity, PROOF)
        self.assertEqual(first["sha256"], second["sha256"])
        self.assertTrue(second["reused"])

    def test_smoke_failure_resumes_without_transfer_apply_or_reload(self):
        archive, transport = self.archive(), FakeTransport()
        transport.fail_at = "smoke"
        with self.assertRaisesRegex(ValueError, "fixture failure"):
            release.deploy(self.root, transport, archive)
        self.assertEqual(transport.calls, ["status", "doctor", "upload", "apply", "reload", "smoke"])
        transport.fail_at, transport.calls = "", []
        self.assertEqual(release.deploy(self.root, transport, archive)["smoke"], "passed")
        self.assertEqual(transport.calls, ["status", "smoke"])
        transport.calls = []
        self.assertEqual(release.deploy(self.root, transport, archive)["smoke"], "reused")
        self.assertEqual(transport.calls, ["status"])

    def test_reload_failure_resumes_reload_and_smoke_only(self):
        archive, transport = self.archive(), FakeTransport()
        transport.fail_at = "reload"
        with self.assertRaises(ValueError):
            release.deploy(self.root, transport, archive)
        transport.fail_at, transport.calls = "", []
        release.deploy(self.root, transport, archive)
        self.assertEqual(transport.calls, ["status", "reload", "smoke"])

    def test_remote_applied_but_local_receipt_failure_does_not_reapply(self):
        archive, transport = self.archive(), FakeTransport()
        with patch.object(release, "save_progress", side_effect=OSError("fixture receipt failure")):
            with self.assertRaises(OSError):
                release.deploy(self.root, transport, archive)
        transport.calls = []
        release.deploy(self.root, transport, archive)
        self.assertEqual(transport.calls, ["status", "reload", "smoke"])

    def test_force_rechecks_only_smoke_and_other_target_does_not_reuse(self):
        archive, transport = self.archive(), FakeTransport()
        release.deploy(self.root, transport, archive)
        transport.calls = []
        release.deploy(self.root, transport, archive, force=True)
        self.assertEqual(transport.calls, ["status", "smoke"])
        other = FakeTransport("different-target")
        other.matched = True
        release.deploy(self.root, other, archive, smoke_only=True)
        self.assertEqual(other.calls, ["status", "smoke"])

    def test_smoke_only_cannot_deploy_or_claim_wrong_remote_artifact(self):
        archive, transport = self.archive(), FakeTransport()
        with self.assertRaisesRegex(ValueError, "does not match"):
            release.deploy(self.root, transport, archive, smoke_only=True)
        self.assertEqual(transport.calls, ["status"])

    def test_wrappers_have_no_product_tests_or_content_renderer_and_backup_is_retained(self):
        for script in ("release-package", "deploy-staging", "smoke-staging"):
            source = (ROOT / "scripts" / (script + ".sh")).read_text()
            self.assertLessEqual(len(source.splitlines()), 5)
            self.assertNotIn("npm", source)
            self.assertNotIn("--run", source)
        remote = (ROOT / "scripts/remote-deploy-staging.sh").read_text()
        self.assertNotIn("rm -rf", remote)
        self.assertNotIn("\\App\\Models", remote)
        self.assertIn("ModuleRepositoryInterface", remote)
        self.assertIn("Recovery copy retained", remote)
        doctor = (ROOT / "scripts/remote-staging-doctor.sh").read_text()
        self.assertNotIn("mysqldump", doctor)
        self.assertNotIn("1048576", doctor)
        self.assertEqual(len(release.ASSETS), 8)
        self.assertIn("dist/js/page-builder-manager.iife.js", release.ASSETS)

    def test_remote_artifact_readiness_blocks_apply_and_restores_previous_files(self):
        result, app, target, calls = self.run_remote_readiness(ready=False)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertEqual((target / "previous.php").read_text(), "previous module")
        self.assertFalse((target / ".g7pb-artifact-sha256").exists())
        self.assertIn("prior files restored", result.stdout)
        self.assertEqual(sum("page-builder:site-part-artifacts" in call for call in calls), 1)
        self.assertFalse(any("--prepare" in call for call in calls))

    def test_remote_readiness_pass_retains_recovery_copy_and_records_applied_identity(self):
        result, app, target, calls = self.run_remote_readiness(ready=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertTrue((target / ".g7pb-artifact-sha256").is_file())
        previous = list((app / "modules").glob(".*.rollback-*/previous.php"))
        self.assertEqual(len(previous), 1)
        self.assertEqual(previous[0].read_text(), "previous module")
        self.assertEqual(sum("page-builder:site-part-artifacts" in call for call in calls), 1)
        self.assertFalse(any("--prepare" in call for call in calls))

    def run_remote_readiness(self, *, ready):
        # Exercise the actual apply/rollback shell in a self-owned temporary app.
        # PHP and flock are fake transports; no application, DB or server is used.
        archive = self.archive()
        app = self.root / "app"
        target = app / "modules" / artifacts.MODULE
        target.mkdir(parents=True)
        (app / "artisan").write_text("fixture")
        (target / "previous.php").write_text("previous module")
        fakebin = self.root / "fakebin"
        fakebin.mkdir()
        calls = self.root / "php-calls.log"
        php = fakebin / "php"
        php.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$G7PB_FIXTURE_CALLS"
if [[ "$2" == page-builder:site-part-artifacts ]]; then exit "$G7PB_FIXTURE_READINESS"; fi
if [[ "$2" == tinker ]]; then printf 'active\\n'; fi
exit 0
''')
        php.chmod(0o755)
        flock = fakebin / "flock"
        flock.write_text("#!/usr/bin/env bash\nexit 0\n")
        flock.chmod(0o755)
        environment = {**os.environ, "PATH": str(fakebin) + os.pathsep + os.environ["PATH"],
                       "G7PB_FIXTURE_CALLS": str(calls), "G7PB_FIXTURE_READINESS": "0" if ready else "1"}
        result = subprocess.run([
            "bash", str(ROOT / "scripts/remote-deploy-staging.sh"), "apply", str(app), str(self.path),
            archive["sha256"], self.info["release_id"], "c" * 64, VERSION, "https://fixture.invalid",
        ], env=environment, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        return result, app, target, calls.read_text().splitlines() if calls.exists() else []

    def test_transport_rejects_shell_target_injection(self):
        for ssh, app, url in [("-oProxyCommand=bad", "/home/g7devops/public_html", "https://fixture.invalid"),
                              ("fixture", "/", "https://fixture.invalid"),
                              ("fixture", "/home/g7devops/public_html", "http://fixture.invalid")]:
            with self.assertRaises(ValueError):
                release.Transport(self.root, ssh, app, url)


if __name__ == "__main__":
    unittest.main()
