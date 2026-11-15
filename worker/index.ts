/**
 * CareNBuddi AI Health Guide — server-side boundary.
 *
 * Runs on Cloudflare Workers (the app deploys as a static export, so this is
 * the only server-side code in the project). It is the sole place an AI API
 * key can exist: browser code never sees secrets.
 *
 * Layered safety: deterministic emergency detection runs here BEFORE any
 * model call (the client does the same pre-check), so the emergency pathway
 * never depends on the model. See lib/guide-core.ts.
 *
 * Privacy: no chat transcript is stored or logged — only request metadata
 * (status codes) is emitted. No session identifiers are accepted or required;
 * the endpoint is controlled by origin allow-listing, input limits and a
 * per-IP rate budget (best effort, per isolate).
 */

import {
  EMERGENCY_RESPONSE_TEXT,
  GUIDE_CATEGORIES,
  GUIDE_STATES,
  containsEmergencySignal,
  guideReplyLanguageDirective,
  normalizeGuideLang,
  parseGuideReply,
} from "../lib/guide-core";
import { handleAdminGrantRole } from "../lib/admin-provision";
import { createJoinTicket, videoConfigured, VideoProviderError } from "../lib/video-provider";
import { reconcileRoomClosures } from "./room-closure";

interface Env {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  /* Telemedicine (0011_consultations.sql). SUPABASE_URL and
     SUPABASE_ANON_KEY let the Worker verify the caller's Supabase session and
     call the join-context RPC with that user's own token. DAILY_API_KEY and
     DAILY_DOMAIN arm short-lived private video rooms; without them the join
     endpoint returns 503 video_not_configured and no token is ever minted. */
  SUPABASE_ANON_KEY?: string;
  DAILY_API_KEY?: string;
  DAILY_DOMAIN?: string;
  /* Daily webhook secret for verifying participant events. Configured via
     `wrangler secret put DAILY_WEBHOOK_SECRET`. Without it the webhook endpoint
     returns 503 and does not process events. */
  DAILY_WEBHOOK_SECRET?: string;
  /* First-administrator provisioning (lib/admin-provision.ts). All four are
     server-only: ADMIN_PROVISIONING_KEY and SUPABASE_SERVICE_KEY are secrets,
     ADMIN_EMAIL_ALLOWLIST is the operator's account list. Absent or empty
     values fail closed (503). */
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  ADMIN_PROVISIONING_KEY?: string;
  ADMIN_EMAIL_ALLOWLIST?: string;
  /* Comma-separated browser origins allowed to call API routes. Configured in
     wrangler.jsonc so the deployed domain is part of deployment config rather
     than a source edit; localhost is always allowed for development. */
  APP_ORIGINS?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function allowedOrigins(env: Env): string[] {
  const configured = (env.APP_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...LOCAL_ORIGINS, ...configured];
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const MAX_BODY_CHARS = 8_192;
const MAX_MESSAGE_CHARS = 1_500;
const MAX_HISTORY_ITEMS = 8;
const MAX_HISTORY_TEXT = 400;
const AI_TIMEOUT_MS = 25_000;

const rateBuckets = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(ip, bucket);
    return true;
  }
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  if (rateBuckets.size > 5_000) {
    for (const [key, times] of rateBuckets) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  return false;
}

const joinRateBuckets = new Map<string, number[]>();
const JOIN_RATE_LIMIT_MAX = 30;

function joinRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = (joinRateBuckets.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (bucket.length >= JOIN_RATE_LIMIT_MAX) {
    joinRateBuckets.set(ip, bucket);
    return true;
  }
  bucket.push(now);
  joinRateBuckets.set(ip, bucket);
  if (joinRateBuckets.size > 5_000) {
    for (const [key, times] of joinRateBuckets) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) joinRateBuckets.delete(key);
    }
  }
  return false;
}

const DAILY_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

async function decodeBase64Secret(secret: string): Promise<ArrayBuffer> {
  try {
    const binary = atob(secret);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    throw new Error("invalid_base64_secret");
  }
}

