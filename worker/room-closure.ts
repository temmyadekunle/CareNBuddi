/**
 * Room lifecycle reconciliation for telemedicine consultations.
 *
 * The database (0015) owns the durable queue and never claims a provider-side
 * room was deleted. This module is the Worker half: it asks a pluggable room
 * closer to delete the room, then records the confirmed result.
 *
 * Daily is the only closer wired up here, and it is implemented in this file
 * rather than by changing lib/video-provider.ts. The database stores only a
 * provider label and the private room name, so a future adapter can be passed
 * in without a schema change.
 *
 * Privacy: logs carry counts and HTTP status codes only. Room names,
 * consultation ids and participant data are never logged.
 */

import { DAILY_API_BASE } from "../lib/video-provider";

export interface RoomClosureEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  DAILY_API_KEY?: string;
}

export type RoomCloseResult = "closed" | "missing" | "failed";

export type RoomCloser = (roomName: string) => Promise<RoomCloseResult>;

export interface RoomClosureSummary {
  configured: boolean;
  flagged: number;
  pending: number;
  failed: number;
  claimed: number;
  closed: number;
  errors: number;
}

const ROOM_NAME_PATTERN = /^cnb-[a-f0-9]{32}$/;
const REQUEST_TIMEOUT_MS = 10_000;
const CLAIM_LIMIT = 10;

interface ClaimRow {
  consultation_id?: unknown;
  room_name?: unknown;
}

interface ReconcileCounts {
  flagged?: unknown;
  pending?: unknown;
  failed?: unknown;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function postRpc<T>(
  base: string,
  key: string,
  name: string,
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<T | null> {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    console.error(`consultations closure rpc_unavailable name=${name}`);
    return null;
  }

  if (!response.ok) {
    console.error(`consultations closure rpc_failed name=${name} status=${response.status}`);
    response.body?.cancel();
    return null;
  }

  return (await response.json().catch(() => null)) as T | null;
}

/**
 * Daily room deletion. A 404 means the room is already gone, which is the
 * desired end state. Only 2xx or 404 count as confirmed closure.
 */
export function dailyRoomCloser(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): RoomCloser {
  const key = apiKey.trim();
  return async (roomName) => {
    if (!ROOM_NAME_PATTERN.test(roomName)) return "failed";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(
        `${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${key}` },
          signal: controller.signal,
        },
      );
      response.body?.cancel();
      if (response.ok) return "closed";
      if (response.status === 404) return "missing";
      return "failed";
    } catch {
      return "failed";
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * One reconciliation tick:
 *   1. ask the database to queue any room that should have been closed;
 *   2. claim a bounded batch;
 *   3. close each room through the provider closer;
 *   4. record the confirmed result (success or a retryable failure).
 *
 * Inert without Supabase credentials. Without a room closer (no Daily key and
 * none injected) the queue is still reconciled, but nothing is claimed.
 */
export async function reconcileRoomClosures(
  env: RoomClosureEnv,
  options: { fetchImpl?: typeof fetch; closer?: RoomCloser } = {},
): Promise<RoomClosureSummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const summary: RoomClosureSummary = {
    configured: false,
    flagged: 0,
    pending: 0,
    failed: 0,
    claimed: 0,
    closed: 0,
    errors: 0,
  };

  const base = env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const key = env.SUPABASE_SERVICE_KEY?.trim() ?? "";
  if (!base || !key) {
    console.error("consultations closure backend_not_configured");
    return summary;
  }
  summary.configured = true;

  const closer =
    options.closer ??
    (env.DAILY_API_KEY?.trim()
      ? dailyRoomCloser(env.DAILY_API_KEY, fetchImpl)
      : null);

  const reconciled = await postRpc<ReconcileCounts>(
    base,
    key,
    "reconcile_room_closures",
    {},
    fetchImpl,
  );
  if (reconciled) {
    summary.flagged = count(reconciled.flagged);
    summary.pending = count(reconciled.pending);
    summary.failed = count(reconciled.failed);
  }

  if (!closer) {
    console.error("consultations closure provider_not_configured");
    return summary;
  }

  const batch = await postRpc<unknown>(
    base,
    key,
    "claim_room_closure_batch",
    { p_limit: CLAIM_LIMIT },
    fetchImpl,
  );
  if (!Array.isArray(batch)) {
    console.error("consultations closure claim_failed");
    return summary;
  }

  for (const item of batch as ClaimRow[]) {
    const id =
      typeof item?.consultation_id === "string" ? item.consultation_id : "";
    const roomName = typeof item?.room_name === "string" ? item.room_name : "";
    if (!id || !roomName) {
      summary.errors += 1;
      continue;
    }

    const result = await closer(roomName);
    const success = result !== "failed";
    if (success) summary.closed += 1;
    else summary.errors += 1;

    const recorded = await postRpc<unknown>(
      base,
      key,
      "record_room_closure_result",
      {
        p_id: id,
        p_success: success,
        p_detail: success ? result : "provider_error",
      },
      fetchImpl,
    );
    if (recorded === null) {
      summary.errors += 1;
    }
  }
  summary.claimed = batch.length;

  console.log(
    `consultations closure flagged=${summary.flagged} pending=${summary.pending} ` +
      `failed=${summary.failed} claimed=${summary.claimed} closed=${summary.closed} ` +
      `errors=${summary.errors}`,
  );

  return summary;
}
