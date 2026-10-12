import tempfile
import unittest
from pathlib import Path

from tools.g7pb.planner import EDITOR_ASSET_SPEC, INTER_FONT_INPUTS, INTER_FONT_TEST, build_plan
from tools.g7pb.environment import build_inputs


class InterFontScopeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (*INTER_FONT_INPUTS, INTER_FONT_TEST, EDITOR_ASSET_SPEC):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('// fixture\n' if path.suffix in ('.ts', '.mjs') else 'fixture')

    def test_every_owned_font_input_selects_integrity_and_browser_without_full(self):
        for phase in ('submission', 'integration', 'verification', 'ci'):
            for name in INTER_FONT_INPUTS:
                with self.subTest(phase=phase, path=name):
                    plan = build_plan(self.root, [name], phase=phase)
                    self.assertEqual(plan.unresolved, [])
                    self.assertFalse(plan.full)
                    unit = next(g for g in plan.gates if g.name == 'unit:' + INTER_FONT_TEST)
                    browser = next(g for g in plan.gates if g.name == 'browser:' + EDITOR_ASSET_SPEC)
                    self.assertTrue(set(INTER_FONT_INPUTS).issubset(unit.inputs))
                    self.assertTrue(set(INTER_FONT_INPUTS).issubset(browser.inputs))
                    self.assertEqual(browser.deferred, phase == 'submission')
                    self.assertIn('browser-assets', browser.depends_on)

    def test_missing_consumer_and_unknown_vendor_file_fail_closed(self):
        (self.root / INTER_FONT_TEST).unlink()
        self.assertTrue(build_plan(self.root, [INTER_FONT_INPUTS[0]]).unresolved)
        self.assertTrue(build_plan(self.root, ['resources/css/vendor/inter-4.1/unknown.woff2']).unresolved)

    def test_font_and_license_bytes_invalidate_existing_build_fingerprint(self):
        for name in INTER_FONT_INPUTS:
            if not name.startswith('resources/css/'):
                continue
            before = build_inputs(self.root)
            path = self.root / name
            path.write_bytes(path.read_bytes() + b'changed')
            self.assertNotEqual(before, build_inputs(self.root), name)


if __name__ == '__main__':
    unittest.main()
