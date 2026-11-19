import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexCatalog } from "../js/catalog.js";
import { DEFAULT_KIT, resolveKit } from "../js/kit.js";
import { SCENES, pickLens, recommend } from "../js/scenes.js";

const catalog = indexCatalog(JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url))));
const kit = resolveKit(catalog, DEFAULT_KIT);
const scene = (id) => SCENES.find((s) => s.id === id);

test("default kit resolves against the catalog", () => {
  assert.deepEqual(kit.missing, []);
  assert.equal(kit.camera.model, "EOS R50");
  assert.equal(kit.lenses.length, 3);
});

test("missing ids are reported, not thrown", () => {
  const partial = resolveKit(catalog, { ...DEFAULT_KIT, lenses: ["no-such-lens"] });
  assert.deepEqual(partial.missing, ["no-such-lens"]);
  assert.equal(partial.lenses.length, 0);
});

test("each scene picks the lens a photographer would", () => {
  const expected = {
    "land-tripod": "canon-rf-s-18-45-f4.5-6.3-is-stm",
    "land-hand": "canon-rf-s-18-45-f4.5-6.3-is-stm",
    portrait: "canon-rf-50-f1.8-stm",
    "pet-run": "canon-rf-s-55-210-f5-7.1-is-stm",
    indoors: "canon-rf-50-f1.8-stm",
    far: "canon-rf-s-55-210-f5-7.1-is-stm",
    night: "canon-rf-s-18-45-f4.5-6.3-is-stm",
    water: "canon-rf-s-18-45-f4.5-6.3-is-stm",
    pan: "canon-rf-s-55-210-f5-7.1-is-stm",
  };
  for (const s of SCENES) assert.equal(pickLens(s, kit).lens.id, expected[s.id], s.id);
});

test("far subject uses the long end at its widest aperture", () => {
  const r = recommend(scene("far"), kit);
  assert.equal(r.focal, 210);
  assert.equal(r.equivalent, 336);
  assert.deepEqual(r.settings[1], ["Aperture", "f/7.1"]);
  assert.deepEqual(r.settings[2], ["Shutter", "1/400+"]);
});

test("portrait on the 50mm keeps f/2 and a fast shutter", () => {
  const r = recommend(scene("portrait"), kit);
  assert.deepEqual(r.settings[1], ["Aperture", "f/2"]);
  assert.deepEqual(r.settings[2], ["Shutter", "1/200+"]);
  assert.deepEqual(r.warnings, []);
});

test("silky water finds the ND1000 through the 49-55 ring", () => {
  const r = recommend(scene("water"), kit);
  assert.equal(r.filter.item.id, "kf-concept-nano-x-magnetic-nd1000-55");
  assert.equal(r.filter.ring.id, "kf-concept-step-up-49-55");
});

test("a kit with only a prime warns when the scene is out of reach", () => {
  const primeOnly = { ...kit, lenses: kit.lenses.filter((l) => l.id === "canon-rf-50-f1.8-stm") };
  const r = recommend(scene("far"), primeOnly);
  assert.ok(r.warnings.some((w) => w.includes("None of your lenses reaches")));
});

test("a missing filter is a warning, not a crash", () => {
  const noFilters = { ...kit, filters: [] };
  const r = recommend(scene("water"), noFilters);
  assert.equal(r.filter, null);
  assert.ok(r.warnings.some((w) => w.includes("ND filter")));
});
