import { KEYS, readLocal, writeLocal } from "@/lib/storage";
import { getSupabase } from "./client";
import type { Role } from "@/lib/types";

/**
 * The collections that belong to one person and therefore belong in the cloud.
 * Catalog data (providers, topics) and the local demo users stay on the device.
 */
export const SYNCED_KEYS = [
  KEYS.journal,
  KEYS.records,
  KEYS.reminders,
  KEYS.fitnessProfile,
  KEYS.weighIns,
  KEYS.workouts,
  KEYS.exerciseReminder,
  KEYS.careCircle,
  KEYS.passport,
  KEYS.bookings,
] as const;

export interface CloudProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  lang: string;
}

const PUSHED_AT_PREFIX = "healthlink:synced-at:";

function pushedAtKey(docKey: string) {
  return `${PUSHED_AT_PREFIX}${docKey}`;
}

function localStamp(docKey: string): number {
  const raw = readLocal<number>(pushedAtKey(docKey));
  return typeof raw === "number" ? raw : 0;
}

function setLocalStamp(docKey: string, stamp: number) {
  writeLocal(pushedAtKey(docKey), stamp);
}

export async function fetchProfile(userId: string): Promise<CloudProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, lang")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as CloudProfile | null) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<CloudProfile, "full_name" | "phone" | "role" | "lang">>,
) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

/** Sends the given collections (or all of them) to the database. */
export async function pushDocuments(userId: string, docKeys: readonly string[] = SYNCED_KEYS) {
  const supabase = getSupabase();
  if (!supabase) return;
  const stamp = Date.now();
  const rows = docKeys
    .map((docKey) => {
      const payload = readLocal<unknown>(docKey);
      if (payload === null) return null;
      return {
        user_id: userId,
        doc_key: docKey,
        payload,
        client_updated_at: new Date(stamp).toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (rows.length === 0) return;

  const { error } = await supabase.from("health_documents").upsert(rows, { onConflict: "user_id,doc_key" });
  if (error) throw error;
  docKeys.forEach((docKey) => setLocalStamp(docKey, stamp));
}

interface RemoteDocument {
  doc_key: string;
  payload: unknown;
  client_updated_at: string;
}

/**
 * Brings the database down to this device. A remote copy only wins when it is
 * newer than what this device last pushed, so two devices editing different
 * features never clobber each other.
 */
export async function pullDocuments(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("health_documents")
    .select("doc_key, payload, client_updated_at")
    .eq("user_id", userId);
  if (error) throw error;

  const applied: string[] = [];
  for (const row of (data ?? []) as RemoteDocument[]) {
    const remoteStamp = Date.parse(row.client_updated_at);
    if (!Number.isNaN(remoteStamp) && remoteStamp <= localStamp(row.doc_key)) continue;
    writeLocal(row.doc_key, row.payload);
    if (!Number.isNaN(remoteStamp)) setLocalStamp(row.doc_key, remoteStamp);
    applied.push(row.doc_key);
  }
  return applied;
}

/** Pushes anything this device has that the database does not, then pulls the rest. */
export async function syncNow(userId: string): Promise<{ pulled: string[]; pushed: string[] }> {
  await pushDocuments(userId);
  const pulled = await pullDocuments(userId);
  return { pulled, pushed: [...SYNCED_KEYS] };
}