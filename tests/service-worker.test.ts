import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The service worker must not answer App Router data requests.
 *
 * RSC payloads used to fall through to the cache-first branch, which resolves
 * to `new Response("", { status: 504 })` once ASSET_TIMEOUT_MS elapses. An
 * empty RSC payload is worse than a slow one: the router has nothing to
 * hydrate from, so the page renders blank and DOMContentLoaded never fires.
 * The profile screen was the heaviest page to hit this.
 *
 * The worker is a static file served straight to the browser, so it cannot be
 * imported. These assertions read it and re-state the routing rule, which is
 * enough to catch the guard being dropped or moved below the cache branch.
 */
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

/** Mirrors the guard in sw.js. */
function isRouterDataRequest(pathAndQuery: string) {
  const u = new URL(pathAndQuery, "https://carenbuddi.test");
  if (u.searchParams.has("_rsc")) return true;
  return /__next\..*\.txt$/.test(u.pathname);
}

test("router data requests are recognised", () => {
  assert.equal(isRouterDataRequest("/profile?_rsc=abc123"), true);
  assert.equal(isRouterDataRequest("/app/__next.!KGFwcCk.app.__PAGE__.txt"), true);
  assert.equal(isRouterDataRequest("/auth/sign-in/__next._tree.txt"), true);
  assert.equal(isRouterDataRequest("/_next/static/chunks/app.js"), false);
  assert.equal(isRouterDataRequest("/_next/static/media/font.woff2"), false);
  assert.equal(isRouterDataRequest("/brand/mark.png"), false);
});

test("the guard is present in the service worker", () => {
  assert.match(sw, /searchParams\.has\("_rsc"\)/, "RSC query guard missing");
  assert.match(sw, /__next\\\.\.\*\\\.txt\$/, "segment-file guard missing");
});

test("the guard runs before the cache-first branch answers requests", () => {
  const guard = sw.indexOf('searchParams.has("_rsc")');
  const cacheFirst = sw.indexOf("const cached = await caches.match(request);", sw.indexOf("Static assets"));
  assert.ok(guard > -1, "guard not found");
  assert.ok(cacheFirst > -1, "cache-first branch not found");
  assert.ok(guard < cacheFirst, "the RSC guard must come before the static-asset branch");
});

test("navigations still fall back to a cache copy rather than hanging", () => {
  // The profile hang was partly this being wrong; do not "fix" it by deleting
  // the offline behaviour the app depends on.
  assert.match(sw, /NAV_TIMEOUT_MS/);
  assert.match(sw, /const FALLBACK = "\/app"/);
  assert.match(sw, /new Response\("You are offline\."/);
});
