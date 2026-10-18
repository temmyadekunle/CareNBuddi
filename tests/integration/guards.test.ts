import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLoopbackHost,
  makeMaskingLogger,
  maskSecrets,
  parseIntegrationTarget,
} from "./guards";

/**
 * Safeguard tests for the integration runner.
 *
 * THESE ARE NOT REAL-SUPABASE INTEGRATION RESULTS AND NEVER PROVE ANY
 * MIGRATION BEHAVIOUR. They verify only that the runner configuration layer
 * fails closed: missing opt-in, missing/invalid endpoints, remote or
 * non-loopback endpoints, missing keys, and secret masking in logs. See
 * tests/integration/README.md for the procedure that actually runs scenarios
 * against a disposable local Supabase stack.
 */

const localEnv = {
  CARENBUDDI_INTEGRATION_TESTS: "1",
  CARENBUDDI_LOCAL_STACK_CONFIRMED: "1",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "local-anon-key-0123456789abcdef",
};

describe("integration guard: fail-closed configuration", () => {
  it("refuses to run without explicit integration-test opt-in", () => {
    const r = parseIntegrationTarget({
      CARENBUDDI_LOCAL_STACK_CONFIRMED: "1",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "k",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /not opted in/i);
  });

  it("refuses a target that has not been confirmed disposable", () => {
    const r = parseIntegrationTarget({
      CARENBUDDI_INTEGRATION_TESTS: "1",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "k",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /confirmed disposable/i);
  });

  it("refuses to infer any URL when SUPABASE_URL is absent", () => {
    const r = parseIntegrationTarget({
      CARENBUDDI_INTEGRATION_TESTS: "1",
      CARENBUDDI_LOCAL_STACK_CONFIRMED: "1",
      SUPABASE_ANON_KEY: "k",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /SUPABASE_URL is not set/i);
  });

  it("rejects remote/linked endpoints outright", () => {
    for (const url of [
      "https://qwertyuiop.supabase.co",
      "https://project.supabase.net/rest/v1",
    ]) {
      const r = parseIntegrationTarget({ ...localEnv, SUPABASE_URL: url });
      assert.equal(r.ok, false, url);
      if (!r.ok) assert.match(r.reason, /remote|linked|loopback/i);
    }
  });

  it("rejects non-loopback hosts even when the host is not a remote marker", () => {
    for (const url of [
      "http://192.168.0.10:54321",
      "http://10.0.0.5:8000",
      "https://integration.example.org",
    ]) {
      const r = parseIntegrationTarget({ ...localEnv, SUPABASE_URL: url });
      assert.equal(r.ok, false, url);
      if (!r.ok) assert.match(r.reason, /loopback/i);
    }
  });

  it("rejects 127.x hostnames that are not full dotted quads", () => {
    // A prefix-shaped match would accept DNS-controlled names such as
    // `127.0.0.1.evil.com`; only exact IPv4 loopback addresses are approved.
    // (URL shorthand like `http://127.1/` is normalized by the URL parser to
    // `127.0.0.1` before the guard runs — loopback either way.)
    const r = parseIntegrationTarget({
      ...localEnv, SUPABASE_URL: "http://127.0.0.1.evil.com:54321",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /loopback/i);
    assert.equal(isLoopbackHost("127.0.0.1.evil.com"), false);
    assert.equal(isLoopbackHost("127.1"), false);
  });

  it("rejects endpoints with embedded credentials", () => {
    for (const url of [
      "http://user:hunter2@127.0.0.1:54321",
      "http://svc-token@localhost:54321",
    ]) {
      const r = parseIntegrationTarget({ ...localEnv, SUPABASE_URL: url });
      assert.equal(r.ok, false, url);
      if (!r.ok) assert.match(r.reason, /credentials/i);
    }
  });

  it("accepts the documented loopback forms only", () => {
    for (const host of ["localhost", "127.0.0.1", "127.0.0.5", "[::1]"]) {
      const r = parseIntegrationTarget({
        ...localEnv,
        SUPABASE_URL: `http://${host}:54321`,
      });
      assert.equal(r.ok, true, host);
    }
    assert.equal(isLoopbackHost("[1234:5678::1]"), false);
    assert.equal(isLoopbackHost("supabase.co"), false);
  });

  it("refuses to run when the anon key is missing", () => {
    const r = parseIntegrationTarget({
      CARENBUDDI_INTEGRATION_TESTS: "1",
      CARENBUDDI_LOCAL_STACK_CONFIRMED: "1",
      SUPABASE_URL: "http://127.0.0.1:54321",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /SUPABASE_ANON_KEY is not set/i);
  });

  it("refuses a service-role key identical to the anon key", () => {
    const r = parseIntegrationTarget({
      ...localEnv,
      SUPABASE_SERVICE_ROLE_KEY: localEnv.SUPABASE_ANON_KEY,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /identical/i);
  });
});

describe("integration guard: secret redaction", () => {
  it("masks configured keys before they reach logs", () => {
    const secret = "local-anon-key-0123456789abcdef";
    const masked = maskSecrets(`anon client key = ${secret}`, [secret]);
    assert.equal(masked.includes(secret), false, "full key must never survive");
    assert.match(masked, /loca\.\.\.cdef/);
  });

  it("masks bearer tokens and sb_secret_ values in arbitrary error text", () => {
    const text =
      "request failed: Authorization: bearer ey.abcdefgh.ijklmnop inline and sb_secret_StaticFields gone";
    const out = maskSecrets(text, []);
    assert.equal(out.includes("ey.abcdefgh"), false);
    assert.equal(out.includes("sb_secret_StaticFields"), false);
    assert.match(out, /<redacted>/);
  });

  it("fully redacts configured secrets too short to stub safely", () => {
    const secret = "k9";
    const out = maskSecrets(`key = ${secret}`, [secret]);
    assert.equal(out.includes(secret), false, "short secret must never survive");
    assert.match(out, /\[redacted\]/);
  });

  it("passes ordinary messages through untouched", () => {
    const before = "postgres://not-a-secret-host.log 54321 open";
    assert.equal(maskSecrets(before, []), before);
  });
});

describe("integration guard: log masking", () => {
  it("the masked logger wrapper produces the same masking for console output", () => {
    const secret = "0123456789abcdefghijklmn";
    const logger = makeMaskingLogger([secret, undefined]);
    const printed: string[] = [];
    const original = console.log;
    try {
      console.log = (...parts: unknown[]) => printed.push(parts.join(" "));
      logger(`service key ${secret} was handed to setup`);
    } finally {
      console.log = original;
    }
    const line = printed.join("\n");
    assert.equal(line.includes(secret), false);
    assert.match(line, /\.\.\.kilm|0123\.\.\./);
  });
});
