import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const sw = readFileSync(join(appDir, "sw.js"), "utf8");
const listed = new Set([...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [relative(appDir, path)];
  });
}

test("the service worker caches every app file", () => {
  const needed = files(appDir).filter((f) =>
    !f.startsWith("tests/") && f !== "sw.js" && /\.(html|css|js|json|webmanifest|png)$/.test(f));
  const missing = needed.filter((f) => !listed.has(f));
  assert.deepEqual(missing, [], "add these to CORE in app/sw.js and bump VERSION");
});

test("the service worker lists no files that don't exist", () => {
  const all = new Set(files(appDir));
  const stale = [...listed].filter((f) => f !== "" && !all.has(f));
  assert.deepEqual(stale, []);
});
