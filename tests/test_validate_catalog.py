"""Tests for scripts/validate_catalog.py.

Each test copies the valid fixture catalog into a temporary folder, breaks one
thing, and checks that the validator reports it. Run with:

    python -m unittest discover -s tests
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import validate_catalog  # noqa: E402

VALID = REPO_ROOT / "tests" / "fixtures" / "valid"


class CatalogTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.catalog = Path(self._tmp.name) / "catalog"
        shutil.copytree(VALID, self.catalog)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def edit(self, rel: str, change) -> None:
        """Load a fixture file, apply change(data), and write it back."""
        path = self.catalog / rel
        data = json.loads(path.read_text(encoding="utf-8"))
        change(data)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def assert_problem(self, fragment: str) -> None:
        problems = validate_catalog.validate(self.catalog)
        self.assertTrue(
            any(fragment in p for p in problems),
            f"expected a problem containing {fragment!r}, got {problems}",
        )


class ValidCatalog(CatalogTestCase):
    def test_fixtures_pass(self):
        self.assertEqual(validate_catalog.validate(self.catalog), [])

    def test_empty_catalog_passes(self):
        empty = Path(self._tmp.name) / "empty"
        empty.mkdir()
        self.assertEqual(validate_catalog.validate(empty), [])

    def test_main_exit_codes(self):
        self.assertEqual(validate_catalog.main(["x", str(self.catalog)]), 0)
        self.edit("lenses/example-x-50.json", lambda d: d.pop("mount"))
        self.assertEqual(validate_catalog.main(["x", str(self.catalog)]), 1)


class SchemaErrors(CatalogTestCase):
    def test_missing_required_field(self):
        self.edit("lenses/example-x-50.json", lambda d: d.pop("focalMm"))
        self.assert_problem("'focalMm' is a required property")

    def test_unknown_field(self):
        self.edit("cameras/example-c1.json", lambda d: d.update(price=999))
        self.assert_problem("Additional properties are not allowed")

    def test_bad_id_format(self):
        self.edit("filters/generic-nd1000-55.json", lambda d: d.update(id="ND 1000"))
        self.assert_problem("does not match")

    def test_bad_shutter_speed(self):
        self.edit("cameras/example-c1.json", lambda d: d["shutter"].update(longestTimed="1/0"))
        self.assert_problem("shutter/longestTimed")

    def test_source_needs_https(self):
        self.edit("mounts/example-x.json", lambda d: d["source"].update(url="http://example.com"))
        self.assert_problem("source/url")

    def test_nd_filter_needs_factor(self):
        self.edit("filters/generic-nd1000-55.json", lambda d: d.pop("ndFactor"))
        self.assert_problem("'ndFactor' is a required property")

    def test_step_ring_takes_sizes_not_mounts(self):
        self.edit("adapters/step-up-49-55.json", lambda d: d.update({"from": "example-x"}))
        self.assert_problem("adapters/step-up-49-55.json: from")

    def test_invalid_json(self):
        (self.catalog / "lenses" / "broken.json").write_text("{ not json", encoding="utf-8")
        self.assert_problem("not valid JSON")


class CrossChecks(CatalogTestCase):
    def test_file_name_must_match_id(self):
        self.edit("lenses/example-x-50.json", lambda d: d.update(id="example-x-50-ii"))
        self.assert_problem("file name must be example-x-50-ii.json")

    def test_entry_in_wrong_folder(self):
        src = self.catalog / "lenses" / "example-x-50.json"
        shutil.copy(src, self.catalog / "filters" / "example-x-50.json")
        self.assert_problem("filters/example-x-50.json: type")

    def test_duplicate_id_across_same_type(self):
        other = self.catalog / "mounts" / "example-z.json"
        data = json.loads((self.catalog / "mounts" / "example-x.json").read_text())
        data["id"] = "example-x"
        other.write_text(json.dumps(data), encoding="utf-8")
        self.assert_problem("is already used by")

    def test_unknown_mount(self):
        self.edit("cameras/example-c1.json", lambda d: d.update(mount="example-y"))
        self.assert_problem("mount example-y is not in catalog/mounts")

    def test_focal_range_order(self):
        self.edit("lenses/example-x-18-45.json", lambda d: d.update(focalMm={"min": 45, "max": 18}))
        self.assert_problem("focalMm.min is higher than focalMm.max")

    def test_aperture_point_outside_range(self):
        self.edit(
            "lenses/example-x-18-45.json",
            lambda d: d["maxAperture"].append({"atMm": 70, "f": 6.3}),
        )
        self.assert_problem("outside the focal range")

    def test_aperture_points_wide_end_first(self):
        self.edit("lenses/example-x-18-45.json", lambda d: d["maxAperture"].reverse())
        self.assert_problem("from the wide end to the long end")

    def test_min_aperture_above_max(self):
        self.edit("lenses/example-x-50.json", lambda d: d.update(minAperture=1.4))
        self.assert_problem("minAperture must be a larger f-number")

    def test_iso_order(self):
        self.edit("cameras/example-c1.json", lambda d: d["iso"].update(min=64000))
        self.assert_problem("iso.min is higher than iso.max")

    def test_shutter_order(self):
        self.edit("cameras/example-c1.json", lambda d: d["shutter"].update(longestTimed="1/8000"))
        self.assert_problem("must be faster than shutter.longestTimed")

    def test_step_up_ring_direction(self):
        self.edit("adapters/step-up-49-55.json", lambda d: d.update({"from": 58}))
        self.assert_problem("a step-up ring goes from a smaller thread")

    def test_adapter_unknown_mount(self):
        self.edit("adapters/example-classic-to-x.json", lambda d: d.update(to="example-q"))
        self.assert_problem("to mount example-q is not in catalog/mounts")

    def test_variable_nd_order(self):
        self.edit("filters/generic-vnd-58.json", lambda d: d.update(ndStops={"min": 9, "max": 1}))
        self.assert_problem("ndStops.min is higher than ndStops.max")


if __name__ == "__main__":
    unittest.main()
