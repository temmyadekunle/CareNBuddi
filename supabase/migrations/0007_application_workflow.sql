-- ============================================================================
-- 0007_application_workflow.sql
--
-- Server-authoritative provider application workflow.
--
-- Until now the application record and its review state existed only on the
-- applicant's device (localStorage) and no client code wrote to the
-- provider_applications table created in 0005. That made the whole review
-- state client-controlled: the UI could display an invented status, and a
-- reviewing administrator could only ever see their own device's data.
--
-- This migration supplies the two database entry points the workflow needs:
--
--   public.upsert_provider_application(payload jsonb, submit boolean)
--     - applicant path
--     - creates or updates ONLY permitted applicant fields
--     - forces user_id = auth.uid(); the caller cannot address anyone else's row
--     - review/status authority fields are NOT writable from the payload
--     - validates that document references belong to this applicant AND this
--       application row (path segments [2] and [3])
--     - transitions: draft -> submitted and needs-info -> submitted only
--
--   public.review_provider_application(app_id uuid, next text, reason text,
--     credential_type text, credential_path text)
--     - administrator decision path
--     - derives the reviewer identity from the JWT (auth.uid()), never from
--       client-supplied values
--     - enforces the transition matrix mirrored in
--       lib/provider-application.ts (APPLICATION_TRANSITIONS)
--     - requires a reason for needs-info / rejected / suspended
--     - updates the application row AND inserts the audit row in the same
--       transaction: a failed decision leaves neither; a successful one
--       cannot omit its audit entry
--
-- Both functions bypass RLS by being SECURITY DEFINER, by design: they are
-- the single allowed write path for their respective callers. Direct table
-- writes stay governed by the 0005 policies (administrator-only). Neither
-- function trusts a client-supplied role, reviewer id, or status.
--
-- CAVEAT (documented, not hidden): service-role credentials and database
-- owners hold BYPASSRLS and can write provider_applications or the audit
-- table directly, bypassing every policy here. That is inherent to
-- PostgreSQL RLS; the audit table exists precisely so privileged actions
-- remain visible.
--
-- Forward-only migration. Never rewrites historical migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Applicant read access to their own application row.
--
-- The status screen must display the SERVER's status (never a locally
-- invented one), and the applicant needs to read their own row to do that.
-- Writes remain admin-only (0005); applicants write through the function
-- below.
-- ---------------------------------------------------------------------------
drop policy if exists provider_applications_select_own on public.provider_applications;
create policy provider_applications_select_own
  on public.provider_applications
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and auth.role() = 'authenticated'
  );

-- ---------------------------------------------------------------------------
-- Allowed admin review transitions, as a standalone helper so the matrix is
-- legible and testable independently of the write path. Must stay in step
-- with APPLICATION_TRANSITIONS in lib/provider-application.ts.
-- ---------------------------------------------------------------------------
create or replace function public.can_review_transition(p_from text, p_to text)
returns boolean
language sql
stable
as $$
  select (p_from, p_to) in (
    ('submitted', 'under-review'), ('submitted', 'needs-info'),
    ('submitted', 'verified'), ('submitted', 'rejected'),
    ('under-review', 'needs-info'), ('under-review', 'verified'),
    ('under-review', 'rejected'), ('under-review', 'suspended'),
    ('needs-info', 'under-review'), ('needs-info', 'verified'),
    ('needs-info', 'rejected'), ('needs-info', 'suspended'),
    ('verified', 'suspended'),
    ('suspended', 'verified'), ('suspended', 'rejected')
  );
$$;

