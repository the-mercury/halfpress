// Tiny DOM helpers shared by the views.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Escape text for use inside an HTML template. */
export function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Stroke icon paths, drawn in a 24 x 24 box. */
export const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  lens: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  triangle: '<path d="M12 3 L21 19 H3 Z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/>',
  tripod: '<path d="M8 4h8v4H8z"/><path d="M12 8v12"/><path d="M12 10l-6 10"/><path d="M12 10l6 10"/>',
  mountain: '<path d="M2 19l6-10 4 6 3-4 7 8z"/><circle cx="17" cy="6" r="2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="15" cy="6.5" r="1.8"/><circle cx="18.5" cy="10.5" r="1.8"/><path d="M8 17c0-3 2-5 4.5-5S17 14 17 17c0 2-2 3-4.5 3S8 19 8 17z"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  compare: '<rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/><path d="M7 10v4M17 9v6"/>',
  pan: '<path d="M3 12h14"/><path d="M13 8l4 4-4 4"/><path d="M3 7h6"/><path d="M3 17h6"/>',
};

export function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}

/** Colour class for the n-th lens in the kit, so a lens keeps its colour on every screen. */
export function lensClass(kit, lens) {
  return `l${Math.max(0, kit.lenses.indexOf(lens)) % 4}`;
}

/** Short lens label such as "18-45" or "50 f/1.8". */
export function lensLabel(lens) {
  const { min, max } = lens.focalMm;
  return min === max ? `${min} f/${lens.maxAperture[0].f}` : `${min}-${max}`;
}

export const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};
