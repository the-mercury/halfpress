"""Tests for scripts/build_catalog.py."""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import build_catalog  # noqa: E402

VALID = REPO_ROOT / "tests" / "fixtures" / "valid"


class BuildCatalog(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.catalog = Path(self._tmp.name) / "catalog"
        shutil.copytree(VALID, self.catalog)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_merges_every_section_sorted_by_id(self):
        data = json.loads(build_catalog.build(self.catalog))
        self.assertEqual(data["schemaVersion"], 1)
        self.assertEqual(data["counts"], {"mounts": 2, "cameras": 1, "lenses": 2, "filters": 2, "adapters": 2})
        ids = [lens["id"] for lens in data["lenses"]]
        self.assertEqual(ids, sorted(ids))

    def test_output_is_deterministic(self):
        self.assertEqual(build_catalog.build(self.catalog), build_catalog.build(self.catalog))

    def test_version_changes_with_content(self):
        before = json.loads(build_catalog.build(self.catalog))["version"]
        path = self.catalog / "lenses" / "example-x-50.json"
        data = json.loads(path.read_text())
        data["weightG"] = 161
        path.write_text(json.dumps(data), encoding="utf-8")
        after = json.loads(build_catalog.build(self.catalog))["version"]
        self.assertNotEqual(before, after)

    def test_refuses_invalid_catalog(self):
        path = self.catalog / "lenses" / "example-x-50.json"
        data = json.loads(path.read_text())
        data["mount"] = "nowhere"
        path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaises(ValueError):
            build_catalog.build(self.catalog)

    def test_committed_catalog_is_current(self):
        self.assertEqual(build_catalog.main(["x", "--check"]), 0)


if __name__ == "__main__":
    unittest.main()
