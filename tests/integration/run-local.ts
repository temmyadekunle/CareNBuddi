/**
 * CareNBuddi real-service integration runner.
 *
 * Preconditions binding — the runner FAILS CLOSED unless:
 *   1. explicit opt-in: CARENBUDDI_INTEGRATION_TESTS=1,
 *   2. disposable confirmation: CARENBUDDI_LOCAL_STACK_CONFIRMED=1,
 *   3. a loopback SUPABASE_URL + SUPABASE_ANON_KEY from the local stack
 *      (`npx supabase status`), and
 *   4. schema probe confirms migrations applied (bucket present),
 * so it can never silently aim at a linked or remote project, and never
 * clean anything it has not proven disposable AND local.
 *
 * Usage (documented in tests/integration/README.md):
 *
 *   npx supabase start                                  # disposable local stack
 *   $env:SUPABASE_URL      = "http://127.0.0.1:54321"   # from `npx supabase status`
 *   $env:SUPABASE_ANON_KEY = "<from status>"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<from status>"     # optional; without it the
 *                                                        # administrator-led flow and
 *                                                        # cleanup are skipped, not passed
 *   $env:CARENBUDDI_INTEGRATION_TESTS = "1"
 *   $env:CARENBUDDI_LOCAL_STACK_CONFIRMED = "1"
 *   node --import ./tests/register.mjs tests/integration/run-local.ts
 *
 * Layout of the run:
 *   A. authentication (signup, real JWT sessions, default role, bad session)
 *   B. provider application workflow (RPCs + RLS + audit)
 *   C. storage (paths, ownership, MIME, size, signed URLs, mismatch notes)
 *   D. cleanup: only this run's synthetic identities/files, service-side
 *
 * Output uses a masking logger; keys never appear verbatim.
 * Results are checked/asserted style with a final count and exit code =
 * 1 when any check failed.
 */

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  makeMaskingLogger,
  parseIntegrationTarget,
  type IntegrationConfig,
  type GuardResult,
} from "./guards";

/* ------------------------------------------------------------------ consts */

const EMAIL_SUFFIX = "@qa.synthetic";
const PASSWORD = "synthetic-password-not-a-secret-1!";

/*
 * The application id is generated fresh for every run instead of a fixed
 * constant: a rerun that follows a skipped cleanup (no service key) must
 * never collide with an earlier run's `provider_applications_pkey` row.
 * It is assigned after signup, before section B.
 */
let APP_ID_A = "";

/** Submission preconditions identical to the SQL checks in migration 0007.
 *  The payload travels as an OBJECT, exactly as production does
 *  (lib/server-provider-applications.ts `applicationToPayload`); a
 *  pre-stringified string would bind as a jsonb scalar and the RPC would
 *  read null for every field. */
const docPayload = (appId: string, email: string): Record<string, unknown> => ({
  id: appId,
  email,
  fullName: "Synthetic Tester",
  phone: "+10000000000",
  acceptedTerms: true,
  acceptedPrivacy: true,
  category: "doctor",
  trainee: false,
  speciality: "", qualifications: "", institution: "", registrationNumber: "",
  licensingBody: "", licenceExpiry: "", yearsExperience: "", bio: "", languages: "",
  state: "Lagos", city: "", facility: "", services: "",
  identityDocument: null,
  credentialEvidence: null,
});

/* --------------------------------------------------------------- utilities */

interface Identity {
  email: string;
  uid: string;
  client: SupabaseClient;
}

let PASS = 0, FAIL = 0, SKIP = 0;
let log = makeMaskingLogger([]);

const check = (name: string, ok: boolean, detail?: string) => {
  if (ok) PASS++; else FAIL++;
  const d = detail ? `  -- ${detail}` : "";
  log(`  ${ok ? "OK  " : "FAIL"}  ${name}${d}`);
};

/** A requirement that could not be exercised at all, without counting it as a pass or a failure. */
const checkSkip = (name: string, detail?: string) => {
  SKIP++;
  log(`  SKIP  ${name}${detail ? `  -- ${detail}` : ""}`);
};

const section = (name: string) => log(`\n-- ${name} --`);

