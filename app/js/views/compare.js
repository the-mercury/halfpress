// Compare view: your lenses side by side. How big a subject comes out at a
// distance (and how far you can crop), and which lens blurs the background
// most for the same framing.

import { $, $$, esc, lensClass, lensLabel, store } from "../dom.js";
import { backgroundBlur, blurriestSetting, cropMegapixels, frameFill, printSizeCm } from "../optics.js";

// Rough real-world sizes, in metres.
const SUBJECTS = [
  { id: "person", label: "Person", heightM: 1.75, widthM: 0.5 },
  { id: "child", label: "Child", heightM: 1.1, widthM: 0.35 },
  { id: "dog", label: "Dog", heightM: 0.6, widthM: 0.9 },
  { id: "bird", label: "Bird", heightM: 0.2, widthM: 0.25 },
  { id: "car", label: "Car", heightM: 1.5, widthM: 4.5 },
  { id: "house", label: "House", heightM: 8, widthM: 10 },
];

// Distances on the slider, metres.
const DISTANCES = [2, 3, 5, 7, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300];

// subjectHeightM is the part of the subject that fills `fill` of the frame
// height; tighter framings crop the drawing from the top down.
const FRAMINGS = [
  { id: "head", label: "Head and shoulders", subjectHeightM: 0.5, fill: 0.9, draw: "person" },
  { id: "half", label: "Half body", subjectHeightM: 0.9, fill: 0.9, draw: "person" },
  { id: "full", label: "Full body", subjectHeightM: 1.75, fill: 0.85, draw: "person" },
  { id: "child", label: "Child", subjectHeightM: 1.1, fill: 0.85, draw: "child" },
  { id: "dog", label: "Dog", subjectHeightM: 0.6, fill: 0.8, draw: "dog" },
];

const BACKGROUNDS = [
  { id: "2", label: "2 m behind", behindM: 2 },
  { id: "10", label: "10 m behind", behindM: 10 },
  { id: "far", label: "Far away", behindM: Infinity },
];

const CROP_TARGET = 0.6;   // crop until the subject fills 60% of the frame
const MIN_USEFUL_MP = 2;   // below this a crop is too soft to use

