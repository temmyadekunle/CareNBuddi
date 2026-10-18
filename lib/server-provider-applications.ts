/**
 * Server-authoritative provider application workflow.
 *
 * This module is the only place the browser talks to
 * `public.provider_applications`, `public.provider_application_audit` or the
 * two RPC entry points created by migration 0007. Everything here is built
 * around one rule: the database, not this device, decides what an
 * application's status is.
 *
 *  - Reading: the applicant may read their own row (policy
 *    `provider_applications_select_own`); an administrator may read every row
 *    (policy `provider_applications_select_admin`, 0005). Local drafts are a
 *    form, never a decision: they must never be displayed as submitted or
 *    verified.
 *  - Writing as applicant: `upsert_provider_application` — the single
 *    applicant path. Stored locally and confirmed from the returned row.
 *  - Writing as administrator: `review_provider_application` — writes the
 *    decision row and the audit row in one transaction inside the database.
 *    The reviewer identity is derived from the JWT there; no client value is
 *    trusted.
 *
 * None of these functions ever stores document bytes; the payloads contain
 * only metadata plus the Storage path, exactly as `DocumentRef` specifies.
 */

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
// Relative imports keep this module loadable by the node test harness
// (tests/resolve-ts.mjs resolves relative specifiers only), matching
// lib/storage/upload.ts.
import { getSupabase } from "./supabase/client";
import {
  type ProviderApplication,
  type ProviderApplicationStatus,
} from "./provider-application";

/* --------------------------------------------------------------- helpers */

/** Failure kind, for UI copy: expired session vs network vs rejected request. */
export type ServerFailureKind = "auth" | "network" | "validation";

export interface ServerResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  kind?: ServerFailureKind;
}

/**
 * The database raises precise errors (migration 0007). Map the two that are
 * about identity to calm copy; anything else is passed through, because the
 * message is the operator-facing contract.
 */
export function describeServerFailure(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("sign-in required") || m.includes("jwt") || m.includes("401")) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (m.includes("permission") || m.includes("not allowed") || m.includes("violates row-level")) {
    return "Your account is not permitted to perform that action.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "CareNBuddi cloud is unreachable. Check your connection and try again.";
  }
  return message;
}

function kindOf(message: string): ServerFailureKind {
  const m = message.toLowerCase();
  if (m.includes("sign-in required") || m.includes("jwt") || m.includes("401")) return "auth";
  if (m.includes("failed to fetch") || m.includes("network")) return "network";
  return "validation";
}

/* -------------------------------------------------------------- row <-> app */

type ServerRow = Record<string, unknown>;

