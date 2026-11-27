// Lens view: zoom through each lens in the kit and see what it frames. A
// subject stands in the scene at its true size for your distance, so the
// picture also answers "how big will it be, and can I crop it?".

import { $, $$, esc, lensClass, lensLabel, store } from "../dom.js";
import {
  angleOfView,
  cropMegapixels,
  equivalentFocal,
  filterFit,
  formatShutter,
  frameFill,
  handheldShutter,
  printSizeCm,
  widestAperture,
} from "../optics.js";
import { SUBJECTS, drawSubject } from "../subjects.js";

// Your distance from the subject, metres.
const DISTANCES = [0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300];
const DEFAULT_DISTANCE_M = 10;
const GROUND_Y = 107;      // where the subject stands in the scene, SVG units
const CROP_TARGET = 0.6;   // crop until the subject fills 60% of the frame
const MIN_USEFUL_MP = 2;   // below this a crop is too soft to use
const KEY = { subject: "halfpress.lens.subject", distance: "halfpress.lens.distance" };

const fmtM = (m) => (m < 10 ? m.toFixed(1) : Math.round(m)).toString().replace(/\.0$/, "");
const pct = (x) => `${x < 0.01 ? "under 1" : Math.round(x * 100)}%`;

/** For a person or child taller than the frame, which portrait crop it is. */
function portraitCrop(subject, sceneHm) {
  if (!["person", "child"].includes(subject.id) || sceneHm >= subject.heightM) return null;
  const share = sceneHm / subject.heightM;
  return share >= 0.5 ? "half body" : share >= 0.25 ? "head and shoulders" : "face only";
}

/** The longest focal length on a lens at which the whole subject still fits. */
function reachOf(lens, subject, distanceM, sensor) {
  const fill = frameFill(subject, distanceM, lens.focalMm.max, sensor);
  const focal = fill > 0.95 ? Math.max(lens.focalMm.min, Math.floor((lens.focalMm.max * 0.95) / fill)) : lens.focalMm.max;
  return { lens, focal, fill: frameFill(subject, distanceM, focal, sensor) };
}

// A simple scene drawn at the widest framing; zooming scales it up.
const SCENE_SVG = `
  <rect x="-3000" y="-3000" width="6300" height="3096" fill="#9cc7e6"/>
  <circle cx="236" cy="38" r="13" fill="#f6dc8a"/>
  <path d="M-600 96 L10 58 L62 78 L122 40 L184 82 L232 60 L900 96 Z" fill="#7f9db5"/>
  <path d="M-600 96 L40 80 L96 90 L150 74 L214 90 L270 78 L900 96 Z" fill="#587f6f"/>
  <rect x="-3000" y="95" width="6300" height="3100" fill="#5f8f52"/>
  <rect x="66" y="84" width="3" height="16" fill="#5a4630"/><circle cx="67.5" cy="78" r="10" fill="#3f6f45"/>
  <rect x="222" y="88" width="2.4" height="12" fill="#5a4630"/><circle cx="223.2" cy="83" r="7.5" fill="#3f6f45"/>`;

