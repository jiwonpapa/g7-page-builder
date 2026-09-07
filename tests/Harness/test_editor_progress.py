import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from tools.g7pb.editor_progress import DASHBOARD, LEDGER, PLAN, POLICY, input_files, markdown, summary, validate


class EditorProgressTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="g7pb-editor-progress-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write(POLICY, "# 정책\n[계획](editor-plan.md)\n")
        self.write(PLAN, "# 계획\n[정책](editing-policy.md)\n")
        self.write("src/Existing.php", "<?php // existing baseline\n")
        self.write("docs/audits/editor-evidence.md", "# 실제 실행 요약 fixture\n")
        self.data = {
            "schema_version": "g7pb-editor-progress/v1", "plan_id": "editor-maturity-20260907",
            "baseline_sha": "a" * 40, "updated_at": "2026-09-07", "policy_file": POLICY,
            "plan_file": PLAN, "dashboard_file": DASHBOARD,
            "documents": [{"path": path, "role": "current", "required_text": marker} for path, marker in (
                (POLICY, "# 정책"), (PLAN, "# 계획"), (DASHBOARD, "# 편집기 개발 진척"))],
            "acceptance": [{"id": "CAT-01", "description": "올바른 요소 찾기", "required_evidence": ["unit", "browser"]}],
            "phases": [{"id": "phase-1", "title": "삽입 UX"}],
            "baseline": [{"id": "BASE-01", "title": "기존 구현", "state": "partial",
                          "source_paths": ["src/Existing.php"], "historical_evidence": ["docs/audits/editor-evidence.md"]}],
            "items": [{"id": "ED-01", "phase": "phase-1", "title": "분류 통일", "status": "planned",
                       "depends_on": [], "acceptance_ids": ["CAT-01"], "owner_task": None,
                       "implementation_commit": None, "integrated_commit": None, "evidence": [],
                       "blocked_reason": None, "scope": ["resources/js/editor/new-file.ts"],
                       "completion": "실제 삽입과 저장이 같은 대상을 유지한다."}],
        }
        self.save()

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def save(self, *, dashboard=True):
        self.write(LEDGER, json.dumps(self.data, ensure_ascii=False))
        if dashboard:
            self.write(DASHBOARD, markdown(self.data))

    def finish(self, item):
        item.update(status="done", implementation_commit="b" * 40, integrated_commit="c" * 40)
        item["evidence"] = [{"acceptance_id": "CAT-01", "kind": kind, "commit": "b" * 40,
                             "result": "pass", "path": "docs/audits/editor-evidence.md"} for kind in ("unit", "browser")]

    def test_planned_scope_can_name_future_files_and_baseline_is_not_progress(self):
        data = validate(self.root)
        result = summary(data)
        self.assertEqual((result["counts"]["done"], result["total"], result["baseline_count"]), (0, 1, 1))
        self.assertEqual(result["next"], ["ED-01"])
        self.assertFalse(result["product_verified"])
        self.assertFalse(result["deployment_executed"])
        board = markdown(data)
        self.assertIn("BASE-01 · 기존 구현", board)
        self.assertIn("일부 구현", board)
        self.assertIn("[src/Existing.php](<../../src/Existing.php>)", board)
        self.assertIn("[docs/audits/editor-evidence.md](<../audits/editor-evidence.md>)", board)
        self.assertEqual(result["baseline"], self.data["baseline"])

    def test_rejects_bad_schema_dates_ids_and_duplicate_items(self):
        original = copy.deepcopy(self.data)
        for field, value in (("schema_version", "future"), ("updated_at", "2026-02-30"),
                             ("updated_at", "20260907"), ("baseline_sha", "HEAD")):
            self.data = copy.deepcopy(original)
            self.data[field] = value
            self.save(dashboard=False)
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate(self.root)
        self.data = copy.deepcopy(original)
        self.data["items"].append(copy.deepcopy(self.data["items"][0]))
        self.save()
        with self.assertRaisesRegex(ValueError, "duplicate ID"):
            validate(self.root)
        self.data = copy.deepcopy(original)
        self.data["items"][0]["id"] = "bad id"
        self.save()
        with self.assertRaisesRegex(ValueError, "invalid ID"):
            validate(self.root)

    def test_rejects_unknown_status_empty_completion_and_unknown_acceptance(self):
        for field, value in (("status", "approved"), ("completion", ""), ("acceptance_ids", ["NOPE"])):
            original = copy.deepcopy(self.data)
            self.data["items"][0][field] = value
            self.save(dashboard=False)
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate(self.root)
            self.data = original

    def test_done_requires_both_commits_and_every_required_evidence_kind(self):
        item = self.data["items"][0]
        item["status"] = "done"
        self.save()
        with self.assertRaisesRegex(ValueError, "implementation and integration"):
            validate(self.root)
        self.finish(item)
        item["evidence"].pop()
        self.save()
        with self.assertRaisesRegex(ValueError, "Missing completion evidence"):
            validate(self.root)
        self.finish(item)
        self.save()
        self.assertEqual(summary(validate(self.root))["counts"]["done"], 1)
        board = markdown(self.data)
        self.assertIn("구현 `" + "b" * 40 + "`", board)
        self.assertIn("통합 `" + "c" * 40 + "`", board)
        self.assertIn("필수 증거 2/2", board)
        self.assertIn("[CAT-01/browser](<../audits/editor-evidence.md>)", board)

    def test_source_tests_and_plan_files_cannot_replace_execution_summaries(self):
        self.write("tests/example.test.ts", "test('defined but not executed')")
        self.write("docs/audits/not-a-summary.txt", "unstructured output")
        self.finish(self.data["items"][0])
        for name in ("src/Existing.php", "tests/example.test.ts", LEDGER, DASHBOARD, PLAN, POLICY,
                     "docs/audits/not-a-summary.txt"):
            self.data["items"][0]["evidence"][0]["path"] = name
            self.save()
            with self.subTest(path=name), self.assertRaisesRegex(ValueError, "dedicated execution summary"):
                validate(self.root)

    def test_in_progress_requires_assigned_task(self):
        self.data["items"][0]["status"] = "in_progress"
        self.save()
        with self.assertRaisesRegex(ValueError, "in_progress requires owner_task"):
            validate(self.root)
        self.data["items"][0]["owner_task"] = "editor-owned-20260907"
        self.save()
        self.assertEqual(summary(validate(self.root))["counts"]["in_progress"], 1)

    def test_completion_evidence_missing_wrong_result_or_wrong_acceptance_fails(self):
        self.finish(self.data["items"][0])
        original = copy.deepcopy(self.data)
        for field, value in (("path", "docs/missing.md"), ("result", "fail"), ("acceptance_id", "NOPE"), ("commit", "short")):
            self.data = copy.deepcopy(original)
            self.data["items"][0]["evidence"][0][field] = value
            self.save()
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate(self.root)

    def test_missing_self_or_cyclic_dependencies_fail(self):
        original = copy.deepcopy(self.data)
        for dependency in ("NOPE", "ED-01"):
            self.data = copy.deepcopy(original)
            self.data["items"][0]["depends_on"] = [dependency]
            self.save()
            with self.assertRaisesRegex(ValueError, "Invalid dependency"):
                validate(self.root)
        self.data = copy.deepcopy(original)
        second = copy.deepcopy(self.data["items"][0])
        second.update(id="ED-02", depends_on=["ED-01"])
        self.data["items"][0]["depends_on"] = ["ED-02"]
        self.data["items"].append(second)
        self.save()
        with self.assertRaisesRegex(ValueError, "Dependency cycle"):
            validate(self.root)

    def test_done_cannot_skip_dependencies_and_blocked_requires_reason(self):
        second = copy.deepcopy(self.data["items"][0])
        second.update(id="ED-02", depends_on=["ED-01"])
        self.finish(second)
        self.data["items"].append(second)
        self.save()
        with self.assertRaisesRegex(ValueError, "completed dependencies"):
            validate(self.root)
        second.update(status="blocked", blocked_reason=None)
        self.save()
        with self.assertRaisesRegex(ValueError, "blocked_reason"):
            validate(self.root)
        second["blocked_reason"] = "선행 구현 대기"
        self.save()
        self.assertEqual(summary(validate(self.root))["next"], ["ED-01"])

    def test_document_markers_current_links_and_dashboard_are_checked(self):
        self.write(PLAN, "# 다른 계획\n")
        with self.assertRaisesRegex(ValueError, "required_text"):
            validate(self.root)
        self.write(PLAN, "# 계획\n[없는 문서](missing.md)\n")
        with self.assertRaisesRegex(ValueError, "Missing or escaping document link"):
            validate(self.root)
        self.write(PLAN, "# 계획\n[공식](https://example.org/docs)\n")
        self.write(DASHBOARD, markdown(self.data).replace("계획 작업 완료", "잘못된 상태판"))
        with self.assertRaisesRegex(ValueError, "Dashboard differs"):
            validate(self.root)

    def test_historical_links_are_not_current_acceptance_but_document_must_exist(self):
        self.write("docs/history.md", "과거 실행\n[과거 로그](../output/deleted-historical-log.txt)\n")
        self.data["documents"].append({"path": "docs/history.md", "role": "historical", "required_text": "과거 실행"})
        self.save()
        validate(self.root)
        self.data["documents"][-1]["path"] = "docs/missing-history.md"
        self.save()
        with self.assertRaisesRegex(ValueError, "Missing file"):
            validate(self.root)

    def test_unsafe_paths_and_symlink_escape_fail(self):
        original = copy.deepcopy(self.data)
        for name in (".", "../outside.php", "/tmp/outside.php", "docs/../outside.php", "docs\\outside.php", "https://outside.test/file"):
            self.data = copy.deepcopy(original)
            self.data["items"][0]["scope"] = [name]
            self.save()
            with self.subTest(path=name), self.assertRaises(ValueError):
                validate(self.root)
        self.data = original
        (self.root / "docs/escape").symlink_to(self.root.parent, target_is_directory=True)
        self.data["items"][0]["scope"] = ["docs/escape/new-file.py"]
        self.save()
        with self.assertRaisesRegex(ValueError, "escapes repository"):
            validate(self.root)

    def test_markdown_can_be_requested_before_dashboard_creation_but_check_fails(self):
        (self.root / DASHBOARD).unlink()
        self.write(PLAN, "# 계획\n[상태판](editor-progress.md)\n")
        result = validate(self.root, check_dashboard=False)
        self.assertIn("# 편집기 개발 진척", markdown(result))
        with self.assertRaisesRegex(ValueError, "Missing file"):
            validate(self.root)

    def test_declared_input_files_include_documents_baseline_and_completion_evidence(self):
        self.finish(self.data["items"][0])
        self.save()
        self.assertTrue({LEDGER, DASHBOARD, PLAN, POLICY, "src/Existing.php", "docs/audits/editor-evidence.md"}.issubset(input_files(self.root)))
        self.assertNotIn("resources/js/editor/new-file.ts", input_files(self.root))

    def test_status_and_check_cli_do_not_change_files_or_create_bytecode(self):
        module = Path(__file__).resolve().parents[2] / "tools/g7pb/editor_progress.py"
        self.write("tools/g7pb/editor_progress.py", module.read_text())
        def snapshot():
            return {str(path.relative_to(self.root)): (path.read_bytes(), path.stat().st_mtime_ns)
                    for path in self.root.rglob("*") if path.is_file()}
        before = snapshot()
        for arguments in (("status",), ("status", "--json"), ("status", "--markdown"), ("check",)):
            result = subprocess.run([sys.executable, "-B", "-m", "tools.g7pb.editor_progress", *arguments],
                                    cwd=self.root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            if arguments == ("status", "--markdown"):
                self.assertEqual(result.stdout, (self.root / DASHBOARD).read_text())
            if arguments == ("status", "--json"):
                self.assertFalse(json.loads(result.stdout)["product_verified"])
        self.assertEqual(snapshot(), before)
        (self.root / LEDGER).unlink()
        result = subprocess.run([sys.executable, "-B", "-m", "tools.g7pb.editor_progress", "check"],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Missing file", result.stderr)


if __name__ == "__main__":
    unittest.main()
