"""Exercise the real checker entrypoints; never run a product/browser fixture."""
import json
import os
from pathlib import Path
import subprocess
import unittest
import tempfile
import shutil


ROOT = Path(__file__).resolve().parents[2]
CHECKERS = ("scripts/check-editor-acceptance-contract.mjs", "scripts/check-editor-layout-parity.mjs")
REGISTRATION = "scripts/lib/editorContractRegistration.mjs"
CSS_SOURCES = "scripts/lib/editorCssSources.mjs"
SOURCE_GRAPH = "scripts/lib/editorSourceGraph.mjs"


class EditorContractTests(unittest.TestCase):
    def source_graph(self, root, entries=None, owner=None, boundary=False, binding=False):
        helper = os.environ.get("G7PB_EDITOR_SOURCE_GRAPH", str(ROOT / SOURCE_GRAPH))
        selected = json.loads(os.environ.get("G7PB_EDITOR_CONTRACT_CHECKERS", "{}"))
        checker = selected.get(CHECKERS[0], str(ROOT / CHECKERS[0]))
        code = ("import {pathToFileURL} from 'node:url';import ts from 'typescript';const args=JSON.parse(process.argv[1]);"
                "const {readEditorSourceGraph}=await import(pathToFileURL(args.helper));"
                "try{const graph=await readEditorSourceGraph(args.root,args.entries??undefined);"
                "const result={files:graph.files};if(args.owner==='@Puck'){result.owner=graph.jsxOwner('Puck','config','runtimePuckConfig');}"
                "else if(args.owner){result.owner=graph.owner(args.owner);result.declaration=graph.declaration(args.owner);}"
                "if(args.boundary){const {validateEditorMutationBoundary}=await import(pathToFileURL(args.checker));"
                "result.errors=validateEditorMutationBoundary(graph);}"
                "if(args.binding){const nodes=graph.find(n=>ts.isJsxAttribute(n)&&n.name.text==='disabled');"
                "result.binding=graph.value(nodes[0].initializer.expression).getText();}console.log(JSON.stringify(result));}"
                "catch(error){console.log(JSON.stringify({error:error.message}));}")
        result = subprocess.run(["node", "--input-type=module", "-e", code, json.dumps({
            "root": str(root), "helper": helper, "checker": checker, "entries": entries,
            "owner": owner, "boundary": boundary, "binding": binding,
        })], cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def write_sources(self, root, files):
        for name, source in files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source)

    def test_actual_alias_reexport_and_moved_owner_follow_changed_source(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-owner-") as directory:
            root = Path(directory)
            self.write_sources(root, {
                "entry.ts": "import {render as view} from './barrel';export function entry(){return view();}",
                "barrel.ts": "export {HeroPreview as render} from './new/preview';",
                "new/preview.ts": "export function HeroPreview(){return 'current';}",
            })
            result = self.source_graph(root, ["entry.ts"], "HeroPreview")
            self.assertEqual(result["files"], ["barrel.ts", "entry.ts", "new/preview.ts"])
            self.assertEqual(result["owner"], "new/preview.ts")
            (root / "new/preview.ts").write_text("export function HeroPreview(){return 'changed';}")
            self.assertIn("changed", self.source_graph(root, ["entry.ts"], "HeroPreview")["declaration"])

    def test_comment_string_unused_import_and_local_declaration_cannot_supply_an_owner(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-disconnected-") as directory:
            root = Path(directory)
            self.write_sources(root, {"owner.ts": "export function protectedCommand(){return true;}"})
            for source in (
                "// import {protectedCommand} from './owner';\nexport const entry=1;",
                "const text=\"import {protectedCommand} from './owner'\";export const entry=text;",
                "import {protectedCommand} from './owner';export const entry=1;",
                "export function entry(){function protectedCommand(){return true;} return 1;}",
                "export const entry=\"function protectedCommand(){return true;}\";",
            ):
                with self.subTest(source=source):
                    (root / "entry.ts").write_text(source)
                    self.assertIn("found 0", self.source_graph(root, ["entry.ts"], "protectedCommand")["error"])

    def test_missing_circular_dynamic_and_escaping_runtime_edges_are_rejected(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-edges-") as directory:
            root = Path(directory) / "subject"
            root.mkdir()
            (root.parent / "outside.ts").write_text("export const value=1;")
            (root / "outside-link.ts").symlink_to(root.parent / "outside.ts")
            for source, expected in (
                ("import './missing';export const entry=1;", "Missing editor source import"),
                ("import './entry';export const entry=1;", "Circular editor source import"),
                ("export const entry=()=>import(target);", "Dynamic editor source import"),
                ("import '../outside';export const entry=1;", "Editor source escapes root"),
                ("import './outside-link';export const entry=1;", "Editor source escapes root"),
            ):
                with self.subTest(source=source):
                    (root / "entry.ts").write_text(source)
                    self.assertIn(expected, self.source_graph(root, ["entry.ts"])["error"])

    def test_type_only_edges_follow_project_verbatim_emission_without_false_cycles(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-type-edges-") as directory:
            root = Path(directory)
            self.write_sources(root, {
                "entry.ts": "import {type Value} from './types';export const entry:Value=1;",
                "types.ts": "import './entry';export type Value=number;",
                "tsconfig.json": json.dumps({"compilerOptions": {"verbatimModuleSyntax": False}}),
            })
            self.assertEqual(self.source_graph(root, ["entry.ts"])["files"], ["entry.ts", "tsconfig.json"])
            (root / "tsconfig.json").write_text(json.dumps({"compilerOptions": {"verbatimModuleSyntax": True}}))
            self.assertIn("Circular editor source import", self.source_graph(root, ["entry.ts"])["error"])
            (root / "entry.ts").write_text("import type {Value} from './types';export const entry:Value=1;")
            self.assertEqual(self.source_graph(root, ["entry.ts"])["files"], ["entry.ts", "tsconfig.json"])

    def test_jsx_binding_follows_hook_return_and_not_a_shadowed_same_name(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-binding-") as directory:
            root = Path(directory)
            self.write_sources(root, {
                "session.ts": "export function useSession(){const editingDisabled=!viewportPolicy.canEdit || recovering;return {editingDisabled};}",
                "entry.tsx": "import {useSession} from './session';export function entry(){const {editingDisabled}=useSession();return <Puck disabled={editingDisabled}/>;}",
            })
            self.assertEqual(self.source_graph(root, ["entry.tsx"], binding=True)["binding"], "!viewportPolicy.canEdit || recovering")
            (root / "entry.tsx").write_text("import {useSession} from './session';export function entry(){const ignored=useSession();const editingDisabled=false;return <Puck disabled={editingDisabled} data-result={ignored}/>;}")
            self.assertEqual(self.source_graph(root, ["entry.tsx"], binding=True)["binding"], "false")

    def test_mutation_boundary_uses_live_permissions_recovery_and_callbacks(self):
        original = self.source_graph(ROOT, boundary=True)
        self.assertNotIn("error", original)
        self.assertEqual(original["errors"], [])
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-boundary-") as directory:
            root = Path(directory)
            for name in original["files"]:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            changes = (
                ("@Puck", "edit: !editingDisabled", "edit: true"),
                ("editingDisabled", "!viewportPolicy.canEdit || recovering", "!viewportPolicy.canEdit"),
                ("@Puck", "onChange={boundary.onChange}", "onChange={onChange}"),
                ("usePuckDocumentBoundary", "current.canEdit && !recovery", "current.canEdit"),
                ("assessEditorCandidate", "changed && !canEdit", "false"),
            )
            for owner, before, after in changes:
                name = self.source_graph(root, owner=owner)["owner"]
                with self.subTest(path=name, mutation=before):
                    path = root / name
                    content = path.read_text()
                    self.assertIn(before, content)
                    path.write_text(content.replace(before, after, 1) + "\n// " + before + "\n")
                    result = self.source_graph(root, boundary=True)
                    self.assertNotIn("error", result)
                    self.assertTrue(result["errors"])
                    path.write_text(content)
            disabled_file = root / self.source_graph(root, owner="editingDisabled")["owner"]
            source = disabled_file.read_text()
            original_declaration = "const editingDisabled = !viewportPolicy.canEdit || recovering;"
            self.assertIn(original_declaration, source)
            disabled_file.write_text(source.replace(original_declaration,
                "const editingDisabled = false; const shadow = () => { " + original_declaration + " return editingDisabled; }; shadow();", 1))
            self.assertTrue(self.source_graph(root, boundary=True)["errors"])
            disabled_file.write_text(source)
            facade = root / "resources/js/editor/PuckEditorAdapter.tsx"
            source = facade.read_text()
            self.assertIn("export function PuckEditorAdapter(", source)
            facade.write_text(source.replace("export function PuckEditorAdapter(", "function IsolatedEditorSession(", 1)
                + "\nexport function PuckEditorAdapter(props: PuckEditorAdapterProps) { return <IsolatedEditorSession {...props}/>; }\n")
            wrapped = self.source_graph(root, boundary=True)
            self.assertNotIn("error", wrapped)
            self.assertEqual(wrapped["errors"], [])

    def registration(self, source, scripts=None):
        code = ("import {validateEditorTestRegistration as registration, validateFocusedUnitCommand as unit} from './" + REGISTRATION + "';"
                "const input=JSON.parse(process.argv[1]);"
                "console.log(JSON.stringify({registration:registration(input.source,'example.spec.ts'),unit:unit(input.scripts)}));")
        result = subprocess.run(["node", "--input-type=module", "-e", code,
                                 json.dumps({"source": source, "scripts": scripts or {"test:unit": "vitest run"}})],
                                cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_current_entrypoints_agree_with_isolated_unit_command(self):
        selected = json.loads(os.environ.get("G7PB_EDITOR_CONTRACT_CHECKERS", "{}"))
        if selected and set(selected) != set(CHECKERS):
            self.fail("Planner must declare every checker; missing checkers cannot be skipped")
        for script in CHECKERS:
            with self.subTest(script=script):
                target = Path(selected.get(script, ROOT / script))
                self.assertTrue(target.is_absolute() and target.is_file(), f"Missing declared checker: {target}")
                result = subprocess.run(["node", str(target), "--root", str(ROOT)], cwd=ROOT, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_comments_and_skipped_tests_are_not_registered_behavior(self):
        for body in ("// test('fake', async () => {});", "test.skip('fake', async () => {});", "const text = `test('fake', () => {})`;"):
            result = self.registration("import {test} from '@playwright/test';\n" + body)
            self.assertTrue(result["registration"])

    def test_valid_alias_and_helper_refactor_keep_registration(self):
        result = self.registration("import {test as scenario} from '@playwright/test';\nconst operation=()=>1;\nscenario('example', async () => {operation();});")
        self.assertEqual(result, {"registration": [], "unit": []})

    def test_hidden_preflight_fails_without_requiring_old_shell_profiles(self):
        result = self.registration("import {test} from '@playwright/test';test('case',async()=>{});",
                                   {"test:unit": "npm run check && vitest run"})
        self.assertTrue(result["unit"])

    def css_graph(self, root, entries):
        code = ("import {readCssGraph,cssPropertyValues} from './" + CSS_SOURCES + "';"
                "const args=JSON.parse(process.argv[1]);try{const graph=await readCssGraph(args.root,args.entries);"
                "console.log(JSON.stringify({...graph,values:cssPropertyValues(graph.css,'.theme','--radius')}));}"
                "catch(error){console.log(JSON.stringify({error:error.message}));}")
        result = subprocess.run(["node", "--input-type=module", "-e", code, json.dumps({"root": str(root), "entries": entries})],
                                cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_css_imports_follow_shared_file_and_read_changed_values_without_stale_cache(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-css-imports-") as directory:
            root = Path(directory)
            (root / "tokens").mkdir()
            (root / "editor.css").write_text('@import url("./tokens/theme.css"); .editor {display:block;}')
            (root / "public.css").write_text('@import "./tokens/theme.css"; .viewer {display:block;}')
            shared = root / "tokens/theme.css"
            shared.write_text('.theme {--radius:1rem;}')
            for entry in ("editor.css", "public.css"):
                graph = self.css_graph(root, [entry])
                self.assertEqual(graph["files"], [entry, "tokens/theme.css"])
                self.assertEqual(graph["values"], ["1rem"])
            shared.write_text('.theme {--radius:.75rem;}')
            self.assertEqual(self.css_graph(root, ["editor.css"])["values"], [".75rem"])
            graph = self.css_graph(root, ["editor.css", "public.css"])
            self.assertEqual(len(graph["files"]), 3)

    def test_missing_circular_remote_and_escaping_css_imports_fail(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-css-import-errors-") as directory:
            root = Path(directory) / "subject"
            root.mkdir()
            entry = root / "editor.css"
            for statement, expected in (
                ('@import "./missing.css";', "Missing CSS import"),
                ('@import "./editor.css";', "Circular CSS import"),
                ('@import "https://example.test/theme.css";', "Unsupported CSS import"),
                ('@import "../outside.css";', "CSS import escapes root")):
                with self.subTest(statement=statement):
                    (root.parent / "outside.css").write_text('.outside {}')
                    entry.write_text(statement)
                    self.assertIn(expected, self.css_graph(root, ["editor.css"])["error"])

    def test_comments_are_not_imports_and_selector_declarations_ignore_file_order(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-css-import-comments-") as directory:
            root = Path(directory)
            (root / "editor.css").write_text('/* @import "missing.css"; */ .other {--radius:wrong;} .theme {--radius:1rem;}')
            self.assertEqual(self.css_graph(root, ["editor.css"])["values"], ["1rem"])


if __name__ == "__main__":
    unittest.main()
