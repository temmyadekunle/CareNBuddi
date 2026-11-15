/**
 * Video provider adapter (Daily.co).
 *
 * Server-only. The API key is read by the Worker from its environment and is
 * never sent to the browser. The browser receives only a short-lived meeting
 * token for one private room.
 *
 * Daily was chosen because it offers REST room creation and scoped meeting
 * tokens without shipping a permanent public room URL. If the credentials are
 * absent every function here fails closed, so the app can honestly report
 * "video is not configured" instead of pretending a consultation can start.
 */

export type VideoErrorCode =
  | "not_configured"
  | "invalid_room"
  | "room_failed"
  | "token_failed";

export class VideoProviderError extends Error {
  code: VideoErrorCode;

  constructor(code: VideoErrorCode, message?: string) {
    super(message ?? code);
    this.name = "VideoProviderError";
    this.code = code;
  }
}

export interface VideoConfig {
  apiKey?: string;
  domain?: string;
}

export interface JoinTicketRequest {
  roomName: string;
  displayName: string;
  isOwner: boolean;
  /** Unix seconds. The token must already have expired when this passes. */
  tokenExpiresAt: number;
  /** Unix seconds. The room is ejected shortly after the token expires. */
  roomExpiresAt: number;
}

export interface JoinTicket {
  url: string;
  token: string;
  expiresAt: string;
}

export const DAILY_API_BASE = "https://api.daily.co/v1";
const REQUEST_TIMEOUT_MS = 10_000;
const ROOM_NAME_PATTERN = /^cnb-[a-f0-9]{32}$/;

export function videoConfigured(config: VideoConfig): boolean {
  return Boolean(config.apiKey?.trim() && config.domain?.trim());
}

/** Accepts `team.daily.co`, `https://team.daily.co/`, or a bare subdomain. */
export function normalizeDailyDomain(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const withoutScheme = value.replace(/^https?:\/\//i, "");
  const host = withoutScheme.split("/")[0].toLowerCase();
  if (!host) return "";
  return host.includes(".") ? host : `${host}.daily.co`;
}

export function dailyRoomUrl(domain: string, roomName: string): string {
  const host = normalizeDailyDomain(domain);
  if (!host) throw new VideoProviderError("not_configured");
  return `https://${host}/${roomName}`;
}

function safeDisplayName(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "CareNBuddi participant").slice(0, 80);
}

async function dailyRequest(
  path: string,
  init: RequestInit,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(`${DAILY_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function createRoomIfMissing(
  roomName: string,
  roomExpiresAt: number,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  let existing: Response;
  try {
    existing = await dailyRequest(`/rooms/${roomName}`, { method: "GET" }, apiKey, fetchImpl);
  } catch {
    throw new VideoProviderError("room_failed");
  }
  if (existing.ok) return;
  if (existing.status !== 404) {
    existing.body?.cancel();
    throw new VideoProviderError("room_failed");
  }
  existing.body?.cancel();

  let created: Response;
  try {
    created = await dailyRequest(
      "/rooms",
      {
        method: "POST",
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp: roomExpiresAt,
            eject_at_room_exp: true,
            max_participants: 2,
            enable_chat: false,
            enable_screenshare: false,
            start_video_off: false,
            start_audio_off: false,
            enable_prejoin_ui: true,
            enable_network_ui: true,
          },
        }),
      },
      apiKey,
      fetchImpl,
    );
  } catch {
    throw new VideoProviderError("room_failed");
  }
  if (!created.ok) {
    created.body?.cancel();
    throw new VideoProviderError("room_failed");
  }
  created.body?.cancel();
}

export async function createJoinTicket(
  request: JoinTicketRequest,
  config: VideoConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<JoinTicket> {
  const apiKey = config.apiKey?.trim() ?? "";
  const domain = normalizeDailyDomain(config.domain);
  if (!apiKey || !domain) throw new VideoProviderError("not_configured");
  if (!ROOM_NAME_PATTERN.test(request.roomName)) throw new VideoProviderError("invalid_room");

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(request.tokenExpiresAt) || request.tokenExpiresAt <= nowSeconds + 60) {
    throw new VideoProviderError("token_failed");
  }
  if (!Number.isFinite(request.roomExpiresAt) || request.roomExpiresAt <= request.tokenExpiresAt) {
    throw new VideoProviderError("token_failed");
  }

  await createRoomIfMissing(request.roomName, request.roomExpiresAt, apiKey, fetchImpl);

  let tokenResponse: Response;
  try {
    tokenResponse = await dailyRequest(
      "/meeting-tokens",
      {
        method: "POST",
        body: JSON.stringify({
          properties: {
            room_name: request.roomName,
            user_name: safeDisplayName(request.displayName),
            is_owner: request.isOwner,
            exp: request.tokenExpiresAt,
            enable_screenshare: false,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      },
      apiKey,
      fetchImpl,
    );
  } catch {
    throw new VideoProviderError("token_failed");
  }

  const data = (await tokenResponse.json().catch(() => null)) as { token?: unknown } | null;
  if (!tokenResponse.ok || !data || typeof data.token !== "string" || !data.token) {
    throw new VideoProviderError("token_failed");
  }

  return {
    url: dailyRoomUrl(domain, request.roomName),
    token: data.token,
    expiresAt: new Date(request.tokenExpiresAt * 1000).toISOString(),
  };
}
