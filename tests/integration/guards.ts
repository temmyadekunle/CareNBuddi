/**
 * Integration-test environment guard.
 *
 * Pure functions, no network. Every other module in tests/integration goes
 * through `parseIntegrationTarget` before touching Supabase, and through
 * `makeMaskingLogger` before printing anything: the runner must fail *closed*
 * unless the target is simultaneously
 *
 *   1. explicitly opted into (CARENBUDDI_INTEGRATION_TESTS=1),
 *   2. explicitly confirmed disposable, started locally for this repo
 *      (CARENBUDDI_LOCAL_STACK_CONFIRMED=1),
 *   3. a positively loopback endpoint (localhost / 127.x / ::1 / *.localhost),
 *   4. carrying an anon key.
 *
 * Constants (SERVICE_ROLE etc.) never default the URL to anything and never
 * fall back to a remote endpoint: an absent localhost URL is a hard failure,
 * not a redirect to a "reasonable" alternative.
 */

/** Remote-host fragments that must never appear in an approved endpoint. */
const REMOTE_HOST_MARKERS = ["supabase.co", "supabase.in", "supabase.net", "supabase.com"];

/** Only loopback hosts can ever be a disposable local stack. */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // `127.` requires a full dotted quad: a bare prefix would also accept
  // DNS-controlled names such as `127.0.0.1.evil.com`, which is not loopback
  // by any guarantee a test runner can rely on.
  return (
    h === "localhost" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    h === "::1" ||
    h.endsWith(".localhost")
  );
}

export interface IntegrationConfig {
  /** Local stack endpoint, loopback only. */
  url: URL;
  /** Anonymous key of the local stack; printed nowhere. */
  anonKey: string;
  /** service_role key of the local stack; optional; setup/teardown only. */
  serviceKey: string | null;
}

export type GuardResult =
  | { ok: true; value: IntegrationConfig }
  | { ok: false; reason: string };

/**
 * Validates the process environment for a real-service integration run.
 * `env` is injected so safeguard tests can exercise every failure mode
 * without touching the real environment.
 */
export function parseIntegrationTarget(env: Record<string, string | undefined>): GuardResult {
  if (env.CARENBUDDI_INTEGRATION_TESTS !== "1") {
    return {
      ok: false,
      reason:
        "Integration mode is not opted in. Set CARENBUDDI_INTEGRATION_TESTS=1 for the run; otherwise this suite refuses to talk to anything.",
    };
  }
  if (env.CARENBUDDI_LOCAL_STACK_CONFIRMED !== "1") {
    return {
      ok: false,
      reason:
        "The target has not been confirmed disposable. Start the stack from this repository with `npx supabase start` (documented in tests/integration/README.md), then set CARENBUDDI_LOCAL_STACK_CONFIRMED=1 explicitly for the run.",
    };
  }
  const rawUrl = env.SUPABASE_URL ?? "";
  if (!rawUrl) {
    // Deliberately NOT defaulting to any URL, local or remote.
    return {
      ok: false,
      reason:
        "SUPABASE_URL is not set. Run `npx supabase status` for the local stack and pass its URL explicitly; this suite never guesses an endpoint.",
    };
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "SUPABASE_URL is not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `SUPABASE_URL must be http(s), got ${url.protocol}` };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      reason:
        "SUPABASE_URL must not embed credentials (user:pass@host). Keys are configured via SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY only.",
    };
  }
  if (!isLoopbackHost(url.hostname)) {
    return {
      ok: false,
      reason: `SUPABASE_URL must point at the local stack (loopback only). This endpoint's host is not loopback, so it cannot be confirmed disposable.`,
    };
  }
  const host = `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  if (REMOTE_HOST_MARKERS.some((m) => url.hostname.toLowerCase().includes(m))) {
    return {
      ok: false,
      reason: `SUPABASE_URL references a remote/linked project (${host}); linked/remote projects are prohibited for this suite.`,
    };
  }
  const anonKey = env.SUPABASE_ANON_KEY ?? "";
  if (!anonKey) {
    return {
      ok: false,
      reason:
        "SUPABASE_ANON_KEY is not set. Take both values from `npx supabase status`; this suite never invents keys.",
    };
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY === anonKey) {
    return {
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY must not be identical to the anon key.",
    };
  }
  return {
    ok: true,
    value: {
      url,
      anonKey,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || null,
    },
  };
}

/**
 * Masks every secret value the runner may have been handed. The logger passes
 * all output through this helper: token-like values are cut to a prefix-suffix
 * stub at most, whole anon/service keys never survive verbatim, and secrets
 * too short to stub safely (below eight characters) are fully replaced.
 */
export function maskSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (!s || !out.includes(s)) continue;
    if (s.length >= 8) {
      out = out.split(s).join(`${s.slice(0, 4)}...${s.slice(-4)}`);
    } else {
      out = out.split(s).join("[redacted]");
    }
  }
  // Bearer tokens from any shape of error text.
  out = out.replace(/bearer\s+[A-Za-z0-9._-]{16,}/gi, "bearer <redacted>");
  out = out.replace(/sb_secret_[A-Za-z0-9_]+/g, "sb_secret_<redacted>");
  return out;
}

/**
 * A console-log wrapper that refuses to print any configured secret verbatim.
 */
export function makeMaskingLogger(
  secrets: (string | null | undefined)[],
): (msg: string, ...rest: unknown[]) => void {
  const redacted = secrets.filter((s): s is string => typeof s === "string" && s.length >= 4);
  const emit = (line: string) => console.log(maskSecrets(line, redacted));
  return (msg: string, ...rest: unknown[]) => {
    let line = msg;
    if (rest.length > 0) {
      line = `${msg} ${rest.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join(" ")}`;
    }
    emit(line);
  };
}