export const lensView = {
  id: "lens",
  label: "Lenses",
  icon: "lens",

  render(root, { kit }) {
    const camera = kit.camera;
    const crop = camera.cropFactor;
    const baseEq = Math.min(...kit.lenses.map((l) => l.focalMm.min * crop));
    let current = kit.lenses[0];

    root.innerHTML = `
      <div class="head">
        <span class="eyebrow">Your lenses on the ${esc(camera.model)}</span>
        <h1>What each lens sees</h1>
      </div>
      <div class="seg lens" id="lensSeg" role="group" aria-label="Lens">
        ${kit.lenses.map((l, i) => `<button type="button" class="${lensClass(kit, l)}" data-i="${i}" aria-pressed="false">${esc(lensLabel(l))}</button>`).join("")}
      </div>
      <div class="frame">
        <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g id="vfZoom">${SCENE_SVG}<g id="vfSubject"></g></g></svg>
        <span class="tag" id="vfTag"></span>
      </div>
      <div class="ctl">
        <div class="row"><label for="focal">Zoom</label><span class="val" id="focalVal"></span></div>
        <input type="range" id="focal" step="1">
        <span class="effect" id="focalNote"></span>
      </div>
      <div class="seg" id="lensSubject" role="group" aria-label="Subject">
        ${SUBJECTS.map((x) => `<button type="button" data-id="${x.id}" aria-pressed="false">${esc(x.label)}</button>`).join("")}
      </div>
      <div class="ctl">
        <div class="row"><label for="lensDist">Your distance</label><span class="val" id="lensDistVal"></span></div>
        <input type="range" id="lensDist" min="0" max="${DISTANCES.length - 1}" step="1">
      </div>
      <div class="tiles" id="lensTiles"></div>
      <div class="notes" id="lensNotes" aria-live="polite"></div>
      <div class="panel" id="lensFacts"></div>`;

    const slider = $("#focal", root);
    const dist = $("#lensDist", root);
    let subject = SUBJECTS.find((x) => x.id === store.get(KEY.subject)) ?? SUBJECTS[0];
    const saved = Number(store.get(KEY.distance));
    dist.value = DISTANCES.indexOf(DISTANCES.includes(saved) ? saved : DEFAULT_DISTANCE_M);
    // Pixels per metre at the subject when framed by the widest lens in the kit.
    const widestMm = baseEq / crop;

    const update = () => {
      const f = Number(slider.value);
      const d = DISTANCES[Number(dist.value)];
      const eq = equivalentFocal(f, crop);
      const isStops = current.stabilization.present ? current.stabilization.stops ?? 0 : 0;
      const bodyStops = camera.stabilization.present ? camera.stabilization.stops ?? 0 : 0;
      const angle = angleOfView(f, camera.sensor.widthMm);

      // The subject at true size, with the camera aimed at it: centred when it
      // fits, at its top when it doesn't (a person up close becomes a portrait).
      const pxPerM0 = 200 / ((d * camera.sensor.heightMm) / widestMm);
      const sceneHm = (d * camera.sensor.heightMm) / f;
      const aimM = subject.heightM - Math.min(subject.heightM, sceneHm) / 2;
      const aimY = GROUND_Y - aimM * pxPerM0;
      $("#vfSubject", root).innerHTML = drawSubject(subject, 150, GROUND_Y, pxPerM0);
      $("#vfZoom", root).setAttribute("transform",
        `translate(150 100) scale(${((f * crop) / baseEq).toFixed(3)}) translate(-150 ${(-aimY).toFixed(2)})`);
      $("#vfTag", root).textContent = `${f} mm · looks like ${eq} mm · ${fmtM(d)} m away`;
      $("#focalVal", root).textContent = `${f} mm`;
      $("#lensDistVal", root).textContent = `${fmtM(d)} m`;

      const fill = frameFill(subject, d, f, camera.sensor);
      const framing = portraitCrop(subject, sceneHm);
      const mp = cropMegapixels(camera.sensor.megapixels, Math.min(fill, 1), CROP_TARGET);
      const tooClose = current.minFocusM && d < current.minFocusM;
      const tile = (k, v, small = false) => `<div class="tile"><div class="k">${k}</div><div class="v${small ? " small" : ""}">${v}</div></div>`;
      $("#lensTiles", root).innerHTML =
        tile("Full-frame look", `${eq} mm`) +
        tile("Widest aperture", `f/${widestAperture(current, f)}`) +
        tile("Slowest handheld", formatShutter(handheldShutter(f, crop, Math.max(isStops, bodyStops)))) +
        tile("Angle of view", `${angle.toFixed(angle < 10 ? 1 : 0)}°`) +
        tile(`${esc(subject.label)} fills`, framing ? `Cropped: ${framing}` : fill > 1 ? "Doesn't fit" : pct(fill), true) +
        tile("After a crop", framing || fill >= CROP_TARGET ? "No crop needed" : fill > 1 ? "Doesn't fit" : `${mp.toFixed(mp < 10 ? 1 : 0)} MP`, true);

      // Notes for the points this setup has crossed, most important first.
      const notes = [];
      if (tooClose) notes.push(["warning", `Too close to focus. This lens focuses no closer than ${current.minFocusM} m.`]);
      if (framing) {
        notes.push(["tip", framing === "face only"
          ? "Only the face fits. Step back or zoom out for head and shoulders."
          : `Cropped to ${framing}: a portrait framing.`]);
      } else if (fill > 1) {
        notes.push(["warning", `The ${subject.noun} doesn't fit. ${f > current.focalMm.min ? "Zoom out, or step" : "Step"} back to about ${fmtM((d * fill) / 0.9)} m.`]);
      } else if (fill < CROP_TARGET) {
        notes.push(mp < MIN_USEFUL_MP
          ? ["warning", `Too small to crop into a usable picture (${mp.toFixed(1)} MP left). Get closer or use a longer lens.`]
          : ["tip", `The ${subject.noun} fills ${pct(fill)} of the frame. Cropping in leaves ${mp.toFixed(mp < 10 ? 1 : 0)} MP, enough for a sharp print up to ${Math.round(printSizeCm(mp))} cm wide.`]);
      }
      const reach = kit.lenses.map((l) => reachOf(l, subject, d, camera.sensor)).filter((r) => r.fill <= 1);
      const best = reach.reduce((m, r) => (!m || r.fill > m.fill ? r : m), null);
      if (best && kit.lenses.length > 1 && !framing) {
        notes.push(["tip", best.lens === current
          ? `From ${fmtM(d)} m, this is your lens with the most reach for a ${subject.noun}.`
          : `From ${fmtM(d)} m, the ${esc(lensLabel(best.lens))} at ${best.focal} mm makes the ${subject.noun} biggest (${pct(best.fill)} of the frame).`]);
      }
      $("#lensNotes", root).innerHTML = notes.slice(0, 3).map(([cls, text]) => `<p class="${cls}">${text}</p>`).join("");
      $$("#lensSubject button", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === subject.id)));
      store.set(KEY.subject, subject.id);
      store.set(KEY.distance, String(d));
    };

    const facts = () => {
      const l = current;
      const fits = kit.filters.map((flt) => ({ flt, fit: filterFit(l.filterThreadMm, flt.sizeMm, kit.adapters) }));
      const usable = fits.filter((x) => x.fit.fit !== "none");
      const filterLine = usable.length
        ? usable.map((x) => esc(x.flt.model) + (x.fit.ring ? ` (with the ${esc(x.fit.ring.model)})` : "")).join(", ")
        : "None of your filters fit this lens.";
      $("#lensFacts", root).innerHTML = `
        <div class="row"><h2>${esc(l.model)}</h2><span class="chip ${lensClass(kit, l)}">${l.stabilization.present ? "IS" : "No IS"}</span></div>
        <div class="tiles">
          <div class="tile"><div class="k">Filter thread</div><div class="v small">${l.filterThreadMm ? `${l.filterThreadMm} mm` : "None"}</div></div>
          <div class="tile"><div class="k">Closest focus</div><div class="v small">${l.minFocusM ? `${l.minFocusM} m` : "Not listed"}</div></div>
        </div>
        <p><b>Filters that fit:</b> ${filterLine}</p>
        <p class="muted">Specs from <a href="${esc(l.source.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(l.maker)}</a> · ${esc(l.source.status)}</p>`;
    };

    const select = (i) => {
      current = kit.lenses[i];
      slider.min = current.focalMm.min;
      slider.max = current.focalMm.max;
      slider.value = current.focalMm.min;
      slider.disabled = current.focalMm.min === current.focalMm.max;
      $("#focalNote", root).textContent = slider.disabled
        ? "Fixed lens. Walk closer or farther to change the framing."
        : "Drag to zoom through the lens.";
      $$("#lensSeg button", root).forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i)));
      update();
      facts();
    };

    $$("#lensSeg button", root).forEach((b) => b.addEventListener("click", () => select(Number(b.dataset.i))));
    slider.addEventListener("input", update);
    dist.addEventListener("input", update);
    $$("#lensSubject button", root).forEach((b) => b.addEventListener("click", () => {
      subject = SUBJECTS.find((x) => x.id === b.dataset.id);
      update();
    }));
    if (kit.lenses.length) select(0);
  },
};
