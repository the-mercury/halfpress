// Opens every screen in dark and light mode and checks that all visible text
// has enough contrast against what is actually behind it (WCAG AA: 4.5:1, or
// 3:1 for large text). Catches theme slips like dark text on a dark card.
//
//   node tests/ui/contrast.mjs
//
// Needs Playwright with Chromium (not a regular dependency, so `npm test`
// stays install-free). CI installs it; locally: npm install --no-save playwright
// && npx playwright install chromium.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const APP = fileURLToPath(new URL("../../app/", import.meta.url));
const VIEWS = ["scenes", "lens", "exposure", "timer"];
const SCHEMES = ["dark", "light"];
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml",
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "");
    try {
      const body = await readFile(join(APP, path.endsWith("/") || path === "" ? path + "index.html" : path));
      res.writeHead(200, { "content-type": TYPES[extname(path) || ".html"] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Runs in the page: returns every text element below the required contrast.
function audit() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  // Background behind an element: stack every ancestor's background colour.
  const background = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0) { layers.push(bg); if (bg.a === 1) break; }
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) out = over(layer, out);
    return out;
  };
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };

  const failures = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".frame, svg, [disabled], [aria-hidden='true'] svg")) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (!text) continue;
    const rect = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (!rect.width || !rect.height || st.visibility === "hidden") continue;
    const bg = background(el);
    const fg = parse(st.color);
    const shown = over({ ...fg, a: fg.a * opacity(el) }, bg);
    const size = parseFloat(st.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(shown, bg);
    if (got < need) failures.push({ text: text.slice(0, 40), got: Math.round(got * 100) / 100, need, cls: el.className || el.tagName });
  }
  return failures;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let problems = 0;
let checked = 0;

for (const scheme of SCHEMES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, serviceWorkers: "block" });
  // Fonts come from Google; the check is about colour, so leave them out.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (err) => { problems++; console.log(`${scheme}: page error: ${err.message}`); });

  for (const view of VIEWS) {
    await page.goto(`${base}#${view}`);
    await page.waitForSelector(`#view-${view}:not([hidden])`);
    // Every scene, so each card variant (warnings, filters) gets looked at.
    const states = view === "scenes" ? await page.locator("#sceneGrid button").count() : 1;
    for (let i = 0; i < states; i++) {
      if (view === "scenes") await page.locator("#sceneGrid button").nth(i).click();
      const failures = await page.evaluate(audit);
      checked++;
      for (const f of failures) {
        problems++;
        console.log(`${scheme} / ${view}${view === "scenes" ? ` #${i + 1}` : ""}: "${f.text}" (${f.cls}) is ${f.got}:1, needs ${f.need}:1`);
      }
    }
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(problems ? `\n${problems} contrast problem(s) in ${checked} screens.` : `Contrast OK in ${checked} screens (dark and light).`);
process.exit(problems ? 1 : 0);