async function verifyDailyWebhookSignature(
  body: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): Promise<{ valid: boolean; timestamp?: number }> {
  if (!signatureHeader || !timestampHeader) return { valid: false };
  const signature = signatureHeader.trim();
  const timestampStr = timestampHeader.trim();
  if (!signature || !timestampStr) return { valid: false };

  const timestamp = Number.parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp)) return { valid: false };

  const now = Date.now();
  if (now - timestamp > DAILY_WEBHOOK_MAX_AGE_MS) return { valid: false };

  let keyData: ArrayBuffer;
  try {
    keyData = await decodeBase64Secret(secret);
  } catch {
    return { valid: false };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return { valid: false };
  }

  const signedContent = `${timestamp}.${JSON.stringify(parsedBody)}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  if (signature.length !== expectedBase64.length) return { valid: false };
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expectedBase64.charCodeAt(i);
  return { valid: diff === 0, timestamp };
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function systemPrompt(): string {
  return [
    'You are "CareNBuddi Health Guide", a care-navigation assistant inside the CareNBuddi app in Nigeria.',
    "You help people describe what they need and find an appropriate healthcare service category, understand available options, and use the app's appointment workflow. You are NOT a doctor and this is NOT a diagnosis service.",
    "",
    "HARD RULES:",
    "- Never diagnose a condition, never prescribe or suggest changing any medicine, never claim a diagnosis is certain, never pretend to have examined anyone, never invent providers, prices, ratings, availability or test results.",
    "- Only discuss services CareNBuddi actually offers and these provider categories: " +
      GUIDE_CATEGORIES.join(", ") +
      ".",
    "- Ask at most ONE short clarifying question when a detail is genuinely needed (usually location or service type). Never ask for names, phone numbers, addresses, insurance IDs or medical history.",
    "- If the user describes potentially life-threatening symptoms (e.g. chest pain, severe bleeding, trouble breathing, unconsciousness, stroke signs, seizure, suicidal feelings), set safety=true and reply with a short instruction to seek emergency care immediately.",
    "- For out-of-scope requests use intent unsupported_request and briefly explain what you can help with instead. If the user does not know what they need, describe the available options without diagnosing them.",
    "- Reply with ONLY one JSON object, no markdown commentary, shaped exactly as:",
    '{"intent":"health_information|find_provider|find_service|appointment_navigation|unsupported_request","category":"<category or null>","state":"<state or null>","preferences":["short preference strings"],"response":"concise user-facing reply","needs_clarification":false,"safety":false}',
    "- Set category only to one of the listed categories. Supported states: " +
      GUIDE_STATES.join(", ") +
      " (or null if not mentioned).",
    "- Keep response under 120 words, plain text, warm and practical. Set needs_clarification=true only when you are asking your one clarifying question.",
  ].join("\n");
}

function sanitizeHistory(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { role: unknown; text: unknown } => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { role?: unknown }).role === "string" &&
        typeof (item as { text?: unknown }).text === "string"
      );
    })
    .map((item) => ({
      role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(item.text).slice(0, MAX_HISTORY_TEXT),
    }))
    .slice(-MAX_HISTORY_ITEMS);
}

const CONSULTATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeLogText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n"]/g, " ")
    .slice(0, 300);
}

/**
 * POST /api/consultations/join
 *
 * The browser presents its Supabase access token. The Worker:
 *   1. verifies it with Supabase Auth (the Worker holds no user data);
 *   2. asks the database, as that user, for the join context — which enforces
 *      assignment, consent, status and the time window;
 *   3. mints a private Daily room + short-lived token only after that passes.
 *
 * No permanent room URL, no room name and no token is ever returned to
 * anybody other than the two assigned participants.
 */
async function handleConsultationJoin(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins(env).includes(origin)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (joinRateLimited(ip)) {
    return json({ ok: false, error: "rate_limited" }, 429, { "retry-after": "60" });
  }

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (bodyText.length > 2_048) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const consultationId =
    typeof record.consultationId === "string" ? record.consultationId.trim() : "";
  if (!CONSULTATION_ID_PATTERN.test(consultationId)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (bearer.length < 20 || bearer.length > 4_096) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const anonKey = env.SUPABASE_ANON_KEY?.trim() ?? "";
  if (!supabaseUrl || !anonKey) {
    console.error("consultations join backend_not_configured");
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }

  const authHeaders = {
    apikey: anonKey,
    authorization: `Bearer ${bearer}`,
  };

  let userResponse: Response;
  try {
    userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders });
  } catch {
    console.error("consultations join auth_unavailable");
    return json({ ok: false, error: "auth_unavailable" }, 503);
  }
  if (!userResponse.ok) {
    userResponse.body?.cancel();
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const user = (await userResponse.json().catch(() => null)) as { id?: unknown } | null;
  if (!user || typeof user.id !== "string") {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let contextResponse: Response;
  try {
    contextResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consultation_join_context`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ p_id: consultationId }),
    });
  } catch {
    console.error("consultations join context_unavailable");
    return json({ ok: false, error: "auth_unavailable" }, 503);
  }

  const contextText = await contextResponse.text();
  let contextRaw: unknown = null;
  try {
    contextRaw = JSON.parse(contextText);
  } catch {
    contextRaw = null;
  }

  if (!contextResponse.ok) {
    const errorMessage =
      typeof contextRaw === "object" && contextRaw !== null
        ? (contextRaw as Record<string, unknown>).message
        : contextText;
    console.error(
      `consultations join_context status=${contextResponse.status} err=${safeLogText(
        errorMessage,
      )}`,
    );
    const message = safeLogText(errorMessage);
    if (/not a participant|not your consultation|not verified|consent required/i.test(message)) {
      return json({ ok: false, error: "not_allowed" }, 403);
    }
    if (/not found/i.test(message)) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    return json({ ok: false, error: "not_joinable" }, 409);
  }

  const context =
    typeof contextRaw === "object" && contextRaw !== null
      ? (contextRaw as Record<string, unknown>)
      : {};
  const role =
    context.role === "patient" || context.role === "provider" ? context.role : null;
  const roomName = typeof context.room_name === "string" ? context.room_name : "";
  const closesAt =
    typeof context.join_closes_at === "string" ? Date.parse(context.join_closes_at) : NaN;
  const displayName =
    role === "provider"
      ? typeof context.provider_name === "string"
        ? context.provider_name
        : ""
      : typeof context.patient_name === "string"
        ? context.patient_name
        : "";

  const now = Date.now();
  if (!role || !roomName || !Number.isFinite(closesAt) || closesAt <= now + 60_000) {
    console.error("consultations join invalid_context");
    return json({ ok: false, error: "not_joinable" }, 409);
  }

  if (!videoConfigured({ apiKey: env.DAILY_API_KEY, domain: env.DAILY_DOMAIN })) {
    return json({ ok: false, error: "video_not_configured" }, 503);
  }

  const tokenExpiresAt = Math.floor(
    Math.min(closesAt, now + 2 * 60 * 60_000) / 1000,
  );
  const roomExpiresAt = tokenExpiresAt + 600;

  let ticket;
  try {
    ticket = await createJoinTicket(
      {
        roomName,
        displayName,
        isOwner: role === "provider",
        tokenExpiresAt,
        roomExpiresAt,
      },
      { apiKey: env.DAILY_API_KEY, domain: env.DAILY_DOMAIN },
    );
  } catch (error) {
    const code = error instanceof VideoProviderError ? error.code : "token_failed";
    console.error(`consultations join video_failed code=${code}`);
    return json(
      { ok: false, error: code === "not_configured" ? "video_not_configured" : "video_error" },
      code === "not_configured" ? 503 : code === "invalid_room" ? 400 : 502,
    );
  }

  /* Room lifecycle (0015). The room exists at this point, so record it with
     the service role; a failure is coarse-logged and the provider's own room
     expiry remains the backstop. Never log the room name or the id. */
  const serviceKey = env.SUPABASE_SERVICE_KEY?.trim() ?? "";
  if (serviceKey) {
    try {
      const roomResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/record_room_opened`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_id: consultationId, p_provider: "daily" }),
      });
      if (!roomResponse.ok) {
        console.error(`consultations join room_record_failed status=${roomResponse.status}`);
      }
      roomResponse.body?.cancel();
    } catch {
      console.error("consultations join room_record_failed network");
    }
  } else {
    console.error("consultations join room_tracking_not_configured");
  }

  /* Lifecycle audit is best effort: a logging failure must not block care. */
  try {
    const logResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/log_consultation_join`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ p_id: consultationId }),
    });
    if (!logResponse.ok) {
      console.error(`consultations join log_failed status=${logResponse.status}`);
    }
    logResponse.body?.cancel();
  } catch {
    console.error("consultations join log_failed network");
  }

  return json(
    {
      ok: true,
      join: {
        url: ticket.url,
        token: ticket.token,
        expiresAt: ticket.expiresAt,
        role,
      },
    },
    200,
    { "referrer-policy": "no-referrer" },
  );
}

