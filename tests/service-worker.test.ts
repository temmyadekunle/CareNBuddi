import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The service worker must not answer App Router data requests, auth screens,
 * registration screens, or one route with another route's document.
 *
 * RSC payloads used to fall through to the cache-first branch, which resolves
 * to `new Response("", { status: 504 })` once ASSET_TIMEOUT_MS elapses. An
 * empty RSC payload is worse than a slow one: the router has nothing to
 * hydrate from, so the page renders blank and DOMContentLoaded never fires.
 *
 * Navigations to /auth/* and the provider application screens used to be
 * network-first with a cached /app fallback. On a slow connection an
 * unconfirmed provider landed on the patient dashboard instead of the
 * verification screen, so the confirmation token in the URL was never
 * consumed.
 *
 * The worker is a static file served straight to the browser, so it cannot be
 * imported. These assertions read it and re-state the routing rules, which is
 * enough to catch a guard being dropped or moved below a cache branch.
 */
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

/** Mirrors the guard in sw.js. */
function isRouterDataRequest(pathAndQuery: string) {
  const u = new URL(pathAndQuery, "https://carenbuddi.test");
  if (u.searchParams.has("_rsc")) return true;
  return /__next\..*\.txt$/.test(u.pathname);
}

/**
 * Evaluate the worker's own routing helpers instead of re-stating them, so a
 * change to the list or the normalisation is exercised rather than mirrored.
 * Only the pure helpers are evaluated; the worker's top-level event
 * registration is never run.
 */
