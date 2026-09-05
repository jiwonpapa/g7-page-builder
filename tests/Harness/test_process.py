import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from tools.g7pb.process import run


class ProcessTests(unittest.TestCase):
    def test_capture_and_failure_preserve_subprocess_contract(self):
        result = run([sys.executable, '-c', 'print("ready")'], capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout, 'ready\n')
        with self.assertRaises(subprocess.CalledProcessError):
            run([sys.executable, '-c', 'raise SystemExit(3)'], check=True)

    def test_timeout_kills_descendants_and_returns_within_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = pathlib.Path(directory) / 'orphan'
            child = f'import time,pathlib;time.sleep(0.4);pathlib.Path({str(marker)!r}).write_text("orphan")'
            parent = f'import subprocess,sys,time;subprocess.Popen([sys.executable,"-c",{child!r}]);time.sleep(30)'
            started = time.monotonic()
            with self.assertRaises(subprocess.TimeoutExpired):
                run([sys.executable, '-c', parent], timeout=0.1, capture_output=True)
            self.assertLess(time.monotonic() - started, 3)
            time.sleep(0.45)
            self.assertFalse(marker.exists())
