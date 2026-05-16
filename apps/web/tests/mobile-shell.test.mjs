import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("root layout opts into edge-to-edge mobile viewport rendering", () => {
  const layout = read("app/layout.tsx");

  assert.match(layout, /viewportFit:\s*["']cover["']/);
  assert.match(layout, /min-h-svh/);
  assert.doesNotMatch(layout, /\bmin-h-screen\b/);
});

test("home page uses the shared responsive mobile shell and safe-area bottom spacing", () => {
  const page = read("app/page.tsx");

  assert.match(page, /className=["'][^"']*\bmobile-shell\b/);
  assert.match(page, /className=["'][^"']*\bsafe-area-bottom\b/);
});

test("global utilities provide mobile width, safe-area, and touch target guarantees", () => {
  const css = read("app/globals.css");

  assert.match(css, /\.mobile-shell/);
  assert.match(css, /max-width:\s*480px/);
  assert.match(css, /\.safe-area-bottom/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.touch-target/);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(css, /\b100vh\b/);
});
