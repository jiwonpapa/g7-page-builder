"""Test-only CLI for isolated Git fixtures; never used by formal commands."""
import argparse
from pathlib import Path
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.g7pb.coord import main

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-root", type=Path, required=True)
    args, remaining = parser.parse_known_args()
    raise SystemExit(main(remaining, fixture_root=args.fixture_root))
