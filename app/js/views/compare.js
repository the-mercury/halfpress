// Compare view: your lenses side by side. How big a subject comes out at a
// distance (and how far you can crop), and which lens blurs the background
// most for the same framing.

import { $, $$, esc, lensClass, lensLabel, store } from "../dom.js";
import { backgroundBlur, blurriestSetting, cropMegapixels, frameFill, printSizeCm } from "../optics.js";

// Rough real-world sizes, in metres.
const SUBJECTS = [
  { id: "person", label: "Person", heightM: 1.75, widthM: 0.5 },
  { id: "dog", label: "Dog", heightM: 0.6, widthM: 0.9 },
  { id: "bird", label: "Bird", heightM: 0.2, widthM: 0.25 },
  { id: "car", label: "Car", heightM: 1.5, widthM: 4.5 },
  { id: "house", label: "House", heightM: 8, widthM: 10 },
];

// Distances on the slider, metres.
const DISTANCES = [2, 3, 5, 7, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300];

const FRAMINGS = [
  { id: "head", label: "Head and shoulders", subjectHeightM: 0.5, fill: 0.9, shape: "person", top: 0.32 },
  { id: "half", label: "Half body", subjectHeightM: 0.9, fill: 0.9, shape: "person", top: 0.55 },
  { id: "full", label: "Full body", subjectHeightM: 1.8, fill: 0.85, shape: "person", top: 1 },
  { id: "dog", label: "Dog", subjectHeightM: 0.6, fill: 0.8, shape: "dog", top: 1, aspect: 1.5 },
];

const BACKGROUNDS = [
  { id: "2", label: "2 m behind", behindM: 2 },
  { id: "10", label: "10 m behind", behindM: 10 },
  { id: "far", label: "Far away", behindM: Infinity },
];

const CROP_TARGET = 0.6;   // crop until the subject fills 60% of the frame
const MIN_USEFUL_MP = 2;   // below this a crop is too soft to use

// Simple silhouettes in a 100 x 100 box, stretched to the subject's shape.
const SHAPES = {
  person: '<circle cx="50" cy="11" r="10"/><path d="M28 26h44l6 40h-12l-2 34H36l-2-34H22z"/>',
  dog: '<ellipse cx="44" cy="50" rx="32" ry="15"/><path d="M62 42L72 22l14 6-8 22z"/><circle cx="82" cy="24" r="12"/><path d="M76 16l2-14 9 11z"/><path d="M90 24l10 4-3 6-8-1z"/><rect x="18" y="56" width="7" height="44" rx="3"/><rect x="30" y="58" width="7" height="42" rx="3"/><rect x="56" y="58" width="7" height="42" rx="3"/><rect x="67" y="56" width="7" height="44" rx="3"/><path d="M14 46C6 42 4 32 8 24" fill="none" stroke-width="5" stroke-linecap="round"/>',
  bird: '<path d="M10 55c10-25 40-35 62-28l18-10-4 16c10 14 4 34-18 40l-8 22h-6l4-20c-24 2-44-4-48-20z"/>',
  car: '<path d="M4 62l10-28c2-6 8-10 14-10h40c6 0 12 4 16 10l12 18c4 2 4 6 4 10v18H4z"/><circle cx="24" cy="86" r="12" fill="#1b2433"/><circle cx="78" cy="86" r="12" fill="#1b2433"/>',
  house: '<path d="M6 46L50 6l44 40v54H6z"/>',
};

// Background lights for the blur pictures, as x, y in a 150 x 100 frame.
const LIGHTS = [[12, 18], [34, 30], [58, 12], [80, 26], [104, 16], [128, 30], [142, 10],
  [20, 52], [46, 44], [112, 48], [136, 60], [8, 80], [30, 70], [122, 82], [144, 88]];

// `top` keeps only the top share of a shape, for tighter framings.
function silhouette(shape, x, y, w, h, fill, top = 1) {
  return `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="0 0 100 ${100 * top}" preserveAspectRatio="none" fill="${fill}" stroke="${fill}">${SHAPES[shape]}</svg>`;
}

