"""Coordinator-only tests: temporary Git repositories and mocked product gates."""
from __future__ import annotations

from contextlib import redirect_stdout
import io
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.g7pb.coord import Coordinator, Interrupted, parser
from tools.g7pb.gitops import Git, execute
from tools.g7pb.state import CoordError, MetadataTransaction, Store, atomic_write, defer_interrupts, new_task, read_meta, serialize


class StateTests(unittest.TestCase):
    def test_interrupt_is_deferred_until_commit_boundary(self):
        received = []
        previous = signal.signal(signal.SIGTERM, lambda signum, _frame: received.append(signum))
        try:
            with defer_interrupts():
                os.kill(os.getpid(), signal.SIGTERM)
                self.assertEqual(received, [])
            self.assertEqual(received, [signal.SIGTERM])
        finally:
            signal.signal(signal.SIGTERM, previous)

    def test_hard_interrupt_backup_blocks_new_writes_without_deleting_evidence(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-python-state-") as directory:
            store = Store(Path(directory))
            store.ensure()
            backup = store.tasks / ".test-task.meta.txn-123-preserved.backup"
            backup.write_text("preserved evidence")
            with self.assertRaises(CoordError):
                with store.mutex():
                    self.fail("unrecovered transaction admitted a writer")
            self.assertEqual(backup.read_text(), "preserved evidence")
            self.assertFalse((store.root / "mutex").exists())

    def test_tsv_roundtrip_preserves_unknown_optional_fields(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-python-state-") as directory:
            path = Path(directory) / "task.meta"
            meta = new_task(task="test-task", profile="scoped", future_field="retained")
            atomic_write(path, serialize(meta))
            self.assertEqual(read_meta(path), meta)
            self.assertFalse(list(path.parent.glob("*.stage")))

    def test_uncommitted_metadata_transaction_restores_all_files(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-python-state-") as directory:
            root = Path(directory)
            original, archive = root / "task.meta", root / "history.meta"
            meta = new_task(task="test-task")
            atomic_write(original, serialize(meta))
            with self.assertRaises(Interrupted):
                with MetadataTransaction() as transaction:
                    transaction.write(archive, dict(meta, status="integrated"))
                    transaction.delete(original)
                    raise Interrupted()
            self.assertEqual(read_meta(original), meta)
            self.assertFalse(archive.exists())

    def test_committed_transaction_survives_late_interrupt(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-python-state-") as directory:
            path = Path(directory) / "task.meta"
            with self.assertRaises(Interrupted):
                with MetadataTransaction() as transaction:
                    transaction.write(path, new_task(task="test-task"))
                    transaction.commit()
                    raise Interrupted()
            self.assertEqual(read_meta(path)["task"], "test-task")

    def test_live_legacy_symlink_lock_is_not_stolen(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-python-state-") as directory:
            first, second = Store(Path(directory)), Store(Path(directory))
            with patch.dict(os.environ, {"G7PB_COORD_TESTING": "1"}):
                first.lock("test-task")
                try:
                    with self.assertRaises(CoordError):
                        second.lock("test-task")
                finally:
                    second.close()
                    first.close()
            self.assertFalse(list((Path(directory) / "task-locks").iterdir()))


class CoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="g7pb-python-coord-")
        self.addCleanup(self.temporary.cleanup)
        self.top = Path(self.temporary.name)
        self.repo = self.top / "repo"
        self.repo.mkdir()
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Coordinator Test")
        self.git("config", "user.email", "coord@example.test")
        for name in ("a", "b", "upstream"):
            (self.repo / name).mkdir()
            (self.repo / name / "file.txt").write_text("base\n")
        self.git("add", ".")
        self.git("commit", "-m", "base")
        self.base = self.git("rev-parse", "HEAD")
        self.state = self.repo / ".git/g7pb-coordination-v1"
        self.env = patch.dict(os.environ, {"G7PB_COORD_TESTING": "1", "G7PB_COORD_STATE_DIR": str(self.state.resolve())})
        self.env.start()
        self.addCleanup(self.env.stop)

    def git(self, *args, root=None):
        result = execute(["git", *args], root or self.repo)
        return result.stdout.decode().strip()

    def call(self, root, *args, env=None, runner=execute):
        output = io.StringIO()
        with patch.dict(os.environ, env or {}), redirect_stdout(output):
            coordinator = Coordinator(root, runner)
            try:
                coordinator.dispatch(parser().parse_args(args))
            finally:
                coordinator.store.close()
        return output.getvalue()

    def meta(self, task):
        return read_meta(self.state / "tasks" / f"{task}.meta")

    def worktree(self, name):
        path = self.top / name
        self.git("worktree", "add", "--detach", str(path), self.base)
        return path

    def submit_task(self, name="first-task", folder="a", profile="scoped"):
        path = self.worktree(name)
        claim = f"{folder}/file.txt" if profile == "scoped" else folder
        self.call(path, "claim", "--task", name, "--paths", claim, "--profile", profile)
        (path / folder / "file.txt").write_text(f"submitted {name}\n")
        self.call(path, "submit", "--task", name)
        return path

    def integration(self):
        self.call(self.repo, "claim", "--task", "integration-task", "--areas", "integration,runtime", "--profile", "harness")

    def assert_no_locks(self):
        self.assertFalse(list((self.state / "task-locks").glob("*.lock")))

    def test_status_does_not_create_state(self):
        output = self.call(self.repo, "status", "--history")
        self.assertTrue(output.startswith("KIND\tTASK"))
        self.assertFalse(self.state.exists())

    def test_development_finish_preserves_history_without_release_promotion(self):
        self.integration()
        with patch.object(Coordinator, "quality", side_effect=AssertionError("no validation on development finish")):
            output = self.call(self.repo, "finish", "--task", "integration-task", "--without-release")
        self.assertIn("FINISHED_UNRELEASED", output)
        self.assertFalse((self.state / "tasks/integration-task.meta").exists())
        records = [read_meta(path) for path in (self.state / "history").glob("*.meta")]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["status"], "complete-unreleased")
        self.assertEqual(records[0]["integration_sha"], self.base)
        self.assertFalse(records[0]["verified_sha"])

    def test_development_finish_cannot_discard_a_submitted_task(self):
        self.submit_task()
        self.integration()
        with self.assertRaises(CoordError):
            self.call(self.repo, "finish", "--task", "integration-task", "--without-release")
        self.assertEqual(self.meta("first-task")["status"], "submitted")

    def test_production_quality_delegates_to_only_common_planner_cli(self):
        calls = []
        def runner(args, cwd, **kwargs):
            if args[0] == "git":
                return execute(args, cwd, **kwargs)
            calls.append((args, kwargs))
            return subprocess.CompletedProcess(args, 0, b"", b"")
        with patch.dict(os.environ, {"G7PB_COORD_TESTING": "0"}):
            coordinator = Coordinator(self.repo, runner)
            coordinator.quality("integration", self.base, task="integration-task")
        self.assertEqual(calls[0][0], [sys.executable, str(ROOT / "scripts/g7pb.py"), "run", "--base", self.base,
                                     "--phase", "integration", "--task", "integration-task"])
        self.assertTrue(calls[0][1]["stream"])

    def test_old_worktree_uses_running_controller_cli_and_preserves_target_cwd(self):
        calls = []
        def runner(args, cwd, **kwargs):
            if args[0] == "git":
                return execute(args, cwd, **kwargs)
            calls.append((args, cwd))
            return subprocess.CompletedProcess(args, 0, b"", b"")
        self.assertFalse((self.repo / "scripts/g7pb.py").exists())
        with patch.dict(os.environ, {"G7PB_COORD_TESTING": "0"}):
            coordinator = Coordinator(self.repo, runner)
            coordinator.quality("submission", self.base, task="old-worktree-task")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0], [sys.executable, str(ROOT / "scripts/g7pb.py"), "run", "--base", self.base,
                                     "--phase", "submission", "--task", "old-worktree-task"])
        self.assertEqual(calls[0][1], self.repo.resolve())

    def test_exact_leaf_scope_and_overlap_rejection(self):
        first, other = self.worktree("first"), self.worktree("other")
        for bad in ("a", "a/file.txt,a/file.txt", "../escape", "a/*.txt"):
            with self.subTest(path=bad), self.assertRaises(CoordError):
                self.call(first, "claim", "--task", "first-task", "--paths", bad, "--profile", "scoped")
        self.call(first, "claim", "--task", "first-task", "--paths", "a/file.txt", "--profile", "scoped")
        with self.assertRaises(CoordError):
            self.call(other, "claim", "--task", "other-task", "--paths", "a/file.txt", "--profile", "scoped")
        (first / "b/file.txt").write_text("out of scope\n")
        with self.assertRaises(CoordError):
            self.call(first, "submit", "--task", "first-task")
        self.assertEqual(self.meta("first-task")["status"], "active")

    def test_submission_resubmission_preserves_ancestry(self):
        path = self.submit_task()
        first = self.meta("first-task")["submitted_sha"]
        (path / "a/file.txt").write_text("revision\n")
        self.call(path, "resubmit", "--task", "first-task")
        second = self.meta("first-task")["submitted_sha"]
        self.assertNotEqual(first, second)
        self.assertTrue(Git(path).ancestor(first, second))
        self.assertEqual(self.meta("first-task")["base_sha"], self.base)

    def test_rename_checks_both_old_and_new_owned_paths(self):
        path = self.worktree("rename")
        self.call(path, "claim", "--task", "rename-task", "--paths", "b/new.txt", "--profile", "scoped")
        self.git("mv", "a/file.txt", "b/new.txt", root=path)
        with self.assertRaises(CoordError):
            self.call(path, "submit", "--task", "rename-task")
        self.assertEqual(self.meta("rename-task")["status"], "active")

    def test_resubmission_metadata_failure_keeps_user_contents_and_original_sha(self):
        path = self.submit_task()
        original = self.meta("first-task")
        (path / "a/file.txt").write_text("uncommitted user revision\n")
        with patch.object(Store, "save", side_effect=OSError("simulated metadata write failure")):
            with self.assertRaises(OSError):
                self.call(path, "resubmit", "--task", "first-task")
        self.assertEqual(self.meta("first-task"), original)
        self.assertEqual(self.git("rev-parse", "HEAD", root=path), original["submitted_sha"])
        self.assertEqual((path / "a/file.txt").read_text(), "uncommitted user revision\n")
        self.assert_no_locks()

    def test_each_integration_uses_premerge_head_not_old_task_base(self):
        self.submit_task()
        self.submit_task("second-task", "b")
        self.integration()
        calls = []
        def quality(_coordinator, phase, base, **_kwargs):
            calls.append((phase, base))
        with patch.object(Coordinator, "quality", quality):
            self.call(self.repo, "integrate-scoped", "--task", "first-task", "--integration-task", "integration-task")
            first_integration = self.git("rev-parse", "HEAD")
            self.call(self.repo, "integrate-scoped", "--task", "second-task", "--integration-task", "integration-task")
        self.assertEqual(calls, [("integration", self.base), ("integration", first_integration)])

    def test_integration_verification_and_finish(self):
        path = self.submit_task()
        submitted = self.meta("first-task")["submitted_sha"]
        self.integration()
        with self.assertRaises(CoordError):
            self.call(path, "runtime-guard", "--task", "integration-task")
        self.call(self.repo, "integrate-scoped", "--task", "first-task", "--integration-task", "integration-task")
        archived = read_meta(next((self.state / "history").glob("first-task.*.meta")))
        self.assertEqual(archived["submitted_sha"], submitted)
        self.assertEqual(archived["status"], "integrated")
        self.assertEqual(self.git("rev-parse", "HEAD", root=path), submitted)
        self.call(self.repo, "verify", "--task", "integration-task", "--full")
        self.assertIn("VERIFY_REUSED", self.call(self.repo, "verify", "--task", "integration-task"))
        self.call(self.repo, "finish", "--task", "integration-task")
        self.assertFalse(list((self.state / "tasks").glob("*.meta")))
        self.assert_no_locks()

    def test_unrelated_dirty_active_task_does_not_block_verify_release_or_finish(self):
        path = self.worktree("independent-active")
        self.call(path, "claim", "--task", "independent-task", "--paths", "b/file.txt", "--profile", "scoped")
        (path / "b/file.txt").write_text("unfinished independent user work\n")
        active = self.meta("independent-task")
        self.integration()
        self.call(self.repo, "verify", "--task", "integration-task", "--full")
        self.call(self.repo, "release-guard", "--task", "integration-task")
        self.call(self.repo, "finish", "--task", "integration-task")
        self.assertEqual(self.meta("independent-task"), active)
        self.assertEqual((path / "b/file.txt").read_text(), "unfinished independent user work\n")
        self.assertFalse(list((self.state / "history").glob("independent-task.*.meta")))

    def test_old_release_receipt_does_not_expand_the_current_integration_delta(self):
        self.call(self.repo, "claim", "--task", "old-integration", "--areas", "integration,runtime", "--profile", "frontend")
        self.call(self.repo, "verify", "--task", "old-integration", "--full")
        self.call(self.repo, "finish", "--task", "old-integration")
        (self.repo / "upstream/file.txt").write_text("earlier completed work\n")
        self.git("add", "upstream/file.txt")
        self.git("commit", "-m", "earlier work outside this integration")
        start = self.git("rev-parse", "HEAD")
        self.submit_task()
        self.integration()
        self.call(self.repo, "integrate-scoped", "--task", "first-task", "--integration-task", "integration-task")

        with patch.object(Coordinator, "quality") as quality:
            self.call(self.repo, "verify", "--task", "integration-task")
            quality.assert_called_once()
            self.assertEqual(quality.call_args.args, ("verification", start))
            self.assertFalse(quality.call_args.kwargs["full"])
        self.assertEqual(self.meta("integration-task")["verified_base_sha"], start)
        self.assertEqual(self.git("diff", "--name-only", start, "HEAD"), "a/file.txt")
        with patch.object(Coordinator, "quality") as quality:
            self.assertIn("VERIFY_REUSED", self.call(self.repo, "verify", "--task", "integration-task"))
            quality.assert_not_called()

    def test_unintegrated_submitted_task_still_blocks_verification(self):
        self.submit_task()
        self.integration()
        with patch.object(Coordinator, "quality") as quality:
            with self.assertRaisesRegex(CoordError, "submitted"):
                self.call(self.repo, "verify", "--task", "integration-task", "--full")
            quality.assert_not_called()
        self.assertEqual(self.meta("first-task")["status"], "submitted")

    def test_missing_baseline_requires_explicit_full_before_any_gate(self):
        self.integration()
        before = self.meta("integration-task")
        with patch.object(Coordinator, "quality") as quality:
            with self.assertRaisesRegex(CoordError, "--full"):
                self.call(self.repo, "verify", "--task", "integration-task")
            quality.assert_not_called()
            self.assertEqual(self.meta("integration-task"), before)
            self.call(self.repo, "verify", "--task", "integration-task", "--full")
            quality.assert_called_once()
            self.assertTrue(quality.call_args.kwargs["full"])
        self.assertEqual(self.meta("integration-task")["verified_mode"], "full")

    def test_batch_failure_and_success_are_atomic(self):
        self.submit_task()
        self.submit_task("second-task", "b")
        self.integration()
        for failure in ("FAIL_INTEGRATION_PROFILE", "FAIL_INTEGRATION_FINALIZE", "TERMINATE_AFTER_FIRST_INTEGRATION_ARCHIVE"):
            with self.subTest(failure=failure), self.assertRaises(CoordError):
                self.call(self.repo, "integrate-batch", "--tasks", "second-task,first-task", "--integration-task", "integration-task",
                          env={"G7PB_COORD_TEST_" + failure: "1"})
            self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
            self.assertEqual(self.meta("first-task")["status"], "submitted")
            self.assertEqual(self.meta("second-task")["status"], "submitted")
            self.assertFalse(list((self.state / "history").glob("*.meta")))
            self.assert_no_locks()
        with self.assertRaises(Interrupted):
            self.call(self.repo, "integrate-batch", "--tasks", "first-task,second-task", "--integration-task", "integration-task",
                      env={"G7PB_COORD_TEST_TERMINATE_AFTER_INTEGRATION_METADATA": "1"})
        self.assertNotEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertEqual(len(list((self.state / "history").glob("*.meta"))), 2)
        self.assert_no_locks()

    def test_restack_and_squash_rollback(self):
        path = self.submit_task()
        original = self.meta("first-task")
        (self.repo / "upstream/file.txt").write_text("upstream 1\n")
        self.git("add", ".")
        self.git("commit", "-m", "upstream")
        new_base = self.git("rev-parse", "HEAD")
        for command in ("restack", "restack-squash"):
            with self.subTest(command=command), self.assertRaises(CoordError):
                self.call(path, command, "--task", "first-task", "--new-base-ref", new_base,
                          env={"G7PB_COORD_TEST_FAIL_SUBMISSION_PROFILE": "1"})
            self.assertEqual(self.git("rev-parse", "HEAD", root=path), original["submitted_sha"])
            self.assertEqual(self.meta("first-task"), original)
            self.assert_no_locks()
        with self.assertRaises(Interrupted):
            self.call(path, "restack-squash", "--task", "first-task", "--new-base-ref", new_base,
                      env={"G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_METADATA": "1"})
        updated = self.meta("first-task")
        self.assertEqual(updated["base_sha"], new_base)
        self.assertEqual(updated["previous_submitted_sha"], original["submitted_sha"])
        self.assertEqual(self.git("rev-parse", "HEAD", root=path), updated["submitted_sha"])

    def test_replacement_rollback_and_expanded_preservation(self):
        path = self.submit_task()
        old = self.meta("first-task")
        replacement = self.worktree("replacement")
        self.git("switch", "-c", "codex/replacement", root=replacement)
        arguments = ["replace-submitted-expanded", "--task", "replacement-task", "--supersedes", "first-task",
                     "--paths", "a/file.txt,b/file.txt"]
        with self.assertRaises(Interrupted):
            self.call(replacement, *arguments, env={"G7PB_COORD_TEST_TERMINATE_AFTER_REPLACE_ARCHIVE": "1"})
        self.assertEqual(self.meta("first-task"), old)
        self.assertFalse(list((self.state / "history").glob("*.meta")))
        self.call(replacement, *arguments)
        archived = read_meta(next((self.state / "history").glob("first-task.*.meta")))
        self.assertEqual(archived["submitted_sha"], old["submitted_sha"])
        self.assertEqual(archived["status"], "superseded")
        self.assertEqual(self.meta("replacement-task")["paths"], "a/file.txt,b/file.txt")
        self.assertEqual(self.git("rev-parse", "HEAD", root=path), old["submitted_sha"])

    def test_actual_sigterm_stops_owned_gate_and_rolls_back_merge(self):
        self.submit_task(profile="harness")
        self.integration()
        hook = self.top / "gate-hook"
        marker = self.top / "gate-started"
        hook.write_text(f"#!{sys.executable}\nfrom pathlib import Path\nimport time\nPath({str(marker)!r}).write_text('ready')\ntime.sleep(30)\n")
        hook.chmod(0o700)
        environment = dict(os.environ, PYTHONPATH=str(ROOT), G7PB_COORD_TESTING="1",
                           G7PB_COORD_TEST_INTEGRATION_PROFILE_HOOK=str(hook))
        process = subprocess.Popen([sys.executable, "-m", "tools.g7pb.coord", "integrate", "--task", "first-task",
                                    "--integration-task", "integration-task"], cwd=self.repo, env=environment,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 10
            while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(marker.exists(), "mock gate did not start")
            process.send_signal(signal.SIGTERM)
            process.communicate(timeout=10)
            self.assertEqual(process.returncode, 143)
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertEqual(self.meta("first-task")["status"], "submitted")
        self.assertTrue(Git(self.repo).clean())
        self.assert_no_locks()


class LegacyCompatibilityTests(unittest.TestCase):
    def test_existing_coordination_fixture_against_python_backend(self):
        """Reuse its isolated repositories/fault injections, not its Bash backend."""
        with tempfile.TemporaryDirectory(prefix="g7pb-python-legacy-") as directory:
            temporary = Path(directory)
            launcher = temporary / "coord"
            launcher.write_text(f"#!{sys.executable}\nimport sys\nsys.path.insert(0, {str(ROOT)!r})\nfrom tools.g7pb.coord import main\nraise SystemExit(main())\n")
            launcher.chmod(0o700)
            source = (ROOT / "tests/Harness/coord-harness.test.sh").read_text()
            source = source.replace('root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"', f'root="{ROOT}"')
            source = source.replace('harness="$root/scripts/coord-harness.sh"', f'harness="{launcher}"')
            # The new policy requires an explicit initial baseline; never auto-run full.
            source = source.replace('"$harness" verify --task', '"$harness" verify --full --task')
            fixture = temporary / "fixture.sh"
            fixture.write_text(source)
            environment = {key: value for key, value in os.environ.items()
                           if key != "G7PB_COORD_STATE_DIR" and not key.startswith("G7PB_COORD_TEST_")}
            result = subprocess.run(["bash", str(fixture)], env=environment, capture_output=True, text=True, timeout=120)
            self.assertEqual(result.returncode, 0, result.stdout[-10000:] + result.stderr[-15000:])


def load_tests(loader, _tests, _pattern):
    """The one-off legacy migration fixture is explicit, not repeated by discovery."""
    return unittest.TestSuite(loader.loadTestsFromTestCase(case) for case in (StateTests, CoordinatorTests))


if __name__ == "__main__":
    unittest.main()
