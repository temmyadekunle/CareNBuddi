import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index";

// End-to-end tests for the Daily webhook endpoint. The signature is produced
// with Daily's documented algorithm: HMAC-SHA256 over
// `${timestamp}.${exact raw request body}` keyed by the base64-decoded secret,
// base64 encoded and sent as X-Webhook-Signature. Nothing here replicates the
// Worker's verifier, so a change to the verifier cannot silently pass.

const SECRET = "NQrSA5z0FkJ44QPrFerW7uCc5kdNLv3l2FDEKDanL1U=";
const ROOM = `cnb-${"a".repeat(32)}`;
const SESSION = "sess_01HVK9YJ2X3Z4W5V6U7T8S9R";
const USER = "usr_01HVK9YJ2X3Z4W5V6U7T8S9R";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co/",
  SUPABASE_SERVICE_KEY: "service-secret",
  DAILY_WEBHOOK_SECRET: SECRET,
};

type FetchCall = { url: string; init?: RequestInit; body?: unknown };

async function withFetch<T>(
  handler: (call: FetchCall) => Promise<Response>,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const call = { url, init, body };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

async function withConsole<T>(run: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    return { result: await run(), lines };
  } finally {
    console.error = original;
  }
}

function forbidden(name: string): (call: FetchCall) => Promise<Response> {
  return async () => {
    throw new Error(`unexpected upstream call to ${name}`);
  };
}

async function hmacBase64(secret: string, content: string): Promise<string> {
  const binary = atob(secret);
  const keyData = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) keyData[i] = binary.charCodeAt(i);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function presenceEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    version: "1.0.0",
    type,
    id: "evt_01HVK9YJ2X3Z4W5V6U7T8S9R",
    event_ts: Date.now(),
    payload: {
      room: ROOM,
      session_id: SESSION,
      user_id: USER,
      user_name: "Dr. Smith",
      ...overrides,
    },
  };
}

async function signedRequest(
  event: unknown,
  options: {
    timestamp?: string;
    secret?: string;
    signature?: string;
    body?: string;
    headerNames?: "canonical" | "lowercase";
  } = {},
): Promise<Request> {
  const timestamp = options.timestamp ?? String(Date.now());
  const rawBody = options.body ?? JSON.stringify(event);
  const signature =
    options.signature ?? (await hmacBase64(options.secret ?? SECRET, `${timestamp}.${rawBody}`));
  const names =
    options.headerNames === "lowercase"
      ? { signature: "x-webhook-signature", timestamp: "x-webhook-timestamp" }
      : { signature: "X-Webhook-Signature", timestamp: "X-Webhook-Timestamp" };
  return new Request("https://worker.test/api/daily/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [names.signature]: signature,
      [names.timestamp]: timestamp,
    },
    body: rawBody,
  });
}

function recordingBackend(result: unknown) {
  return async (call: FetchCall): Promise<Response> => {
    if (!call.url.endsWith("/rest/v1/rpc/record_room_participant_event")) {
      throw new Error(`unexpected upstream call to ${call.url}`);
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

test("a signed participant.joined is recorded with a hashed dedupe key", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));

  const { result, lines } = await withConsole(() =>
    withFetch(recordingBackend("recorded"), async (calls) => {
      const response = await worker.fetch(request, ENV);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, processed: 1 });
      return calls;
    }),
  );
  assert.deepEqual(lines, []);
  assert.equal(result.length, 1);
  const body = result[0].body as Record<string, unknown>;
  assert.equal(body.p_room_name, ROOM);
  assert.equal(body.p_event, "participant_joined");
  assert.equal(body.p_provider, "daily");
  assert.equal(body.p_dedupe_key, await sha256Hex(`participant.joined:${SESSION}`));
  // The raw provider session id must not reach the database.
  assert.ok(!JSON.stringify(body).includes(SESSION));
});

test("a signed participant.left is recorded as leaving", async () => {
  const request = await signedRequest(presenceEvent("participant.left"));
  await withFetch(recordingBackend("recorded"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 200);
    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.p_event, "participant_left");
  });
});

test("a signature over the exact raw body is accepted", async () => {
  const event = presenceEvent("participant.joined");
  const rawBody = JSON.stringify(event, null, 2);
  const request = await signedRequest(event, { body: rawBody });
  await withFetch(recordingBackend("recorded"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 200);
  });
});