// Subjects drawn in the same flat style as the Lenses and Exposure pictures.
// Units are centimetres, standing on y = 0 and centred on x = 0, so one
// scale factor puts them at their true size in any frame.
const DRAW = {
  person: { h: 175, svg: `
    <rect x="-12" y="-88" width="10" height="88" rx="3" fill="#2b3a55"/><rect x="2" y="-88" width="10" height="88" rx="3" fill="#2b3a55"/>
    <rect x="-27" y="-142" width="9" height="52" rx="4.5" fill="#c94a46"/><rect x="18" y="-142" width="9" height="52" rx="4.5" fill="#c94a46"/>
    <rect x="-20" y="-146" width="40" height="64" rx="10" fill="#d9534f"/>
    <rect x="-5" y="-152" width="10" height="8" fill="#e6b994"/><circle cy="-161" r="13" fill="#f0c9a4"/>
    <path d="M-13 -162a13 13 0 0 1 26 0c-6-5-20-5-26 0z" fill="#4a3426"/>` },
  child: { h: 110, svg: `
    <rect x="-8" y="-50" width="7" height="50" rx="3" fill="#3f66a8"/><rect x="1" y="-50" width="7" height="50" rx="3" fill="#3f66a8"/>
    <rect x="-18" y="-86" width="7" height="32" rx="3.5" fill="#e3a64a"/><rect x="11" y="-86" width="7" height="32" rx="3.5" fill="#e3a64a"/>
    <rect x="-13" y="-88" width="26" height="42" rx="8" fill="#f2b84f"/>
    <circle cy="-98" r="12" fill="#f0c9a4"/><path d="M-12 -99a12 12 0 0 1 24 0c-5-6-19-6-24 0z" fill="#6b4a2e"/>` },
  dog: { h: 62, svg: `
    <g stroke="#f1e2c4" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M-20 -14 L-32 0"/><path d="M-12 -14 L-6 0"/><path d="M16 -14 L10 0"/><path d="M24 -14 L36 0"/><path d="M-27 -28 L-42 -40"/></g>
    <rect x="-28" y="-36" width="56" height="24" rx="12" fill="#f1e2c4"/><circle cx="34" cy="-42" r="11" fill="#f1e2c4"/>
    <rect x="38" y="-42" width="16" height="8" rx="4" fill="#f1e2c4"/><path d="M27 -50 L24 -62 L36 -52 Z" fill="#d9c49c"/>
    <circle cx="37" cy="-45" r="1.6" fill="#1b2433"/>` },
  bird: { h: 20, svg: `
    <path d="M-12 -9 L-20 -13 L-18 -6 Z" fill="#4a3a2e"/><ellipse cx="-2" cy="-9" rx="11" ry="7" fill="#5a4636"/>
    <ellipse cx="1" cy="-7" rx="7" ry="5" fill="#d9783a"/><circle cx="8" cy="-15" r="5" fill="#5a4636"/>
    <path d="M12 -16 L17 -14.5 L12 -13 Z" fill="#e3a64a"/><circle cx="9.5" cy="-16" r="0.9" fill="#111"/>
    <path d="M-3 -2 V0 M2 -2 V0" stroke="#4a3a2e" stroke-width="1.2"/>` },
  car: { h: 150, svg: `
    <path d="M-130 -100 L-90 -148 H70 L120 -100 Z" fill="#c0392b"/><path d="M-112 -102 L-82 -138 H-8 V-102 Z M6 -102 V-138 H64 L100 -102 Z" fill="#9ed0ff"/>
    <rect x="-225" y="-108" width="450" height="76" rx="22" fill="#d9534f"/><rect x="190" y="-92" width="26" height="12" rx="4" fill="#ffd27a"/>
    <circle cx="-140" cy="-33" r="33" fill="#1f252f"/><circle cx="140" cy="-33" r="33" fill="#1f252f"/>
    <circle cx="-140" cy="-33" r="13" fill="#8a96a8"/><circle cx="140" cy="-33" r="13" fill="#8a96a8"/>` },
  house: { h: 800, svg: `
    <rect x="-400" y="-500" width="800" height="500" fill="#e8dcc4"/><path d="M-470 -490 L0 -800 L470 -490 Z" fill="#b5543c"/>
    <rect x="-70" y="-230" width="140" height="230" fill="#6b4f3a"/>
    <rect x="-320" y="-400" width="150" height="130" fill="#9ed0ff"/><rect x="170" y="-400" width="150" height="130" fill="#9ed0ff"/>
    <rect x="-320" y="-200" width="150" height="130" fill="#9ed0ff"/><rect x="170" y="-200" width="150" height="130" fill="#9ed0ff"/>` },
};

// The sunny landscape from the Lenses tab, in a 150 x 100 frame. Only the
// far scenery (sky, sun, hills) is drawn here: it is far enough away that
// its size barely changes. Anything near the subject would have to scale
// with it, so a scale bar shows size instead.
const DAY = `
  <rect width="150" height="100" fill="#9cc7e6"/><circle cx="124" cy="18" r="7" fill="#f6dc8a"/>
  <path d="M0 72 L22 52 L40 62 L66 44 L92 64 L116 52 L150 70 V82 H0 Z" fill="#7f9db5"/>
  <path d="M0 78 L30 68 L58 75 L86 66 L120 76 L150 70 V82 H0 Z" fill="#587f6f"/>
  <rect y="80" width="150" height="20" fill="#5f8f52"/>`;

const place = (kind, x, groundY, cmToPx) =>
  `<g transform="translate(${x.toFixed(2)} ${groundY.toFixed(2)}) scale(${cmToPx.toFixed(5)})">${DRAW[kind].svg}</g>`;

const BAR_LENGTHS_M = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];

