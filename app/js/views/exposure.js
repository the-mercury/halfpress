// Exposure trainer: move aperture, shutter and ISO and watch the picture react.
// Ranges come from the selected lens and the camera in the kit.

import { $, $$, esc, lensClass, lensLabel } from "../dom.js";
import { F_STOPS, SHUTTER_STOPS, exposureValue, formatShutter, parseShutter } from "../optics.js";

// Scene light levels as EV at ISO 100.
const LIGHT = [
  ["Sunny", 15], ["Cloudy", 13], ["Shade", 12], ["Indoors", 7], ["Night", 4],
];

const PICTURE = `
  <svg id="exBg" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="transform:scale(1.12)">
    <rect width="300" height="200" fill="#1b2433"/>
    <rect x="8" y="58" width="52" height="100" fill="#28344a"/><rect x="70" y="36" width="44" height="122" fill="#222c40"/>
    <rect x="124" y="70" width="60" height="88" fill="#2b3850"/><rect x="196" y="46" width="40" height="112" fill="#232e43"/>
    <rect x="246" y="66" width="50" height="92" fill="#28344a"/>
    <g fill="#f2c96b"><rect x="18" y="72" width="8" height="10"/><rect x="38" y="96" width="8" height="10"/><rect x="80" y="52" width="8" height="10"/>
      <rect x="96" y="84" width="8" height="10"/><rect x="136" y="84" width="8" height="10"/><rect x="162" y="110" width="8" height="10"/>
      <rect x="206" y="62" width="8" height="10"/><rect x="218" y="98" width="8" height="10"/><rect x="258" y="82" width="8" height="10"/><rect x="276" y="112" width="8" height="10"/></g>
    <circle cx="22" cy="30" r="6" fill="#ffd27a"/><circle cx="62" cy="38" r="6" fill="#ff9e7a"/><circle cx="104" cy="42" r="6" fill="#9ed0ff"/>
    <circle cx="148" cy="43" r="6" fill="#ffd27a"/><circle cx="192" cy="41" r="6" fill="#ff9e7a"/><circle cx="236" cy="36" r="6" fill="#9ed0ff"/>
    <circle cx="278" cy="28" r="6" fill="#ffd27a"/><rect y="156" width="300" height="44" fill="#2c3340"/>
  </svg>
  <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><g id="dogShape">
      <g stroke="#f1e2c4" stroke-width="6" stroke-linecap="round" fill="none">
        <path d="M-20 -14 L-32 0"/><path d="M-12 -14 L-6 0"/><path d="M16 -14 L10 0"/><path d="M24 -14 L36 0"/><path d="M-27 -28 L-42 -40"/></g>
      <rect x="-28" y="-36" width="56" height="24" rx="12" fill="#f1e2c4"/><circle cx="34" cy="-42" r="11" fill="#f1e2c4"/>
      <rect x="38" y="-42" width="16" height="8" rx="4" fill="#f1e2c4"/><path d="M27 -50 L24 -62 L36 -52 Z" fill="#d9c49c"/>
      <circle cx="37" cy="-45" r="1.6" fill="#1b2433"/></g></defs>
    <rect y="156" width="300" height="44" fill="#2c3340"/><ellipse cx="160" cy="176" rx="46" ry="5" fill="#1f252f"/>
    <g id="exGhosts"></g><use href="#dogShape" id="exDog" transform="translate(160 174)"/>
  </svg>
  <canvas id="exNoise" width="150" height="100" aria-hidden="true" style="image-rendering:pixelated;mix-blend-mode:screen"></canvas>`;

