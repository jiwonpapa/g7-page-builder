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
    def source_graph(self, root, entries=None, owner=None, boundary=False, binding=False, target=None, selection=False):
        helper = os.environ.get("G7PB_EDITOR_SOURCE_GRAPH", str(ROOT / SOURCE_GRAPH))
        selected = json.loads(os.environ.get("G7PB_EDITOR_CONTRACT_CHECKERS", "{}"))
        checker = selected.get(CHECKERS[0], str(ROOT / CHECKERS[0]))
        code = ("import {pathToFileURL} from 'node:url';import {relative} from 'node:path';import ts from 'typescript';const args=JSON.parse(process.argv[1]);"
                "const {readEditorSourceGraph}=await import(pathToFileURL(args.helper));"
                "try{const graph=await readEditorSourceGraph(args.root,args.entries??undefined);"
                "const result={files:graph.files};if(args.owner==='@Puck'){result.owner=graph.jsxOwner('Puck','config','runtimePuckConfig');}"
                "else if(args.owner){result.owner=graph.owner(args.owner);result.declaration=graph.declaration(args.owner);"
                "const n=graph.nodes(args.owner)[0]?.initializer;if(n){const source=n.getSourceFile().text;result.initializer={"
                "text:n.getText(),left:ts.isBinaryExpression(n)?n.left.getText():null,"
                "start:[...source.slice(0,n.getStart())].length,end:[...source.slice(0,n.end)].length};}}"
                "if(args.boundary){const {validateEditorMutationBoundary}=await import(pathToFileURL(args.checker));"
                "result.errors=validateEditorMutationBoundary(graph);}"
                "if(args.selection){const {validateCanvasSelectionPermissions}=await import(pathToFileURL(args.checker));"
                "result.errors=validateCanvasSelectionPermissions(graph);}"
                "if(args.binding){const nodes=graph.find(n=>ts.isJsxAttribute(n)&&n.name.text==='disabled');"
                "result.binding=graph.value(nodes[0].initializer.expression).getText();"
                "result.inputResolved=Boolean(graph.inputBinding(nodes[0].initializer.expression));}"
                "if(args.target){const nodes=graph.find(n=>(ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))"
                "&&n.tagName.getText()===args.target&&(args.target!=='Puck'||n.attributes.properties.some(p=>"
                "ts.isJsxAttribute(p)&&p.name.text==='config'&&p.initializer?.expression?.getText()==='runtimePuckConfig')));"
                "if(nodes.length!==1||!ts.isJsxSelfClosingElement(nodes[0]))throw Error('Expected one self-closing target');"
                "const n=nodes[0],attribute=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text===(args.target==='Puck'?'onChange':'boundary'));"
                "const value=attribute?.initializer?.expression,receiver=args.target==='Puck'&&value&&ts.isPropertyAccessExpression(value)?value.expression:value;"
                "if(!receiver||!ts.isIdentifier(receiver))throw Error('Expected an explicit boundary receiver');"
                "const source=n.getSourceFile().text;result.target={file:relative(args.root,n.getSourceFile().fileName),"
                "start:[...source.slice(0,n.getStart())].length,end:[...source.slice(0,n.end)].length,text:n.getText(),receiver:receiver.text};}"
                "console.log(JSON.stringify(result));}"
                "catch(error){console.log(JSON.stringify({error:error.message}));}")
        result = subprocess.run(["node", "--input-type=module", "-e", code, json.dumps({
            "root": str(root.resolve()), "helper": helper, "checker": checker, "entries": entries,
            "owner": owner, "boundary": boundary, "binding": binding, "target": target, "selection": selection,
        })], cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def write_sources(self, root, files):
        for name, source in files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source)

    def alias_puck_import(self, source):
        # Replace the bound import specifier once; whitespace and line wrapping
        # belong to the source formatter, not this mutation fixture's contract.
        code = ("import ts from 'typescript';const source=JSON.parse(process.argv[1]);"
                "const tree=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);"
                "const matches=tree.statements.filter(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='@puckeditor/core')"
                ".flatMap(n=>n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)?n.importClause.namedBindings.elements:[])"
                ".filter(n=>!n.isTypeOnly&&(n.propertyName??n.name).text==='Puck');"
                "if(matches.length!==1||matches[0].name.text!=='Puck')throw Error('Expected exactly one Puck import specifier');"
                "const n=matches[0];console.log(JSON.stringify(source.slice(0,n.getStart())+'Puck as NativePuck'+source.slice(n.end)));")
        result = subprocess.run(["node", "--input-type=module", "-e", code, json.dumps(source)],
                                cwd=ROOT, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

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

    def test_spread_arguments_cannot_supply_positional_permission_provenance(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-spread-input-") as directory:
            root = Path(directory)
            source = ("function useSession(unused,canEdit,...extra){return <Puck disabled={canEdit}/>;}"
                      "export function entry(){const viewportPolicy={canEdit:false};"
                      "return useSession(0,viewportPolicy.canEdit);}")
            (root / "entry.tsx").write_text(source)
            self.assertTrue(self.source_graph(root, ["entry.tsx"], binding=True)["inputResolved"])
            # Runtime canEdit receives true; AST argument 1 is not parameter 1.
            (root / "entry.tsx").write_text(source.replace(
                "useSession(0,viewportPolicy.canEdit)",
                "useSession(...[0,true],viewportPolicy.canEdit)",
            ))
            self.assertFalse(self.source_graph(root, ["entry.tsx"], binding=True)["inputResolved"])

    def test_current_canvas_selection_uses_the_mutation_boundary_permission(self):
        result = self.source_graph(ROOT, selection=True)
        self.assertNotIn("error", result)
        self.assertEqual(result["errors"], [])

    def test_moved_canvas_selection_accepts_aliases_but_rejects_disconnected_guards(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-canvas-permission-") as directory:
            root = Path(directory)
            caller = """
import {resolveEditorViewportPolicy, usePuckDocumentBoundary} from './policy';
import {useCanvasEditingUi as useCanvas} from './canvas';
export function entry() {
  const viewportPolicy = resolveEditorViewportPolicy();
  const permission = viewportPolicy.canEdit;
  const boundary = usePuckDocumentBoundary(null, {canEdit: permission});
  const canvas = useCanvas(null, permission);
  return <Puck boundary={boundary} canvas={canvas}/>;
}
"""
            canvas = """
import {useEffect} from 'react';
export function useCanvasEditingUi(data, editAllowed) {
  const transitionCanvasContext = (action) => action;
  useEffect(() => {
    const accept = (selection) => {
      if (!editAllowed) return;
      transitionCanvasContext({type: 'selection.accept', selection});
    };
    const acceptRangeState = (active) => {
      if (!editAllowed) return;
      transitionCanvasContext({type: 'range.change', active});
    };
    window.addEventListener('message', event => accept(event.data));
    window.addEventListener('range', event => acceptRangeState(event.detail));
  }, [editAllowed]);
  return data;
}
"""
            self.write_sources(root, {
                "entry.tsx": caller,
                "canvas.tsx": canvas,
                "policy.ts": "export function resolveEditorViewportPolicy(){return {canEdit:false};}"
                             "export function usePuckDocumentBoundary(data,options){return options;}",
            })
            check = lambda: self.source_graph(root, ["entry.tsx"], selection=True)
            self.assertEqual(check()["errors"], [])
            # Names and the owning module may change without changing inputs.
            (root / "canvas.tsx").write_text(canvas.replace("acceptRangeState", "receiveRange").replace("accept =", "receiveSelection =").replace("=> accept(", "=> receiveSelection("))
            self.assertEqual(check()["errors"], [])
            (root / "canvas.tsx").write_text(canvas)
            for broken in (
                caller.replace("useCanvas(null, permission)", "useCanvas(null, true)"),
                caller.replace("useCanvas(null, permission)", "useCanvas(null, resolveEditorViewportPolicy().canEdit)"),
            ):
                (root / "entry.tsx").write_text(broken)
                result = check()
                self.assertNotIn("error", result)
                self.assertTrue(result["errors"])
            (root / "entry.tsx").write_text(caller)
            for name in ("accept", "acceptRangeState"):
                with self.subTest(unguarded=name):
                    before = "const " + name + " = (" + ("selection" if name == "accept" else "active") + ") => {\n      if (!editAllowed) return;"
                    self.assertEqual(canvas.count(before), 1)
                    (root / "canvas.tsx").write_text(canvas.replace(before, before.replace("if (!editAllowed) return;", ""), 1))
                    result = check()
                    self.assertNotIn("error", result)
                    self.assertTrue(result["errors"])

    def test_type_only_reference_cannot_make_a_loaded_function_a_runtime_owner(self):
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-type-owner-") as directory:
            root = Path(directory)
            self.write_sources(root, {
                "owner.ts": "export function protectedCommand(){return 1;} export const liveValue=1;",
                "entry.ts": "import {liveValue} from './owner';import type {protectedCommand} from './owner';"
                            "export function entry(): ReturnType<typeof protectedCommand>{return liveValue;}",
            })
            result = self.source_graph(root, ["entry.ts"], "protectedCommand")
            self.assertIn("error", result)
            self.assertIn("found 0", result["error"])

    def test_mutation_callbacks_cannot_use_a_shadow_boundary_with_overridden_members(self):
        original = self.source_graph(ROOT)
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-boundary-members-") as directory:
            root = Path(directory)
            for name in original["files"]:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            target = self.source_graph(root, target="Puck")["target"]
            path = root / target["file"]
            source = path.read_text()
            for member, replacement in (
                ("onChange", "() => undefined"),
                ("onAction", "() => undefined"),
                ("acceptForPublish", "() => null"),
            ):
                with self.subTest(member=member):
                    shadow = "{((protectedBoundary) => { const " + target["receiver"] + " = { ...protectedBoundary, " + member + ": " + replacement + " }; return " + target["text"] + "; })(" + target["receiver"] + ")}"
                    path.write_text(source[:target["start"]] + shadow + source[target["end"]:])
                    result = self.source_graph(root, boundary=True)
                    self.assertNotIn("error", result)
                    self.assertTrue(result["errors"], member)
            path.write_text(source)

    def test_recovery_component_cannot_receive_a_shadowed_boundary_receiver(self):
        original = self.source_graph(ROOT)
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-recovery-receiver-") as directory:
            root = Path(directory)
            for name in original["files"]:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            target = self.source_graph(root, target="PuckDocumentBoundary")["target"]
            path = root / target["file"]
            source = path.read_text()
            shadow = "{((protectedBoundary) => { const " + target["receiver"] + " = { ...protectedBoundary, finishRecovery: () => undefined }; return " + target["text"] + "; })(" + target["receiver"] + ")}"
            path.write_text(source[:target["start"]] + shadow + source[target["end"]:])
            result = self.source_graph(root, boundary=True)
            self.assertNotIn("error", result)
            self.assertTrue(result["errors"])

    def test_split_session_owner_keeps_the_same_mutation_and_recovery_contract(self):
        original = self.source_graph(ROOT)
        with tempfile.TemporaryDirectory(prefix="g7pb-editor-split-session-") as directory:
            root = Path(directory)
            for name in original["files"]:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            # Keep the real boundary implementation; only its caller moves into
            # a separate hook behind an explicitly keyed JSX session fixture.
            self.write_sources(root, {
                "resources/js/editor/usePageBuilderSession.ts": """
import {usePuckDocumentBoundary as useDocumentBoundary} from './PuckDocumentBoundary';
export function usePageBuilderSession({initialSession, contextRef, canEdit: editAllowed, onDirty, onChange}) {
  const {boundary: canonicalBoundary, data, recovering} = useDocumentBoundary(initialSession, {
    context: contextRef, canEdit: editAllowed, onDirty, onChange,
  });
  const editingDisabled = !editAllowed || recovering;
  return {boundary: canonicalBoundary, data, recovering, editingDisabled};
}
""",
                "resources/js/editor/PuckEditorAdapter.tsx": """
import {Puck} from '@puckeditor/core';
import {PuckDocumentBoundary} from './PuckDocumentBoundary';
import {usePageBuilderSession} from './usePageBuilderSession';
import {resolveEditorViewportPolicy} from './editorViewportPolicy';
export function PuckEditorAdapter(props) {
  return <IsolatedSession key={JSON.stringify([props.document.document_id, props.revisionKey])} {...props}/>;
}
function IsolatedSession({initialSession, contextRef, onDirty, onChange, onPublish}) {
  const viewportPolicy = resolveEditorViewportPolicy({disabled: false, hostWidth: 1280, canvasWidth: 1280});
  const {boundary, data, recovering, editingDisabled} = usePageBuilderSession({initialSession, contextRef, canEdit: viewportPolicy.canEdit, onDirty, onChange});
  const runtimePuckConfig = {};
  return <><Puck config={runtimePuckConfig} data={data}
    permissions={{edit: !editingDisabled, insert: !editingDisabled, delete: !editingDisabled, duplicate: !editingDisabled, drag: !editingDisabled}}
    onChange={boundary.onChange} onAction={boundary.onAction}
    onPublish={(nextData) => {
      if (editingDisabled) return;
      const candidate = boundary.acceptForPublish(nextData);
      if (candidate) return onPublish(candidate);
    }}/><PuckDocumentBoundary boundary={boundary}/></>;
}
""",
            })
            self.assertEqual(self.source_graph(root, boundary=True)["errors"], [])
            self.assertEqual(self.source_graph(root, owner="editingDisabled")["owner"], "resources/js/editor/usePageBuilderSession.ts")
            caller = root / "resources/js/editor/PuckEditorAdapter.tsx"
            caller_source = caller.read_text()
            self.assertEqual(caller_source.count("canEdit: viewportPolicy.canEdit"), 1)
            shorthand = caller_source.replace("  const {boundary, data, recovering, editingDisabled}",
                "  const canEdit = viewportPolicy.canEdit;\n  const {boundary, data, recovering, editingDisabled}", 1)
            caller.write_text(shorthand.replace("canEdit: viewportPolicy.canEdit", "canEdit", 1))
            self.assertEqual(self.source_graph(root, boundary=True)["errors"], [])
            for broken in (caller_source.replace("canEdit: viewportPolicy.canEdit", "canEdit: true", 1),
                           shorthand.replace("canEdit: viewportPolicy.canEdit", "canEdit: true", 1),
                           caller_source.replace("canEdit: viewportPolicy.canEdit", "canEdit: viewportPolicy.canEdit, ...{canEdit: true}", 1)):
                caller.write_text(broken)
                result = self.source_graph(root, boundary=True)
                self.assertNotIn("error", result)
                self.assertTrue(result["errors"])
            caller.write_text(caller_source)
            for tag, member, replacement in (("Puck", "onChange", "() => undefined"),
                                              ("Puck", "onAction", "() => undefined"),
                                              ("Puck", "acceptForPublish", "() => null"),
                                              ("PuckDocumentBoundary", "finishRecovery", "() => undefined")):
                with self.subTest(member=member):
                    target = self.source_graph(root, target=tag)["target"]
                    path = root / target["file"]
                    source = path.read_text()
                    shadow = "{((protectedBoundary) => { const " + target["receiver"] + " = { ...protectedBoundary, " + member + ": " + replacement + " }; return " + target["text"] + "; })(" + target["receiver"] + ")}"
                    path.write_text(source[:target["start"]] + shadow + source[target["end"]:])
                    result = self.source_graph(root, boundary=True)
                    self.assertNotIn("error", result)
                    self.assertTrue(result["errors"])
                    path.write_text(source)

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
                ("editingDisabled", None, None),
                ("@Puck", "onChange={boundary.onChange}", "onChange={onChange}"),
                ("usePuckDocumentBoundary", "current.canEdit && !recovery", "current.canEdit"),
                ("assessEditorCandidate", "changed && !canEdit", "false"),
            )
            for owner, before, after in changes:
                owned = self.source_graph(root, owner=owner)
                name = owned["owner"]
                with self.subTest(path=name, mutation=before):
                    path = root / name
                    content = path.read_text()
                    if owner == "editingDisabled":
                        initializer = owned["initializer"]
                        self.assertIsNotNone(initializer["left"])
                        path.write_text(content[:initializer["start"]] + initializer["left"] + content[initializer["end"]:] + "\n// " + initializer["text"] + "\n")
                    else:
                        self.assertIn(before, content)
                        path.write_text(content.replace(before, after, 1) + "\n// " + before + "\n")
                    result = self.source_graph(root, boundary=True)
                    self.assertNotIn("error", result)
                    self.assertTrue(result["errors"])
                    path.write_text(content)
            disabled_owner = self.source_graph(root, owner="editingDisabled")
            disabled_file = root / disabled_owner["owner"]
            source = disabled_file.read_text()
            initializer = disabled_owner["initializer"]
            shadow = "false; const shadow = () => { const editingDisabled = " + initializer["text"] + "; return editingDisabled; }; shadow()"
            disabled_file.write_text(source[:initializer["start"]] + shadow + source[initializer["end"]:])
            self.assertTrue(self.source_graph(root, boundary=True)["errors"])
            disabled_file.write_text(source)
            facade = root / "resources/js/editor/PuckEditorAdapter.tsx"
            source = facade.read_text()
            self.assertIn("export function PuckEditorAdapter(", source)
            facade.write_text(source.replace("export function PuckEditorAdapter(", "function IsolatedEditorSession(", 1)
                + "\nexport function PuckEditorAdapter(props: PuckEditorAdapterProps) { return <IsolatedEditorSession key={JSON.stringify([props.document.document_id, props.revisionKey])} {...props}/>; }\n")
            wrapped = self.source_graph(root, boundary=True)
            self.assertNotIn("error", wrapped)
            self.assertEqual(wrapped["errors"], [])
            # The Puck owner may differ from the facade and session hook owner.
            target = self.source_graph(root, target="Puck")["target"]
            puck_file = root / target["file"]
            puck_source = puck_file.read_text()
            aliased = puck_source[:target["start"]] + target["text"].replace("<Puck", "<NativePuck", 1) + puck_source[target["end"]:]
            puck_file.write_text(self.alias_puck_import(aliased))
            named = self.source_graph(root, boundary=True)
            self.assertNotIn("error", named)
            self.assertEqual(named["errors"], [])

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
