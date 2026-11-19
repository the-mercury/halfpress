#!/usr/bin/env python3
"""Validate the HalfPress gear catalog.

Checks every entry against its JSON Schema, then runs the checks a schema
cannot express on its own: file names match ids, ids are unique, references
point at real entries, and ranges are in order.

Usage:
    python scripts/validate_catalog.py [CATALOG_DIR]

CATALOG_DIR defaults to the catalog/ folder next to this script's parent.
Exits with status 1 and prints every problem found when the catalog is invalid.
"""

from __future__ import annotations

import json
import sys
from fractions import Fraction
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = REPO_ROOT / "catalog" / "schema"

# Folder name -> entry type and schema it is checked against.
FOLDERS = {
    "mounts": "mount",
    "cameras": "camera",
    "lenses": "lens",
    "filters": "filter",
    "adapters": "adapter",
}


def load_registry() -> Registry:
    """Load every schema file so $ref between them resolves by $id."""
    registry = Registry()
    for path in sorted(SCHEMA_DIR.glob("*.schema.json")):
        schema = json.loads(path.read_text(encoding="utf-8"))
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
    return registry


def shutter_seconds(value: str) -> Fraction:
    """Turn "1/4000" or "30" into seconds."""
    return Fraction(value)


def validate(catalog_dir: Path) -> list[str]:
    """Return a list of problems. An empty list means the catalog is valid."""
    registry = load_registry()
    validators = {
        kind: Draft202012Validator(
            registry.contents(f"urn:halfpress:schema:{kind}"), registry=registry
        )
        for kind in FOLDERS.values()
    }

    problems: list[str] = []
    entries: dict[str, list[tuple[Path, dict]]] = {kind: [] for kind in FOLDERS.values()}
    seen_ids: dict[str, Path] = {}

    for folder, kind in FOLDERS.items():
        for path in sorted((catalog_dir / folder).glob("*.json")):
            rel = path.relative_to(catalog_dir)
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as err:
                problems.append(f"{rel}: not valid JSON ({err})")
                continue

            errors = sorted(validators[kind].iter_errors(data), key=lambda e: list(e.path))
            for err in errors:
                where = "/".join(str(p) for p in err.path) or "(top level)"
                problems.append(f"{rel}: {where}: {err.message}")
            if errors:
                continue

            if path.stem != data["id"]:
                problems.append(f"{rel}: file name must be {data['id']}.json to match its id")
            if data["id"] in seen_ids:
                other = seen_ids[data["id"]].relative_to(catalog_dir)
                problems.append(f"{rel}: id {data['id']} is already used by {other}")
            else:
                seen_ids[data["id"]] = path
            entries[kind].append((path, data))

    mount_ids = {data["id"] for _, data in entries["mount"]}

    for path, cam in entries["camera"]:
        rel = path.relative_to(catalog_dir)
        if cam["mount"] not in mount_ids:
            problems.append(f"{rel}: mount {cam['mount']} is not in catalog/mounts")
        if cam["iso"]["min"] > cam["iso"]["max"]:
            problems.append(f"{rel}: iso.min is higher than iso.max")
        expanded = cam["iso"].get("expandedMax")
        if expanded is not None and expanded < cam["iso"]["max"]:
            problems.append(f"{rel}: iso.expandedMax is lower than iso.max")
        shutter = cam["shutter"]
        if shutter_seconds(shutter["mechanicalFastest"]) >= shutter_seconds(shutter["longestTimed"]):
            problems.append(f"{rel}: shutter.mechanicalFastest must be faster than shutter.longestTimed")

    for path, lens in entries["lens"]:
        rel = path.relative_to(catalog_dir)
        if lens["mount"] not in mount_ids:
            problems.append(f"{rel}: mount {lens['mount']} is not in catalog/mounts")
        lo, hi = lens["focalMm"]["min"], lens["focalMm"]["max"]
        if lo > hi:
            problems.append(f"{rel}: focalMm.min is higher than focalMm.max")
        stops = lens["maxAperture"]
        for point in stops:
            if not lo <= point["atMm"] <= hi:
                problems.append(f"{rel}: maxAperture at {point['atMm']} mm is outside the focal range")
        focal_order = [p["atMm"] for p in stops]
        if focal_order != sorted(focal_order):
            problems.append(f"{rel}: maxAperture entries must go from the wide end to the long end")
        min_ap = lens.get("minAperture")
        if min_ap is not None and min_ap <= max(p["f"] for p in stops):
            problems.append(f"{rel}: minAperture must be a larger f-number than every maxAperture")

    for path, flt in entries["filter"]:
        rel = path.relative_to(catalog_dir)
        nd = flt.get("ndStops")
        if nd is not None and nd["min"] > nd["max"]:
            problems.append(f"{rel}: ndStops.min is higher than ndStops.max")

    for path, ad in entries["adapter"]:
        rel = path.relative_to(catalog_dir)
        if ad["kind"] == "mount-adapter":
            for end in ("from", "to"):
                if ad[end] not in mount_ids:
                    problems.append(f"{rel}: {end} mount {ad[end]} is not in catalog/mounts")
        elif ad["kind"] == "step-up-ring" and not ad["from"] < ad["to"]:
            problems.append(f"{rel}: a step-up ring goes from a smaller thread to a larger filter")
        elif ad["kind"] == "step-down-ring" and not ad["from"] > ad["to"]:
            problems.append(f"{rel}: a step-down ring goes from a larger thread to a smaller filter")

    return problems


def main(argv: list[str]) -> int:
    catalog_dir = Path(argv[1]).resolve() if len(argv) > 1 else REPO_ROOT / "catalog"
    problems = validate(catalog_dir)
    counts = {
        folder: len(list((catalog_dir / folder).glob("*.json"))) for folder in FOLDERS
    }
    summary = ", ".join(f"{n} {folder}" for folder, n in counts.items())
    if problems:
        print(f"Catalog has {len(problems)} problem(s) ({summary}):")
        for line in problems:
            print(f"  - {line}")
        return 1
    print(f"Catalog OK ({summary}).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
