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
  parseGuideReply,
} from "../lib/guide-core";

interface Env {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

const ALLOWED_ORIGINS = [
  "https://carenbuddi.vercel.app",
  "https://carenbuddi.folababy02.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

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

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
    }
    if (url.pathname !== "/api/health-guide") {
      return json({ ok: false, error: "not_found" }, 404);
    }

    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
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
        { role: "system", content: systemPrompt() },
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