/** Subject drawn at its true size in a 150 x 100 landscape frame. */
function reachPicture(subject, distanceM, focalMm, sensor) {
  const sceneH = (distanceM * sensor.heightMm) / focalMm;
  const sceneW = (distanceM * sensor.widthMm) / focalMm;
  const h = (subject.heightM / sceneH) * 100;
  const w = (subject.widthM / sceneW) * 150;
  const groundY = 82;
  return `<svg viewBox="0 0 150 100" aria-hidden="true">
    <rect width="150" height="100" fill="#9cc7e6"/><rect y="${groundY}" width="150" height="18" fill="#5f8f52"/>
    ${silhouette(subject.id, 75 - w / 2, groundY - h + Math.min(h, 100) * 0.04, w, h, "#2b3a55")}
  </svg>`;
}

/** Subject in focus over background lights blurred to their true size. */
function blurPicture(framing, blur) {
  const d = Math.max(1.2, blur * 150);
  const opacity = Math.max(0.18, Math.min(0.95, 3 / d));
  const lights = LIGHTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${(d / 2).toFixed(2)}" fill="#ffd08a" opacity="${opacity.toFixed(2)}"/>`).join("");
  const h = framing.fill * 100;
  // People scale evenly (wider when framed tighter); the dog has its own shape.
  const w = framing.shape === "person" ? h / framing.top : h * framing.aspect;
  return `<svg viewBox="0 0 150 100" aria-hidden="true">
    <rect width="150" height="100" fill="#1b2433"/>${lights}
    ${silhouette(framing.shape, 75 - w / 2, 100 - h + (framing.top < 1 ? 0 : 4), w, h, "#0c0f14", framing.top)}
  </svg>`;
}

const fmtM = (m) => (m < 10 ? m.toFixed(1) : Math.round(m)).toString().replace(/\.0$/, "");