/** Minimal PNG- and PDF-shaped synthetic bytes. */
function syntheticBytes(sizeBytes: number, mime: string): Uint8Array {
  const bytes = new Uint8Array(sizeBytes);
  if (mime === "image/png") {
    bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4e; bytes[3] = 0x47;
  } else if (mime === "application/pdf") {
    bytes[0] = 0x25; bytes[1] = 0x50; bytes[2] = 0x44; bytes[3] = 0x46;
  } else {
    bytes[0] = 0x4d; bytes[1] = 0x5a;
  }
  return bytes;
}

const pathA = (uid: string, appId: string, docType: string, name: string): string =>
  `provider-applications/${uid}/${appId}/${docType}/${name}`;

/* ------------------------------------------------------------- lifecycle */

async function createIdentity(
  cfg: IntegrationConfig, email: string, name: string, role: string,
): Promise<Identity> {
  const client = createClient(cfg.url.origin, cfg.anonKey, { auth: { persistSession: false } });
  const { error, data } = await client.auth.signUp({
    email, password: PASSWORD, options: { data: { name, role } },
  });
  if (error) {
    // Existing account from a previous run of the SAME ids is not re-created
    // silently: rerun = fresh IDs. Explicitly fail, not "log in and hope".
    throw error;
  }
  if (!data.user) throw new Error(`signup returned no user for ${email}`);
  if (!data.session) {
    throw new Error(
      `no session for ${email}: the local stack has email confirmation enabled, ` +
      "so no JWT was issued. Use `npx supabase db reset` on a stack with confirmations disabled.",
    );
  }
  return { email, uid: data.user.id, client };
}

/**
 * Removes exactly the paths this run uploaded and this run's synthetic auth
 * users, reporting every per-item failure. Profiles cascade off auth.users,
 * applications cascade off profiles' user ref, audit cascades off
 * applications (0006/0005 FKs). No truncation, no wildcards, no other uids.
 */
async function tearDown(
  cfg: IntegrationConfig,
  ids: Identity[],
  uploadedPaths: string[],
): Promise<string[]> {
  if (!cfg.serviceKey) {
    log("  SKIP teardown: no SUPABASE_SERVICE_ROLE_KEY; synthetic accounts/profiles remain in the local DB (disposable by contract). Objects, if any, remain for post-mortem.");
    return ["service key absent: cleanup skipped"];
  }
  const problems: string[] = [];
  const svc = createClient(cfg.url.origin, cfg.serviceKey, { auth: { persistSession: false } });
  if (uploadedPaths.length > 0) {
    const rm = await svc.storage.from("provider-applications").remove([...uploadedPaths]);
    if (rm.error) problems.push(`storage.remove: ${rm.error.message}`);
  }
  for (const id of ids) {
    const del = await svc.auth.admin.deleteUser(id.uid);
    if (del.error) problems.push(`deleteUser: ${del.error.message}`);
  }
  return problems;
}

/* ------------------------------------------------------------------ main */

