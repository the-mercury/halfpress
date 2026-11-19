# Half Press

A pocket field app for photographers. Add the camera, lenses and filters you own, and Half Press gives you settings, framing and exposure help that fit that exact kit.

It runs in the browser, installs to your phone's home screen, works offline, and needs no account.

## Status

Early planning. Version 1 starts with Canon RF bodies and RF/RF-S lenses.

## What it will do

| Feature | What you get |
| --- | --- |
| My Kit | Pick your camera, lenses, filters, adapters and step rings from the catalog, or add your own. Export or import the kit as one file. |
| Scenes | Tap a scene (landscape, portrait, pets, night, long exposure, far subjects) and get the lens to use and its settings. |
| Lens view | Zoom through a lens and see the full-frame equivalent, angle of view, widest aperture and slowest safe shutter. |
| Exposure trainer | Move aperture, shutter and ISO and watch the picture change. |
| ND timer | Pick an ND filter and the metered shutter speed, get the long-exposure time and a countdown. |
| Compatibility check | Warnings when a lens needs an adapter, a filter needs a step ring, or a crop lens goes on a full-frame body. |

## How it works

- **Static web app.** Plain HTML, CSS and JavaScript, served from a free static host. No server and no database.
- **Gear catalog.** One JSON file per camera, lens or filter under `catalog/`, checked against a JSON Schema on every change and merged into one versioned `catalog.json`.
- **Sources.** Specs come from each maker's official spec page. Every entry records its source link and a status: draft, sourced or verified.
- **Your data stays on your phone.** Your kit is stored locally and only leaves the device if you export it.

## Roadmap

1. **Foundation:** catalog schema and checks, Canon RF catalog, the first app screens.
2. **My Kit:** add and remove gear, kit-aware screens, export and import.
3. **More mounts:** Sony E, Nikon Z, Fujifilm X, and a contribution guide.
4. **Extras:** compare two lenses, focal-range gaps, share a kit file.

## Branches

- `main`: released work.
- `dev`: integration branch.
- `feature/*`: one branch per step, opened as a draft pull request into `dev`.

## License

To be decided.
