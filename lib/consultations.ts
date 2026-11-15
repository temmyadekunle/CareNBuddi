"use client";

/**
 * Telemedicine persistence.
 *
 * Supabase is the only authority for consultations. There is deliberately no
 * localStorage fallback: an offline device must never show a scheduled session
 * the server does not know about, or claim a video room exists.
 *
 * Video joins are the one operation that cannot go through the Supabase client
 * directly. The browser asks the Worker (/api/consultations/join) for a short
 * lived provider token; the Worker re-checks assignment and the time window
 * against the database and is the only place the video API key exists.
 */

import { getSupabase, isCloudEnabled } from "./supabase/client";
import type {
  Consultation,
  ConsultationDuration,
  ConsultationEvent,
  ConsultationJoinTicket,
  VerifiedProvider,
} from "./consultation-core";

export type ConsultationErrorCode =
  | "cloud_required"
  | "auth_required"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "video_not_configured"
  | "video_unavailable"
  | "video_error"
  | "consultation_error";

export class ConsultationError extends Error {
  code: ConsultationErrorCode;

  constructor(code: ConsultationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ConsultationError";
    this.code = code;
  }
}

function client() {
  if (!isCloudEnabled) throw new ConsultationError("cloud_required");
  const supabase = getSupabase();
  if (!supabase) throw new ConsultationError("cloud_required");
  return supabase;
}

function fail(
  error: { message?: string } | null,
  fallback: ConsultationErrorCode = "consultation_error",
): never {
  const message = error?.message ?? "";
  if (/duplicate key|time no longer available|already handled|cannot cancel|not ready|window closed|outside the join window|outside service hours|too early|not active/i.test(message)) {
    throw new ConsultationError("conflict", message);
  }
  if (/not a participant|not your consultation|not verified|patient account required|consent required|not permitted|invalid status transition|immutable/i.test(message)) {
    throw new ConsultationError("forbidden", message);
  }
  if (/not found/i.test(message)) throw new ConsultationError("not_found", message);
  if (/invalid schedule|unsupported duration|describe what you need|choose another provider/i.test(message)) {
    throw new ConsultationError("invalid", message);
  }
  throw new ConsultationError(fallback, message || fallback);
}

export async function currentConsultationUserId(): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ConsultationError("auth_required");
  return data.user.id;
}

/* ------------------------------------------------------------- directory */

export async function listVerifiedProviders(args?: {
  search?: string;
  state?: string;
}): Promise<VerifiedProvider[]> {
  const supabase = client();
  const { data, error } = await supabase.rpc("list_verified_providers", {
    p_search: (args?.search ?? "").trim(),
    p_state: (args?.state ?? "").trim(),
  });
  if (error) fail(error);
  return (data ?? []) as VerifiedProvider[];
}

export async function listOpenSlots(providerId: string, days = 7): Promise<string[]> {
  const supabase = client();
  const { data, error } = await supabase.rpc("provider_open_slots", {
    p_provider: providerId,
    p_from: null,
    p_days: days,
  });
  if (error) fail(error);
  return ((data ?? []) as { slot: string }[]).map((row) => row.slot);
}

/* --------------------------------------------------------- consultations */

export async function listConsultationsForPatient(userId: string): Promise<Consultation[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("patient_id", userId)
    .order("scheduled_for", { ascending: false })
    .limit(100);
  if (error) fail(error);
  return (data ?? []) as Consultation[];
}

export async function listConsultationsForProvider(userId: string): Promise<Consultation[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("provider_id", userId)
    .order("scheduled_for", { ascending: false })
    .limit(100);
  if (error) fail(error);
  return (data ?? []) as Consultation[];
}

export async function listAllConsultations(): Promise<Consultation[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .order("scheduled_for", { ascending: false })
    .limit(200);
  if (error) fail(error);
  return (data ?? []) as Consultation[];
}

export async function fetchConsultation(id: string): Promise<Consultation | null> {
  const supabase = client();
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  return (data ?? null) as Consultation | null;
}

export async function fetchConsultationEvents(id: string): Promise<ConsultationEvent[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("consultation_events")
    .select("*")
    .eq("consultation_id", id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) fail(error);
  return (data ?? []) as ConsultationEvent[];
}

export async function requestConsultation(args: {
  providerId: string;
  scheduledFor: string;
  durationMinutes: ConsultationDuration;
  reason: string;
  consent: boolean;
}): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.rpc("request_consultation", {
    p_provider: args.providerId,
    p_scheduled_for: args.scheduledFor,
    p_duration_minutes: args.durationMinutes,
    p_reason: args.reason.trim(),
    p_consent: args.consent,
  });
  if (error) fail(error);
  return String(data);
}

export async function respondConsultation(args: {
  id: string;
  accept: boolean;
  reason?: string;
}): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("respond_consultation", {
    p_id: args.id,
    p_accept: args.accept,
    p_reason: args.reason ?? "",
  });
  if (error) fail(error);
}

export async function cancelConsultation(id: string, note = ""): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("cancel_consultation", {
    p_id: id,
    p_note: note,
  });
  if (error) fail(error);
}

export async function startConsultation(id: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("start_consultation", { p_id: id });
  if (error) fail(error);
}

export async function completeConsultation(id: string, note = ""): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("complete_consultation", {
    p_id: id,
    p_note: note,
  });
  if (error) fail(error);
}

export async function expireMyConsultations(): Promise<number> {
  const supabase = client();
  const { data, error } = await supabase.rpc("expire_my_consultations");
  if (error) fail(error);
  return Number(data ?? 0);
}

/* ------------------------------------------------------------ video join */

interface JoinPayload {
  ok?: boolean;
  error?: string;
  join?: {
    url?: unknown;
    token?: unknown;
    expiresAt?: unknown;
    role?: unknown;
  };
}

export async function joinConsultation(consultationId: string): Promise<ConsultationJoinTicket> {
  const supabase = client();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new ConsultationError("auth_required");

  let response: Response;
  try {
    response = await fetch("/api/consultations/join", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ consultationId }),
    });
  } catch {
    throw new ConsultationError("video_unavailable");
  }

  if (response.status === 404) throw new ConsultationError("video_unavailable");

  const payload = (await response.json().catch(() => null)) as JoinPayload | null;

  if (response.status === 401) throw new ConsultationError("auth_required");
  if (response.status === 403) throw new ConsultationError("forbidden");
  if (response.status === 409) throw new ConsultationError("conflict");
  if (response.status === 503 && payload?.error === "video_not_configured") {
    throw new ConsultationError("video_not_configured");
  }
  if (!response.ok || !payload || payload.ok !== true || !payload.join) {
    throw new ConsultationError("video_error", payload?.error ?? undefined);
  }

  const { url, token, expiresAt, role } = payload.join;
  if (
    typeof url !== "string" ||
    typeof token !== "string" ||
    typeof expiresAt !== "string" ||
    (role !== "patient" && role !== "provider")
  ) {
    throw new ConsultationError("video_error");
  }

  return { url, token, expiresAt, role };
}
