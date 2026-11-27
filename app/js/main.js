// Boots the app: loads the catalog, resolves the kit, builds the tabs.

import { loadCatalog } from "./catalog.js";
import { $, $$, esc, icon, store } from "./dom.js";
import { resolveKit } from "./kit.js";
import { exposureView } from "./views/exposure.js";
import { lensView } from "./views/lens.js";
import { scenesView } from "./views/scenes.js";
import { timerView } from "./views/timer.js";

const VIEWS = [scenesView, lensView, exposureView, timerView];

function buildShell(context) {
  const main = $("#views");
  main.innerHTML = VIEWS.map((v) => `<section class="view" id="view-${v.id}" hidden></section>`).join("");
  $("#tabs").innerHTML = VIEWS.map((v) =>
    `<button type="button" data-tab="${v.id}">${icon(v.icon)}${esc(v.label)}</button>`).join("");

  const go = (id, fromHash = false) => {
    const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    VIEWS.forEach((v) => { $(`#view-${v.id}`).hidden = v.id !== view.id; });
    $$("#tabs button").forEach((b) => {
      if (b.dataset.tab === view.id) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    store.set("halfpress.tab", view.id);
    if (!fromHash) history.replaceState(null, "", `#${view.id}`);
    view.onShow?.();
    window.scrollTo(0, 0);
  };

  context.go = go;
  VIEWS.forEach((v) => v.render($(`#view-${v.id}`), context));
  $$("#tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  window.addEventListener("hashchange", () => go(location.hash.slice(1), true));
  go(location.hash.slice(1) || store.get("halfpress.tab") || VIEWS[0].id, true);
}

async function boot() {
  try {
    const catalog = await loadCatalog();
    const kit = resolveKit(catalog);
    if (!kit.camera) throw new Error("The camera in your kit is not in the catalog.");
    buildShell({ catalog, kit });
  } catch (err) {
    $("#views").innerHTML = `<div class="error"><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p></div>`;
  }
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {}));
}
