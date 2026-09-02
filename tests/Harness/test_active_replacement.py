"""Real isolated Git worktrees, preserved active edits, and fault compensation."""
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.g7pb.active_replacement import snapshot
from tools.g7pb.coord import Coordinator, Interrupted, parser
from tools.g7pb.gitops import execute
from tools.g7pb.state import CoordError, atomic_write, read_meta


class ActiveReplacementTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="g7pb-active-replacement-")
        self.addCleanup(temporary.cleanup)
        self.top = Path(temporary.name)
        self.repo = self.top / "repo"
        self.repo.mkdir()
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Active Replacement Test")
        self.git("config", "user.email", "active@example.test")
        for name in ("owned.txt", "deleted.txt", "upstream.txt", "outside.txt"):
            (self.repo / name).write_text(f"base {name}\n")
        (self.repo / ".gitignore").write_text("ignored/\n")
        self.git("add", ".")
        self.git("commit", "-m", "base")
        self.base = self.git("rev-parse", "HEAD")
        self.state = self.repo / ".git/g7pb-coordination-v1"
        environment = patch.dict(os.environ, G7PB_COORD_TESTING="1", G7PB_COORD_STATE_DIR=str(self.state))
        environment.start()
        self.addCleanup(environment.stop)
        self.source = self.top / "source"
        self.git("worktree", "add", "--detach", str(self.source), self.base)
        self.paths = "owned.txt,deleted.txt,new.bin"
        self.call(self.source, "claim", "--task", "source-task", "--profile", "scoped", "--paths", self.paths,
                  "--areas", "migration")
        (self.source / "owned.txt").write_text("staged edit\n")
        self.git("add", "owned.txt", root=self.source)
        (self.source / "owned.txt").write_text("unstaged final edit\n")
        (self.source / "deleted.txt").unlink()
        (self.source / "new.bin").write_bytes(bytes(range(256)))
        (self.source / "new.bin").chmod(0o755)
        (self.source / "ignored").mkdir()
        (self.source / "ignored/evidence.txt").write_text("existing execution evidence\n")
        (self.repo / "upstream.txt").write_text("reviewed upstream\n")
        self.git("add", ".")
        self.git("commit", "-m", "upstream")
        self.upstream = self.git("rev-parse", "HEAD")
        self.target = self.top / "target"
        self.git("worktree", "add", "-b", "codex/replacement", str(self.target), self.upstream)
        self.args = ("replace-active", "--task", "replacement-task", "--supersedes", "source-task",
                     "--base-ref", self.upstream)

    def git(self, *args, root=None):
        result = execute(["git", *args], root or self.repo, env=dict(os.environ, GIT_OPTIONAL_LOCKS="0"))
        return result.stdout.decode().strip()

    def call(self, root, *args, env=None, runner=execute):
        with patch.dict(os.environ, env or {}), redirect_stdout(io.StringIO()) as output:
            coordinator = Coordinator(root, runner, fixture_root=self.top)
            try:
                coordinator.dispatch(parser().parse_args(args))
            finally:
                coordinator.store.close()
        return output.getvalue()

    def meta(self, task="source-task"):
        return read_meta(self.state / "tasks" / f"{task}.meta")

    def signature(self):
        index = Path(self.git("rev-parse", "--path-format=absolute", "--git-path", "index", root=self.source))
        return (self.git("rev-parse", "HEAD", root=self.source), self.git("branch", "--show-current", root=self.source),
                index.read_bytes(), self.git("status", "--porcelain=v1", "--untracked-files=all", root=self.source),
                (self.source / "owned.txt").read_bytes(), (self.source / "new.bin").read_bytes(),
                (self.source / "ignored/evidence.txt").read_bytes())

    def assert_rolled_back(self, meta, signature):
        self.assertEqual(self.meta(), meta)
        self.assertEqual(self.signature(), signature)
        self.assertFalse((self.state / "tasks/replacement-task.meta").exists())
        self.assertFalse(list((self.state / "history").glob("*.meta")))
        self.assertEqual(self.git("rev-parse", "HEAD", root=self.target), self.upstream)
        self.assertEqual(self.git("branch", "--show-current", root=self.target), "codex/replacement")
        self.assertFalse(self.git("status", "--porcelain", root=self.target))
        self.assertFalse(list((self.state / "task-locks").glob("*.lock")))

    def test_preserves_source_and_inherits_exact_scope_without_claiming_validation(self):
        before = self.signature()
        old = self.meta()
        with patch.object(Coordinator, "quality", side_effect=AssertionError("replacement is not submission")):
            self.assertIn("REPLACED_ACTIVE", self.call(self.target, *self.args))
        self.assertEqual(self.signature(), before)
        self.assertEqual((self.target / "owned.txt").read_text(), "unstaged final edit\n")
        self.assertEqual((self.target / "new.bin").read_bytes(), bytes(range(256)))
        self.assertTrue(os.access(self.target / "new.bin", os.X_OK))
        self.assertFalse((self.target / "deleted.txt").exists())
        self.assertEqual((self.target / "upstream.txt").read_text(), "reviewed upstream\n")
        current = self.meta("replacement-task")
        for key in ("paths", "areas", "profile"):
            self.assertEqual(current[key], old[key])
        self.assertEqual(current["status"], "active")
        self.assertFalse(current["submitted_sha"] or current["verified_sha"])
        self.assertEqual(current["base_sha"], self.upstream)
        archived = read_meta(next((self.state / "history").glob("source-task.*.meta")))
        self.assertEqual(archived["status"], "superseded")
        self.assertEqual(archived["preserved_head"], self.base)
        self.assertEqual(archived["worktree"], str(self.source.resolve()))
        manifest = json.loads((Path(current["replacement_evidence"]) / "manifest.json").read_text())
        self.assertEqual(manifest["source_task"], old)
        self.assertEqual(manifest["status"], "active-replaced")
        self.assertEqual((Path(current["replacement_evidence"]) / "source.original-index").read_bytes(), before[2])
        self.call(self.target, "check", "--task", "replacement-task")

    def test_interrupts_and_metadata_failure_restore_git_and_lease(self):
        before, old = self.signature(), self.meta()
        for fault in ("AFTER_ACTIVE_APPLY", "AFTER_ACTIVE_ARCHIVE", "BEFORE_ACTIVE_COMMIT"):
            with self.subTest(fault=fault), self.assertRaises(Interrupted):
                self.call(self.target, *self.args, env={"G7PB_COORD_TEST_TERMINATE_" + fault: "1"})
            self.assert_rolled_back(old, before)
        original_write = atomic_write

        def fail_new_metadata(path, data):
            if path.name == "replacement-task.meta":
                raise OSError("isolated disk failure")
            original_write(path, data)

        with patch("tools.g7pb.state.atomic_write", side_effect=fail_new_metadata), self.assertRaises(OSError):
            self.call(self.target, *self.args)
        self.assert_rolled_back(old, before)
        for evidence in (self.state / "active-replacements").iterdir():
            self.assertTrue((evidence / "source.patch").is_file())
            self.assertTrue((evidence / "destination-failure/files.json").is_file())

    def test_late_interrupt_preserves_completed_transfer(self):
        before = self.signature()
        with self.assertRaises(Interrupted):
            self.call(self.target, *self.args, env={"G7PB_COORD_TEST_TERMINATE_AFTER_ACTIVE_COMMIT": "1"})
        self.assertEqual(self.signature(), before)
        self.assertEqual(self.meta("replacement-task")["status"], "active")
        self.assertFalse((self.state / "tasks/source-task.meta").exists())
        self.assertEqual((self.target / "owned.txt").read_text(), "unstaged final edit\n")

    def test_content_conflict_preserves_both_versions_and_restores_target(self):
        (self.repo / "owned.txt").write_text("conflicting upstream\n")
        self.git("add", ".")
        self.git("commit", "-m", "conflict")
        self.upstream = self.git("rev-parse", "HEAD")
        self.git("reset", "--hard", self.upstream, root=self.target)
        args = (*self.args[:-1], self.upstream)
        before, old = self.signature(), self.meta()
        with self.assertRaises(CoordError):
            self.call(self.target, *args)
        self.assert_rolled_back(old, before)
        evidence = next((self.state / "active-replacements").iterdir()) / "destination-failure"
        files = json.loads((evidence / "files.json").read_text())
        conflict = (evidence / files["owned.txt"]["file"]).read_text()
        self.assertIn("conflicting upstream", conflict)
        self.assertIn("unstaged final edit", conflict)

    def test_source_mutation_during_copy_aborts_without_discarding_new_edit(self):
        real_snapshot = snapshot
        calls = 0

        def mutating_snapshot(*args):
            nonlocal calls
            value = real_snapshot(*args)
            calls += 1
            if calls == 2:
                (self.source / "owned.txt").write_text("concurrent source edit\n")
            return value

        old = self.meta()
        with patch("tools.g7pb.active_replacement.snapshot", side_effect=mutating_snapshot), self.assertRaisesRegex(CoordError, "원본 작업이 변경"):
            self.call(self.target, *self.args)
        self.assertEqual((self.source / "owned.txt").read_text(), "concurrent source edit\n")
        self.assertEqual(self.meta(), old)
        self.assertFalse(self.git("status", "--porcelain", root=self.target))

    def test_scope_overrides_outside_edits_and_existing_lease_are_rejected(self):
        old, before = self.meta(), self.signature()
        for option in ("--paths", "--areas", "--profile"):
            with self.subTest(option=option), self.assertRaisesRegex(CoordError, "정확히 상속"):
                self.call(self.target, *self.args, option, "outside.txt")
        (self.source / "outside.txt").write_text("unowned change\n")
        with self.assertRaisesRegex(CoordError, "PATHS 밖"):
            self.call(self.target, *self.args)
        (self.source / "outside.txt").write_text("base outside.txt\n")
        self.call(self.target, "claim", "--task", "occupied-task", "--paths", "upstream.txt", "--profile", "scoped")
        with self.assertRaisesRegex(CoordError, "이미 소유"):
            self.call(self.target, *self.args)
        self.assertEqual(self.meta(), old)
        self.assertEqual(self.signature(), before)

    def test_ancestry_and_source_branch_are_verified(self):
        for ref in ("HEAD", self.base):
            with self.subTest(ref=ref), self.assertRaises(CoordError):
                self.call(self.target, *self.args[:-1], ref)
        self.git("branch", "-m", "codex/changed-owner", root=self.source)
        with self.assertRaisesRegex(CoordError, "소유권"):
            self.call(self.target, *self.args)
        self.assertEqual(self.meta()["status"], "active")

    def test_hidden_outside_change_cannot_bypass_snapshot_ownership(self):
        self.git("update-index", "--assume-unchanged", "outside.txt", root=self.source)
        (self.source / "outside.txt").write_text("hidden unowned change\n")
        before, old = self.signature(), self.meta()
        with self.assertRaisesRegex(CoordError, "snapshot에 PATHS 밖"):
            self.call(self.target, *self.args)
        self.assert_rolled_back(old, before)
        self.assertEqual((self.source / "outside.txt").read_text(), "hidden unowned change\n")

    def test_new_lease_between_preflight_and_apply_is_rechecked(self):
        real_snapshot = snapshot
        calls = 0

        def claim_during_snapshot(*args):
            nonlocal calls
            value = real_snapshot(*args)
            calls += 1
            if calls == 1:
                self.call(self.target, "claim", "--task", "concurrent-task", "--paths", "upstream.txt", "--profile", "scoped")
            return value

        before, old = self.signature(), self.meta()
        with patch("tools.g7pb.active_replacement.snapshot", side_effect=claim_during_snapshot), self.assertRaisesRegex(CoordError, "이미 소유"):
            self.call(self.target, *self.args)
        self.assert_rolled_back(old, before)
        self.assertEqual(self.meta("concurrent-task")["status"], "active")

    def test_dirty_target_and_non_descendant_base_are_rejected_before_apply(self):
        (self.target / "upstream.txt").write_text("new target user edit\n")
        with self.assertRaisesRegex(CoordError, "깨끗한"):
            self.call(self.target, *self.args)
        self.assertEqual((self.target / "upstream.txt").read_text(), "new target user edit\n")
        (self.target / "upstream.txt").write_text("reviewed upstream\n")
        tree = self.git("rev-parse", "HEAD^{tree}")
        unrelated = self.git("commit-tree", tree, "-m", "unrelated reviewed commit")
        self.git("reset", "--hard", unrelated, root=self.target)
        with self.assertRaisesRegex(CoordError, "후손"):
            self.call(self.target, *self.args[:-1], unrelated)
        self.assertEqual(self.meta()["status"], "active")

    def test_ignored_target_file_is_not_overwritten(self):
        exclude = self.repo / ".git/info/exclude"
        exclude.write_text(exclude.read_text() + "\nnew.bin\n")
        # Source new.bin is now ignored too: preserve it as an intentional staged addition.
        self.git("add", "--force", "new.bin", root=self.source)
        (self.target / "new.bin").write_bytes(b"existing ignored output")
        before = self.signature()
        with self.assertRaisesRegex(CoordError, "ignored/untracked"):
            self.call(self.target, *self.args)
        self.assertEqual((self.target / "new.bin").read_bytes(), b"existing ignored output")
        self.assertEqual(self.signature(), before)

    def test_committed_active_delta_is_preserved_with_dirty_and_untracked_state(self):
        self.git("commit", "-m", "owned staged progress", root=self.source)
        before = self.signature()
        self.call(self.target, *self.args)
        self.assertEqual(self.signature(), before)
        self.assertEqual((self.target / "owned.txt").read_text(), "unstaged final edit\n")

    def test_make_entry_forwards_reviewed_base_without_scope_override(self):
        result = subprocess.run(["make", "-s", "-n", "task-replace-active", "TASK=new-task", "SUPERSEDES=old-task",
                                 f"BASE_REF={self.upstream}", "COORD_HARNESS=recorder"], cwd=ROOT,
                                capture_output=True, text=True, check=True)
        self.assertIn(f'recorder replace-active --task "new-task" --supersedes "old-task" --base-ref "{self.upstream}"', result.stdout)
        self.assertNotIn("--paths", result.stdout)


if __name__ == "__main__":
    unittest.main()
