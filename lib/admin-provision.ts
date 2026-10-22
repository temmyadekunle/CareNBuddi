/**
 * First-administrator provisioning boundary.
 *
 * Runs inside the Cloudflare Worker only (like everything server-side in this
 * project — the app itself is a static export, migration 0003:190-199 makes
 * `grant_role()` reachable solely through the Worker's service-role
 * credential, and until now no caller ever shipped, so no real administrator
 * could exist).
 *
 * Authorisation model, fail-closed at every step:
 *
 *   1. Configuration: all four server-only settings must be present, the
 *      allow-list must be non-empty; otherwise 503 and nothing else happens.
 *   2. Bearer secret: the request must carry `ADMIN_PROVISIONING_KEY`; the
 *      comparison hashes both sides (SHA-256 via WebCrypto) so digest-length
 *      timing cannot probe the secret. Wrong or missing token is an
 *      indistinguishable 403.
 *   3. Role: only "admin" may be requested. This endpoint exists to create
 *      administrators; nothing else rides along.
 *   4. Allow-list: normalized email must already appear (case-insensitively)
 *      in `ADMIN_EMAIL_ALLOWLIST`. A non-allow-listed email never reaches the
 *      database, so the endpoint cannot be used to enumerate accounts.
 *   5. Database: the profile is looked up via the service-role client and
 *      the role change is applied by the audited `grant_role()` function
 *      (migration 0003), which double-checks service_role and refuses
 *      unknown roles and unknown users.
 *
 * No secrets, tokens or personal data are ever logged or echoed; responses
 * carry only booleans and coarse reasons.
 */

import { createClient } from "@supabase/supabase-js";

export interface AdminGrantEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  ADMIN_PROVISIONING_KEY?: string;
  ADMIN_EMAIL_ALLOWLIST?: string;
}

/** The one role a provisioning call may request. */
export const PROVISIONABLE_ROLE = "admin";

const MAX_BODY_CHARS = 512;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Case-folded, trimmed, shape-checked email, or null when not plausible. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 320) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}

/** "a@b.test, c@d.test" -> Set of lowercased addresses. */
export function parseAllowList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** "Bearer <token>" -> token, or null. */
export function bearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue);
  const token = match?.[1].trim();
  return token ? token : null;
}

/**
 * Equality check that does not leak byte-for-byte agreement in its timing.
 * Both inputs are hashed first, so comparisons are always over equal-length
 * digests; the reference implementation hashes then compares, exactly as
 * this one does.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (typeof crypto === "undefined" || !crypto?.subtle) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  const hexLeft = toHex(left);
  const hexRight = toHex(right);
  let diff = 0;
  for (let i = 0; i < hexLeft.length; i += 1) diff |= hexLeft.charCodeAt(i) ^ hexRight.charCodeAt(i);
  return diff === 0 && hexLeft.length === hexRight.length;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Sanitised upstream detail for logs: shape only, never values. */
function describeError(error: { message?: unknown } | null | undefined): string {
  const message = typeof error?.message === "string" ? error.message : "";
  return message.slice(0, 200).replace(/[\r\n]/g, " ");
}

export async function handleAdminGrantRole(request: Request, env: AdminGrantEnv): Promise<Response> {
  /* 1. Configuration — absent settings fail closed before anything else. */
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_KEY ||
    !env.ADMIN_PROVISIONING_KEY ||
    parseAllowList(env.ADMIN_EMAIL_ALLOWLIST).size === 0
  ) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  /* 2. Bearer secret, time-safely compared. */
  const token = bearerToken(request.headers.get("authorization"));
  const authorized = token && (await timingSafeEqual(token, env.ADMIN_PROVISIONING_KEY));
  if (!authorized) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (bodyText.length > MAX_BODY_CHARS) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  /* 3. Role is pinned to "admin"; every other request is rejected as a
     malformed request, without revealing what else might be possible. */
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const email = normalizeEmail(record.email);
  if (!email || record.role !== PROVISIONABLE_ROLE) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  /* 4. The allow-list is the whole point: requests outside it never touch
     the database, so this endpoint cannot be used to discover accounts. */
  if (!parseAllowList(env.ADMIN_EMAIL_ALLOWLIST).has(email)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  /* 5. Service-role lookup and audited grant. */
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error(`admin-grant lookup_failed status=${lookupError.code ?? ""}`);
    return json({ ok: false, error: "upstream_error" }, 502);
  }
  if (!profile || typeof profile.id !== "string") {
    return json({ ok: false, error: "not_found" }, 404);
  }

  const { error: grantError } = await supabase.rpc("grant_role", {
    p_user: profile.id,
    p_role: PROVISIONABLE_ROLE,
  });
  if (grantError) {
    console.error(`admin-grant grant_failed status=${describeError(grantError)}`);
    return json({ ok: false, error: "upstream_error" }, 502);
  }

  const previousRole = typeof profile.role === "string" ? profile.role : "unknown";
  return json({ ok: true, appliedRole: PROVISIONABLE_ROLE, changed: previousRole !== PROVISIONABLE_ROLE });
}