function functionSource(name: string): string {
  const match = sw.match(
    new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`),
  );
  assert.ok(match, `${name} not found in sw.js`);
  return match[0];
}

const networkOnlyList = sw.match(/const NETWORK_ONLY = \[[\s\S]*?\];/);
assert.ok(networkOnlyList, "NETWORK_ONLY not found in sw.js");

const routing = new Function(
  `${networkOnlyList[0]}
   ${functionSource("normalizeRoutePath")}
   ${functionSource("isNetworkOnlyPath")}
   return { NETWORK_ONLY, normalizeRoutePath, isNetworkOnlyPath };`,
)() as {
  NETWORK_ONLY: string[];
  normalizeRoutePath: (pathname: string) => string;
  isNetworkOnlyPath: (pathname: string) => boolean;
};

const { NETWORK_ONLY, normalizeRoutePath, isNetworkOnlyPath } = routing;

function cachedDocumentForWith(entries: Record<string, string>) {
  const source = functionSource("cachedDocumentFor");
  const tables = {
    async match(pathname: string) {
      return entries[pathname] ? new Response(entries[pathname]) : undefined;
    },
  };
  return new Function("caches", `${source}; return cachedDocumentFor;`)(tables) as (
    url: URL,
  ) => Promise<Response | null>;
}

test("router data requests are recognised", () => {
  assert.equal(isRouterDataRequest("/profile?_rsc=abc123"), true);
  assert.equal(isRouterDataRequest("/app/__next.!KGFwcCk.app.__PAGE__.txt"), true);
  assert.equal(isRouterDataRequest("/auth/sign-in/__next._tree.txt"), true);
  assert.equal(isRouterDataRequest("/_next/static/chunks/app.js"), false);
  assert.equal(isRouterDataRequest("/_next/static/media/font.woff2"), false);
  assert.equal(isRouterDataRequest("/brand/mark.png"), false);
});

test("the RSC guard is present in the service worker", () => {
  assert.match(sw, /searchParams\.has\("_rsc"\)/, "RSC query guard missing");
  assert.match(sw, /__next\\\.\.\*\\\.txt\$/, "segment-file guard missing");
});

test("the RSC guard runs before the cache-first branch answers requests", () => {
  const guard = sw.indexOf('searchParams.has("_rsc")');
  const cacheFirst = sw.indexOf("const cached = await caches.match(request);", sw.indexOf("Static assets"));
  assert.ok(guard > -1, "guard not found");
  assert.ok(cacheFirst > -1, "cache-first branch not found");
  assert.ok(guard < cacheFirst, "the RSC guard must come before the static-asset branch");
});

test("auth, verification and provider application navigations are network-only", () => {
  for (const pathname of [
    "/auth",
    "/auth/verify",
    "/auth/sign-up",
    "/auth/sign-up/role",
    "/provider/register",
    "/provider/register/anything",
    "/provider/onboarding",
    "/provider/status",
  ]) {
    assert.equal(isNetworkOnlyPath(pathname), true, pathname);
  }
  for (const pathname of ["/", "/app", "/provider", "/provider/index", "/find-care", "/onboarding"]) {
    assert.equal(isNetworkOnlyPath(pathname), false, pathname);
  }
});

test("the static export's .html aliases obey the same network-only rule", () => {
  // next.config.ts does not set trailingSlash, so `out/provider/register.html`
  // exists alongside the extensionless route and can be opened directly.
  for (const pathname of [
    "/provider/register.html",
    "/provider/onboarding.html",
    "/provider/status.html",
    "/auth/verify.html",
    "/auth/sign-in.html",
  ]) {
    assert.equal(isNetworkOnlyPath(pathname), true, pathname);
  }
  // The professional workspace is a normal cacheable screen.
  assert.equal(isNetworkOnlyPath("/provider.html"), false);
});

test("trailing slashes and .html aliases resolve to the same route", () => {
  assert.equal(normalizeRoutePath("/provider/register/"), "/provider/register");
  assert.equal(normalizeRoutePath("/provider/register.html/"), "/provider/register");
  assert.equal(normalizeRoutePath("/provider/register/index.html"), "/provider/register/index");
  assert.equal(normalizeRoutePath("/app/"), "/app");
});

test("a navigation may only be answered by the requested route's document", async () => {
  const cachedDocumentFor = cachedDocumentForWith({
    "/app": "app-document",
    "/provider/onboarding": "onboarding-document",
  });

  const exact = await cachedDocumentFor(new URL("https://carenbuddi.test/provider/onboarding"));
  assert.equal(await exact?.text(), "onboarding-document");

  // The export is served with trailing slashes; the bare path is the same route.
  const slashed = await cachedDocumentFor(new URL("https://carenbuddi.test/provider/onboarding/"));
  assert.equal(await slashed?.text(), "onboarding-document");

  // Another route's document is never a substitute.
  const other = await cachedDocumentFor(new URL("https://carenbuddi.test/records"));
  assert.equal(other, null);
});

test("the worker leaves those navigations to the network", () => {
  assert.match(sw, /const NETWORK_ONLY = \[/, "network-only list missing");
  for (const route of NETWORK_ONLY) {
    assert.ok(sw.includes(`"${route}"`), `${route} missing from NETWORK_ONLY`);
  }
  const navigate = sw.indexOf('request.mode === "navigate"');
  const bypass = sw.indexOf("if (isNetworkOnlyPath(url.pathname)) return;");
  const respond = sw.indexOf("event.respondWith(", navigate);
  assert.ok(navigate > -1 && bypass > -1 && respond > -1, "navigation guards not found");
  assert.ok(bypass > navigate && bypass < respond, "the bypass must run before respondWith");
});

test("a failed navigation never falls back to another route's document", () => {
  // The /app fallback was the provider-registration bug: an unrelated URL was
  // answered with the patient dashboard.
  assert.doesNotMatch(sw, /\bFALLBACK\b/);
  assert.doesNotMatch(sw, /caches\.match\("\/app"\)/);
  assert.doesNotMatch(sw, /caches\.match\(FALLBACK\)/);
});

test("only the requested route may answer a navigation", () => {
  assert.match(sw, /async function cachedDocumentFor\(url\)/);
  assert.match(sw, /caches\.match\(url\.pathname\)/);
  // ignoreSearch would let one route's query variant answer another.
  assert.doesNotMatch(sw, /ignoreSearch:\s*true/);
});

test("query-string navigations are never cached", () => {
  assert.match(sw, /if \(!url\.search\) event\.waitUntil\(putInCache\(request, fresh\)\)/);
});

test("the cache version was bumped so old /app fallbacks are evicted", () => {
  assert.match(sw, /const CACHE = "healthlink-v6"/);
  assert.match(sw, /keys\.filter\(\(k\) => k !== CACHE\)/);
});

test("navigations still time out and explain themselves when offline", () => {
  // Do not "fix" the provider bug by deleting the offline behaviour the app
  // depends on.
  assert.match(sw, /NAV_TIMEOUT_MS/);
  assert.match(sw, /new Response\("You are offline\."/);
  assert.match(sw, /status: 503/);
});
