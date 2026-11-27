// Compare view: one live scene. Pick a subject and a lens, then move the zoom,
// aperture, your distance and the background's distance. The picture is
// drawn to true scale from the same optics as the numbers: how big the
// subject comes out, how large the background looms (compression) and how
// blurred it is. Notes appear as you cross the points that matter, and a
// strip compares every lens in the kit for the same spot.

import { $, $$, esc, lensClass, lensLabel, store } from "../dom.js";
import {
  F_STOPS, backgroundScale, blurCircle, cropMegapixels, equivalentFocal, frameFill, printSizeCm, widestAperture,
} from "../optics.js";

// Rough real-world sizes, in metres.
const SUBJECTS = [
  { id: "person", label: "Person", noun: "person", heightM: 1.75, widthM: 0.5 },
  { id: "child", label: "Child", noun: "child", heightM: 1.1, widthM: 0.35 },
  { id: "dog", label: "Dog", noun: "dog", heightM: 0.6, widthM: 0.9 },
  { id: "bird", label: "Bird", noun: "bird", heightM: 0.2, widthM: 0.25 },
  { id: "car", label: "Car", noun: "car", heightM: 1.5, widthM: 4.5 },
  { id: "house", label: "House", noun: "house", heightM: 8, widthM: 10 },
];

// Your distance from the subject, metres.
const DISTANCES = [0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300];

const BACKGROUNDS = [
  { id: "1", label: "1 m", behindM: 1 },
  { id: "3", label: "3 m", behindM: 3 },
  { id: "10", label: "10 m", behindM: 10 },
  { id: "30", label: "30 m", behindM: 30 },
  { id: "far", label: "Far", behindM: Infinity },
];

const CROP_TARGET = 0.6;   // crop until the subject fills 60% of the frame
const MIN_USEFUL_MP = 2;   // below this a crop is too soft to use
const W = 150;             // picture size in SVG units (3:2)
const H = 100;

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

const place = (kind, x, groundY, cmToPx) =>
  `<g transform="translate(${x.toFixed(2)} ${groundY.toFixed(2)}) scale(${cmToPx.toFixed(5)})">${DRAW[kind].svg}</g>`;

const BAR_LENGTHS_M = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];

