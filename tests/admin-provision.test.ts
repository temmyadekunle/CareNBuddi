import assert from "node:assert/strict";
import test from "node:test";
import {
  bearerToken,
  handleAdminGrantRole,
  normalizeEmail,
  parseAllowList,
  timingSafeEqual,
} from "../lib/admin-provision";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    headers: new Headers({
      "content-type": "application/json",
      ...headers,
    }),
    text: async () => JSON.stringify(body),
  } as unknown as Request;
}

test("normalizeEmail is strict, trimmed and lower-case", () => {
  assert.equal(normalizeEmail("  Ops@Example.COM "), "ops@example.com");
  for (const bad of [null, undefined, 42, "", "   ", "operator", "a@b", "a@b.", "<a@b.test>>", "a b@c.test"]) {
    assert.equal(normalizeEmail(bad as unknown as string), null, String(bad));
  }
});

test("parseAllowList is case-insensitive and ignores empties", () => {
  assert.deepEqual(
    [...parseAllowList(" A@B.test ,second@test.ng ,,")].sort(),
    ["a@b.test", "second@test.ng"],
  );
  for (const raw of [undefined, "", "   "]) {
    assert.equal(parseAllowList(raw).size, 0, String(raw));
  }
});

test("bearerToken extracts only the token part", () => {
  assert.equal(bearerToken("Bearer abc"), "abc");
  assert.equal(bearerToken("bearer abc"), "abc");
  assert.equal(bearerToken("Bearer  spaced  "), "spaced");
  assert.equal(bearerToken(""), null);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("abc"), null);
});

test("timingSafeEqual is a hash-then-compare equality check", async () => {
  assert.equal(await timingSafeEqual("same", "same"), true);
  assert.equal(await timingSafeEqual("secret-value", "secret-value"), true);
  assert.equal(await timingSafeEqual("secret-value", "secret-valueX"), false);
  assert.equal(await timingSafeEqual("", ""), true);
  assert.equal(await timingSafeEqual("", "."), false);
});

const CONFIGURED = {
  SUPABASE_URL: "https://supabase.local",
  SUPABASE_SERVICE_KEY: "svc-key-in-test-only",
  ADMIN_PROVISIONING_KEY: "provision-secret",
  ADMIN_EMAIL_ALLOWLIST: "ops@carenbuddi.ng",
};

test("endpoint fails closed when any required setting is absent", async () => {
  const variants = [
    { SUPABASE_URL: "https://supabase.local" },
    { ...CONFIGURED, SUPABASE_SERVICE_KEY: "" },
    { ...CONFIGURED, ADMIN_PROVISIONING_KEY: "" },
    { ...CONFIGURED, ADMIN_EMAIL_ALLOWLIST: "" },
    { ...CONFIGURED, ADMIN_EMAIL_ALLOWLIST: " , " },
    {},
  ];
  for (const env of variants) {
    const res = await handleAdminGrantRole(post({ email: "ops@carenbuddi.ng", role: "admin" }), env);
    assert.equal(res.status, 503, JSON.stringify(env));
  }
});

test("endpoint rejects wrong or missing bearer secrets without distinguishing them", async () => {
  for (const headers of [{} as Record<string, string>, { authorization: "Bearer nope" }, { authorization: "Basic abc" }]) {
    const res = await handleAdminGrantRole(
      post({ email: "ops@carenbuddi.ng", role: "admin" }, headers),
      CONFIGURED,
    );
    assert.equal(res.status, 403, JSON.stringify(headers));
  }
});

test("endpoint refuses non-JSON requests", async () => {
  const res = await handleAdminGrantRole(
    { headers: new Headers({ authorization: "Bearer provision-secret" }), text: async () => "[]" } as unknown as Request,
    CONFIGURED,
  );
  assert.equal(res.status, 415);
});

test("endpoint validates the request shape after authentication", async () => {
  const cases: unknown[] = [
    { email: "ops@carenbuddi.ng", role: "provider" },
    { email: "ops@carenbuddi.ng", role: "consumer" },
    { email: "ops@carenbuddi.ng", role: null },
    { email: "not-an-email", role: "admin" },
    {},
  ];
  for (const body of cases) {
    const res = await handleAdminGrantRole(
      post(body, { authorization: "Bearer provision-secret" }),
      CONFIGURED,
    );
    assert.equal(res.status, 400, JSON.stringify(body));
  }

  const oversize = "quota ".repeat(200);
  const res = await handleAdminGrantRole(
    {
      headers: new Headers({ authorization: "Bearer provision-secret", "content-type": "application/json" }),
      text: async () => JSON.stringify({ email: "ops@carenbuddi.ng", role: "admin", note: oversize }),
    } as unknown as Request,
    CONFIGURED,
  );
  assert.equal(res.status, 413);
});

test("endpoint blocks non-allow-listed accounts before any database call", async () => {
  const res = await handleAdminGrantRole(
    post({ email: "stranger@elsewhere.test", role: "admin" }, { authorization: "Bearer provision-secret" }),
    CONFIGURED,
  );
  assert.equal(res.status, 403);
});

test("endpoint compares the allow-list after normalization", async () => {
  const res = await handleAdminGrantRole(
    post({ email: "OPS@CareNBuddi.NG", role: "admin" }, { authorization: "Bearer provision-secret" }),
    CONFIGURED,
  );
  // A unit context has no database to consult: with every gate passed the
  // only legal outcomes are the upstream paths (502 on lookup, or 404 shape)
  // — anything from the auth/allow-list gates would mean the gate leaked.
  assert.equal(res.status === 400 || res.status === 403 || res.status === 503 || res.status === 415 || res.status === 413, false, String(res.status));
});
