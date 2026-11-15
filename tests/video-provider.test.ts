import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_API_BASE,
  VideoProviderError,
  createJoinTicket,
  dailyRoomUrl,
  normalizeDailyDomain,
  videoConfigured,
} from "../lib/video-provider";

/**
 * The adapter is the only place the video API key is used. These tests pin the
 * two properties that matter most: an unconfigured server fails closed, and a
 * configured server creates a private two-person room with a short-lived,
 * scoped token instead of a permanent public URL.
 */

const ROOM = `cnb-${"a".repeat(32)}`;
const CONFIG = { apiKey: "daily-key", domain: "carenbuddi.daily.co" };

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { impl, calls };
}

function bodyOf(call: Call): Record<string, unknown> {
  return JSON.parse(String(call.init.body ?? "{}")) as Record<string, unknown>;
}

function happyHandler(call: Call): Response {
  if (call.init.method === "GET") return new Response(null, { status: 404 });
  if (call.url.endsWith("/rooms")) return new Response("{}", { status: 200 });
  if (call.url.endsWith("/meeting-tokens")) {
    return new Response(JSON.stringify({ token: "tok_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(null, { status: 500 });
}

function future(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

function request(over: Partial<Parameters<typeof createJoinTicket>[0]> = {}) {
  return {
    roomName: ROOM,
    displayName: "Amina Yusuf",
    isOwner: false,
    tokenExpiresAt: future(900),
    roomExpiresAt: future(1500),
    ...over,
  };
}

test("videoConfigured requires both key and domain", () => {
  assert.equal(videoConfigured({}), false);
  assert.equal(videoConfigured({ apiKey: "key" }), false);
  assert.equal(videoConfigured({ domain: "team.daily.co" }), false);
  assert.equal(videoConfigured({ apiKey: "  ", domain: "team.daily.co" }), false);
  assert.equal(videoConfigured(CONFIG), true);
});

test("normalizeDailyDomain accepts hosts, URLs and bare subdomains", () => {
  assert.equal(normalizeDailyDomain("team.daily.co"), "team.daily.co");
  assert.equal(normalizeDailyDomain("https://team.daily.co/"), "team.daily.co");
  assert.equal(normalizeDailyDomain("https://team.daily.co/path?x=1"), "team.daily.co");
  assert.equal(normalizeDailyDomain("TEAM.DAILY.CO"), "team.daily.co");
  assert.equal(normalizeDailyDomain("team"), "team.daily.co");
  assert.equal(normalizeDailyDomain(""), "");
  assert.equal(normalizeDailyDomain("   "), "");
});

test("dailyRoomUrl rejects a missing domain and builds the room URL otherwise", () => {
  assert.throws(
    () => dailyRoomUrl("", ROOM),
    (err: unknown) => err instanceof VideoProviderError && err.code === "not_configured",
  );
  assert.equal(dailyRoomUrl("team", ROOM), `https://team.daily.co/${ROOM}`);
});

test("createJoinTicket fails closed without credentials", async () => {
  const { impl, calls } = fakeFetch(happyHandler);
  await assert.rejects(
    createJoinTicket(request(), {}, impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "not_configured",
  );
  assert.equal(calls.length, 0);
});

test("createJoinTicket rejects a room name it did not generate", async () => {
  const { impl, calls } = fakeFetch(happyHandler);
  await assert.rejects(
    createJoinTicket(request({ roomName: "public-room" }), CONFIG, impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "invalid_room",
  );
  assert.equal(calls.length, 0);
});

test("createJoinTicket refuses a token that is already expiring", async () => {
  const { impl, calls } = fakeFetch(happyHandler);
  const now = Math.floor(Date.now() / 1000);

  await assert.rejects(
    createJoinTicket(request({ tokenExpiresAt: now + 30, roomExpiresAt: now + 600 }), CONFIG, impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "token_failed",
  );
  await assert.rejects(
    createJoinTicket(request({ tokenExpiresAt: now + 900, roomExpiresAt: now + 900 }), CONFIG, impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "token_failed",
  );
  assert.equal(calls.length, 0);
});

test("a new room is private, two-person and has chat and screenshare disabled", async () => {
  const { impl, calls } = fakeFetch(happyHandler);
  const req = request();
  const ticket = await createJoinTicket(req, CONFIG, impl);

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, `${DAILY_API_BASE}/rooms/${ROOM}`);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, `${DAILY_API_BASE}/rooms`);
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[2].url, `${DAILY_API_BASE}/meeting-tokens`);

  const room = bodyOf(calls[1]);
  assert.equal(room.name, ROOM);
  assert.equal(room.privacy, "private");
  const properties = room.properties as Record<string, unknown>;
  assert.equal(properties.exp, req.roomExpiresAt);
  assert.equal(properties.eject_at_room_exp, true);
  assert.equal(properties.max_participants, 2);
  assert.equal(properties.enable_chat, false);
  assert.equal(properties.enable_screenshare, false);
  assert.equal("recordings" in properties || "enable_recording" in properties, false);

  const token = bodyOf(calls[2]);
  const tokenProperties = token.properties as Record<string, unknown>;
  assert.equal(tokenProperties.room_name, ROOM);
  assert.equal(tokenProperties.user_name, "Amina Yusuf");
  assert.equal(tokenProperties.is_owner, false);
  assert.equal(tokenProperties.exp, req.tokenExpiresAt);
  assert.equal(tokenProperties.enable_screenshare, false);

  assert.equal(ticket.url, `https://carenbuddi.daily.co/${ROOM}`);
  assert.equal(ticket.token, "tok_123");
  assert.equal(ticket.expiresAt, new Date(req.tokenExpiresAt * 1000).toISOString());
});

test("an existing room is reused instead of created again", async () => {
  const { impl, calls } = fakeFetch((call) => {
    if (call.init.method === "GET") return new Response("{}", { status: 200 });
    return new Response(JSON.stringify({ token: "tok_123" }), { status: 200 });
  });

  await createJoinTicket(request(), CONFIG, impl);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, `${DAILY_API_BASE}/meeting-tokens`);
});

test("room lookup or creation failures are reported as room_failed", async () => {
  const getFails = fakeFetch(() => new Response(null, { status: 500 }));
  await assert.rejects(
    createJoinTicket(request(), CONFIG, getFails.impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "room_failed",
  );

  const createFails = fakeFetch((call) =>
    call.init.method === "GET"
      ? new Response(null, { status: 404 })
      : new Response(null, { status: 400 }),
  );
  await assert.rejects(
    createJoinTicket(request(), CONFIG, createFails.impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "room_failed",
  );

  const networkFails = fakeFetch(() => {
    throw new Error("offline");
  });
  await assert.rejects(
    createJoinTicket(request(), CONFIG, networkFails.impl),
    (err: unknown) => err instanceof VideoProviderError && err.code === "room_failed",
  );
});

test("token failures never produce a join ticket", async () => {
  for (const response of [
    new Response(null, { status: 500 }),
    new Response("not json", { status: 200 }),
    new Response(JSON.stringify({}), { status: 200 }),
    new Response(JSON.stringify({ token: "" }), { status: 200 }),
  ]) {
    const { impl } = fakeFetch((call) => {
      if (call.init.method === "GET") return new Response("{}", { status: 200 });
      return response.clone();
    });
    await assert.rejects(
      createJoinTicket(request(), CONFIG, impl),
      (err: unknown) => err instanceof VideoProviderError && err.code === "token_failed",
    );
  }
});

test("the participant name is cleaned and truncated before it reaches Daily", async () => {
  const { impl, calls } = fakeFetch(happyHandler);
  await createJoinTicket(request({ displayName: "  Dr \u0000 Mensah  " }), CONFIG, impl);
  assert.equal((bodyOf(calls[2]).properties as Record<string, unknown>).user_name, "Dr Mensah");

  const long = fakeFetch(happyHandler);
  await createJoinTicket(request({ displayName: "x".repeat(200) }), CONFIG, long.impl);
  assert.equal(
    ((bodyOf(long.calls[2]).properties as Record<string, unknown>).user_name as string).length,
    80,
  );

  const empty = fakeFetch(happyHandler);
  await createJoinTicket(request({ displayName: "   " }), CONFIG, empty.impl);
  assert.equal(
    (bodyOf(empty.calls[2]).properties as Record<string, unknown>).user_name,
    "CareNBuddi participant",
  );
});
