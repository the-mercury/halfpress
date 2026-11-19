#!/usr/bin/env python3
"""Build app/data/catalog.json from the catalog folder.

Validates the catalog first, then merges every entry into one file the app
loads. The output is deterministic: entries are sorted by id and the version
is a hash of the content, so the file only changes when the catalog does.

Usage:
    python scripts/build_catalog.py           write app/data/catalog.json
    python scripts/build_catalog.py --check   fail if the file is out of date
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import validate_catalog

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG_DIR = REPO_ROOT / "catalog"
OUTPUT = REPO_ROOT / "app" / "data" / "catalog.json"


def build(catalog_dir: Path = CATALOG_DIR) -> str:
    """Return the merged catalog as JSON text. Raises ValueError if invalid."""
    problems = validate_catalog.validate(catalog_dir)
    if problems:
        raise ValueError("catalog is invalid:\n" + "\n".join(f"  - {p}" for p in problems))

    sections: dict[str, list[dict]] = {}
    for folder in validate_catalog.FOLDERS:
        items = [
            json.loads(path.read_text(encoding="utf-8"))
            for path in sorted((catalog_dir / folder).glob("*.json"))
        ]
        sections[folder] = sorted(items, key=lambda item: item["id"])

    body = json.dumps(sections, ensure_ascii=False, sort_keys=False)
    version = hashlib.sha256(body.encode("utf-8")).hexdigest()[:12]
    merged = {
        "schemaVersion": 1,
        "version": version,
        "counts": {folder: len(items) for folder, items in sections.items()},
        **sections,
    }
    return json.dumps(merged, ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str]) -> int:
    check = "--check" in argv[1:]
    try:
        text = build()
    except ValueError as err:
        print(err)
        return 1

    current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else None
    if check:
        if current != text:
            print(f"{OUTPUT.relative_to(REPO_ROOT)} is out of date. Run: python scripts/build_catalog.py")
            return 1
        print(f"{OUTPUT.relative_to(REPO_ROOT)} is up to date.")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(text, encoding="utf-8")
    counts = json.loads(text)["counts"]
    print(f"Wrote {OUTPUT.relative_to(REPO_ROOT)} (" + ", ".join(f"{n} {k}" for k, n in counts.items()) + ").")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
