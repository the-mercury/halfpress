# press/2

Half a shutter press: the moment you focus and set up, before the shot. The repo and web address keep the old slug, `halfpress`.

A pocket field app for photographers. Add the camera, lenses and filters you own, and press/2 gives you settings, framing and exposure help that fit that exact kit.

It runs in the browser, installs to your phone's home screen, works offline, and needs no account.

## Status

In development. The catalog covers a Canon EOS R50 kit, and the app has four screens (Scenes, Lenses, Exposure, ND timer) that read from it. The kit is fixed for now; My Kit, where you pick your own gear, comes next.

## Run it locally

The app is plain HTML, CSS and JavaScript in `app/`, with no build step for the app itself.

```
npm run serve          # serves app/ at http://localhost:8000
```

Any static server works; the app only needs to be served over http(s), not opened as a file, so it can load its modules and catalog.

To try it on a phone, host the `app/` folder on any static host (for example Netlify Drop), open it in Safari, then Share → Add to Home Screen. After the first visit it works offline.

## Develop

```
pip install -r requirements-dev.txt
python scripts/validate_catalog.py     # check catalog entries
python scripts/build_catalog.py        # rebuild app/data/catalog.json after editing catalog/
python -m unittest discover -s tests   # catalog script tests
npm test                               # app logic tests (Node 22+)
```

| Path | What it holds |
| --- | --- |
| `catalog/` | One JSON file per camera, lens, filter, mount or adapter, plus the schemas |
| `scripts/` | Validator and the build script that merges the catalog into `app/data/catalog.json` |
| `app/js/optics.js` | Camera math: equivalent focal length, apertures, shutter rules, ND times, filter and mount fit |
| `app/js/scenes.js` | Scene recipes and the rules that pick a lens from the kit |
| `app/js/views/` | One file per screen |
| `app/sw.js` | Offline cache; add new app files to its list (a test checks this) |

## What it does

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

- **Code** (the app, scripts, tests and schemas): [MIT](LICENSE).
- **Gear catalog data** (`catalog/` entries and `app/data/catalog.json`): [CC BY 4.0](catalog/LICENSE.md). Reuse it freely, with credit to press/2.

Specifications come from each maker's published spec pages, linked in every entry. Brand and product names belong to their owners.
