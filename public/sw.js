const CACHE = "healthlink-v3";

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

/** Offline fallback when a navigation fails and nothing was cached. */
const FALLBACK = "/app";

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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: show the cached copy straight away when the network is
  // slow or offline, and pick up a new deploy in the background.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const fresh = fetchWithTimeout(request, NAV_TIMEOUT_MS);

        if (cached) {
          // Refresh the cache for next time, but do not make this load wait.
          event.waitUntil(
            fetchWithTimeout(request, NAV_TIMEOUT_MS).then((res) => putInCache(request, res)),
          );
          return cached;
        }

        const res = await fresh;
        if (res) {
          event.waitUntil(putInCache(request, res));
          return res;
        }

        const fallback = await caches.match(FALLBACK);
        return (
          fallback ||
          new Response("You are offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
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
