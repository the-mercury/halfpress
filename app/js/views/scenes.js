// Scenes: tap a situation, get the lens from your kit and its settings.

import { $, $$, esc, icon, lensClass, lensLabel, store } from "../dom.js";
import { SCENES, recommend } from "../scenes.js";

export const scenesView = {
  id: "scenes",
  label: "Scenes",
  icon: "grid",

  render(root, { kit, go }) {
    root.innerHTML = `
      <div class="head">
        <span class="eyebrow">${esc(kit.camera.maker)} ${esc(kit.camera.model)} · tap a scene</span>
        <h1>What are you shooting?</h1>
      </div>
      <div class="panel" id="scenePanel" aria-live="polite"></div>
      <div class="scene-grid" id="sceneGrid">
        ${SCENES.map((s) => `
          <button type="button" class="scene-btn" data-id="${s.id}" aria-pressed="false">
            ${icon(s.icon)}<span>${esc(s.short)}</span>
          </button>`).join("")}
      </div>`;

    const show = (id) => {
      const scene = SCENES.find((s) => s.id === id) ?? SCENES[0];
      const r = recommend(scene, kit);
      const panel = $("#scenePanel", root);
      if (!r.lens) {
        panel.innerHTML = `<h2>${esc(scene.name)}</h2>${r.warnings.map((w) => `<p class="warning">${esc(w)}</p>`).join("")}`;
      } else {
        const filter = r.filter
          ? `<p class="muted">Filter: ${esc(r.filter.item.model)}${r.filter.ring ? ` on the ${esc(r.filter.ring.model)}` : ""}.</p>`
          : "";
        panel.innerHTML = `
          <div class="row"><h2>${esc(scene.name)}</h2><span class="chip ${lensClass(kit, r.lens)}">${esc(lensLabel(r.lens))}</span></div>
          <p class="muted">${esc(r.lens.model)} at ${r.focal} mm (looks like ${r.equivalent} mm)</p>
          <div class="tiles">${r.settings.map(([k, v]) =>
            `<div class="tile"><div class="k">${esc(k)}</div><div class="v${String(v).length > 7 ? " small" : ""}">${esc(v)}</div></div>`).join("")}</div>
          ${filter}
          ${r.warnings.map((w) => `<p class="warning">${esc(w)}</p>`).join("")}
          <p class="tip">${esc(scene.tip)}</p>
          ${scene.timer ? '<button type="button" class="primary" id="toTimer">Open the ND timer</button>' : ""}`;
        $("#toTimer", panel)?.addEventListener("click", () => go("timer"));
      }
      $$("#sceneGrid button", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === scene.id)));
      store.set("halfpress.scene", scene.id);
    };

    $$("#sceneGrid button", root).forEach((b) =>
      b.addEventListener("click", () => { show(b.dataset.id); window.scrollTo(0, 0); }));
    show(store.get("halfpress.scene"));
  },
};