/** A map-style scale bar for a frame drawn at `pxPerM`. */
function scaleBar(pxPerM) {
  const m = BAR_LENGTHS_M.find((l) => l * pxPerM >= 18) ?? BAR_LENGTHS_M.at(-1);
  const w = m * pxPerM;
  const label = m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`;
  // Bottom-right corner; the settings tag sits bottom-left.
  const x = 150 - 6 - w - label.length * 4.9 - 3;
  return `<g transform="translate(${x.toFixed(2)} 94)" font-family="ui-monospace, Menlo, monospace" font-size="8">
    <path d="M0 -4V0H${w.toFixed(2)}V-4" fill="none" stroke="#0c0f14" stroke-width="2.4"/>
    <path d="M0 -4V0H${w.toFixed(2)}V-4" fill="none" stroke="#ffffff" stroke-width="1"/>
    <text x="${(w + 3).toFixed(2)}" y="0" fill="#ffffff" stroke="#0c0f14" stroke-width="1.6" paint-order="stroke">${label}</text></g>`;
}

// Backgrounds, in metres from the subject's centre line. Each suits its
// distance and has detail at its own scale, so blur and size both show.
const BUILDINGS = [[14, 24], [18, 38], [12, 18], [20, 44], [16, 30], [22, 52], [13, 22], [17, 34]];
const BUILDING_FILLS = ["#28344a", "#222c40", "#2b3850", "#232e43"];
const LIGHT_COLOURS = ["#ffd27a", "#ff9e7a", "#9ed0ff"];
const FAR_AWAY_M = 300;    // stands in for "far away" when drawing

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

/** Plain words for a blur circle size (share of the frame width). */
function blurWords(blur) {
  if (blur >= 0.03) return "Background very soft";
  if (blur >= 0.015) return "Background soft";
  if (blur >= 0.006) return "Background slightly soft";
  return "Background nearly sharp";
}

/**
 * The whole picture. The camera aims at the subject: centred when it fits,
 * at its top when it doesn't (so a person close up becomes a portrait).
 * Subject and background share one scale rule: things D metres behind look
 * s / (s + D) as big as at the subject.
 */
function scenePicture({ subject, focalMm, distanceM, behindM, blur, sensor }) {
  const sceneHm = (distanceM * sensor.heightMm) / focalMm;
  const pxPerM = H / sceneHm;
  const visible = Math.min(subject.heightM, sceneHm);
  const aimM = subject.heightM - visible / 2;                  // height the frame centre is on
  const D = Number.isFinite(behindM) ? behindM : FAR_AWAY_M;
  const bgPxPerM = pxPerM * (distanceM / (distanceM + D));
  const X = (m) => W / 2 + m * bgPxPerM;
  const Y = (m) => H / 2 - (m - aimM) * bgPxPerM;
  const at = {
    pxPerM: bgPxPerM, left: -(W / 2 + 5) / bgPxPerM, right: (W / 2 + 5) / bgPxPerM,
    rect: (x, y, w, h, fill) => {
      const x0 = Math.max(-5, X(x)), x1 = Math.min(W + 5, X(x + w));
      const y0 = Math.max(-5, Y(y + h)), y1 = Math.min(H + 5, Y(y));
      return x1 > x0 && y1 > y0 ? `<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${(y1 - y0).toFixed(2)}" fill="${fill}"/>` : "";
    },
    dot: (x, y, r, fill) => {
      const cx = X(x), cy = Y(y), rr = r * bgPxPerM;
      return cx + rr < -5 || cx - rr > W + 5 || cy + rr < -5 || cy - rr > H + 5 ? ""
        : `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${rr.toFixed(2)}" fill="${fill}"/>`;
    },
  };
  const bg = D <= 4 ? hedge(at) : D <= 40 ? park(at) : city(at);

  const d = Math.max(1.2, blur * W);
  const opacity = Math.max(0.25, Math.min(0.95, 3 / d));
  const lights = bg.lights.map(([x, y, c]) => {
    const cx = X(x), cy = Y(y);
    return cx < -d || cx > W + d || cy < -d || cy > H + d ? ""
      : `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(d / 2).toFixed(2)}" fill="${c}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
  const bgGround = Y(0);
  const subjGround = H / 2 + aimM * pxPerM;
  const cmToPx = (pxPerM / 100) * ((subject.heightM * 100) / DRAW[subject.id].h);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><filter id="cmpBlur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(d / 3).toFixed(2)}"/></filter></defs>
    <rect width="${W}" height="${H}" fill="#141b27"/>
    <g filter="url(#cmpBlur)">${bg.scenery}${bgGround < H ? `<rect y="${bgGround.toFixed(2)}" width="${W}" height="${(H - bgGround).toFixed(2)}" fill="#2c3340"/>` : ""}</g>${lights}
    ${subjGround < H + 400 ? place(subject.id, W / 2, subjGround, cmToPx) : ""}
    ${scaleBar(pxPerM)}
  </svg>`;
}

const fmtM = (m) => (m < 10 ? m.toFixed(1) : Math.round(m)).toString().replace(/\.0$/, "");
const pct = (x) => `${x < 0.01 ? "under 1" : Math.round(x * 100)}%`;

/** For a person or child, what a framing taller than the frame shows. */
function crop(subject, sceneHm) {
  if (!["person", "child"].includes(subject.id) || sceneHm >= subject.heightM) return null;
  const share = sceneHm / subject.heightM;
  if (share >= 0.5) return "half body";
  if (share >= 0.25) return "head and shoulders";
  return "face only";
}

/** Everything the screen says about one setup. */
function analyse({ lens, subject, focalMm, fNumber, distanceM, behindM, camera }) {
  const sensor = camera.sensor;
  const sceneHm = (distanceM * sensor.heightMm) / focalMm;
  const fill = frameFill(subject, distanceM, focalMm, sensor);
  const blur = blurCircle(focalMm, fNumber, distanceM, behindM, sensor.widthMm);
  const tooClose = lens.minFocusM && distanceM < lens.minFocusM;
  const framing = crop(subject, sceneHm);
  const mp = cropMegapixels(sensor.megapixels, Math.min(fill, 1), CROP_TARGET);
  return { sceneHm, fill, blur, tooClose, framing, mp };
}

/** The notes for the points the current setup has crossed, most important first. */
function notes(a, s, kit) {
  const out = [];
  const { subject, lens, focalMm, fNumber, distanceM, behindM } = s;
  if (a.tooClose) {
    out.push(["warning", `Too close to focus. The ${esc(lensLabel(lens))} focuses no closer than ${lens.minFocusM} m, so step back.`]);
  }
  if (a.framing) {
    out.push(["tip", a.framing === "face only"
      ? `Only the face fits. Step back or zoom out for head and shoulders.`
      : `The ${subject.noun} is cropped to ${a.framing}: a portrait framing, which suits ${subject.id === "child" ? "a child" : "a person"} well.`]);
  } else if (a.fill > 1) {
    const backTo = (distanceM * a.fill) / 0.9;
    out.push(["warning", `The ${subject.noun} doesn't fit. ${focalMm > lens.focalMm.min ? "Zoom out, or step" : "Step"} back to about ${fmtM(backTo)} m.`]);
  } else if (a.fill < CROP_TARGET) {
    if (a.mp < MIN_USEFUL_MP) {
      const longest = Math.max(...kit.lenses.map((l) => l.focalMm.max));
      out.push(["warning", `Too small to crop into a usable picture (${a.mp.toFixed(1)} MP left).${focalMm < longest ? " A longer lens or getting closer will help." : " Getting closer is the only fix."}`]);
    } else {
      out.push(["tip", `The ${subject.noun} fills ${pct(a.fill)} of the frame. Cropping in leaves ${a.mp.toFixed(a.mp < 10 ? 1 : 0)} MP, enough for a sharp print up to ${Math.round(printSizeCm(a.mp))} cm wide.`]);
    }
  }
  const scale = backgroundScale(distanceM, behindM);
  if (Number.isFinite(behindM) && behindM <= 3 && a.blur < 0.015) {
    out.push(["tip", `The background is only ${behindM} m behind, so it stays fairly sharp. Moving the ${subject.noun} farther from it helps more than any lens.`]);
  } else if (Number.isFinite(behindM) && scale >= 0.6) {
    out.push(["tip", `Compression: from ${fmtM(distanceM)} m away, things ${behindM} m behind look ${Math.round(scale * 100)}% as big as at your ${subject.noun}, so the background looms large and only a small patch of it shows.`]);
  } else if (Number.isFinite(behindM) && scale <= 0.25) {
    out.push(["tip", `Wide and close: things ${behindM} m behind shrink to ${Math.round(scale * 100)}% of their size at your ${subject.noun}, so much more of the background fits in.`]);
  }
  const widest = widestAperture(lens, focalMm);
  if (fNumber > widest + 1e-9 && a.blur < 0.03) {
    out.push(["tip", `Opening up to f/${widest} would blur the background more.`]);
  } else if (a.blur >= 0.03 && !a.tooClose) {
    out.push(["tip", `A very soft background: the ${subject.noun} stands out clearly.`]);
  }
  return out.slice(0, 3);
}

/**
 * Each lens at its best for this spot: zoomed in as far as it can while the
 * subject still fits (for people, while at least head and shoulders fit),
 * wide open.
 */
function lensAtBest(lens, s, camera) {
  const portrait = ["person", "child"].includes(s.subject.id);
  const maxFocal = portrait
    ? (s.distanceM * camera.sensor.heightMm) / Math.min(s.subject.heightM, 0.55)
    : (0.95 * lens.focalMm.max) / Math.max(1e-9, frameFill(s.subject, s.distanceM, lens.focalMm.max, camera.sensor));
  const focalMm = Math.max(lens.focalMm.min, Math.min(lens.focalMm.max, Math.floor(maxFocal)));
  const fNumber = widestAperture(lens, focalMm);
  return { lens, focalMm, fNumber, ...analyse({ ...s, lens, focalMm, fNumber, camera }) };
}

export const compareView = {
  id: "compare",
  label: "Compare",
  icon: "compare",

  render(root, { kit }) {
    const camera = kit.camera;
    const lenses = kit.lenses;
    if (!lenses.length) { root.innerHTML = '<div class="panel"><p>Add a lens to compare.</p></div>'; return; }
    const s = {
      subject: SUBJECTS.find((x) => x.id === store.get("halfpress.cmp.subject")) ?? SUBJECTS[0],
      lens: lenses[Number(store.get("halfpress.cmp.lens")) || 0] ?? lenses[0],
      distanceM: Number(store.get("halfpress.cmp.distance")) || 3,
      behindM: BACKGROUNDS.find((b) => b.id === store.get("halfpress.cmp.bg"))?.behindM ?? 10,
      focalMm: 0,
      fNumber: 0,
    };

    const seg = (id, items, label, cls = "") => `<div class="seg ${cls}" id="${id}" role="group" aria-label="${label}">
      ${items.map((x) => `<button type="button" data-id="${x.id}" ${x.cls ? `class="${x.cls}"` : ""} aria-pressed="false">${esc(x.label)}</button>`).join("")}</div>`;
    const slider = (id, label) => `<div class="ctl">
      <div class="row"><label for="${id}">${label}</label><span class="val" id="${id}Val"></span></div>
      <input type="range" id="${id}" step="1"><span class="effect" id="${id}Note"></span></div>`;

    root.innerHTML = `
      <div class="head">
        <span class="eyebrow">Your lenses side by side</span>
        <h1>Which lens for this?</h1>
      </div>
      ${seg("cmpSubject", SUBJECTS, "Subject")}
      ${seg("cmpLens", lenses.map((l, i) => ({ id: String(i), label: lensLabel(l), cls: lensClass(kit, l) })), "Lens", "lens")}
      <div class="frame" id="cmpFrame"></div>
      <div class="tiles" id="cmpTiles"></div>
      <div id="cmpNotes" aria-live="polite"></div>
      ${slider("cmpDist", "Your distance")}
      ${slider("cmpZoom", "Zoom")}
      ${slider("cmpAp", "Aperture")}
      <div class="ctl"><div class="row"><label id="cmpBgLabel">Background behind the ${esc(s.subject.noun)}</label></div>
        ${seg("cmpBg", BACKGROUNDS, "Background distance")}</div>
      <h2>All your lenses, same spot</h2>
      <div class="cmp-strip" id="cmpStrip"></div>
      <p class="muted">Each lens zoomed as far as it can while the subject still fits, wide open. Tap one to try it.</p>`;

    const dist = $("#cmpDist", root), zoom = $("#cmpZoom", root), ap = $("#cmpAp", root);
    dist.min = 0; dist.max = DISTANCES.length - 1;
    let apertures = [];

    const press = (group, id) => $$(`#${group} button`, root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));

    const setAperture = (n) => {
      apertures = F_STOPS.filter((f) => f >= widestAperture(s.lens, s.focalMm) - 1e-9 && f <= (s.lens.minAperture ?? 22) + 1e-9);
      const i = apertures.findIndex((f) => f >= n - 1e-9);
      ap.min = 0; ap.max = apertures.length - 1; ap.value = i < 0 ? apertures.length - 1 : i;
      s.fNumber = apertures[Number(ap.value)];
    };

    const selectLens = (i, focalMm) => {
      s.lens = lenses[i];
      zoom.min = s.lens.focalMm.min; zoom.max = s.lens.focalMm.max;
      zoom.disabled = s.lens.focalMm.min === s.lens.focalMm.max;
      s.focalMm = Math.min(s.lens.focalMm.max, Math.max(s.lens.focalMm.min, focalMm ?? s.lens.focalMm.max));
      zoom.value = s.focalMm;
      setAperture(0);
      press("cmpLens", String(i));
      store.set("halfpress.cmp.lens", String(i));
    };

    const update = () => {
      const a = analyse({ ...s, camera });
      $("#cmpFrame", root).innerHTML = scenePicture({ ...s, blur: a.blur, sensor: camera.sensor })
        + `<span class="tag">${s.focalMm} mm f/${s.fNumber} · ${fmtM(s.distanceM)} m away</span>`;
      const tile = (k, v) => `<div class="tile"><div class="k">${k}</div><div class="v small">${v}</div></div>`;
      $("#cmpTiles", root).innerHTML =
        tile("Subject fills", a.framing ? `Cropped: ${a.framing}` : a.fill > 1 ? "Doesn't fit" : pct(a.fill)) +
        tile("After a crop", a.framing || a.fill >= CROP_TARGET ? "No crop needed" : a.fill > 1 ? "Doesn't fit" : `${a.mp.toFixed(a.mp < 10 ? 1 : 0)} MP`) +
        tile("Background", a.tooClose ? "Out of focus range" : blurWords(a.blur).replace("Background ", "")) +
        tile("Full-frame look", `${equivalentFocal(s.focalMm, camera.cropFactor)} mm`);
      $("#cmpNotes", root).innerHTML = notes(a, s, kit).map(([cls, text]) => `<p class="${cls}">${text}</p>`).join("");

      $("#cmpDistVal", root).textContent = `${fmtM(s.distanceM)} m`;
      $("#cmpZoomVal", root).textContent = `${s.focalMm} mm`;
      $("#cmpZoomNote", root).textContent = zoom.disabled ? "Fixed lens. Move closer or farther to change the framing." : "";
      $("#cmpApVal", root).textContent = `f/${s.fNumber}`;
      $("#cmpApNote", root).textContent = s.fNumber <= widestAperture(s.lens, s.focalMm) + 1e-9 ? "Wide open: the most blur this lens gives here." : "";
      $("#cmpBgLabel", root).textContent = `Background behind the ${s.subject.noun}`;

      const best = lenses.map((l) => lensAtBest(l, s, camera));
      const usable = best.filter((b) => !b.tooClose && (b.framing || b.fill <= 1.0001));
      const mostBlur = usable.reduce((m, b) => (!m || b.blur > m.blur ? b : m), null);
      // Reach: the tightest framing that still works (for people, at least head and shoulders).
      const reachable = usable.filter((b) => b.framing !== "face only");
      const mostReach = reachable.reduce((m, b) => (!m || b.fill > m.fill ? b : m), null);
      $("#cmpStrip", root).innerHTML = best.map((b, i) => `
        <button type="button" class="cmp-pick" data-i="${i}" data-f="${b.focalMm}" aria-pressed="${b.lens === s.lens}">
          <span class="chip ${lensClass(kit, b.lens)}">${esc(lensLabel(b.lens))}</span>
          <span class="cmp-pick-k">${b.focalMm} mm f/${b.fNumber}</span>
          <span>${b.tooClose ? "Too close" : b.framing ? `Fills: ${b.framing}` : b.fill > 1 ? "Doesn't fit" : `Fills ${pct(b.fill)}`}</span>
          <span>${b.tooClose ? "" : blurWords(b.blur).replace("Background ", "Bg ")}</span>
          ${b === mostReach ? '<span class="badge">Fills most</span>' : ""}${b === mostBlur ? '<span class="badge">Most blur</span>' : ""}
        </button>`).join("");
      $$("#cmpStrip .cmp-pick", root).forEach((btn) => btn.addEventListener("click", () => {
        selectLens(Number(btn.dataset.i), Number(btn.dataset.f));
        update();
      }));

      press("cmpSubject", s.subject.id);
      press("cmpBg", BACKGROUNDS.find((b) => b.behindM === s.behindM)?.id);
      store.set("halfpress.cmp.subject", s.subject.id);
      store.set("halfpress.cmp.distance", String(s.distanceM));
      store.set("halfpress.cmp.bg", BACKGROUNDS.find((b) => b.behindM === s.behindM)?.id ?? "10");
    };

    const nearest = DISTANCES.reduce((b, d, i) => (Math.abs(d - s.distanceM) < Math.abs(DISTANCES[b] - s.distanceM) ? i : b), 0);
    dist.value = nearest; s.distanceM = DISTANCES[nearest];
    selectLens(Math.max(0, lenses.indexOf(s.lens)));

    $$("#cmpSubject button", root).forEach((b) => b.addEventListener("click", () => { s.subject = SUBJECTS.find((x) => x.id === b.dataset.id); update(); }));
    $$("#cmpLens button", root).forEach((b) => b.addEventListener("click", () => { selectLens(Number(b.dataset.id)); update(); }));
    $$("#cmpBg button", root).forEach((b) => b.addEventListener("click", () => { s.behindM = BACKGROUNDS.find((x) => x.id === b.dataset.id).behindM; update(); }));
    dist.addEventListener("input", () => { s.distanceM = DISTANCES[Number(dist.value)]; update(); });
    zoom.addEventListener("input", () => { s.focalMm = Number(zoom.value); setAperture(s.fNumber); update(); });
    ap.addEventListener("input", () => { s.fNumber = apertures[Number(ap.value)]; update(); });
    update();
  },
};