export const compareView = {
  id: "compare",
  label: "Compare",
  icon: "compare",

  render(root, { kit }) {
    const camera = kit.camera;
    const sensor = camera.sensor;
    const lenses = kit.lenses;
    const state = {
      subject: store.get("halfpress.cmp.subject") ?? "person",
      distance: Number(store.get("halfpress.cmp.distance") ?? 7),
      framing: store.get("halfpress.cmp.framing") ?? "head",
      background: store.get("halfpress.cmp.background") ?? "far",
    };

    const seg = (id, items, label) => `<div class="seg" id="${id}" role="group" aria-label="${label}">
      ${items.map((x) => `<button type="button" data-id="${x.id}" aria-pressed="false">${esc(x.label)}</button>`).join("")}</div>`;

    root.innerHTML = `
      <div class="head">
        <span class="eyebrow">Your lenses side by side</span>
        <h1>Which lens for this?</h1>
      </div>

      <h2>How big will it be?</h2>
      ${seg("cmpSubject", SUBJECTS, "Subject")}
      <div class="ctl">
        <div class="row"><label for="cmpDist">Distance</label><span class="val" id="cmpDistVal"></span></div>
        <input type="range" id="cmpDist" min="0" max="${DISTANCES.length - 1}" step="1">
      </div>
      <div class="cmp-list" id="cmpReach"></div>

      <h2>Background blur</h2>
      ${seg("cmpFraming", FRAMINGS, "Framing")}
      ${seg("cmpBg", BACKGROUNDS, "Background")}
      <div class="cmp-list" id="cmpBlur"></div>
      <p class="muted" id="cmpBlurNote"></p>`;

    const slider = $("#cmpDist", root);
    const nearest = DISTANCES.reduce((best, d, i) => (Math.abs(d - state.distance) < Math.abs(DISTANCES[best] - state.distance) ? i : best), 0);
    slider.value = nearest;

    const press = (groupId, id) =>
      $$(`#${groupId} button`, root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));

    const renderReach = () => {
      const subject = SUBJECTS.find((s) => s.id === state.subject) ?? SUBJECTS[0];
      const d = DISTANCES[Number(slider.value)];
      state.distance = d;
      $("#cmpDistVal", root).textContent = `${d} m`;
      press("cmpSubject", subject.id);

      const rows = lenses.map((lens) => {
        const fillAtLong = frameFill(subject, d, lens.focalMm.max, sensor);
        let focal = lens.focalMm.max;
        if (fillAtLong > 0.9) focal = Math.max(lens.focalMm.min, Math.floor((lens.focalMm.max * 0.85) / fillAtLong));
        const fill = frameFill(subject, d, focal, sensor);
        let verdict;
        let fits = true;
        if (fill > 1) {
          fits = false;
          verdict = `Too close to fit, even at ${focal} mm. Step back to about ${fmtM((d * fill) / 0.9)} m.`;
        } else if (fill >= CROP_TARGET) {
          verdict = `Fills ${Math.round(fill * 100)}% of the frame. No crop needed.`;
        } else {
          const mp = cropMegapixels(camera.sensor.megapixels, fill, CROP_TARGET);
          verdict = mp < MIN_USEFUL_MP
            ? `Fills ${fill < 0.01 ? "under 1" : Math.round(fill * 100)}% of the frame. Too small to crop into a usable picture.`
            : `Fills ${Math.round(fill * 100)}% of the frame. Cropped in, ${mp.toFixed(mp < 10 ? 1 : 0)} MP left: sharp prints up to ${Math.round(printSizeCm(mp))} cm wide.`;
        }
        return { lens, focal, fill, fits, verdict };
      });
      const best = rows.filter((r) => r.fits).sort((a, b) => b.fill - a.fill)[0];
      $("#cmpReach", root).innerHTML = rows.map((r) => `
        <div class="cmp-row">
          <div class="mini">${reachPicture(subject, d, r.focal, sensor)}</div>
          <div class="cmp-text">
            <div class="row"><span class="chip ${lensClass(kit, r.lens)}">${esc(lensLabel(r.lens))}</span>${r === best ? '<span class="badge">Fills most</span>' : ""}</div>
            <p><b>At ${r.focal} mm.</b> ${esc(r.verdict)}</p>
          </div>
        </div>`).join("");
      store.set("halfpress.cmp.subject", subject.id);
      store.set("halfpress.cmp.distance", String(d));
    };

    const renderBlur = () => {
      const framing = FRAMINGS.find((f) => f.id === state.framing) ?? FRAMINGS[0];
      const bg = BACKGROUNDS.find((b) => b.id === state.background) ?? BACKGROUNDS[2];
      press("cmpFraming", framing.id);
      press("cmpBg", bg.id);

      const rows = lenses.map((lens) => {
        const setting = blurriestSetting(lens, { subjectHeightM: framing.subjectHeightM, fill: framing.fill, sensor, behindM: bg.behindM });
        const tooClose = lens.minFocusM && setting.distanceM < lens.minFocusM;
        return { lens, ...setting, tooClose };
      });
      const usable = rows.filter((r) => !r.tooClose);
      const best = usable.sort((a, b) => b.blur - a.blur)[0];
      const ranked = [...rows].sort((a, b) => b.blur - a.blur);
      $("#cmpBlur", root).innerHTML = ranked.map((r) => `
        <div class="cmp-row">
          <div class="mini">${blurPicture(framing, r.blur)}</div>
          <div class="cmp-text">
            <div class="row"><span class="chip ${lensClass(kit, r.lens)}">${esc(lensLabel(r.lens))}</span>${r === best ? '<span class="badge">Most blur</span>' : ""}</div>
            <p><b>${r.focalMm} mm at f/${r.fNumber}.</b> Stand ${fmtM(r.distanceM)} m away. ${r.tooClose
              ? `Closer than this lens can focus (${r.lens.minFocusM} m).`
              : `Blur circles ${(r.blur * 100).toFixed(1)}% of the frame wide.`}</p>
          </div>
        </div>`).join("");
      $("#cmpBlurNote", root).textContent = Number.isFinite(bg.behindM)
        ? "With the background close behind, a shorter lens you stand nearer with tends to win: from farther back, the background is relatively closer to your subject."
        : "With a far background, blur for the same framing comes down to focal length divided by f-number. That is why a long zoom can rival a fast prime.";
      store.set("halfpress.cmp.framing", framing.id);
      store.set("halfpress.cmp.background", bg.id);
    };

    $$("#cmpSubject button", root).forEach((b) => b.addEventListener("click", () => { state.subject = b.dataset.id; renderReach(); }));
    $$("#cmpFraming button", root).forEach((b) => b.addEventListener("click", () => { state.framing = b.dataset.id; renderBlur(); }));
    $$("#cmpBg button", root).forEach((b) => b.addEventListener("click", () => { state.background = b.dataset.id; renderBlur(); }));
    slider.addEventListener("input", renderReach);

    renderReach();
    renderBlur();
  },
};