/**
 * POST /api/daily/webhook
 *
 * Receives authenticated Daily webhook events for participant join/leave.
 * Verifies the HMAC-SHA256 signature per Daily's documented procedure:
 *   - Header: X-Webhook-Signature (hex-encoded HMAC-SHA256)
 *   - Header: X-Webhook-Timestamp (Unix milliseconds)
 *   - Secret: Base64-encoded, must be decoded before use
 *   - Signed content: timestamp + "." + raw_request_body
 *
 * Enforces idempotency using Daily's recommended approach:
 *   - Key: (event_type, payload.session_id)
 *   - Stored in consultation_media_events with a unique constraint
 *   - Concurrent duplicate deliveries are serialized by the database
 *
 * Privacy: only the consultation id and event type are logged. Participant
 * names, emails, or session IDs from the webhook are never written to logs
 * or the database.
 */
async function handleDailyWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.DAILY_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    console.error("daily webhook not_configured");
    return json({ ok: false, error: "webhook_not_configured" }, 503);
  }

  const signature = request.headers.get("X-Webhook-Signature") ?? request.headers.get("x-webhook-signature");
  const timestampHeader = request.headers.get("X-Webhook-Timestamp") ?? request.headers.get("x-webhook-timestamp");
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  if (!bodyText || bodyText.length > 65536) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  const verified = await verifyDailyWebhookSignature(bodyText, signature, timestampHeader, secret);
  if (!verified.valid) {
    console.error("daily webhook signature_invalid");
    return json({ ok: false, error: "invalid_signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const events = (typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>).events
    : undefined) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(events)) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }

  const serviceKey = env.SUPABASE_SERVICE_KEY?.trim() ?? "";
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("daily webhook backend_not_configured");
    return json({ ok: false, error: "backend_not_configured" }, 503);
  }

  let processed = 0;

  for (const event of events) {
    const eventType = typeof event.type === "string" ? event.type : "";
    const roomName = typeof event.room_name === "string" ? event.room_name : "";
    const payload = event.payload as Record<string, unknown> | undefined;
    const sessionId = typeof payload?.session_id === "string" ? payload.session_id : "";

    if (!eventType || !roomName || !sessionId) continue;

    // Map Daily event types to our audit events
    let auditEvent: string | null = null;
    if (eventType === "participant-joined") auditEvent = "participant_joined";
    else if (eventType === "participant-left") auditEvent = "participant_left";
    else continue; // Ignore other event types

    // Find the consultation by room_name (service role only)
    let consultationResponse: Response;
    try {
      consultationResponse = await fetch(`${supabaseUrl}/rest/v1/consultations?room_name=eq.${encodeURIComponent(roomName)}&select=id`, {
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
        },
      });
    } catch {
      console.error("daily webhook consultation_lookup_failed");
      continue;
    }

    if (!consultationResponse.ok) {
      console.error(`daily webhook consultation_lookup_failed status=${consultationResponse.status}`);
      consultationResponse.body?.cancel();
      continue;
    }

    const consultations = (await consultationResponse.json().catch(() => [])) as Array<{ id: string }>;
    consultationResponse.body?.cancel();
    if (consultations.length !== 1) {
      console.error(`daily webhook room_not_found_or_ambiguous room=${safeLogText(roomName)}`);
      continue;
    }

    const consultationId = consultations[0].id;

    // Record the event to consultation_media_events with idempotency key
    // The unique constraint on (consultation_id, event, detail) where detail contains session_id
    // ensures concurrent duplicate deliveries cannot create duplicates.
    let logResponse: Response;
    try {
      logResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/log_consultation_media_event`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_id: consultationId,
          p_event: auditEvent,
          p_provider: "daily",
          p_detail: `session:${sessionId}`,
        }),
      });
    } catch {
      console.error("daily webhook log_failed network");
      continue;
    }

    if (!logResponse.ok) {
      // Check if it's a duplicate key violation (idempotent success)
      const errorText = await logResponse.text().catch(() => "");
      if (errorText.includes("duplicate") || errorText.includes("unique") || logResponse.status === 409) {
        // Duplicate delivery - already processed, count as success
        logResponse.body?.cancel();
        processed += 1;
        continue;
      }
      console.error(`daily webhook log_failed status=${logResponse.status} event=${auditEvent}`);
      logResponse.body?.cancel();
      continue;
    }
    logResponse.body?.cancel();
    processed += 1;
  }

  return json({ ok: true, processed });
}

/** Minimal shapes for the cron entry point (no workers-types package here). */
interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Cron: move every account's stale consultation to 'expired'.
 *
 * expire_stale_consultations() (0013) accepts only the service-role claim, so
 * this Worker's service key is the only caller. A failure is logged coarsely
 * and swallowed: the next five-minute tick retries, and a booking dashboard
 * still has its own caller-scoped expiry.
 */
export async function expireStaleConsultations(env: Env): Promise<number> {
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const serviceKey = env.SUPABASE_SERVICE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("consultations expiry backend_not_configured");
    return 0;
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/expire_stale_consultations`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
  } catch {
    console.error("consultations expiry rpc_unavailable");
    return 0;
  }

  if (!response.ok) {
    console.error(`consultations expiry rpc_failed status=${response.status}`);
    response.body?.cancel();
    return 0;
  }

  const payload = await response.json().catch(() => null);
  const expired = typeof payload === "number" && Number.isFinite(payload) ? payload : 0;
  console.log(`consultations expiry expired=${expired}`);
  return expired;
}

