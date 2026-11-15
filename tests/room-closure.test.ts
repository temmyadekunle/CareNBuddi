import assert from "node:assert/strict";
import test from "node:test";
import { dailyRoomCloser, reconcileRoomClosures } from "../worker/room-closure";

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

const CONFIG = {
  SUPABASE_URL: "https://project.supabase.co/",
  SUPABASE_SERVICE_KEY: "service-secret",
};
const ID = "10000000-0000-4000-8000-000000000c01";
const ROOM = `cnb-${"a".repeat(32)}`;

test("reconciliation is inert without Supabase credentials", async () => {
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return json({});
    },
    async () => {
      const summary = await reconcileRoomClosures({});
      assert.equal(summary.configured, false);
      assert.equal(summary.claimed, 0);
      assert.equal(called, false);
    },
  );
});

test("a queued room is claimed, closed and recorded as confirmed", async () => {
  const recorded: Record<string, unknown>[] = [];
  await withFetch(
    async (url, init) => {
      if (url.endsWith("/rpc/reconcile_room_closures")) {
        return json({ flagged: 1, pending: 1, failed: 0 });
      }
      if (url.endsWith("/rpc/claim_room_closure_batch")) {
        return json([{ consultation_id: ID, room_name: ROOM, attempts: 1 }]);
      }
      if (url.endsWith("/rpc/record_room_closure_result")) {
        recorded.push(bodyOf(init));
        return json("closed");
      }
      throw new Error(`unexpected url ${url}`);
    },
    async (calls) => {
      const summary = await reconcileRoomClosures(CONFIG, {
        closer: async (roomName) => {
          assert.equal(roomName, ROOM);
          return "closed";
        },
      });
      assert.equal(summary.configured, true);
      assert.equal(summary.flagged, 1);
      assert.equal(summary.claimed, 1);
      assert.equal(summary.closed, 1);
      assert.equal(summary.errors, 0);
      assert.equal(calls.length, 3);
      assert.deepEqual(recorded, [{ p_id: ID, p_success: true, p_detail: "closed" }]);
      assert.deepEqual(bodyOf(calls[1].init), { p_limit: 10 });
      const headers = new Headers(calls[0].init?.headers);
      assert.equal(headers.get("apikey"), "service-secret");
      assert.equal(headers.get("authorization"), "Bearer service-secret");
    },
  );
});

test("an already-absent room counts as confirmed closure", async () => {
  const recorded: Record<string, unknown>[] = [];
  await withFetch(
    async (url, init) => {
      if (url.endsWith("/rpc/reconcile_room_closures")) return json({});
      if (url.endsWith("/rpc/claim_room_closure_batch")) {
        return json([{ consultation_id: ID, room_name: ROOM, attempts: 2 }]);
      }
      recorded.push(bodyOf(init));
      return json("closed");
    },
    async () => {
      const summary = await reconcileRoomClosures(CONFIG, { closer: async () => "missing" });
      assert.equal(summary.closed, 1);
      assert.equal(summary.errors, 0);
      assert.deepEqual(recorded, [{ p_id: ID, p_success: true, p_detail: "missing" }]);
    },
  );
});

test("a provider failure is recorded as retryable, not as closure", async () => {
  const recorded: Record<string, unknown>[] = [];
  await withFetch(
    async (url, init) => {
      if (url.endsWith("/rpc/reconcile_room_closures")) return json({});
      if (url.endsWith("/rpc/claim_room_closure_batch")) {
        return json([{ consultation_id: ID, room_name: ROOM, attempts: 3 }]);
      }
      recorded.push(bodyOf(init));
      return json("failed");
    },
    async () => {
      const summary = await reconcileRoomClosures(CONFIG, { closer: async () => "failed" });
      assert.equal(summary.closed, 0);
      assert.equal(summary.errors, 1);
      assert.deepEqual(recorded, [
        { p_id: ID, p_success: false, p_detail: "provider_error" },
      ]);
    },
  );
});

test("without a room provider the queue is reconciled but nothing is claimed", async () => {
  await withFetch(
    async (url) => {
      if (url.endsWith("/rpc/reconcile_room_closures")) {
        return json({ flagged: 2, pending: 2, failed: 0 });
      }
      throw new Error(`unexpected url ${url}`);
    },
    async (calls) => {
      const summary = await reconcileRoomClosures(CONFIG);
      assert.equal(summary.configured, true);
      assert.equal(summary.flagged, 2);
      assert.equal(summary.claimed, 0);
      assert.equal(calls.length, 1);
    },
  );
});

test("the Daily closer deletes the private room and treats 404 as gone", async () => {
  for (const [status, expected] of [
    [200, "closed"],
    [404, "missing"],
  ] as const) {
    await withFetch(
      async () => new Response("{}", { status }),
      async (calls) => {
        assert.equal(await dailyRoomCloser("daily-secret")(ROOM), expected);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, `https://api.daily.co/v1/rooms/${ROOM}`);
        assert.equal(calls[0].init?.method, "DELETE");
        const headers = new Headers(calls[0].init?.headers);
        assert.equal(headers.get("authorization"), "Bearer daily-secret");
      },
    );
  }
});

test("the Daily closer reports failures without throwing", async () => {
  await withFetch(
    async () => new Response("boom", { status: 500 }),
    async () => {
      assert.equal(await dailyRoomCloser("daily-secret")(ROOM), "failed");
    },
  );

  await withFetch(
    async () => {
      throw new Error("offline");
    },
    async () => {
      assert.equal(await dailyRoomCloser("daily-secret")(ROOM), "failed");
    },
  );

  let called = false;
  await withFetch(
    async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
    async () => {
      assert.equal(await dailyRoomCloser("daily-secret")("not-a-room"), "failed");
      assert.equal(called, false);
    },
  );
});

test("reconciliation logs never contain a room name or consultation id", async () => {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    await withFetch(
      async (url) => {
        if (url.endsWith("/rpc/reconcile_room_closures")) {
          return json({ flagged: 1, pending: 1, failed: 0 });
        }
        if (url.endsWith("/rpc/claim_room_closure_batch")) {
          return json([{ consultation_id: ID, room_name: ROOM, attempts: 1 }]);
        }
        return json("closed");
      },
      async () => {
        await reconcileRoomClosures(CONFIG, { closer: async () => "closed" });
      },
    );
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.ok(lines.length > 0, "expected at least one log line");
  assert.ok(
    lines.every((line) => !line.includes(ROOM) && !line.includes(ID)),
    lines.join("\n"),
  );
});