test("a modified body is rejected even with a valid signature", async () => {
  const original = presenceEvent("participant.joined");
  const timestamp = String(Date.now());
  const signature = await hmacBase64(SECRET, `${timestamp}.${JSON.stringify(original)}`);
  const tampered = {
    ...original,
    payload: { ...original.payload, session_id: "sess_tampered" },
  };
  const request = await signedRequest(tampered, { timestamp, signature });
  await withFetch(forbidden("tampered body"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_signature" });
    assert.equal(calls.length, 0);
  });
});

test("a canonicalised JSON body is not accepted as a fallback", async () => {
  const event = presenceEvent("participant.joined");
  const rawBody = JSON.stringify(event, null, 2);
  const canonical = JSON.stringify(JSON.parse(rawBody));
  assert.notEqual(canonical, rawBody, "the fixture must differ from its canonical form");
  const timestamp = String(Date.now());
  const signature = await hmacBase64(SECRET, `${timestamp}.${canonical}`);
  const request = await signedRequest(event, { body: rawBody, timestamp, signature });
  await withFetch(forbidden("canonicalised body"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_signature" });
    assert.equal(calls.length, 0);
  });
});

test("lowercase webhook headers are accepted", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"), {
    headerNames: "lowercase",
  });
  await withFetch(recordingBackend("recorded"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 200);
  });
});

test("a forged signature is rejected without touching the backend", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"), {
    signature: await hmacBase64(SECRET, "unrelated"),
  });
  await withFetch(forbidden("participant.joined"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_signature" });
    assert.equal(calls.length, 0);
  });
});

test("a signature from a different secret is rejected", async () => {
  const otherSecret = btoa("a-completely-different-signing-secret");
  const request = await signedRequest(presenceEvent("participant.joined"), {
    secret: otherSecret,
  });
  await withFetch(forbidden("participant.joined"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });
});

test("a missing timestamp header is rejected", async () => {
  const body = JSON.stringify(presenceEvent("participant.joined"));
  const signature = await hmacBase64(SECRET, `${Date.now()}.${body}`);
  const request = new Request("https://worker.test/api/daily/webhook", {
    method: "POST",
    headers: { "X-Webhook-Signature": signature },
    body,
  });
  await withFetch(forbidden("participant.joined"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
  });
});

test("a missing signature header is rejected", async () => {
  const request = new Request("https://worker.test/api/daily/webhook", {
    method: "POST",
    headers: { "X-Webhook-Timestamp": String(Date.now()) },
    body: JSON.stringify(presenceEvent("participant.joined")),
  });
  await withFetch(forbidden("participant.joined"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
  });
});

test("a stale timestamp is rejected even with a correct signature", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"), {
    timestamp: String(Date.now() - 6 * 60 * 1000),
  });
  await withFetch(forbidden("participant.joined"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
  });
});

test("a future timestamp outside the window is rejected", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"), {
    timestamp: String(Date.now() + 6 * 60 * 1000),
  });
  await withFetch(forbidden("participant.joined"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 401);
  });
});

test("a missing webhook secret keeps the endpoint inert", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));
  await withConsole(() =>
    withFetch(forbidden("participant.joined"), async (calls) => {
      const response = await worker.fetch(request, {
        ...ENV,
        DAILY_WEBHOOK_SECRET: undefined,
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: "webhook_not_configured" });
      assert.equal(calls.length, 0);
    }),
  );
});

test("a duplicate delivery is acknowledged without an error", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));
  await withFetch(recordingBackend("duplicate"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, processed: 1 });
    const body = calls[0].body as Record<string, unknown>;
    assert.equal(body.p_dedupe_key, await sha256Hex(`participant.joined:${SESSION}`));
  });
});

test("a changed event id still dedupes on the event type and session", async () => {
  const first = await signedRequest(presenceEvent("participant.joined"));
  const second = await signedRequest({
    ...presenceEvent("participant.joined"),
    id: "evt_retry_0001",
  });
  await withFetch(recordingBackend("recorded"), async (calls) => {
    await worker.fetch(first, ENV);
    await worker.fetch(second, ENV);
    const keys = calls.map((call) => (call.body as Record<string, unknown>).p_dedupe_key);
    assert.equal(keys[0], keys[1], "retries with a new event id share a dedupe key");
    assert.equal(keys[0], await sha256Hex(`participant.joined:${SESSION}`));
  });
});