function text(row: ServerRow, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

/**
 * Maps a `provider_applications` row to the domain object. The row is the
 * authority: whatever the device previously held is discarded, including any
 * locally invented status.
 */
export function rowToApplication(row: ServerRow): ProviderApplication {
  return {
    id: text(row, "id"),
    userId: text(row, "user_id"),
    email: text(row, "email"),
    fullName: text(row, "full_name"),
    phone: text(row, "phone"),
    acceptedTerms: row["accepted_terms"] === true,
    acceptedPrivacy: row["accepted_privacy"] === true,
    category: text(row, "category") as ProviderApplication["category"],
    trainee: row["trainee"] === true,
    speciality: text(row, "speciality"),
    qualifications: text(row, "qualifications"),
    institution: text(row, "institution"),
    registrationNumber: text(row, "registration_number"),
    licensingBody: text(row, "licensing_body"),
    licenceExpiry: text(row, "licence_expiry"),
    yearsExperience: text(row, "years_experience"),
    bio: text(row, "bio"),
    languages: text(row, "languages"),
    state: text(row, "state"),
    city: text(row, "city"),
    facility: text(row, "facility"),
    services: text(row, "services"),
    identityDocument: (row["identity_document"] as ProviderApplication["identityDocument"]) ?? null,
    identityStatus: text(row, "identity_status") as ProviderApplication["identityStatus"],
    credentialEvidence: (row["credential_evidence"] as ProviderApplication["credentialEvidence"]) ?? null,
    credentialsStatus: text(row, "credentials_status") as ProviderApplication["credentialsStatus"],
    status: text(row, "status") as ProviderApplicationStatus,
    submittedAt: typeof row["submitted_at"] === "string" ? row["submitted_at"] : null,
    updatedAt: text(row, "updated_at"),
    reviewNote: text(row, "review_note"),
    reviewedBy: typeof row["reviewed_by"] === "string" ? row["reviewed_by"] : null,
    reviewedAt: typeof row["reviewed_at"] === "string" ? row["reviewed_at"] : null,
  };
}

/**
 * Builds the payload sent to `upsert_provider_application`.
 *
 * `id` travels so the database adopts the exact local application id the
 * Storage paths already name in segment [3] (migration 0007 only uses it
 * when the caller has no server row yet, and `user_id` is forced from the
 * JWT there, so a caller can never steer another account's row). Everything
 * the applicant must not be able to set is excluded: `userId`, the status
 * and its timestamps, and the review fields. The database rejects status
 * edits anyway; the shapes here make it obvious that those fields never
 * travel.
 */
export function applicationToPayload(app: ProviderApplication): Record<string, unknown> {
  return {
    id: app.id,
    email: app.email,
    fullName: app.fullName,
    phone: app.phone,
    acceptedTerms: app.acceptedTerms,
    acceptedPrivacy: app.acceptedPrivacy,
    category: app.category,
    trainee: app.trainee,
    speciality: app.speciality,
    qualifications: app.qualifications,
    institution: app.institution,
    registrationNumber: app.registrationNumber,
    licensingBody: app.licensingBody,
    licenceExpiry: app.licenceExpiry,
    yearsExperience: app.yearsExperience,
    bio: app.bio,
    languages: app.languages,
    state: app.state,
    city: app.city,
    facility: app.facility,
    services: app.services,
    identityDocument: app.identityDocument,
    identityStatus: app.identityStatus,
    credentialEvidence: app.credentialEvidence,
    credentialsStatus: app.credentialsStatus,
  };
}

/* ---------------------------------------------------------------- applicant */

/**
 * Sends the application to the database.
 *
 * `submit` transitions draft/needs-info -> submitted, on the server only.
 * Whatever the local application object says is ignored for status: the
 * authoritative state comes back inside the returned row. On failure the
 * caller must keep the application in its previous local state and show the
 * error; a failed call is NOT a submission.
 */
export async function saveApplicationToServer(
  app: ProviderApplication,
  submit: boolean,
): Promise<ServerResult<ProviderApplication>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "CareNBuddi cloud is not configured on this device.", kind: "network" };
  }
  const { data, error } = await supabase.rpc("upsert_provider_application", {
    p_payload: applicationToPayload(app),
    p_submit: submit,
  });
  if (error) {
    return { ok: false, error: describeServerFailure(error.message), kind: kindOf(error.message) };
  }
  return { ok: true, value: rowToApplication((data ?? {}) as ServerRow) };
}

/* ------------------------------------------------------------------ reviewer */

export type ReviewDecision = Extract<
  ProviderApplicationStatus,
  "under-review" | "needs-info" | "verified" | "rejected" | "suspended"
>;

/**
 * Records an administrator decision through `review_provider_application`.
 *
 * The database derives the reviewer identity, validates the transition and
 * writes the audit row in the same transaction. This function only carries
 * the application id, the decided status and the reason/message; there is no
 * parameter a caller could abuse to claim another reviewer.
 */
export async function applyReviewDecision(
  applicationId: string,
  decision: ReviewDecision,
  reason: string,
  credentialType: string | null = null,
  credentialPath: string | null = null,
): Promise<ServerResult<ReviewDecision>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "CareNBuddi cloud is not configured on this device.", kind: "network" };
  }
  const { data, error } = await supabase.rpc("review_provider_application", {
    p_application_id: applicationId,
    p_next: decision,
    p_reason: reason,
    p_credential_type: credentialType,
    p_credential_path: credentialPath,
  });
  if (error) {
    return { ok: false, error: describeServerFailure(error.message), kind: kindOf(error.message) };
  }
  return { ok: true, value: (data ?? decision) as ReviewDecision };
}

/* ----------------------------------------------------------------- audit log */

export interface AuditEntry {
  id: string;
  reviewerId: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
  credentialType: string | null;
  credentialPath: string | null;
  createdAt: string;
}

function rowToAuditEntry(row: ServerRow): AuditEntry {
  return {
    id: text(row, "id"),
    reviewerId: text(row, "reviewer_id"),
    previousStatus: text(row, "previous_status"),
    newStatus: text(row, "new_status"),
    reason: text(row, "reason"),
    credentialType: typeof row["credential_type"] === "string" ? row["credential_type"] : null,
    credentialPath: typeof row["credential_path"] === "string" ? row["credential_path"] : null,
    createdAt: text(row, "created_at"),
  };
}

