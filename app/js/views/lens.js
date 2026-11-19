// Lens view: zoom through each lens in the kit and see what it frames.

import { $, $$, esc, lensClass, lensLabel } from "../dom.js";
import {
  angleOfView,
  equivalentFocal,
  filterFit,
  formatShutter,
  handheldShutter,
  widestAperture,
} from "../optics.js";

// A simple scene drawn at the widest framing; zooming scales it up.
const SCENE_SVG = `
  <rect x="-3000" y="-3000" width="6300" height="3096" fill="#9cc7e6"/>
  <circle cx="236" cy="38" r="13" fill="#f6dc8a"/>
  <path d="M-600 96 L10 58 L62 78 L122 40 L184 82 L232 60 L900 96 Z" fill="#7f9db5"/>
  <path d="M-600 96 L40 80 L96 90 L150 74 L214 90 L270 78 L900 96 Z" fill="#587f6f"/>
  <rect x="-3000" y="95" width="6300" height="3100" fill="#5f8f52"/>
  <rect x="66" y="84" width="3" height="16" fill="#5a4630"/><circle cx="67.5" cy="78" r="10" fill="#3f6f45"/>
  <rect x="222" y="88" width="2.4" height="12" fill="#5a4630"/><circle cx="223.2" cy="83" r="7.5" fill="#3f6f45"/>
  <rect x="148.8" y="101.4" width="1" height="5.6" fill="#2b3a55"/><rect x="150.2" y="101.4" width="1" height="5.6" fill="#2b3a55"/>
  <rect x="148.6" y="96.4" width="2.8" height="5.4" rx="1" fill="#d9534f"/><circle cx="150" cy="94.6" r="1.6" fill="#f0c9a4"/>
  <ellipse cx="155.2" cy="104.6" rx="2.4" ry="1.2" fill="#c98b4a"/><circle cx="157.7" cy="103.5" r="0.95" fill="#c98b4a"/>`;

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
        <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g id="vfZoom">${SCENE_SVG}</g></svg>
        <span class="tag" id="vfTag"></span>
      </div>
      <div class="ctl">
        <div class="row"><label for="focal">Zoom</label><span class="val" id="focalVal"></span></div>
        <input type="range" id="focal" step="1">
        <span class="effect" id="focalNote"></span>
      </div>
      <div class="tiles" id="lensTiles"></div>
      <div class="panel" id="lensFacts"></div>`;

    const slider = $("#focal", root);

    const update = () => {
      const f = Number(slider.value);
      const eq = equivalentFocal(f, crop);
      const isStops = current.stabilization.present ? current.stabilization.stops ?? 0 : 0;
      const bodyStops = camera.stabilization.present ? camera.stabilization.stops ?? 0 : 0;
      const angle = angleOfView(f, camera.sensor.widthMm);
      $("#vfZoom", root).setAttribute("transform",
        `translate(150 100) scale(${((f * crop) / baseEq).toFixed(3)}) translate(-150 -100)`);
      $("#vfTag", root).textContent = `${f} mm · looks like ${eq} mm`;
      $("#focalVal", root).textContent = `${f} mm`;
      const tile = (k, v) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`;
      $("#lensTiles", root).innerHTML =
        tile("Full-frame look", `${eq} mm`) +
        tile("Widest aperture", `f/${widestAperture(current, f)}`) +
        tile("Slowest handheld", formatShutter(handheldShutter(f, crop, Math.max(isStops, bodyStops)))) +
        tile("Angle of view", `${angle.toFixed(angle < 10 ? 1 : 0)}°`);
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
    if (kit.lenses.length) select(0);
  },
};
