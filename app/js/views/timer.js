// ND timer: pick an ND filter from the kit and the metered shutter speed,
// get the long-exposure time and a countdown.

import { $, $$ } from "../dom.js";
import { formatShutter, ndExposure, ndStops, parseShutter } from "../optics.js";

const METERED = [1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const CIRC = 2 * Math.PI * 88;

function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}:${String(r).padStart(2, "0")}` : `${r} s`;
}

export const timerView = {
  id: "timer",
  label: "ND timer",
  icon: "timer",

  render(root, { kit }) {
    const nds = kit.filters.filter((f) => f.kind === "nd" && f.ndFactor);
    const longest = parseShutter(kit.camera.shutter.longestTimed);
    const state = { filter: nds[0], base: 1 / 30, total: 0, left: 0, running: false, end: 0, raf: 0, audio: null, lock: null };

    if (!nds.length) {
      root.innerHTML = `
        <div class="head"><span class="eyebrow">Long exposure</span><h1>ND timer</h1></div>
        <div class="panel"><p>Your kit has no fixed ND filter yet. Add one in My Kit to use the timer.</p></div>`;
      return;
    }

    root.innerHTML = `
      <div class="head">
        <span class="eyebrow">Long exposure</span>
        <h1>ND timer</h1>
      </div>
      ${nds.length > 1 ? `<div class="seg" id="ndFilter" role="group" aria-label="ND filter">
        ${nds.map((f, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">ND${f.ndFactor}</button>`).join("")}</div>` : ""}
      <p class="muted" id="ndIntro"></p>
      <div class="chips" id="ndChips" role="group" aria-label="Metered shutter speed without the filter">
        ${METERED.map((t) => `<button type="button" data-t="${t}" aria-pressed="false">${formatShutter(t)}</button>`).join("")}
      </div>
      <div class="panel">
        <div class="ring">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle class="track" cx="100" cy="100" r="88"/>
            <circle class="prog" id="ndProg" cx="100" cy="100" r="88" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="0"/>
          </svg>
          <div class="read"><span class="big" id="ndBig"></span><span class="muted" id="ndSub"></span></div>
        </div>
        <div class="btn-row">
          <button type="button" class="primary" id="ndStart">Start</button>
          <button type="button" class="ghost" id="ndReset">Reset</button>
        </div>
        <p class="muted" id="ndHint" aria-live="polite"></p>
      </div>
      <div class="panel">
        <div class="tiles">
          <div class="tile"><div class="k">Mode</div><div class="v small">M or Bulb</div></div>
          <div class="tile"><div class="k">Aperture</div><div class="v small">f/8</div></div>
          <div class="tile"><div class="k">ISO</div><div class="v small">${kit.camera.iso.min}</div></div>
          <div class="tile"><div class="k">Focus</div><div class="v small">Manual</div></div>
        </div>
        <p class="tip">Compose and focus before the filter goes on. Use a tripod and the 2 s self-timer.</p>
      </div>`;

    const paint = () => {
      $("#ndBig", root).textContent = state.running ? clock(state.left) : formatShutter(state.total);
      $("#ndSub", root).textContent = state.running ? "remaining" : `with ND${state.filter.ndFactor}`;
      $("#ndProg", root).setAttribute("stroke-dashoffset", (CIRC * (1 - (state.total ? state.left / state.total : 0))).toFixed(1));
      $("#ndStart", root).textContent = state.running ? "Stop" : "Start";
    };

    const release = () => { try { state.lock?.release(); } catch { /* ignore */ } state.lock = null; };
    const stop = () => { state.running = false; cancelAnimationFrame(state.raf); state.left = state.total; release(); };

    const recalc = () => {
      stop();
      state.total = ndExposure(state.base, state.filter.ndFactor);
      state.left = state.total;
      $("#ndIntro", root).textContent =
        `Meter without the filter, tap that shutter speed, then attach the ${state.filter.model} (about ${ndStops(state.filter.ndFactor).toFixed(0)} stops).`;
      $("#ndHint", root).textContent = state.total <= longest
        ? `Up to ${formatShutter(longest)} the ${kit.camera.model} times this itself: set the shutter in M.`
        : `Longer than ${formatShutter(longest)}: use Bulb, press Start as you open the shutter, and close it at zero.`;
      $$("#ndChips button", root).forEach((b) => b.setAttribute("aria-pressed", String(Math.abs(Number(b.dataset.t) - state.base) < 1e-9)));
      paint();
    };

    const beep = () => {
      try {
        const c = state.audio;
        if (!c) return;
        [0, 0.25, 0.5].forEach((t) => {
          const o = c.createOscillator(), g = c.createGain();
          o.frequency.value = 880; g.gain.value = 0.2; o.connect(g); g.connect(c.destination);
          o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.15);
        });
      } catch { /* no audio */ }
    };

    const tick = () => {
      state.left = (state.end - Date.now()) / 1000;
      if (state.left <= 0) {
        state.running = false; state.left = 0; paint(); beep(); release();
        $("#ndBig", root).textContent = "Done";
        $("#ndSub", root).textContent = "close the shutter";
        state.left = state.total;
        return;
      }
      paint();
      state.raf = requestAnimationFrame(tick);
    };

    $("#ndStart", root).addEventListener("click", () => {
      if (state.running) { stop(); paint(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !state.audio) state.audio = new AC();
        state.audio?.resume?.();
      } catch { /* no audio */ }
      navigator.wakeLock?.request("screen").then((l) => { state.lock = l; }).catch(() => {});
      state.running = true;
      state.left = state.total;
      state.end = Date.now() + state.total * 1000;
      tick();
    });
    $("#ndReset", root).addEventListener("click", () => { stop(); paint(); });
    $$("#ndChips button", root).forEach((b) => b.addEventListener("click", () => { state.base = Number(b.dataset.t); recalc(); }));
    $$("#ndFilter button", root).forEach((b) => b.addEventListener("click", () => {
      state.filter = nds[Number(b.dataset.i)];
      $$("#ndFilter button", root).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      recalc();
    }));
    recalc();
  },
};
