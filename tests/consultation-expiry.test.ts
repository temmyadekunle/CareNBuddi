import assert from "node:assert/strict";
import test from "node:test";
import worker, { expireStaleConsultations } from "../worker/index";

type FetchCall = { url: string; init?: RequestInit };

async function withFetch<T>(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const CONFIGURED = {
  SUPABASE_URL: "https://project.supabase.co/",
  SUPABASE_SERVICE_KEY: "service-secret",
};

test("expiry is inert when the backend is not configured", async () => {
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return new Response("0");
    },
    async () => {
      assert.equal(await expireStaleConsultations({}), 0);
      assert.equal(called, false);
    },
  );
});

test("expiry posts to the service-role RPC with the service key", async () => {
  await withFetch(
    async () => new Response("4", { status: 200, headers: { "content-type": "application/json" } }),
    async (calls) => {
      assert.equal(await expireStaleConsultations(CONFIGURED), 4);
      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        "https://project.supabase.co/rest/v1/rpc/expire_stale_consultations",
      );
      const init = calls[0].init ?? {};
      assert.equal(init.method, "POST");
      const headers = new Headers(init.headers);
      assert.equal(headers.get("apikey"), "service-secret");
      assert.equal(headers.get("authorization"), "Bearer service-secret");
      assert.equal(init.body, "{}");
    },
  );
});

test("an upstream failure is reported as zero, not thrown", async () => {
  await withFetch(
    async () => new Response("boom", { status: 500 }),
    async () => {
      assert.equal(await expireStaleConsultations(CONFIGURED), 0);
    },
  );
});

test("a network error is reported as zero, not thrown", async () => {
  await withFetch(
    async () => {
      throw new Error("offline");
    },
    async () => {
      assert.equal(await expireStaleConsultations(CONFIGURED), 0);
    },
  );
});

test("a non-numeric response is reported as zero", async () => {
  await withFetch(
    async () => new Response("null", { status: 200, headers: { "content-type": "application/json" } }),
    async () => {
      assert.equal(await expireStaleConsultations(CONFIGURED), 0);
    },
  );
});

test("the scheduled handler runs expiry, then room reconciliation, and waits", async () => {
  const order: string[] = [];
  await withFetch(
    async (url) => {
      order.push(url);
      if (url.endsWith("/rpc/expire_stale_consultations")) return new Response("2");
      if (url.endsWith("/rpc/reconcile_room_closures")) {
        return new Response(JSON.stringify({ flagged: 0, pending: 0, failed: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/rpc/claim_room_closure_batch")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    },
    async () => {
      const pending: Promise<unknown>[] = [];
      const ctx = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) };
      await worker.scheduled({ cron: "*/5 * * * *", scheduledTime: 0 }, CONFIGURED, ctx);
      assert.equal(pending.length, 1);
      const result = (await pending[0]) as { expired: number; closure: { configured: boolean } };
      assert.equal(result.expired, 2);
      assert.equal(result.closure.configured, true);
      assert.ok(order[0].endsWith("/rpc/expire_stale_consultations"));
      assert.ok(order[1].endsWith("/rpc/reconcile_room_closures"));
    },
  );
});

test("room reconciliation still runs when expiry reports an upstream failure", async () => {
  const order: string[] = [];
  await withFetch(
    async (url) => {
      order.push(url);
      if (url.endsWith("/rpc/expire_stale_consultations")) {
        return new Response("boom", { status: 500 });
      }
      if (url.endsWith("/rpc/reconcile_room_closures")) {
        return new Response(JSON.stringify({ flagged: 1, pending: 1, failed: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    },
    async () => {
      const pending: Promise<unknown>[] = [];
      const ctx = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) };
      await worker.scheduled({ cron: "*/5 * * * *", scheduledTime: 0 }, CONFIGURED, ctx);
      const result = (await pending[0]) as {
        expired: number;
        closure: { configured: boolean; flagged: number };
      };
      assert.equal(result.expired, 0);
      assert.equal(result.closure.flagged, 1);
      assert.ok(order.some((url) => url.endsWith("/rpc/reconcile_room_closures")));
    },
  );
});
