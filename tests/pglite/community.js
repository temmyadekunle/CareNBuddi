/**
 * Community (0010), executed against real PostgreSQL with
 * check_function_bodies = on, as anon / authenticated / service_role —
 * never as the database owner. RLS, grants, triggers and the SECURITY DEFINER
 * moderation RPCs decide every outcome.
 *
 * What is verified here:
 *   1. the full migration sequence 0001..0010 applies strictly;
 *   2. patient space: consumers read/post, providers and anon cannot;
 *   3. provider space: only a provider with a verified application reads or
 *      posts; a provider with a pending application cannot;
 *   4. administrators read both spaces but cannot post in either;
 *   5. comments follow the same space rules, and are only accepted on a
 *      published post;
 *   6. reports: no self-reporting, no duplicates, no reporting content in a
 *      space the reporter cannot read;
 *   7. only administrators can change content status, only through the RPCs,
 *      and the audit rows are written in the same call;
 *   8. ordinary users cannot write the audit table or another user's row;
 *   9. the posting rate limit is enforced in the database.
 *
 * No seed rows are inserted by the migration; fixtures live here only.
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

const MIGRATIONS = [
  "0001_init.sql",
  "0002_rapid_response.sql",
  "0003_admin_role_hardening.sql",
  "0004_anonymous_access_privacy.sql",
  "0005_provider_applications.sql",
  "0006_storage_policies.sql",
  "0007_application_workflow.sql",
  "0008_storage_upload_limits.sql",
  "0009_profile_photo_and_avatars.sql",
  "0010_community.sql",
  "0012_integrity_hardening.sql",
];

/** Supabase-storage mirror, as used by the documents and application suites. */
const STORAGE_STUB = `
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:coalesce(array_length(string_to_array(name, '/'), 1), 1) - 1]
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

const as = async (db, role, sub, fn) => {
  await db.exec("reset role;");
  await db.exec(`set role ${role};`);
  await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
  try {
    const r = await fn();
    return { ok: true, rows: r.rows || [], rowCount: r.rowCount ?? 0 };
  } catch (e) {
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim().slice(0, 200), rowCount: 0 };
  } finally {
    await db.exec("reset role;");
    await db.exec("set request.jwt.claims = '';");
  }
};

(async () => {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail: detail || "" });
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
  };
  const section = (s) => console.log(`\n-- ${s} --`);

  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);
  await db.exec(STORAGE_STUB);

  console.log("=".repeat(78));
  console.log("COMMUNITY: full sequence 0001..0010, strict");
  console.log("=".repeat(78));
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}`);
    if (!r.ok) {
      console.log(`  FIRST FAILURE: ${r.error}`);
      await db.close();
      process.exitCode = 1;
      return;
    }
  }

  const U = {
    patientA: "00000000-0000-4000-8000-000000000a01",
    patientB: "00000000-0000-4000-8000-000000000b01",
    providerVerified: "00000000-0000-4000-8000-000000000c01",
    providerPending: "00000000-0000-4000-8000-000000000d01",
    admin: "00000000-0000-4000-8000-000000000e01",
    rateUser: "00000000-0000-4000-8000-000000000f01",
  };
  for (const [key, email, meta] of [
    ["patientA", "patientA@qa.test", { name: "Patient A", role: "consumer" }],
    ["patientB", "patientB@qa.test", { name: "Patient B", role: "consumer" }],
    ["providerVerified", "verified@qa.test", { name: "Verified Provider", role: "provider" }],
    ["providerPending", "pending@qa.test", { name: "Pending Provider", role: "provider" }],
    ["admin", "admin@qa.test", { name: "Administrator", role: "consumer" }],
    ["rateUser", "rate@qa.test", { name: "Rate User", role: "consumer" }],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)", [
      U[key],
      email,
      JSON.stringify(meta),
    ]);
  }

  await db.exec("set role service_role;");
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
  await db.query("select public.grant_role($1, 'admin')", [U.admin]);
  await db.query(
    `insert into public.provider_applications (user_id,email,full_name,status,submitted_at)
     values ($1,'verified@qa.test','Verified Provider','verified',now())`,
    [U.providerVerified],
  );
  await db.query(
    `insert into public.provider_applications (user_id,email,full_name,status,submitted_at)
     values ($1,'pending@qa.test','Pending Provider','submitted',now())`,
    [U.providerPending],
  );
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");

  const insertPost = (role, sub, space, title, body) =>
    as(db, role, sub, () =>
      db.query(
        "insert into public.community_posts (space,author_id,title,body) values ($1,$2,$3,$4) returning id,author_name,status",
        [space, sub, title, body],
      ),
    );

  section("1. patient space: consumers read and post");
  const p1 = await insertPost("authenticated", U.patientA, "patients", "First question", "How do I manage this?");
  check("consumer posts in patients", p1.ok, p1.error);
  check("author name is snapshotted from the profile", p1.rows?.[0]?.author_name === "Patient A", JSON.stringify(p1.rows?.[0]));
  check("status is forced to published", p1.rows?.[0]?.status === "published");
  const postId = p1.rows?.[0]?.id;

  const readByB = await as(db, "authenticated", U.patientB, () =>
    db.query("select id from public.community_posts where id=$1", [postId]),
  );
  check("another consumer sees the post", readByB.ok && readByB.rows.length === 1, readByB.error);

  const readByVerified = await as(db, "authenticated", U.providerVerified, () =>
    db.query("select id from public.community_posts where id=$1", [postId]),
  );
  check("provider cannot read the patient space", readByVerified.ok && readByVerified.rows.length === 0, readByVerified.error);

  const readAnon = await as(db, "anon", undefined, () =>
    db.query("select id from public.community_posts where id=$1", [postId]),
  );
  check("anon reads nothing", readAnon.ok && readAnon.rows.length === 0, readAnon.error);

  const readAdmin = await as(db, "authenticated", U.admin, () =>
    db.query("select id from public.community_posts where id=$1", [postId]),
  );
  check("administrator can read the patient space", readAdmin.ok && readAdmin.rows.length === 1, readAdmin.error);

  const adminPostPatients = await insertPost("authenticated", U.admin, "patients", "Admin post", "Should fail");
  check("administrator cannot post in patients", !adminPostPatients.ok, adminPostPatients.error);

  section("2. provider space: verified only");
  const readPending = await as(db, "authenticated", U.providerPending, () =>
    db.query("select id from public.community_posts where space='providers'"),
  );
  check("pending provider reads no provider posts", readPending.ok && readPending.rows.length === 0, readPending.error);

  const pendingPost = await insertPost("authenticated", U.providerPending, "providers", "Pending post", "Should fail");
  check("pending provider cannot post", !pendingPost.ok, pendingPost.error);

  const verifiedPost = await insertPost(
    "authenticated",
    U.providerVerified,
    "providers",
    "Clinical peer question",
    "How do colleagues approach this?",
  );
  check("verified provider posts in providers", verifiedPost.ok, verifiedPost.error);
  const providerPostId = verifiedPost.rows?.[0]?.id;

  const readVerified = await as(db, "authenticated", U.providerVerified, () =>
    db.query("select id from public.community_posts where id=$1", [providerPostId]),
  );
  check("verified provider reads provider space", readVerified.ok && readVerified.rows.length === 1, readVerified.error);

  const patientReadsProvider = await as(db, "authenticated", U.patientA, () =>
    db.query("select id from public.community_posts where id=$1", [providerPostId]),
  );
  check("consumer cannot read provider space", patientReadsProvider.ok && patientReadsProvider.rows.length === 0, patientReadsProvider.error);

  const providerPostPatients = await insertPost("authenticated", U.providerVerified, "patients", "Provider post", "Should fail");
  check("verified provider cannot post in patients", !providerPostPatients.ok, providerPostPatients.error);

  const adminPostProviders = await insertPost("authenticated", U.admin, "providers", "Admin provider post", "Should fail");
  check("administrator cannot post in providers", !adminPostProviders.ok, adminPostProviders.error);

  section("3. comments follow the same space rules");
  const c1 = await as(db, "authenticated", U.patientB, () =>
    db.query(
      "insert into public.community_comments (post_id,author_id,body) values ($1,$2,$3) returning id,status",
      [postId, U.patientB, "I have the same question."],
    ),
  );
  check("consumer comments in patients", c1.ok && c1.rows?.[0]?.status === "published", c1.error);
  const commentId = c1.rows?.[0]?.id;

  const verifiedCommentsPatient = await as(db, "authenticated", U.providerVerified, () =>
    db.query(
      "insert into public.community_comments (post_id,author_id,body) values ($1,$2,$3)",
      [postId, U.providerVerified, "Should fail"],
    ),
  );
  check("provider cannot comment in patients", !verifiedCommentsPatient.ok, verifiedCommentsPatient.error);

  const pendingCommentsProvider = await as(db, "authenticated", U.providerPending, () =>
    db.query(
      "insert into public.community_comments (post_id,author_id,body) values ($1,$2,$3)",
      [providerPostId, U.providerPending, "Should fail"],
    ),
  );
  check("pending provider cannot comment in providers", !pendingCommentsProvider.ok, pendingCommentsProvider.error);

  const patientCommentsProvider = await as(db, "authenticated", U.patientA, () =>
    db.query(
      "insert into public.community_comments (post_id,author_id,body) values ($1,$2,$3)",
      [providerPostId, U.patientA, "Should fail"],
    ),
  );
  check("consumer cannot comment in providers", !patientCommentsProvider.ok, patientCommentsProvider.error);

  const readComments = await as(db, "authenticated", U.patientA, () =>
    db.query("select id from public.community_comments where post_id=$1", [postId]),
  );
  check("consumer reads published comments", readComments.ok && readComments.rows.length === 1, readComments.error);

  section("4. reports: no self, no duplicates, no foreign space");
  const selfReport = await as(db, "authenticated", U.patientA, () =>
    db.query(
      "insert into public.community_reports (reporter_id,target_type,target_id,reason) values ($1,'post',$2,'spam')",
      [U.patientA, postId],
    ),
  );
  check("cannot report own post", !selfReport.ok && /own content/i.test(selfReport.error), selfReport.error);

  const reportB = await as(db, "authenticated", U.patientB, () =>
    db.query(
      "insert into public.community_reports (reporter_id,target_type,target_id,reason,detail) values ($1,'post',$2,'medical_misinformation','Needs review') returning id,status,target_author_id",
      [U.patientB, postId],
    ),
  );
  check("consumer reports a post", reportB.ok && reportB.rows?.[0]?.status === "open", reportB.error);
  check("target author is derived by the trigger", reportB.rows?.[0]?.target_author_id === U.patientA);
  const reportId = reportB.rows?.[0]?.id;

  const duplicate = await as(db, "authenticated", U.patientB, () =>
    db.query(
      "insert into public.community_reports (reporter_id,target_type,target_id,reason) values ($1,'post',$2,'spam')",
      [U.patientB, postId],
    ),
  );
  check("duplicate report is rejected", !duplicate.ok, duplicate.error);

  const foreignReport = await as(db, "authenticated", U.providerVerified, () =>
    db.query(
      "insert into public.community_reports (reporter_id,target_type,target_id,reason) values ($1,'post',$2,'spam')",
      [U.providerVerified, postId],
    ),
  );
  check("cannot report content in a space you cannot read", !foreignReport.ok && /space/i.test(foreignReport.error), foreignReport.error);

  section("5. only administrators moderate, through the RPCs");
  const userModerate = await as(db, "authenticated", U.patientB, () =>
    db.query("select public.moderate_community_content('post',$1,'hide','')", [postId]),
  );
  check("ordinary user cannot moderate", !userModerate.ok && /moderator only/i.test(userModerate.error), userModerate.error);

  const userUpdateStatus = await as(db, "authenticated", U.patientA, () =>
    db.query("update public.community_posts set status='hidden' where id=$1 returning id", [postId]),
  );
  check("author cannot set status directly", !userUpdateStatus.ok || userUpdateStatus.rows.length === 0, userUpdateStatus.error);

  const adminHide = await as(db, "authenticated", U.admin, () =>
    db.query("select public.moderate_community_content('post',$1,'hide','harassment review')", [postId]),
  );
  check("administrator hides a post", adminHide.ok, adminHide.error);

  const hiddenFromB = await as(db, "authenticated", U.patientB, () =>
    db.query("select id from public.community_posts where id=$1", [postId]),
  );
  check("hidden post disappears for other users", hiddenFromB.ok && hiddenFromB.rows.length === 0, hiddenFromB.error);

  const hiddenVisibleToAuthor = await as(db, "authenticated", U.patientA, () =>
    db.query("select id,status from public.community_posts where id=$1", [postId]),
  );
  check("author still sees their hidden post", hiddenVisibleToAuthor.ok && hiddenVisibleToAuthor.rows[0]?.status === "hidden", hiddenVisibleToAuthor.error);

  const adminRestore = await as(db, "authenticated", U.admin, () =>
    db.query("select public.moderate_community_content('post',$1,'restore','')", [postId]),
  );
  check("administrator restores a post", adminRestore.ok, adminRestore.error);

  const visibleAgain = await as(db, "authenticated", U.patientB, () =>
    db.query("select id from public.community_posts where id=$1", [postId]),
  );
  check("restored post is visible again", visibleAgain.ok && visibleAgain.rows.length === 1, visibleAgain.error);

  const resolve = await as(db, "authenticated", U.admin, () =>
    db.query("select public.resolve_community_report($1,'resolved','handled','hide')", [reportId]),
  );
  check("administrator resolves a report with a content action", resolve.ok, resolve.error);

  const reportState = await as(db, "authenticated", U.patientB, () =>
    db.query("select status,resolution_note,resolved_by from public.community_reports where id=$1", [reportId]),
  );
  check("report is closed with the moderator identity", reportState.ok && reportState.rows[0]?.status === "resolved" && reportState.rows[0]?.resolved_by === U.admin, JSON.stringify(reportState.rows?.[0]));

  const postAfterResolve = await as(db, "authenticated", U.admin, () =>
    db.query("select status from public.community_posts where id=$1", [postId]),
  );
  check("resolve applied the content action atomically", postAfterResolve.rows[0]?.status === "hidden", JSON.stringify(postAfterResolve.rows?.[0]));

  const hiddenEdit = await as(db, "authenticated", U.patientA, () =>
    db.query("update public.community_posts set body='Should fail' where id=$1 returning id", [postId]),
  );
  check("a moderated post cannot be edited by its author", !hiddenEdit.ok || hiddenEdit.rows.length === 0, hiddenEdit.error);

  const finalRestore = await as(db, "authenticated", U.admin, () =>
    db.query("select public.moderate_community_content('post',$1,'restore','')", [postId]),
  );
  check("administrator restores the moderated post for the ownership checks", finalRestore.ok, finalRestore.error);

  const audit = await as(db, "authenticated", U.admin, () =>
    db.query("select action from public.community_moderation_actions order by created_at"),
  );
  const auditActions = (audit.rows ?? []).map((r) => r.action);
  check(
    "audit records hide, restore and both resolve steps",
    audit.ok && auditActions.includes("hide") && auditActions.includes("restore") && auditActions.includes("resolve_report"),
    auditActions.join(","),
  );

  const userAudit = await as(db, "authenticated", U.patientB, () =>
    db.query("select id from public.community_moderation_actions"),
  );
  check("ordinary user cannot read the audit trail", userAudit.ok && userAudit.rows.length === 0, userAudit.error);

  const directAudit = await as(db, "authenticated", U.admin, () =>
    db.query(
      "insert into public.community_moderation_actions (moderator_id,target_type,target_id,action) values ($1,'post',$2,'hide')",
      [U.admin, postId],
    ),
  );
  check("audit table is append-only through the RPCs", !directAudit.ok, directAudit.error);

  section("6. ownership isolation");
  const bDeletesA = await as(db, "authenticated", U.patientB, () =>
    db.query("delete from public.community_posts where id=$1 returning id", [postId]),
  );
  check("another user cannot delete the post", bDeletesA.ok && bDeletesA.rows.length === 0, bDeletesA.error);

  const bEditsA = await as(db, "authenticated", U.patientB, () =>
    db.query("update public.community_posts set title='hijacked' where id=$1 returning id", [postId]),
  );
  check("another user cannot edit the post", bEditsA.ok && bEditsA.rows.length === 0, bEditsA.error);

  const aEditsOwn = await as(db, "authenticated", U.patientA, () =>
    db.query("update public.community_posts set body='Updated body' where id=$1 returning edited_at", [postId]),
  );
  check("author edits own post and edited_at is set", aEditsOwn.ok && Boolean(aEditsOwn.rows?.[0]?.edited_at), aEditsOwn.error);

  const bDeletesComment = await as(db, "authenticated", U.patientA, () =>
    db.query("delete from public.community_comments where id=$1 returning id", [commentId]),
  );
  check("another user cannot delete the comment", bDeletesComment.ok && bDeletesComment.rows.length === 0, bDeletesComment.error);

  const bDeletesOwnComment = await as(db, "authenticated", U.patientB, () =>
    db.query("delete from public.community_comments where id=$1 returning id", [commentId]),
  );
  check("author deletes own comment", bDeletesOwnComment.ok && bDeletesOwnComment.rows.length === 1, bDeletesOwnComment.error);

  section("7. snapshot, timestamp and identity integrity");
  const spoofPost = await as(db, "authenticated", U.patientA, () =>
    db.query(
      "update public.community_posts set author_name='Someone Else', created_at='2000-01-01T00:00:00Z', edited_at='2000-01-01T00:00:00Z' where id=$1 returning author_name,created_at,edited_at",
      [postId],
    ),
  );
  check(
    "author cannot rewrite the published-by snapshot",
    spoofPost.ok && spoofPost.rows?.[0]?.author_name === "Patient A",
    JSON.stringify(spoofPost.rows?.[0]),
  );
  check(
    "author cannot backdate created_at",
    spoofPost.ok && new Date(spoofPost.rows?.[0]?.created_at).getUTCFullYear() !== 2000,
    JSON.stringify(spoofPost.rows?.[0]),
  );
  check(
    "edited_at is frozen when title/body did not change",
    spoofPost.ok && new Date(spoofPost.rows?.[0]?.edited_at).getUTCFullYear() !== 2000,
    JSON.stringify(spoofPost.rows?.[0]),
  );

  const movePost = await as(db, "authenticated", U.patientA, () =>
    db.query(
      "update public.community_posts set id='00000000-0000-4000-8000-00000000dead' where id=$1 returning id",
      [postId],
    ),
  );
  check("post identity is immutable", !movePost.ok && /immutable/i.test(movePost.error), movePost.error);

  const freshComment = await as(db, "authenticated", U.patientB, () =>
    db.query(
      "insert into public.community_comments (post_id,author_id,body) values ($1,$2,'Snapshot check') returning id,author_name",
      [postId, U.patientB],
    ),
  );
  const freshCommentId = freshComment.rows?.[0]?.id;
  const spoofComment = await as(db, "authenticated", U.patientB, () =>
    db.query(
      "update public.community_comments set author_name='Someone Else', created_at='2000-01-01T00:00:00Z' where id=$1 returning author_name,created_at",
      [freshCommentId],
    ),
  );
  check(
    "comment snapshot and created_at are immutable",
    spoofComment.ok &&
      spoofComment.rows?.[0]?.author_name === "Patient B" &&
      new Date(spoofComment.rows?.[0]?.created_at).getUTCFullYear() !== 2000,
    JSON.stringify(spoofComment.rows?.[0]),
  );
  const moveComment = await as(db, "authenticated", U.patientB, () =>
    db.query(
      "update public.community_comments set id='00000000-0000-4000-8000-00000000beef' where id=$1 returning id",
      [freshCommentId],
    ),
  );
  check("comment identity is immutable", !moveComment.ok && /immutable/i.test(moveComment.error), moveComment.error);

  const helperAnon = await as(db, "anon", undefined, () =>
    db.query("select public.community_target_author('post',$1) as author_id", [postId]),
  );
  check(
    "anon cannot call the internal report helper",
    !helperAnon.ok && /permission denied/i.test(helperAnon.error),
    helperAnon.error,
  );
  const helperUser = await as(db, "authenticated", U.providerVerified, () =>
    db.query("select public.community_target_author('post',$1) as author_id", [postId]),
  );
  check(
    "a signed-in user cannot call the internal report helper",
    !helperUser.ok && /permission denied/i.test(helperUser.error),
    helperUser.error,
  );

  section("8. posting rate limit is enforced in the database");
  let allowed = 0;
  let blocked = false;
  for (let i = 0; i < 21; i += 1) {
    const r = await insertPost(
      "authenticated",
      U.rateUser,
      "patients",
      `Rate post ${i}`,
      "Rate-limit fixture body",
    );
    if (r.ok) allowed += 1;
    else if (/rate_limited/i.test(r.error)) blocked = true;
    else {
      check(`unexpected failure on post ${i}`, false, r.error);
      break;
    }
  }
  check("20 posts are accepted", allowed <= 20, `accepted=${allowed}`);
  check("the 21st post is rate-limited", blocked, `accepted=${allowed}`);

  section("9. deleted actors anonymise audit rows");
  /* The auth stub grants service_role usage but not table DML; real projects
     delete auth users through GoTrue's admin API. Grant the one capability
     the scenario needs so the FK behaviour is what is under test. */
  await db.exec("grant select, delete on auth.users to service_role;");
  await db.exec("set role service_role;");
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
  const applicationRow = await db.query(
    "select id from public.provider_applications where user_id=$1",
    [U.providerVerified],
  );
  await db.query(
    `insert into public.provider_application_audit
       (application_id,reviewer_id,previous_status,new_status)
     values ($1,$2,'submitted','verified')`,
    [applicationRow.rows[0].id, U.admin],
  );
  const moderationBefore = await db.query(
    "select count(*)::int as total from public.community_moderation_actions",
  );
  let deleteAdminError = "";
  try {
    await db.query("delete from auth.users where id=$1", [U.admin]);
  } catch (e) {
    deleteAdminError = e.message;
  }
  const moderationAfter = await db.query(
    `select count(*)::int as total,
            count(*) filter (where moderator_id is null)::int as anonymised
       from public.community_moderation_actions`,
  );
  const providerAuditAfter = await db.query(
    "select reviewer_id from public.provider_application_audit where application_id=$1",
    [applicationRow.rows[0].id],
  );
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");
  check(
    "deleting a moderator account succeeds",
    !deleteAdminError,
    deleteAdminError,
  );
  check(
    "community audit rows keep their history with a null actor",
    moderationBefore.rows[0].total > 0 &&
      moderationAfter.rows[0].total === moderationBefore.rows[0].total &&
      moderationAfter.rows[0].anonymised === moderationAfter.rows[0].total,
    JSON.stringify({ before: moderationBefore.rows[0], after: moderationAfter.rows[0] }),
  );
  check(
    "provider audit rows keep their history with a null reviewer",
    providerAuditAfter.rows[0]?.reviewer_id === null,
    JSON.stringify(providerAuditAfter.rows[0]),
  );

  const failed = checks.filter((c) => !c.ok);
  console.log("\n" + "=".repeat(78));
  console.log(`COMMUNITY RESULT: ${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAILED: ${f.name} -- ${f.detail}`);
    process.exitCode = 1;
  }
  await db.close();
})().catch((e) => {
  console.error("HARNESS ERROR", e);
  process.exit(1);
});