export const exposureView = {
  id: "exposure",
  label: "Exposure",
  icon: "triangle",

  render(root, { kit }) {
    const camera = kit.camera;
    const fastest = parseShutter(camera.shutter.electronicFastest ?? camera.shutter.mechanicalFastest);
    const slowest = parseShutter(camera.shutter.longestTimed);
    const shutters = SHUTTER_STOPS.filter((s) => s <= slowest + 1e-9 && s >= fastest - 1e-12).reverse();
    const isoMax = camera.iso.expandedMax ?? camera.iso.max;
    const isos = [];
    for (let v = camera.iso.min; v <= isoMax; v *= 2) isos.push(v);
    let apertures = [];
    let ev = 12;

    root.innerHTML = `
      <div class="head">
        <span class="eyebrow">Exposure trainer</span>
        <h1>See what each dial does</h1>
      </div>
      <div class="seg lens" id="exLens" role="group" aria-label="Lens">
        ${kit.lenses.map((l, i) => `<button type="button" class="${lensClass(kit, l)}" data-i="${i}" aria-pressed="false">${esc(lensLabel(l))}</button>`).join("")}
      </div>
      <div class="frame" id="exFrame">${PICTURE}</div>
      <div class="seg" id="exLight" role="group" aria-label="Light">
        ${LIGHT.map(([name, v]) => `<button type="button" data-ev="${v}" aria-pressed="${v === ev}">${name}</button>`).join("")}
      </div>
      <div class="panel">
        <div class="meter">
          <div class="bar"><div class="zone"></div><div class="mark" id="exMark"></div></div>
          <div class="scale"><span>−3 dark</span><span>0</span><span>bright +3</span></div>
        </div>
        <div class="verdict ok" id="exVerdict" aria-live="polite"></div>
        <button type="button" class="ghost" id="exBalance">Balance it with ISO</button>
      </div>
      <div class="panel">
        <div class="ctl"><div class="row"><label for="exA">Aperture</label><span class="val" id="exAVal"></span></div>
          <input type="range" id="exA" min="0" step="1"><span class="effect" id="exAFx"></span></div>
        <div class="ctl"><div class="row"><label for="exS">Shutter</label><span class="val" id="exSVal"></span></div>
          <input type="range" id="exS" min="0" max="${shutters.length - 1}" step="1"><span class="effect" id="exSFx"></span></div>
        <div class="ctl"><div class="row"><label for="exI">ISO</label><span class="val" id="exIVal"></span></div>
          <input type="range" id="exI" min="0" max="${isos.length - 1}" step="1"><span class="effect" id="exIFx"></span></div>
      </div>
      <p class="muted">A teaching model, not a light meter. Trust the camera's histogram for the real exposure.</p>`;

    const noise = $("#exNoise", root);
    const ctx = noise.getContext("2d");
    const img = ctx.createImageData(noise.width, noise.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data.set([v, v, v, 255], i);
    }
    ctx.putImageData(img, 0, 0);

    const a = $("#exA", root), s = $("#exS", root), iso = $("#exI", root);
    const offset = () => ev - exposureValue(apertures[a.value], shutters[s.value], isos[iso.value]);

    const update = () => {
      const f = apertures[a.value], t = shutters[s.value], i = isos[iso.value];
      const off = offset();
      const expanded = i > camera.iso.max;
      $("#exAVal", root).textContent = `f/${f}`;
      $("#exSVal", root).textContent = formatShutter(t);
      $("#exIVal", root).textContent = expanded ? `H ${i}` : String(i);
      $("#exAFx", root).textContent = f < 2.8 ? "Very blurry background" : f < 5.6 ? "Blurry background" : f < 8 ? "Some background blur" : "Sharp front to back";
      $("#exSFx", root).textContent = t <= 1 / 1000 ? "Freezes fast action" : t <= 1 / 250 ? "Freezes walking pace" : t <= 1 / 60 ? "Still subjects, handheld" : t <= 1 / 15 ? "Risky handheld, motion blurs" : "Tripod needed";
      $("#exIFx", root).textContent = (i <= 400 ? "Clean image" : i <= 1600 ? "Slight grain" : i <= 6400 ? "Noticeable grain" : "Heavy grain") + (expanded ? " · expanded ISO" : "");

      const blur = Math.max(0, 9 * (1 - Math.log2(f / 1.4) / Math.log2(16 / 1.4)));
      $("#exBg", root).style.filter = `blur(${blur.toFixed(1)}px)`;
      const spread = t >= 1 / 250 ? Math.min(38, 6 * Math.log2(t * 500)) : 0;
      let ghosts = "";
      for (let k = 5; k >= 1 && spread > 0; k--) {
        ghosts += `<use href="#dogShape" transform="translate(${(160 - k * spread).toFixed(1)} 174)" opacity="${(0.34 - k * 0.055).toFixed(2)}"/>`;
      }
      $("#exGhosts", root).innerHTML = ghosts;
      $("#exDog", root).setAttribute("opacity", spread > 12 ? "0.7" : "1");
      noise.style.opacity = Math.min(0.6, Math.max(0, (Math.log2(i / 100) - 1) * 0.1)).toFixed(2);
      $("#exFrame", root).style.filter = `brightness(${Math.max(0.12, Math.min(2.8, 2 ** (off * 0.6))).toFixed(2)})`;

      $("#exMark", root).style.left = `${50 + (Math.max(-3, Math.min(3, off)) / 3) * 50}%`;
      const v = $("#exVerdict", root), n = Math.abs(off), stops = Math.round(n * 2) / 2;
      if (n <= 0.5) { v.textContent = "Good exposure"; v.className = "verdict ok"; }
      else { v.textContent = `${off < 0 ? "Too dark" : "Too bright"} by about ${stops} ${stops === 1 ? "stop" : "stops"}`; v.className = "verdict off"; }
    };

    const pickLens = (idx) => {
      const lens = kit.lenses[idx];
      const widest = Math.min(...lens.maxAperture.map((p) => p.f));
      const narrowest = lens.minAperture ?? 22;
      apertures = F_STOPS.filter((f) => f >= widest - 1e-9 && f <= narrowest + 1e-9);
      a.max = apertures.length - 1;
      const target = apertures.findIndex((f) => f >= 5.6);
      a.value = target < 0 ? apertures.length - 1 : target;
      $$("#exLens button", root).forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.i) === idx)));
      update();
    };

    // shutters run fastest first; start at 1/250.
    s.value = Math.max(0, shutters.findIndex((t) => t >= 1 / 250 - 1e-9));
    iso.value = 0;
    [a, s, iso].forEach((el) => el.addEventListener("input", update));
    $$("#exLens button", root).forEach((b) => b.addEventListener("click", () => pickLens(Number(b.dataset.i))));
    $$("#exLight button", root).forEach((b) => b.addEventListener("click", () => {
      ev = Number(b.dataset.ev);
      $$("#exLight button", root).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      update();
    }));
    $("#exBalance", root).addEventListener("click", () => {
      const f = apertures[a.value], t = shutters[s.value];
      const misses = isos.map((i) => Math.abs(ev - exposureValue(f, t, i)));
      iso.value = misses.indexOf(Math.min(...misses));
      update();
      if (Math.abs(offset()) > 0.5) $("#exVerdict", root).textContent += ". ISO alone can't fix it, so change the shutter or aperture.";
    });
    if (kit.lenses.length) pickLens(0);
  },
};