/**
 * Reads the audit trail for one application. Administrators only (policy
 * `provider_application_audit_select_admin`, 0006); the trail is immutable
 * through this client by construction: there is no write call here at all.
 */
export async function fetchAuditTrail(
  applicationId: string,
): Promise<ServerResult<AuditEntry[]>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "CareNBuddi cloud is not configured on this device.", kind: "network" };
  }
  const { data, error } = await supabase
    .from("provider_application_audit")
    .select("id, reviewer_id, previous_status, new_status, reason, credential_type, credential_path, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) {
    return { ok: false, error: describeServerFailure(error.message), kind: kindOf(error.message) };
  }
  return { ok: true, value: (data ?? []).map(rowToAuditEntry) };
}

/* -------------------------------------------------------------------- hooks */

export type LoadPhase = "loading" | "ready" | "error" | "offline";

interface ServerCollection {
  apps: ProviderApplication[];
  phase: LoadPhase;
  error: string | null;
  reload: () => void;
}

async function fetchPage<T>(
  build: (s: NonNullable<ReturnType<typeof getSupabase>>) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<{ ok: boolean; value?: T; error?: string; kind?: ServerFailureKind }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "CareNBuddi cloud is not configured on this device.", kind: "network" };
  }
  const { data, error } = await build(supabase);
  if (error) {
    return { ok: false, error: describeServerFailure(error.message), kind: kindOf(error.message) };
  }
  return { ok: true, value: data as T };
}

/**
 * Administrator dashboard data: every application, from the database only.
 * There is no localStorage fallback here on purpose. If the cloud is not
 * configured the admin sees that plainly; a local review state was never a
 * decision, and presenting it as one would be the bug this replaces.
 */
export function useServerApplications(): ServerCollection & { setApps: (a: ProviderApplication[]) => void } {
  const [apps, setApps] = useState<ProviderApplication[]>([]);
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(
    (s: SupabaseClient) => s.from("provider_applications").select("*").order("updated_at", { ascending: false }),
    [],
  );

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchPage<ServerRow[]>>>) => {
      if (result.ok) {
        setApps((result.value ?? []).map(rowToApplication));
        setPhase("ready");
        setError(null);
      } else if (result.kind === "network") {
        setApps([]);
        setPhase(getSupabase() ? "error" : "offline");
        setError(result.error ?? null);
      } else {
        setPhase("error");
        setError(result.error ?? null);
      }
    },
    [],
  );

  const reload = useCallback(async () => {
    apply(await fetchPage<ServerRow[]>(read));
  }, [read, apply]);

  // State changes happen in promise reactions, never synchronously in the
  // effect body, and a fast unmount cannot paint a torn result.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchPage<ServerRow[]>(read);
      if (!cancelled) apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [read, apply]);

  return { apps, phase, error, reload, setApps };
}

/**
 * The signed-in applicant's own application, from the database. Local drafts
 * (lib/use-provider-application.ts) remain the editable form, but the status
 * shown to the applicant is whatever this returns. `null` with phase
 * "ready" means the server knows no application for this account yet.
 */
export function useServerApplication(
  userId: string | null | undefined,
): ServerCollection & { application: ProviderApplication | null } {
  const [application, setApplication] = useState<ProviderApplication | null>(null);
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchPage<ServerRow[]>>>) => {
      if (result.ok) {
        setApplication(result.value && result.value[0] ? rowToApplication(result.value[0]) : null);
        setPhase("ready");
        setError(null);
      } else {
        setPhase(result.kind === "network" && !getSupabase() ? "offline" : "error");
        setError(result.error ?? null);
      }
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!userId) return;
    apply(
      await fetchPage<ServerRow[]>((s) =>
        s.from("provider_applications").select("*").eq("user_id", userId)
          .order("updated_at", { ascending: false }).limit(1),
      ),
    );
  }, [userId, apply]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchPage<ServerRow[]>((s) =>
        s.from("provider_applications").select("*").eq("user_id", userId)
          .order("updated_at", { ascending: false }).limit(1),
      );
      if (!cancelled) apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, apply]);

  return {
    // No signed-in user means there is nothing to fetch: that readiness is
    // derived here so the effect body never calls state setters directly.
    apps: application ? [application] : [],
    phase: userId ? phase : "ready",
    error: userId ? error : null,
    reload,
    application: userId ? application : null,
  };
}
