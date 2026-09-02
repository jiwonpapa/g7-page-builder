"""Release readiness uses fake transport and private receipt files, never a server."""
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from g7pb import release


class ReadinessTransport:
    def __init__(self):
        self.target = {"ssh": "fixture", "app_root": "/fixture/app", "base_url": "https://fixture.invalid"}
        self.applied_sha = None
        self.database_ready = True
        self.calls = []

    def status(self, archive):
        self.calls.append("status")
        return self.applied_sha == archive["sha256"]

    def doctor(self, archive): self.calls.append("doctor")
    def upload(self, archive): self.calls.append("upload")
    def reload(self, archive): self.calls.append("reload")

    def apply(self, archive):
        self.calls.append("apply")
        self.applied_sha = archive["sha256"]

    def smoke(self, archive):
        self.calls.append("smoke")
        if not self.database_ready:
            raise ValueError("Fixture Site Part artifacts are missing")


class ReleaseReadinessTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="g7pb-release-readiness-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.archive = {"sha256": "a" * 64}
        self.transport = ReadinessTransport()
        self.assertEqual(release.deploy(self.root, self.transport, self.archive)["smoke"], "passed")
        self.assertEqual(self.transport.calls, ["status", "doctor", "upload", "apply", "reload", "smoke"])
        self.transport.calls.clear()

    def test_explicit_smoke_observes_db_failure_after_a_previous_success(self):
        self.assert_failure_requires_recheck(smoke_only=True)

    def test_forced_smoke_failure_cannot_reuse_a_previous_success(self):
        self.assert_failure_requires_recheck(force=True)

    def assert_failure_requires_recheck(self, **options):
        self.transport.database_ready = False
        with self.assertRaisesRegex(ValueError, "Site Part artifacts are missing"):
            release.deploy(self.root, self.transport, self.archive, **options)
        self.assertEqual(self.transport.calls, ["status", "smoke"])
        self.assertEqual(self.transport.applied_sha, self.archive["sha256"])
        self.transport.calls.clear()
        with self.assertRaisesRegex(ValueError, "Site Part artifacts are missing"):
            release.deploy(self.root, self.transport, self.archive)
        self.assertEqual(self.transport.calls, ["status", "smoke"])

        self.transport.database_ready = True
        self.transport.calls.clear()
        self.assertEqual(release.deploy(self.root, self.transport, self.archive)["smoke"], "passed")
        self.assertEqual(self.transport.calls, ["status", "smoke"])
        self.transport.calls.clear()
        self.assertEqual(release.deploy(self.root, self.transport, self.archive)["smoke"], "reused")
        self.assertEqual(self.transport.calls, ["status"])

    def test_each_explicit_smoke_runs_even_after_a_successful_explicit_smoke(self):
        for _ in range(2):
            self.transport.calls.clear()
            result = release.deploy(self.root, self.transport, self.archive, smoke_only=True)
            self.assertEqual(result["smoke"], "passed")
            self.assertEqual(self.transport.calls, ["status", "smoke"])

    def test_explicit_smoke_rejects_a_different_remote_artifact_before_readiness(self):
        self.transport.applied_sha = "b" * 64
        with self.assertRaisesRegex(ValueError, "does not match"):
            release.deploy(self.root, self.transport, self.archive, smoke_only=True)
        self.assertEqual(self.transport.calls, ["status"])

    def test_repeated_deploy_keeps_existing_transfer_apply_and_smoke_reuse(self):
        result = release.deploy(self.root, self.transport, self.archive)
        self.assertEqual(result["smoke"], "reused")
        self.assertEqual(self.transport.calls, ["status"])


if __name__ == "__main__":
    unittest.main()