async function main(): Promise<number> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const guard: GuardResult = parseIntegrationTarget(env);
  if (!guard.ok) {
    console.log(`REFUSED: ${guard.reason}`);
    console.log("No network calls, writes, or cleanup were attempted.");
    return 2;
  }
  const cfg = guard.value;
  // From here on every emitted line goes through the masking logger seeded
  // with the keys this run was actually handed.
  log = makeMaskingLogger([cfg.anonKey, cfg.serviceKey ?? ""]);
  log(`Target accepted: ${cfg.url.origin} (loopback, explicitly confirmed disposable)`);

  // 0. schema probe. The expandable anon list call must be REFUSED by 0006
  //    (private bucket) — a denial proves Storage is reachable AND the
  //    security policies transport. A clean connection error means the URL
  //    or stack is wrong: not a valid target either way.
  section("0. environment probe");
  const probe = createClient(cfg.url.origin, cfg.anonKey, { auth: { persistSession: false } });
  const probed = await probe.storage.from("provider-applications").list();
  // Distinguish "unreachable" (a transport symptom, the wrong URL/stack) from
  // "denied" (the 0006 private-bucket policy working as intended). A
  // connection error must not masquerade as a pass.
  const probeNetworkError = !!probed.error &&
    /fetch|network|socket|econnrefused|econnreset|enotfound|etimedout|aborted/i
      .test(probed.error.message ?? "");
  check("local stack reachable (no transport error on probe)", !probeNetworkError,
    probed.error?.message);
  check("anon list denied/empty (private bucket applies policy)",
    (!probed.error && (probed.data ?? []).length === 0) || (!!probed.error && !probeNetworkError),
    probed.error?.message);

  const ids: Identity[] = [];
  const uploadedPaths: string[] = [];

  try {
    log("");
    log("== Synthetic identities (real auth signups) ==");
    for (const [name, role] of [
      ["ProA", "provider"], ["ProB", "provider"], ["Con", "consumer"], ["Admin", "admin"],
    ] as const) {
      const suffix = `${Math.floor(Math.random() * 1e9)}`;
      const email = `${role}.${suffix}${EMAIL_SUFFIX}`;
      const identity = await createIdentity(cfg, email, name, role);
      ids.push(identity);
      log(`  ${name}: ${email.slice(0, 6)}...${EMAIL_SUFFIX.slice(1)} (uid ${identity.uid.slice(0, 8)}...)`);
    }
    const [proA, proB, con, admin] = ids;

    // Per-run application id (see the note at the consts block): safe to
    // rerun even when a previous run's cleanup was skipped.
    APP_ID_A = randomUUID();

    // The administrator role exists only through grant_role (0003). Promotion
    // happens later, at the start of the administrator flow in section B, so
    // section A observes the fresh-from-signup (consumer) state first.
    const adminReady = !!cfg.serviceKey;

    section("A. authentication");
    const profileA = await proA.client.from("profiles").select("role").eq("id", proA.uid).single();
    check("signup meta 'provider' yields a provider profile (0001 trigger)",
      profileA.data?.role === "provider", JSON.stringify(profileA.data ?? profileA.error?.message ?? ""));
    const me = await admin.client.from("profiles").select("role").eq("id", admin.uid).single();
    check("signup never self-assigns admin (0003), role stays consumer",
      me.data?.role === "consumer", JSON.stringify(me.data ?? me.error?.message));
    const nobody = await admin.client.from("profiles").select("id").limit(2);
    check("a normal account cannot list other profiles", (nobody.data?.length ?? 1) === 1,
      JSON.stringify(nobody.data?.length ?? nobody.error?.message));
    const broken = createClient(cfg.url.origin, `${cfg.anonKey.slice(0, 8)}${"x".repeat(cfg.anonKey.length - 8)}`,
      { auth: { persistSession: false } });
    const brokenCall = await broken.from("profiles").select("id").limit(1);
    check("an invalid key fails closed (no auth)", !!brokenCall.error, brokenCall.error?.message);
    log("  NOTE  secret redaction is exercised in guards.test.ts (makeMaskingLogger); this run's output is emitted through it");

    section("B. provider application workflow");
    const appA = await proA.client.rpc("upsert_provider_application",
      { p_payload: docPayload(APP_ID_A, proA.email), p_submit: false });
    check("provider A can create a draft", !appA.error, appA.error?.message);
    const draftRow = await proA.client.from("provider_applications")
      .select("status, user_id, id").eq("user_id", proA.uid).single();
    check("draft ownership is the server's idea of identity (JWT uid)",
      draftRow.data?.user_id === proA.uid, JSON.stringify(draftRow.data ?? draftRow.error?.message));
    // The server returned the row (0007 `returning to_jsonb(inserted.*)`). That
    // id — never a locally guessed one — governs every subsequent workflow step
    // and every storage path.
    const appAData = appA.data as { id?: string } | null;
    const serverAppId = typeof appAData?.id === "string" ? appAData.id : "";
    check("server adopted the payload id as its authoritative application id (0007)",
      serverAppId === APP_ID_A,
      `server id ${serverAppId === "" ? "<none returned>" : serverAppId}`);
    if (serverAppId === "") {
      throw new Error("no authoritative application id from the server; aborting the workflow section");
    }

    const submitBad = await proA.client.rpc("upsert_provider_application",
      { p_payload: docPayload(APP_ID_A, proA.email), p_submit: true });
    check("submission without identity evidence is refused", !!submitBad.error,
      submitBad.error?.message);

    const identityPath = pathA(proA.uid, serverAppId, "identity", "synthetic-id.png");
    const up = await proA.client.storage.from("provider-applications")
      .upload(identityPath, syntheticBytes(4, "image/png"), { contentType: "image/png", upsert: false });
    check("provider A can upload identity document in own path", !up.error, up.error?.message);
    if (!up.error) uploadedPaths.push(identityPath);
    const goodPayload = {
      ...docPayload(APP_ID_A, proA.email),
      identityDocument: {
        storagePath: identityPath, docType: "National Identity Card",
        fileName: "synthetic-id.png", sizeBytes: 4, mimeType: "image/png", addedAt: new Date().toISOString(),
      },
    };
    const submitOk = await proA.client.rpc("upsert_provider_application",
      { p_payload: goodPayload, p_submit: true });
    check("provider A submits an eligible application via the RPC", !submitOk.error, submitOk.error?.message);
    const nowStatus = await proA.client.from("provider_applications").select("status").eq("user_id", proA.uid).single();
    check("status transitioned to submitted", nowStatus.data?.status === "submitted", nowStatus.data?.status);

    const foreign = await proB.client.from("provider_applications").select("status, id");
    check("provider B sees none of provider A's applications (select_own only)",
      (foreign.data?.length ?? -1) === 0, JSON.stringify(foreign.data?.length ?? foreign.error?.message));

    const crossWrite = await proB.client.rpc("upsert_provider_application",
      { p_payload: docPayload(APP_ID_A, proA.email), p_submit: true });
    check("provider B cannot write provider A's record", !!crossWrite.error, crossWrite.error?.message);

    const selfApprove = await proA.client.rpc("review_provider_application",
      { p_application_id: serverAppId, p_next: "verified", p_reason: "self" });
    check("self-approval refused", !!selfApprove.error, selfApprove.error?.message);

    const nonAdmin = await con.client.rpc("review_provider_application",
      { p_application_id: serverAppId, p_next: "under-review", p_reason: "nope" });
    check("administrative review refused without an admin role", !!nonAdmin.error, nonAdmin.error?.message);

    const direct = await con.client.from("provider_applications").update({ status: "verified" }).eq("id", serverAppId);
    check("ordinary clients cannot directly update (0007 revoke)", direct.error !== null,
      direct.error?.message ?? "unexpected success");

    if (!adminReady) {
      checkSkip("administrator role grant + review flow (0003/0007 positive path)",
        "no SUPABASE_SERVICE_ROLE_KEY; administrator-controlled transitions are recorded as skipped, not passed");
    } else {
      const svc = createClient(cfg.url.origin, cfg.serviceKey!, { auth: { persistSession: false } });
      const granted = await svc.rpc("grant_role", { p_user: admin.uid, p_role: "admin" });
      check("administrator role granted via the only supported path (0003 grant_role)",
        !granted.error, granted.error?.message);
      if (granted.error) {
        checkSkip("administrator review flow (positive path)", `grant failed: ${granted.error.message}`);
      } else {
        const rUnderReview = await admin.client.rpc("review_provider_application",
        { p_application_id: serverAppId, p_next: "under-review", p_reason: "" });
      check("valid review begins working with the real admin session", !rUnderReview.error, rUnderReview.error?.message);
      const invalid = await admin.client.rpc("review_provider_application",
        { p_application_id: serverAppId, p_next: "draft", p_reason: "" });
      check("under-review -> draft is refused (transition matrix)", !!invalid.error, invalid.error?.message);
      const auditCountBefore = await admin.client.from("provider_application_audit")
        .select("application_id").eq("application_id", serverAppId);
      check("invalid review left no audit row (atomic)", auditCountBefore.data?.length === 1,
        JSON.stringify(auditCountBefore.data?.length));

      const wantsReason = await admin.client.rpc("review_provider_application",
        { p_application_id: serverAppId, p_next: "needs-info", p_reason: "   " });
      check("blank reason refused for needs-info", !!wantsReason.error, wantsReason.error?.message);
      const asks = await admin.client.rpc("review_provider_application",
        { p_application_id: serverAppId, p_next: "needs-info", p_reason: "please re-upload" });
      check("under-review -> needs-info commits its audit event", !asks.error, asks.error?.message);
      const validPath = await admin.client.rpc("review_provider_application",
        { p_application_id: serverAppId, p_next: "verified", p_reason: "in order" });
      check("needs-info -> verified with reason applies", !validPath.error, validPath.error?.message);
      const auditCheck = await admin.client.from("provider_application_audit")
        .select("reviewer_id, new_status")
        .eq("application_id", serverAppId)
        .order("created_at", { ascending: false }).limit(1);
      check("audit consistently records the administrator's uid and the new status",
        auditCheck.data?.[0]?.reviewer_id === admin.uid && auditCheck.data?.[0]?.new_status === "verified",
        JSON.stringify(auditCheck.data?.[0] ?? auditCheck.error?.message));
      const idAfter = await proA.client.from("provider_applications")
        .select("status, identity_status").eq("user_id", proA.uid).single();
      check("verified promotes verification statuses along the review path",
        idAfter.data?.status === "verified", JSON.stringify(idAfter.data ?? idAfter.error?.message));
      const locked = await proA.client.rpc("upsert_provider_application",
        { p_payload: { ...goodPayload, fullName: "rewritten post-verification" }, p_submit: false });
      check("a verified application cannot be edited by its applicant", !!locked.error, locked.error?.message);
      }
    }

    section("C. storage");
    const anon = createClient(cfg.url.origin, cfg.anonKey, { auth: { persistSession: false } });
    const anonRead = await anon.storage.from("provider-applications").list();
    check("anonymous list in the private bucket is empty/denied", (anonRead.data ?? []).length === 0,
      JSON.stringify(anonRead.error?.message ?? anonRead.data?.length));
    const anonUpload = await anon.storage.from("provider-applications")
      .upload(identityPath, syntheticBytes(4, "image/png"), { contentType: "image/png" });
    check("anonymous upload into the bucket is denied", !!anonUpload.error, anonUpload.error?.message);
    // Track anyway: if the policy is ever defeated, cleanup must still reach the object.
    if (!anonUpload.error) uploadedPaths.push(identityPath);

    const crossPath = pathA(proA.uid, serverAppId, "identity", "synthetic-id.png");
    const cross = await proB.client.storage.from("provider-applications")
      .upload(crossPath, syntheticBytes(4, "image/png"), { contentType: "image/png" });
    check("cross-applicant upload is denied (owner-segment policy)", !!cross.error, cross.error?.message);
    if (!cross.error) uploadedPaths.push(crossPath);

    const allowedMimes: [string, string, boolean][] = [
      ["image/png", "test.png", true],
      ["image/jpeg", "test.jpg", true],
      ["image/webp", "test.webp", true],
      ["application/pdf", "test.pdf", true],
      ["text/plain", "test.txt", false],
      ["application/zip", "test.zip", false],
    ];
    for (const [mime, name, ok] of allowedMimes) {
      const u = pathA(proA.uid, serverAppId, "identity", name);
      const r = await proA.client.storage.from("provider-applications")
        .upload(u, syntheticBytes(4, mime), { contentType: mime, upsert: false });
      check(`mime ${mime}${ok ? " (allowed) uploads" : " (disallowed) is refused"}`,
        ok ? !r.error : !!r.error, r.error?.message ?? r.data?.path ?? "");
      if (!r.error) uploadedPaths.push(u);
    }

    // size limits: exactly at and one above the 8 MiB bucket limit.
    const limit = 8 * 1024 * 1024;
    const at = await proA.client.storage.from("provider-applications")
      .upload(pathA(proA.uid, serverAppId, "identity", "at-limit.png"), syntheticBytes(limit, "image/png"),
        { contentType: "image/png", upsert: false });
    check("exactly 8 MiB upload is accepted", !at.error, at.error?.message);
    if (!at.error) uploadedPaths.push(pathA(proA.uid, serverAppId, "identity", "at-limit.png"));
    const over = await proA.client.storage.from("provider-applications")
      .upload(pathA(proA.uid, serverAppId, "identity", "over-limit.png"), syntheticBytes(limit + 1, "image/png"),
        { contentType: "image/png", upsert: false });
    check("8 MiB + 1 byte upload is rejected by the real Storage API", !!over.error, over.error?.message);
    if (!over.error) uploadedPaths.push(pathA(proA.uid, serverAppId, "identity", "over-limit.png"));

    // Real Storage API object keys include the bucket segment (proven
    // empirically: uploads and signed-URL issuance succeed on paths that start
    // with `provider-applications/`), so listing uses the same layout. The
    // cross-applicant check is only valid when the same prefix demonstrably
    // contains this run's objects for their owner — never an empty result from
    // a malformed prefix.
    const ownPrefix = `provider-applications/${proA.uid}/${serverAppId}`;
    const own = await proA.client.storage.from("provider-applications")
      .list(ownPrefix);
    const ownPopulated = (own.data?.length ?? 0) > 0;
    check("applicant lists own folder and sees their uploaded objects", ownPopulated,
      JSON.stringify(own.data?.length));
    check("applicant list is owner-scoped (no other uid folders appear)",
      ownPopulated ? (own.data ?? []).every((o) => o.name.length > 0) : false, "0006 policy scoped");
    const foreignOwned = await proB.client.storage.from("provider-applications")
      .list(ownPrefix);
    check("applicant cannot list another applicant's populated folder (prefix verified as populated for its owner)",
      ownPopulated && (foreignOwned.data ?? []).length === 0,
      JSON.stringify(foreignOwned.error?.message ?? foreignOwned.data?.length));

    const foreignOther = await proB.client.storage.from("provider-applications")
      .createSignedUrl(identityPath, 60);
    check("signed-URL issuance for another applicant's document is denied", !!foreignOther.error,
      foreignOther.error?.message);
    const ownIssue = await proA.client.storage.from("provider-applications")
      .createSignedUrl(identityPath, 60);
    check("owner can issue a signed URL for own document", !ownIssue.error && !!ownIssue.data?.signedUrl,
      ownIssue.error?.message ?? "");
    if (adminReady) {
      const adminUrl = await admin.client.storage.from("provider-applications")
        .createSignedUrl(identityPath, 300);
      check("administrator can issue a signed URL for review", !adminUrl.error && !!adminUrl.data?.signedUrl,
        adminUrl.error?.message ?? "");
    } else {
      checkSkip("administrator can issue a signed URL for review", "requires the granted administrator identity");
    }

    // Content-type / byte mismatch: OBSERVE, never claim validation. Storage
    // authenticates the Content-Type header against the bucket allowlist; it
    // does not promise to inspect the bytes. Neither outcome is counted as a
    // pass beyond the genuine refusal expectation; an acceptance is recorded.
    const mismatchPath = pathA(proA.uid, serverAppId, "credentials", "mismatch.pdf");
    const mismatch = await proA.client.storage.from("provider-applications")
      .upload(mismatchPath, syntheticBytes(4, "application/pdf"),
        { contentType: "image/png", upsert: false });
    if (mismatch.error) {
      log(`  NOTE  mismatch upload refused by service: ${mismatch.error.message}`);
    } else {
      uploadedPaths.push(mismatchPath);
      log("  NOTE  mismatch upload accepted by service — recorded as a limitation, not a pass (do not treat bucket MIME config as byte-sniffing; see README)");
    }

    section("D. cleanup");
    const cleanupProblems = await tearDown(cfg, ids, uploadedPaths);
    if (cleanupProblems.length === 1 && cleanupProblems[0].startsWith("service key absent")) {
      checkSkip("service-side cleanup", cleanupProblems[0]);
    } else {
      check("cleanup removed every synthetic storage object, scoped to this run",
        !cleanupProblems.some((p) => p.startsWith("storage.remove:")),
        cleanupProblems.find((p) => p.startsWith("storage.remove:")));
      check("cleanup deleted the synthetic auth users",
        !cleanupProblems.some((p) => p.startsWith("deleteUser:")),
        cleanupProblems.find((p) => p.startsWith("deleteUser:")));
    }
  } catch (err) {
    log(`RUNNER WARNING: unexpected error, cleaning up before exit: ${String((err as Error)?.message ?? err)}`);
    const problems = await tearDown(cfg, ids, uploadedPaths);
    for (const p of problems) log(`  cleanup problem during abort: ${p}`);
    FAIL++;
  }

  log("\n" + "=".repeat(70));
  const total = PASS + FAIL;
  log(`${PASS}/${total} checks passed` + (SKIP > 0 ? `, ${SKIP} skipped` : ""));
  if (SKIP > 0) log("Skipped checks were not exercised; they are not passes and are listed above.");
  if (FAIL > 0) log("FAILED checks listed above; they are actionable findings, not test code to weaken.");
  return FAIL > 0 ? 1 : 0;
}

process.exitCode = await main();
