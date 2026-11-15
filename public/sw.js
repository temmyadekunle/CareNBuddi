const CACHE = "healthlink-v6";

/**
 * Everything needed to open the app without a network. An installed HealthLink
 * has to start instantly and keep working on a weak connection, so the shell
 * and the main screens are cached on install rather than being fetched one
 * slow navigation at a time.
 */
const SHELL = [
  "/",
  "/app",
  "/find-care",
  "/appointments",
  "/health",
  "/records",
  "/reminders",
  "/journal",
  "/profile",
  "/services",
  "/emergency",
  "/explore",
  "/onboarding",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

/**
 * Routes whose document carries session or confirmation state, or a one-shot
 * token in the query string. They are never served from, and never written to,
 * the service worker: a cached or substituted document can replay a different
 * screen against the URL's state, and a query-string variant must not be
 * stored under another URL.
 */
const NETWORK_ONLY = [
  "/auth",
  "/provider/register",
  "/provider/onboarding",
  "/provider/status",
];

/**
 * The static export (no `trailingSlash`) also emits `/provider/register.html`.
 * A hard navigation to that alias must obey the same rule as the
 * extensionless URL, otherwise a provider application document could be
 * cached and later served from the worker. The `/provider` workspace itself
 * is not in the list and stays cacheable.
 */
function normalizeRoutePath(pathname) {
  const bare = pathname.replace(/\/+$/, "");
  return bare.endsWith(".html") ? bare.slice(0, -5) : bare;
}

function isNetworkOnlyPath(pathname) {
  const path = normalizeRoutePath(pathname);
  return NETWORK_ONLY.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}

/**
 * How long to wait on the network before falling back to the cached copy.
 *
 * Navigations used to be network-first with no timeout at all, so on a slow
 * connection every tap inside the installed app sat blank until the request
 * finally gave up. That is what made the app feel like it had frozen. Two
 * seconds is long enough for a healthy connection and short enough that a bad
 * one still opens instantly from the cache.
 */
const NAV_TIMEOUT_MS = 2000;

/** Same idea for static assets: never let a stalled request hang a render. */
const ASSET_TIMEOUT_MS = 8000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cache entries one at a time. addAll() rejects as a group, so a single
      // missing icon would have left the whole app uncached.
      await Promise.allSettled(SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Resolves with the fetch, or with undefined if it takes too long. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      resolve(undefined);
    }, ms);
    fetch(request).then(
      (res) => {
        if (done) return;
        clearTimeout(timer);
        resolve(res);
      },
      () => {
        if (done) return;
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

async function putInCache(request, response) {
  if (response && response.ok && response.type !== "opaque") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
}

/**
 * The cached document for exactly this navigation, if there is one.
 *
 * The static export serves /app and /app/ for the same document, so the
 * trailing-slash form is also tried. No other route is ever substituted:
 * answering /provider/register with the cached /app document hydrated the
 * wrong screen against the URL. Query state is read by the page after load,
 * so the route's document still matches; query-bearing URLs are simply never
 * cached themselves.
 */
async function cachedDocumentFor(url) {
  const exact = await caches.match(url.pathname);
  if (exact) return exact;

  const bare = url.pathname.replace(/\/+$/, "");
  if (!bare || bare === url.pathname) return null;
  return (await caches.match(bare)) ?? null;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App downloads (zip/apk) are big, one-shot files: never time them out and
  // never answer them with a cached page — let the browser fetch them straight
  // from the network so the origin's attachment headers always apply.
  if (/\.(zip|apk)$/i.test(url.pathname)) return;

  /* Next.js App Router data, not a static asset.
     Prefetches arrive as `?_rsc=…` and per-route segment files end in
     `__next.…__PAGE__.txt`. They used to fall through to the cache-first branch
     below, which on a slow request resolved to a 504 with an empty body after
     ASSET_TIMEOUT_MS. An RSC payload that arrives empty is worse than one that
     never arrives: the router has no data to hydrate from, so the page renders
     blank and never fires DOMContentLoaded. Let these go straight to the
     network — they are already content-hashed and cheap, and the browser HTTP
     cache still covers repeat visits. */
  if (url.searchParams.has("_rsc") || /__next\..*\.txt$/.test(url.pathname)) {
    return;
  }

  // Page navigations: go to the network first so the user always gets the
  // latest deploy, but never wait longer than NAV_TIMEOUT_MS — a slow or dead
  // connection falls back to the cached copy instead of hanging the tap.
  if (request.mode === "navigate") {
    // Auth, verification and provider-application screens are left entirely to
    // the network. Their session handoff cannot run from a cached document,
    // and caching one would let an old document answer a new URL.
    if (isNetworkOnlyPath(url.pathname)) return;

    event.respondWith(
      (async () => {
        const fresh = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
        if (fresh) {
          // Query-string navigations are one-off (destinations, filters,
          // confirmation state); only the plain route is stored.
          if (!url.search) event.waitUntil(putInCache(request, fresh));
          return fresh;
        }

        const cached = await cachedDocumentFor(url);
        if (cached) return cached;

        return new Response("You are offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })(),
    );
    return;
  }

  // Static assets: cache first, refreshed quietly in the background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        event.waitUntil(
          fetchWithTimeout(request, ASSET_TIMEOUT_MS).then((res) => putInCache(request, res)),
        );
        return cached;
      }

      const res = await fetchWithTimeout(request, ASSET_TIMEOUT_MS);
      if (res) {
        event.waitUntil(putInCache(request, res));
        return res;
      }

      return new Response("", { status: 504, statusText: "Offline" });
    })(),
  );
});
