"""Verify the actual committed bytes, including cross-platform newline handling."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def committed(path: str) -> bytes:
    return subprocess.run(["git", "cat-file", "blob", f"HEAD:{path}"], cwd=ROOT,
                          check=True, capture_output=True).stdout


def main():
    manifest = json.loads(committed("assets-manifest.json"))
    mismatches = [path for path, digest in manifest.items()
                  if hashlib.sha256(committed(path)).hexdigest() != digest]
    if mismatches:
        raise SystemExit("Committed assets changed: " + ", ".join(mismatches))
    print(f"Verified {len(manifest)} committed artifacts.")


if __name__ == "__main__":
    main()