-- ---------------------------------------------------------------------------
-- Applicant submission/update function.
--
-- Exactly one application per account (0005 unique(user_id)). The payload is
-- the canonical ProviderApplication object with camelCase keys. The function
-- performs a FULL REPLACE of the permitted fields: callers always send the
-- complete object built by the domain module, and any field not listed in
-- the INSERT is ignored, never merged.
--
-- Application id ownership: the applicant's own generated uuid is accepted
-- for a brand-new row. Uploading documents names the application id in the
-- storage path (segment [3]) BEFORE the row exists server-side, so the
-- server adopts the id the uploads were made under; a malformed value falls
-- back to a server-generated uuid. For an existing row the database id wins
-- and the payload id is ignored. Because user_id is forced to auth.uid(),
-- no caller can ever steer an id belonging to someone else.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_provider_application(
  p_payload jsonb,
  p_submit boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_result jsonb;
  v_id uuid;
  v_id_path text;
  v_cred_path text;
begin
  -- Caller validation. Identity comes from the JWT, never from the payload:
  -- a signed-in account can only ever act as itself.
  if coalesce(auth.uid()::text, '') = '' or coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'applicant sign-in required';
  end if;

  begin
    if coalesce(p_payload->>'id', '') <> '' then
      v_id := (p_payload->>'id')::uuid;
    end if;
  exception when invalid_text_representation then
    v_id := null; -- malformed local id: fall through to a server uuid
  end;

  -- Document references must belong to this applicant. Path segment [2] is
  -- the owner's user id, exactly as the Storage policy in 0006 checks it.
  v_id_path := p_payload #>> '{identityDocument,storagePath}';
  v_cred_path := p_payload #>> '{credentialEvidence,storagePath}';
  if coalesce(v_id_path, '') <> '' and split_part(v_id_path, '/', 2) <> auth.uid()::text then
    raise exception 'identity document belongs to a different account';
  end if;
  if coalesce(v_cred_path, '') <> '' and split_part(v_cred_path, '/', 2) <> auth.uid()::text then
    raise exception 'credential document belongs to a different account';
  end if;

  -- Validate submission preconditions before touching any row.
  if p_submit then
    if coalesce(p_payload->>'acceptedTerms', '') <> 'true'
       or coalesce(p_payload->>'acceptedPrivacy', '') <> 'true' then
      raise exception 'terms and privacy policy must be accepted';
    end if;
    if coalesce(p_payload->>'category', '') = '' then
      raise exception 'professional category is required';
    end if;
    if p_payload #>> '{identityDocument,fileName}' is null then
      raise exception 'identity document is required';
    end if;
  end if;

  select id, status into v_existing from public.provider_applications
    where user_id = auth.uid() for update;

  if v_existing.id is not null then
    v_id := v_existing.id; -- the database row id always wins over the payload
    if v_existing.status not in ('draft', 'needs-info') then
      raise exception 'application is locked while under administrator control';
    end if;
  end if;

  -- Uploaded documents must name the id the row will carry in path segment
  -- [3]. For a new row that is the adopted client id; when the server
  -- generates one (v_id is null) a stale path cannot match and is refused,
  -- keeping every on-server reference consistent with its row.
  if coalesce(v_id_path, '') <> '' and
     (v_id is null or split_part(v_id_path, '/', 3) <> v_id::text) then
    raise exception 'identity document references a different application';
  end if;
  if coalesce(v_cred_path, '') <> '' and
     (v_id is null or split_part(v_cred_path, '/', 3) <> v_id::text) then
    raise exception 'credential document references a different application';
  end if;

  with new_row as (
    insert into public.provider_applications as inserted (
      id, user_id, email, full_name, phone,
      accepted_terms, accepted_privacy,
      category, trainee,
      speciality, qualifications, institution, registration_number,
      licensing_body, licence_expiry, years_experience, bio, languages,
      state, city, facility, services,
      identity_document, identity_status, credential_evidence, credentials_status,
      status, submitted_at, updated_at, review_note, reviewed_by, reviewed_at
    ) values (
      coalesce(v_id, gen_random_uuid()),
      auth.uid(),
      coalesce(p_payload->>'email', ''),
      coalesce(p_payload->>'fullName', ''),
      coalesce(p_payload->>'phone', ''),
      coalesce((p_payload->>'acceptedTerms')::boolean, false),
      coalesce((p_payload->>'acceptedPrivacy')::boolean, false),
      coalesce(p_payload->>'category', ''),
      coalesce((p_payload->>'trainee')::boolean, false),
      coalesce(p_payload->>'speciality', ''),
      coalesce(p_payload->>'qualifications', ''),
      coalesce(p_payload->>'institution', ''),
      coalesce(p_payload->>'registrationNumber', ''),
      coalesce(p_payload->>'licensingBody', ''),
      nullif(p_payload->>'licenceExpiry', '')::timestamptz,
      coalesce(p_payload->>'yearsExperience', ''),
      coalesce(p_payload->>'bio', ''),
      coalesce(p_payload->>'languages', ''),
      coalesce(p_payload->>'state', ''),
      coalesce(p_payload->>'city', ''),
      coalesce(p_payload->>'facility', ''),
      coalesce(p_payload->>'services', ''),
      p_payload #> '{identityDocument}',
      case
        when coalesce(p_payload #>> '{identityDocument,storagePath}', '') <> ''
          then 'submitted' else 'not-started'
      end,
      p_payload #> '{credentialEvidence}',
      case
        when coalesce(p_payload #>> '{credentialEvidence,storagePath}', '') <> ''
          then 'submitted' else 'not-started'
      end,
      case when p_submit then 'submitted' else 'draft' end,
      case when p_submit then now() else null end,
      now(),
      '',  -- review_note is administrator-authoritative
      null, -- reviewed_by likewise
      null  -- reviewed_at likewise
    )
    on conflict (user_id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      phone = excluded.phone,
      accepted_terms = excluded.accepted_terms,
      accepted_privacy = excluded.accepted_privacy,
      category = excluded.category,
      trainee = excluded.trainee,
      speciality = excluded.speciality,
      qualifications = excluded.qualifications,
      institution = excluded.institution,
      registration_number = excluded.registration_number,
      licensing_body = excluded.licensing_body,
      licence_expiry = excluded.licence_expiry,
      years_experience = excluded.years_experience,
      bio = excluded.bio,
      languages = excluded.languages,
      state = excluded.state,
      city = excluded.city,
      facility = excluded.facility,
      services = excluded.services,
      identity_document = excluded.identity_document,
      identity_status = excluded.identity_status,
      credential_evidence = excluded.credential_evidence,
      credentials_status = excluded.credentials_status,
      status = case
        when p_submit then 'submitted'
        else (case when inserted.status = 'needs-info' then 'needs-info' else 'draft' end)
      end,
      submitted_at = case when p_submit then now() else inserted.submitted_at end,
      updated_at = now(),
      review_note = inserted.review_note,
      reviewed_by = inserted.reviewed_by,
      reviewed_at = inserted.reviewed_at
    returning to_jsonb(inserted.*) as full_row
  )
  select coalesce(
    (select full_row from new_row),
    (select to_jsonb(r.*) from public.provider_applications r where r.user_id = auth.uid())
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrator review function.
--
-- The row update and the audit insert execute inside the caller's one
-- transaction, so a rejected decision rolls BOTH back, and a committed
-- decision always carries its audit row.
-- ---------------------------------------------------------------------------
create or replace function public.review_provider_application(
  p_application_id uuid,
  p_next text,
  p_reason text default '',
  p_credential_type text default null,
  p_credential_path text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.provider_applications%rowtype;
begin
  -- Caller validation: an authenticated account whose PROFILE carries the
  -- admin role (0003 grants admin only along the documented provisioning
  -- path). No client-supplied reviewer id or role is accepted anywhere.
  if coalesce(auth.uid()::text, '') = '' or coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'administrator sign-in required';
  end if;
  if not public.is_admin() then
    raise exception 'administrator role required';
  end if;
  if p_application_id is null then
    raise exception 'application id required';
  end if;

  select * into v_row from public.provider_applications
    where id = p_application_id for update;
  if v_row.id is null then
    raise exception 'application not found';
  end if;

  if not public.can_review_transition(v_row.status, p_next) then
    raise exception 'invalid status transition';
  end if;

  -- The decision reason doubles as the request-for-information message. It
  -- is required wherever the applicant must act on it or the decision is
  -- adverse; optional for under-review and verified.
  if p_next in ('needs-info', 'rejected', 'suspended')
     and coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required for this decision';
  end if;

  update public.provider_applications set
    status = p_next,
    identity_status = case when p_next = 'verified' then 'verified' else identity_status end,
    credentials_status = case when p_next = 'verified' then 'verified' else credentials_status end,
    review_note = coalesce(btrim(p_reason), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = v_row.id;

  insert into public.provider_application_audit (
    application_id, reviewer_id, previous_status, new_status,
    reason, credential_type, credential_path, created_at
  ) values (
    v_row.id, auth.uid(), v_row.status, p_next,
    coalesce(btrim(p_reason), ''), p_credential_type, p_credential_path, now()
  );

  return p_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions.
--
-- Supabase's default privileges grant EXECUTE on functions to anon and
-- authenticated. Anonymous sessions must be able to call neither, and both
-- are granted explicitly to authenticated.
-- ---------------------------------------------------------------------------
revoke execute on function public.upsert_provider_application(jsonb, boolean) from anon, public;
revoke execute on function public.review_provider_application(uuid, text, text, text, text) from anon, public;
grant execute on function public.upsert_provider_application(jsonb, boolean) to authenticated;
grant execute on function public.review_provider_application(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Supervisor writes must be audited.
--
-- Supabase's default privileges grant UPDATE and DELETE on every public table
-- to anon and authenticated, and the 0005 update policy permits an
-- administrator's session to pass. A direct UPDATE from an admin session
-- would change status while silently skipping the audit row, so UPDATE and
-- DELETE are revoked from the client roles entirely: the functions above are
-- now the ONLY client write path for applications. service_role and database
-- owners retain their inherent privileges (see the CAVEAT at the top).
-- ---------------------------------------------------------------------------
revoke update, delete on public.provider_applications from anon, authenticated;