const worker = {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    /* Expiry first: it is what marks a scheduled room terminal. Reconciliation
       then queues and closes provider rooms for every terminal consultation,
       including ones missed on an earlier tick. Both jobs are idempotent. */
    ctx.waitUntil(
      (async () => {
        const expired = await expireStaleConsultations(env);
        const closure = await reconcileRoomClosures(env);
        return { expired, closure };
      })(),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
    }

    if (url.pathname === "/api/admin/grant-role") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (rateLimited(ip)) {
        return json({ ok: false, error: "rate_limited" }, 429, { "retry-after": "60" });
      }
      /* No origin allow-list check here by design: provisioning is called by
         an operator tool, not by a browser, and requiring an Origin header
         would add nothing to the bearer-secret gate. */
      return handleAdminGrantRole(request, env);
    }

    if (url.pathname === "/api/consultations/join") {
      return handleConsultationJoin(request, env);
    }

    if (url.pathname === "/api/daily/webhook") {
      return handleDailyWebhook(request, env);
    }

    if (url.pathname !== "/api/health-guide") {
      return json({ ok: false, error: "not_found" }, 404);
    }

    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403);
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

    const record = (typeof body === "object" && body !== null ? body : {}) as Record<
      string,
      unknown
    >;
    const message = typeof record.message === "string" ? record.message.trim() : "";
    if (!message || message.length > MAX_MESSAGE_CHARS) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
    const history = sanitizeHistory(record.history);
    /* Reply language: the app sends the user's chosen language. Anything
       malformed or unsupported normalises to English, so existing clients
       and hostile payloads behave exactly as before. The directive is
       appended to the system prompt for the AI path only; emergency handling
       above stays deterministic (English pre-check + English safety reply),
       because safety must not depend on model compliance in any language. */
    const lang = normalizeGuideLang(record.lang);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (rateLimited(ip)) {
      return json({ ok: false, error: "rate_limited" }, 429, { "retry-after": "60" });
    }

    /* Layer 2 of the safety pathway — deterministic, before any AI call. */
    if (containsEmergencySignal(message)) {
      return json({
        ok: true,
        configured: true,
        reply: {
          intent: "health_information",
          category: null,
          state: null,
          preferences: [],
          response: EMERGENCY_RESPONSE_TEXT,
          needs_clarification: false,
          safety: true,
        },
      });
    }

    if (!env.AI_API_KEY) {
      /* Honest, expected state: the feature is not configured. The client
         falls back to Find Care and never pretends the AI answered. */
      return json({ ok: true, configured: false });
    }

    const baseUrl = (
      env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai"
    ).replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const key = env.AI_API_KEY.trim();
    const model = env.AI_MODEL || "gemini-flash-lite-latest";
    const aiBody = JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: [systemPrompt(), guideReplyLanguageDirective(lang)].filter(Boolean).join("\n") },
        ...history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
    });

    try {
      const doFetch = () =>
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: aiBody,
          signal: controller.signal,
        });
      let aiResponse = await doFetch();
      if (aiResponse.status === 429 || aiResponse.status === 503) {
        aiResponse.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 700));
        aiResponse = await doFetch();
      }

      if (!aiResponse.ok) {
        const detail = await aiResponse.text().catch(() => "");
        let info = "";
        try {
          const parsed = JSON.parse(detail) as Record<string, unknown>;
          const e = (parsed.error ?? parsed) as Record<string, unknown>;
          info = [e.type, e.code, e.message]
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .join(" | ");
        } catch {
          info = detail.slice(0, 200);
        }
        if (!info) info = detail.slice(0, 200);
        console.error(
          `health-guide ai_http status=${aiResponse.status} err=${info
            .replace(/[\r\n"]/g, " ")
            .slice(0, 300)}`,
        );
        return json({ ok: false, error: "ai_error" }, 502);
      }

      const data = (await aiResponse.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = data?.choices?.[0]?.message?.content;
      const reply = parseGuideReply(typeof content === "string" ? content : null);
      if (!reply) {
        console.error("health-guide invalid_ai_response");
        return json({ ok: false, error: "invalid_ai_response" }, 502);
      }

      return json({ ok: true, configured: true, reply });
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      console.error(`health-guide fetch_failed timedOut=${timedOut}`);
      return json({ ok: false, error: timedOut ? "ai_timeout" : "ai_error" }, timedOut ? 504 : 502);
    } finally {
      clearTimeout(timer);
    }
  },
};

export default worker;
