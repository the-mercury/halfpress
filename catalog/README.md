# Gear catalog

The catalog is a folder of small JSON files, one per item. Every file is checked against a JSON Schema in `schema/` and by `scripts/validate_catalog.py`, locally and in GitHub Actions.

## Layout

```
catalog/
  schema/     JSON Schemas (common, mount, camera, lens, filter, adapter)
  mounts/     canon-rf.json ...
  cameras/    canon-eos-r50.json ...
  lenses/     canon-rf-50-f1.8-stm.json ...
  filters/    generic-nd1000-55.json ...
  adapters/   canon-ef-eos-r.json, step-up-49-55.json ...
```

## Rules for every entry

- **One item per file.** The file name is the entry's `id` plus `.json`.
- **`id`** is a lowercase slug of letters, digits, `-` and `.`, unique across the whole catalog, for example `canon-rf-50-f1.8-stm`.
- **`schemaVersion`** is `1` for now.
- **`type`** matches the folder: `mount`, `camera`, `lens`, `filter` or `adapter`.
- **Units are in the field name:** `Mm` millimetres, `M` metres, `G` grams. Apertures are f-numbers (`1.8` means f/1.8). Shutter speeds are strings as the camera shows them (`"1/4000"`, `"30"`).
- **Leave a field out when you don't know it.** Never guess a value.
- **`source`** is required:
  - `url`: the maker's official spec page (https).
  - `retrieved`: the date you read it, `YYYY-MM-DD`.
  - `status`: `draft` (added, not checked), `sourced` (every field matches the page) or `verified` (a second person confirmed it in review).

## Fields by type

| Type | Required | Optional |
| --- | --- | --- |
| Mount | `name`, `maker`, `formats` | `flangeMm` |
| Camera | `maker`, `model`, `mount`, `sensor` (`format`, `widthMm`, `heightMm`), `cropFactor`, `stabilization`, `shutter` (`mechanicalFastest`, `longestTimed`), `iso` (`min`, `max`) | `sensor.megapixels`, `shutter.electronicFastest`, `shutter.bulb`, `iso.expandedMax`, `battery`, `weightG` |
| Lens | `maker`, `model`, `mount`, `coverage`, `focalMm` (`min`, `max`), `maxAperture`, `stabilization`, `autofocus` | `minAperture`, `filterThreadMm` (`null` when there is no thread), `minFocusM`, `maxMagnification`, `weightG` |
| Filter | `maker`, `model`, `kind`, `sizeMm`, `attach` | `ndFactor` (required for `nd`), `ndStops` (required for `variable-nd`), `lightLossStops` |
| Adapter | `maker`, `model`, `kind`, `from`, `to` | `passesAutofocus` (required for a mount adapter), `passesStabilization` |

Notes:

- `maxAperture` lists the widest aperture at one or more focal lengths, wide end first. A prime has one entry, and a zoom lists at least its two ends.
- `stabilization` is `{ "present": true, "stops": 4 }`, or `{ "present": false }`. On a camera it means in-body stabilization; on a lens, optical stabilization.
- A mount adapter's `from` and `to` are mount ids. A step ring's `from` is the lens thread and `to` is the filter size, both in mm.
- Generic items, like a plain ND1000 or a step ring, use `"maker": "Generic"`.

## What the validator checks beyond the schema

- File names match ids, and ids are unique.
- Cameras, lenses and adapters point at mounts that exist.
- Ranges are in order: focal length, ISO, ND stops, shutter speeds.
- Lens aperture points sit inside the focal range, wide end first, and the minimum aperture is a larger f-number than every maximum.
- Step-up rings go from a smaller thread to a larger filter, step-down rings the other way.

## Run the checks

```
pip install -r requirements-dev.txt
python -m unittest discover -s tests
python scripts/validate_catalog.py
```
