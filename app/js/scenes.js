// Scene recipes. Each scene says what it needs; recommend() picks the lens
// in the kit that fits best and works out settings that lens can deliver.

import {
  filterFit,
  formatShutter,
  handheldShutter,
  mountFit,
  widestAperture,
} from "./optics.js";

/**
 * want:      full-frame equivalent focal range the scene looks best in, mm
 * fast:      prefer the lens with the widest aperture over the best framing
 * aperture:  target f-number, or "widest"
 * motion:    slowest shutter (s) that freezes the subject when handheld
 * tripod:    shutter text for tripod scenes, which skip the handheld rule
 */
export const SCENES = [
  { id: "land-tripod", name: "Landscape, tripod", short: "Landscape tripod", icon: "tripod",
    want: [16, 40], aperture: 8, tripod: "any", mode: "M", iso: "100", focus: "One-Shot",
    filter: "cpl", tip: "Use the 2 s timer. The CPL deepens sky and cuts glare on water." },
  { id: "land-hand", name: "Landscape, handheld", short: "Landscape handheld", icon: "mountain",
    want: [16, 40], aperture: 8, motion: 1 / 125, mode: "Av", iso: "Auto, max 1600", focus: "One-Shot",
    tip: "Keep stabilization on and level the horizon." },
  { id: "portrait", name: "Portrait", short: "Portrait", icon: "person",
    want: [70, 135], fast: true, aperture: 2, motion: 1 / 200, mode: "Av", iso: "Auto", focus: "Eye detection",
    tip: "Stand back so the face isn't distorted and keep the background far behind." },
  { id: "pet-run", name: "Pet running", short: "Pet running", icon: "paw",
    want: [100, 400], aperture: "widest", motion: 1 / 1000, mode: "Tv", iso: "Auto, max 6400",
    focus: "Servo, animal detection", tip: "Burst mode. Track the eyes." },
  { id: "indoors", name: "Pet or person, indoors", short: "Indoors", icon: "house",
    want: [50, 90], fast: true, aperture: "widest", motion: 1 / 100, mode: "Av", iso: "Auto, max 6400",
    focus: "Eye or animal detection", tip: "Get close to a window and keep the shutter fast." },
  { id: "far", name: "Far subject", short: "Far subject", icon: "target",
    want: [250, 1000], aperture: "widest", motion: 1 / 400, mode: "Av", iso: "Auto, max 3200", focus: "Servo",
    tip: "Zoom all the way, brace your elbows, and shoot in good light." },
  { id: "night", name: "Night and city, tripod", short: "Night city", icon: "moon",
    want: [20, 60], aperture: 8, tripod: "2-15 s", mode: "M", iso: "100", focus: "Manual, magnified view",
    tip: "Turn stabilization off on a tripod." },
  { id: "water", name: "Silky water, ND", short: "Silky water", icon: "drop",
    want: [20, 60], aperture: 8, tripod: "8 s+", mode: "M", iso: "100", focus: "Manual, set before the filter",
    filter: "nd", timer: true, tip: "Focus first, then attach the ND and use the timer." },
  { id: "pan", name: "Panning", short: "Panning", icon: "pan",
    want: [60, 200], aperture: 8, motion: 1 / 60, panning: true, mode: "Tv", iso: "Auto", focus: "Servo",
    tip: "Follow the subject smoothly and keep moving after the click." },
];

function eqRange(lens, crop) {
  return [lens.focalMm.min * crop, lens.focalMm.max * crop];
}

// A prime's range has zero width, so a prime inside the target range counts
// as a small overlap rather than none.
const POINT = 1e-3;

function overlap([a1, a2], [b1, b2]) {
  const shared = Math.min(a2, b2) - Math.max(a1, b1);
  if (shared > 0) return shared;
  return shared === 0 && a1 >= b1 && a2 <= b2 ? POINT : 0;
}

