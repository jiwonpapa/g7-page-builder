import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.g7pb.planner import (
    EDITOR_ASSET_DIGESTS, EDITOR_ASSET_SPEC, EDITOR_ASSET_VIEW,
    build_plan, editor_asset_identity_added,
)


UNVERSIONED_EDITOR = '<!doctype html>\n<html lang="{{ str_replace(\'_\', \'-\', $locale) }}">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <meta name="robots" content="noindex,nofollow">\n    <title>G7 Page Builder</title>\n    <link rel="stylesheet" href="{{ url(\'/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder-editor.css\') }}">\n</head>\n<body class="g7pb-editor-shell">\n    <div hidden data-g7pb-runtime-config="{{ json_encode($siteRuntimeConfig ?? [], JSON_THROW_ON_ERROR) }}"></div>\n    <div id="g7pb-editor"\n         data-testid="page-builder-editor-root"\n         data-g7pb-editor\n         data-document-id="{{ $documentId }}"\n         data-locale="{{ $locale }}"></div>\n    <script>\n        (() => {\n            const token = window.localStorage.getItem(\'auth_token\');\n            if (!token) {\n                const redirect = encodeURIComponent(window.location.pathname + window.location.search);\n                window.location.replace(`/admin/login?redirect=${redirect}`);\n            }\n        })();\n    </script>\n    <script defer src="{{ url(\'/api/modules/assets/jiwonpapa-page_builder/dist/js/page-builder-editor.iife.js\') }}"></script>\n</body>\n</html>\n'


class EditorAssetScopeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.view = self.root / EDITOR_ASSET_VIEW
        self.view.parent.mkdir(parents=True)
        self.before = UNVERSIONED_EDITOR
        self.view.write_text(self.before)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
                        'commit', '-qm', 'baseline'], check=True)
        self.after = self.before.replace('<head>\n', '<head>\n' + EDITOR_ASSET_DIGESTS, 1)
        for file, var in [('css/page-builder-editor.css', 'editorCssDigest'), ('js/page-builder-editor.iife.js', 'editorJsDigest')]:
            literal = "{{ url('/api/modules/assets/jiwonpapa-page_builder/dist/" + file + "') }}"
            self.after = self.after.replace(literal, literal + '?v={{ $' + var + ' }}')
        spec = self.root / EDITOR_ASSET_SPEC
        spec.parent.mkdir(parents=True)
        spec.write_text("import {test} from '@playwright/test'; test('asset identity', async () => {});\n")

    def test_exact_change_requires_browser_in_every_phase_without_full_expansion(self):
        self.view.write_text(self.after)
        for phase in ('submission', 'integration', 'verification', 'ci'):
            with self.subTest(phase=phase):
                plan = build_plan(self.root, [EDITOR_ASSET_VIEW], base='HEAD', phase=phase)
                self.assertFalse(plan.unresolved, plan.unresolved)
                self.assertFalse(plan.full)
                browser = [gate for gate in plan.gates if gate.name.startswith('browser:')]
                self.assertEqual(len(browser), 1)
                self.assertIn(EDITOR_ASSET_SPEC, browser[0].argv)
                self.assertTrue(browser[0].runtime)
                self.assertIn(EDITOR_ASSET_VIEW, browser[0].inputs)
                self.assertTrue(any(g.name == 'browser-runtime-sync' for g in plan.gates))

    def test_auth_markup_script_paths_and_arbitrary_php_are_not_exempt(self):
        for before, after in [
            ('if (!token)', 'if (false)'), ('G7 Page Builder</title>', 'Changed</title>'),
            ('data-document-id=', 'data-native-id='), ('window.location.replace', 'window.location.assign'),
            ("hash_file('sha256'", "hash_file('md5'"), ('?v={{ $editorJsDigest }}', '?v=constant'),
            ('$editorDist = base_path', '$editorDist = system'),
        ]:
            with self.subTest(change=before):
                candidate = self.after.replace(before, after)
                self.assertNotEqual(candidate, self.after)
                self.view.write_text(candidate)
                self.assertFalse(editor_asset_identity_added(self.root, 'HEAD'))
                self.assertTrue(build_plan(self.root, [EDITOR_ASSET_VIEW], base='HEAD').unresolved)

    def test_missing_test_or_partial_versioning_cannot_claim_acceptance(self):
        self.view.write_text(self.after.replace('?v={{ $editorCssDigest }}', ''))
        self.assertFalse(editor_asset_identity_added(self.root, 'HEAD'))
        self.view.write_text(self.after)
        (self.root / EDITOR_ASSET_SPEC).unlink()
        plan = build_plan(self.root, [EDITOR_ASSET_VIEW], base='HEAD')
        self.assertTrue(any('Missing editor asset identity' in message for message in plan.unresolved))

    def test_symlink_view_is_not_exempt(self):
        target = self.root / 'alternate.blade.php'
        target.write_text(self.after)
        self.view.unlink()
        self.view.symlink_to(target)
        self.assertFalse(editor_asset_identity_added(self.root, 'HEAD'))
