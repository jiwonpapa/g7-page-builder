#!/usr/bin/env python3
"""Repository entry point; never installed on customer servers."""
from pathlib import Path
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tools.g7pb.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