test("a join and a leave for the same session are distinct", async () => {
  await withFetch(recordingBackend("recorded"), async (calls) => {
    await worker.fetch(await signedRequest(presenceEvent("participant.joined")), ENV);
    await worker.fetch(await signedRequest(presenceEvent("participant.left")), ENV);
    const keys = calls.map((call) => (call.body as Record<string, unknown>).p_dedupe_key);
    assert.notEqual(keys[0], keys[1]);
  });
});

test("an unknown room is acknowledged as unprocessed", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));
  await withConsole(() =>
    withFetch(recordingBackend("unknown_room"), async () => {
      const response = await worker.fetch(request, ENV);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, processed: 0 });
    }),
  );
});

test("non-presence events are acknowledged and not recorded", async () => {
  const request = await signedRequest(presenceEvent("recording.started"));
  await withFetch(forbidden("recording.started"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, processed: 0, ignored: true });
    assert.equal(calls.length, 0);
  });
});

test("Daily's verification probe is acknowledged", async () => {
  const request = await signedRequest({ test: "test" });
  await withFetch(forbidden("probe"), async (calls) => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, processed: 0, ignored: true });
    assert.equal(calls.length, 0);
  });
});

test("a presence event without a room is rejected", async () => {
  const request = await signedRequest(presenceEvent("participant.joined", { room: "" }));
  await withConsole(() =>
    withFetch(forbidden("participant.joined"), async (calls) => {
      const response = await worker.fetch(request, ENV);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: "invalid_payload" });
      assert.equal(calls.length, 0);
    }),
  );
});

test("a presence event without a session id is rejected", async () => {
  const request = await signedRequest(presenceEvent("participant.joined", { session_id: "" }));
  await withFetch(forbidden("participant.joined"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 400);
  });
});

test("a backend failure is reported as retryable", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));
  await withConsole(() =>
    withFetch(
      async () => new Response("boom", { status: 500 }),
      async () => {
        const response = await worker.fetch(request, ENV);
        assert.equal(response.status, 502);
        assert.deepEqual(await response.json(), { ok: false, error: "record_failed" });
      },
    ),
  );
});

test("a network failure reaching the backend is reported as retryable", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));
  await withConsole(() =>
    withFetch(
      async () => {
        throw new Error("socket closed");
      },
      async () => {
        const response = await worker.fetch(request, ENV);
        assert.equal(response.status, 502);
      },
    ),
  );
});

test("an unexpected backend result is reported as retryable", async () => {
  const request = await signedRequest(presenceEvent("participant.joined"));
  await withConsole(() =>
    withFetch(recordingBackend("something_else"), async () => {
      const response = await worker.fetch(request, ENV);
      assert.equal(response.status, 502);
    }),
  );
});

test("an empty body is rejected before verification", async () => {
  const request = new Request("https://worker.test/api/daily/webhook", {
    method: "POST",
    headers: {
      "X-Webhook-Signature": "anything",
      "X-Webhook-Timestamp": String(Date.now()),
    },
    body: "",
  });
  await withFetch(forbidden("empty"), async () => {
    const response = await worker.fetch(request, ENV);
    assert.equal(response.status, 413);
  });
});

test("logs never contain patient or room identifiers", async () => {
  const join = await signedRequest(presenceEvent("participant.joined"));
  const left = await signedRequest(presenceEvent("participant.left"));
  const invalid = await signedRequest(presenceEvent("participant.joined", { room: "" }));
  const { lines } = await withConsole(() =>
    withFetch(recordingBackend("recorded"), async () => {
      await worker.fetch(join, ENV);
      await worker.fetch(left, ENV);
    }),
  );
  const rejected = await withConsole(() =>
    withFetch(forbidden("invalid"), async () => {
      await worker.fetch(invalid, ENV);
    }),
  );
  const all = [...lines, ...rejected.lines].join("\n");
  assert.ok(all.includes("daily webhook"), "the endpoint logs its own name");
  for (const sensitive of [ROOM, SESSION, USER, "Dr. Smith", "evt_01HVK9YJ2X3Z4W5V6U7T8S9R"]) {
    assert.ok(!all.includes(sensitive), `logs must not contain ${sensitive}`);
  }
});