function distance([a1, a2], [b1, b2]) {
  if (overlap([a1, a2], [b1, b2]) > 0) return 0;
  return a2 < b1 ? b1 / a2 : a1 / b2;
}

/** The kit's best lens for a scene, and the focal length to use it at. */
export function pickLens(scene, kit) {
  const crop = kit.camera.cropFactor;
  const usable = kit.lenses.filter((l) => mountFit(kit.camera, l, kit.adapters).fit !== "none");
  if (usable.length === 0) return null;

  const scored = usable.map((lens) => {
    const range = eqRange(lens, crop);
    const target = Math.sqrt(scene.want[0] * scene.want[1]) / crop;
    const focal = Math.min(lens.focalMm.max, Math.max(lens.focalMm.min, target));
    return {
      lens,
      focal,
      covers: overlap(range, scene.want) / (scene.want[1] - scene.want[0]),
      miss: distance(range, scene.want),
      f: widestAperture(lens, focal),
    };
  });

  const covering = scored.filter((s) => s.covers > 0);
  const pool = covering.length ? covering : scored;
  pool.sort((a, b) => {
    if (!covering.length) return a.miss - b.miss;
    if (scene.fast && a.f !== b.f) return a.f - b.f;
    if (a.covers !== b.covers) return b.covers - a.covers;
    return a.f - b.f;
  });
  return { ...pool[0], outOfRange: covering.length === 0 };
}

/** Settings for a scene with the given kit. */
export function recommend(scene, kit) {
  const pick = pickLens(scene, kit);
  if (!pick) return { scene, warnings: ["No lens in your kit fits this camera."] };

  const { lens, focal } = pick;
  const camera = kit.camera;
  const warnings = [];
  const widest = widestAperture(lens, focal);

  let aperture = scene.aperture === "widest" ? widest : Math.max(scene.aperture, widest);
  if (scene.aperture !== "widest" && scene.aperture < widest) {
    warnings.push(`This lens opens to f/${widest} here, not f/${scene.aperture}. Raise ISO to keep the shutter fast.`);
  }
  if (pick.outOfRange) {
    warnings.push(`None of your lenses reaches the usual ${scene.want[0]}-${scene.want[1]} mm look. This is the closest.`);
  }

  let shutter;
  if (scene.tripod) {
    shutter = scene.tripod;
  } else if (scene.panning) {
    shutter = `${formatShutter(scene.motion)}-1/30`;
  } else {
    const stops = Math.max(lens.stabilization.present ? lens.stabilization.stops ?? 0 : 0,
      camera.stabilization.present ? camera.stabilization.stops ?? 0 : 0);
    const steady = handheldShutter(focal, camera.cropFactor, stops);
    shutter = `${formatShutter(Math.min(scene.motion, steady))}+`;
  }

  let filter = null;
  if (scene.filter) {
    const options = kit.filters
      .filter((f) => (scene.filter === "nd" ? f.kind === "nd" || f.kind === "variable-nd" : f.kind === scene.filter))
      .map((f) => ({ f, fit: filterFit(lens.filterThreadMm, f.sizeMm, kit.adapters) }));
    const usable = options.find((o) => o.fit.fit !== "none");
    if (usable) {
      filter = { item: usable.f, ring: usable.fit.ring ?? null };
    } else {
      warnings.push(options.length
        ? `Your ${scene.filter.toUpperCase()} filter doesn't fit this lens: ${options[0].fit.reason}.`
        : `This scene works best with a ${scene.filter.toUpperCase()} filter, and your kit has none.`);
    }
  }

  return {
    scene,
    lens,
    focal: Math.round(focal),
    equivalent: Math.round(focal * camera.cropFactor),
    settings: [
      ["Mode", scene.mode],
      ["Aperture", `f/${aperture}`],
      ["Shutter", shutter],
      ["ISO", scene.iso],
      ["Focus", scene.focus],
    ],
    filter,
    warnings,
  };
}