/** A map-style scale bar for a frame drawn at `pxPerM`. */
function scaleBar(pxPerM) {
  const m = BAR_LENGTHS_M.find((l) => l * pxPerM >= 18) ?? BAR_LENGTHS_M.at(-1);
  const w = m * pxPerM;
  const label = m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`;
  return `<g transform="translate(6 94)" font-family="ui-monospace, Menlo, monospace" font-size="8">
    <path d="M0 -4V0H${w.toFixed(2)}V-4" fill="none" stroke="#0c0f14" stroke-width="2.4"/>
    <path d="M0 -4V0H${w.toFixed(2)}V-4" fill="none" stroke="#ffffff" stroke-width="1"/>
    <text x="${(w + 3).toFixed(2)}" y="0" fill="#ffffff" stroke="#0c0f14" stroke-width="1.6" paint-order="stroke">${label}</text></g>`;
}

/** Subject drawn at its true size in a 150 x 100 landscape frame. */
function reachPicture(subject, distanceM, focalMm, sensor) {
  const sceneHm = (distanceM * sensor.heightMm) / focalMm;
  const pxPerM = 100 / sceneHm;
  const cmToPx = (pxPerM / 100) * ((subject.heightM * 100) / DRAW[subject.id].h);
  return `<svg viewBox="0 0 150 100" aria-hidden="true">${DAY}${place(subject.id, 75, 92, cmToPx)}${scaleBar(pxPerM)}</svg>`;
}

// Backgrounds, in metres from the subject's centre line. Each suits its
// distance and has detail at its own scale, so blur and size both show.
const BUILDINGS = [[14, 24], [18, 38], [12, 18], [20, 44], [16, 30], [22, 52], [13, 22], [17, 34]];
const BUILDING_FILLS = ["#28344a", "#222c40", "#2b3850", "#232e43"];
const LIGHT_COLOURS = ["#ffd27a", "#ff9e7a", "#9ed0ff"];
const FAR_AWAY_M = 300;    // stands in for "far away" when drawing
let blurIds = 0;

// Deterministic jitter, so pictures don't flicker between renders.
const jitter = (n) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;

function hedge(at) {
  // A garden hedge 1.8 m tall, leaves every 15 cm, string lights along it.
  let out = at.rect(-60, 0, 120, 1.8, "#1f3a2a");
  const step = 0.15;
  for (let x = Math.floor(at.left / step) * step, i = 0; x < at.right; x += step, i++) {
    for (let y = 0.1, j = 0; y < 1.8; y += step, j++) {
      out += at.dot(x + jitter(i * 31 + j) * 0.08, y + jitter(i + j * 17) * 0.08, 0.055, j % 2 ? "#2f5a3e" : "#3a6b48");
    }
  }
  return { scenery: out, lights: lightRow(at, 1.45, 0.45, 0.12) };
}

function park(at) {
  // Park trees every 6 m, placed so the subject stands between two of them
  // (no tree growing out of a head), bushes along the path, lights at 2 m.
  let out = "";
  for (let k = Math.floor(at.left / 6) - 1; k * 6 < at.right + 6; k++) {
    const x = k * 6 + 3;
    out += at.rect(x - 0.2, 0, 0.4, 3.2, "#3a2e24") + at.dot(x, 4.6, 2.2, "#2f5a3e") + at.dot(x - 1.1, 3.9, 1.4, "#3a6b48");
  }
  for (let k = Math.floor(at.left / 1.1) - 1; k * 1.1 < at.right + 1.1; k++) {
    out += at.dot(k * 1.1 + jitter(k) * 0.3, 0.8 + jitter(k * 7) * 0.25, 0.75, k % 2 ? "#2f5a3e" : "#3a6b48");
  }
  return { scenery: out, lights: lightRow(at, 2, 1.2, 0.3) };
}

function city(at) {
  let out = "";
  const total = BUILDINGS.reduce((a, [w]) => a + w + 2, 0);
  for (let x = -Math.ceil((-at.left + total) / total) * total, i = 0; x < at.right; i++) {
    const [w, h] = BUILDINGS[i % BUILDINGS.length];
    if (x + w > at.left) {
      out += at.rect(x, 0, w, h, BUILDING_FILLS[i % 4]);
      if (1.4 * at.pxPerM >= 0.5) {
        for (let fy = 3, r = 0; fy + 2 < h; fy += 3.5, r++) {
          for (let fx = 2, c = 0; fx + 1.4 < w - 1; fx += 3, c++) {
            if ((i * 7 + r * 3 + c * 5) % 3 || x + fx < at.left - 2 || x + fx > at.right) continue;
            out += at.rect(x + fx, fy, 1.4, 1.8, "#f2c96b");
          }
        }
      }
    }
    x += w + 2;
  }
  return { scenery: out, lights: lightRow(at, 6, 10, 5) };
}

// A row of point lights at a height, every `step` metres: drawn later as
// blur circles of the lens's true size.
function lightRow(at, heightM, step, offset) {
  const pts = [];
  for (let k = Math.floor((at.left - offset) / step) - 1; k * step + offset < at.right + step; k++) {
    pts.push([k * step + offset, heightM, LIGHT_COLOURS[((k % 3) + 3) % 3]]);
  }
  return pts;
}

/**
 * Subject in focus in front of a background D metres behind. The background
 * is drawn at its real size for that distance, so a telephoto (standing
 * farther back) shows it larger behind the subject: compression. It is
 * blurred, and its lights drawn as blur circles, by the amount the lens gives.
 */
function blurPicture(framing, blur, distanceM, behindM) {
  const id = `cmpBlur${blurIds++}`;
  const drawing = DRAW[framing.draw];
  const realHcm = framing.draw === "person" ? 175 : framing.subjectHeightM * 100;
  const cmToPx = ((framing.fill * 100) / (framing.subjectHeightM * 100)) * (realHcm / drawing.h);
  const groundY = 100 - framing.fill * 100 + drawing.h * cmToPx;

  // Things D metres behind look s / (s + D) as big as at the subject.
  const D = Number.isFinite(behindM) ? behindM : FAR_AWAY_M;
  const pxPerM = cmToPx * 100 * (distanceM / (distanceM + D));
  const camHeightM = (groundY - 50) / (cmToPx * 100);    // height of the frame centre
  const X = (m) => 75 + m * pxPerM;
  const Y = (m) => 50 - (m - camHeightM) * pxPerM;
  const at = {
    pxPerM, left: -80 / pxPerM, right: 80 / pxPerM,
    rect: (x, y, w, h, fill) => {
      const x0 = Math.max(-5, X(x)), x1 = Math.min(155, X(x + w));
      const y0 = Math.max(-5, Y(y + h)), y1 = Math.min(105, Y(y));
      return x1 > x0 && y1 > y0 ? `<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${(y1 - y0).toFixed(2)}" fill="${fill}"/>` : "";
    },
    dot: (x, y, r, fill) => {
      const cx = X(x), cy = Y(y), rr = r * pxPerM;
      return cx + rr < -5 || cx - rr > 155 || cy + rr < -5 || cy - rr > 105 ? "" : `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${rr.toFixed(2)}" fill="${fill}"/>`;
    },
  };
  const bg = D <= 4 ? hedge(at) : D <= 30 ? park(at) : city(at);

  const d = Math.max(1.2, blur * 150);
  const opacity = Math.max(0.25, Math.min(0.95, 3 / d));
  const lights = bg.lights.map(([x, y, c]) => {
    const cx = X(x), cy = Y(y);
    return cx < -d || cx > 150 + d || cy < -d || cy > 100 + d ? ""
      : `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(d / 2).toFixed(2)}" fill="${c}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");

  const ground = Y(0);
  return `<svg viewBox="0 0 150 100" aria-hidden="true">
    <defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(d / 3).toFixed(2)}"/></filter></defs>
    <rect width="150" height="100" fill="#141b27"/>
    <g filter="url(#${id})">${bg.scenery}${ground < 100 ? `<rect y="${ground.toFixed(2)}" width="150" height="${(100 - ground).toFixed(2)}" fill="#2c3340"/>` : ""}</g>${lights}
    ${place(framing.draw, 75, groundY, cmToPx)}
  </svg>`;
}

/** Plain words for a blur circle size (share of the frame width). */
function blurWords(blur) {
  if (blur >= 0.03) return "Background very soft";
  if (blur >= 0.015) return "Background soft";
  if (blur >= 0.006) return "Background slightly soft";
  return "Background nearly sharp";
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
        <div class="cmp-row wide">
          <div class="mini">${blurPicture(framing, r.blur, r.distanceM, bg.behindM)}</div>
          <div class="cmp-text">
            <div class="row"><span class="chip ${lensClass(kit, r.lens)}">${esc(lensLabel(r.lens))}</span>${r === best ? '<span class="badge">Most blur</span>' : ""}</div>
            <p><b>${r.tooClose ? "Too close to focus" : blurWords(r.blur)}.</b> ${r.focalMm} mm at f/${r.fNumber}, standing ${fmtM(r.distanceM)} m away. ${r.tooClose
              ? `This lens focuses no closer than ${r.lens.minFocusM} m.`
              : `Lights become circles ${(r.blur * 100).toFixed(1)}% of the frame wide.`}</p>
          </div>
        </div>`).join("");
      $("#cmpBlurNote", root).textContent = Number.isFinite(bg.behindM)
        ? "With the background close behind, every lens leaves it fairly sharp. The biggest gain is moving your subject away from it. Among lenses, the one you stand nearest with tends to win: from farther back, the background is relatively closer to your subject."
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
