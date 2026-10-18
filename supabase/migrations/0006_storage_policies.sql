-- ============================================================================
-- 0006_storage_policies.sql
--
-- Storage policies for private provider-application documents and an
-- append-only audit history table for administrator review decisions.
--
-- Forward-only migration. Never rewrites historical migrations.
--
-- Path scheme (application-scoped, prevents cross-applicant access):
--
--   provider-applications/{userId}/{applicationId}/{docType}/{fileName}
--
-- The second path segment is the authenticated user's ID, so a Storage policy
-- can verify ownership by checking that segment against auth.uid().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Storage policies for the private provider-applications bucket.
--
-- The bucket itself is created in migration 0005. These policies govern who
-- can read and write objects inside it. All policies are scoped to the
-- provider-applications bucket only; no other bucket is affected.
--
-- Path scheme: provider-applications/{userId}/{applicationId}/{docType}/{fileName}
--   segment [2] = authenticated user's ID (ownership check)
--   segment [3] = application ID
--   segment [4] = document type (identity or credentials)
-- ---------------------------------------------------------------------------

-- Applicant can upload documents only to their own application path.
-- The path's second segment must match the authenticated user's ID, so an
-- applicant cannot upload to another applicant's path.
do $$
begin
  if to_regclass('storage.objects') is not null then
    -- CREATE POLICY has no IF NOT EXISTS, so arrive at the same idempotence
    -- the way the earlier migrations do: drop-if-exists, then create.
    drop policy if exists provider_applications_upload_own on storage.objects;
    create policy provider_applications_upload_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'provider-applications'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;

-- Applicant can view/download their own documents.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists provider_applications_view_own on storage.objects;
    create policy provider_applications_view_own
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'provider-applications'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;

-- Applicant cannot replace or delete their own documents after upload.
-- Uploads are append-only; replacement or deletion requires administrator
-- action outside this policy. No update/delete policy is granted to
-- authenticated client roles.
--
-- Supabase grants UPDATE and DELETE on storage.objects to anon and
-- authenticated in its own storage schema init, and with RLS on, an UPDATE
-- or DELETE with no dedicated policy falls back to the SELECT policy for
-- visibility rather than failing loudly — so an applicant could rewrite the
-- name of their own object into another applicant's path. Append-only has
-- to be a revocation.
do $$
begin
  if to_regclass('storage.objects') is not null then
    revoke update, delete on storage.objects from anon, authenticated;
  end if;
end $$;

-- Authenticated administrator can view any document in the bucket for review.
-- Enforced by the database, not frontend visibility.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists provider_applications_admin_view on storage.objects;
    create policy provider_applications_admin_view
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'provider-applications'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
  end if;
end $$;

-- Anonymous users have no storage policies for this bucket, so they cannot
-- read, upload, replace, or delete any private provider documents.

-- ---------------------------------------------------------------------------
-- Append-only audit history for administrator review decisions.
--
-- Every review decision is recorded here. Providers cannot insert, update,
-- or delete rows; only administrators (via the service-role Worker path or
-- an authenticated admin session) can write.
-- ---------------------------------------------------------------------------

create table if not exists public.provider_application_audit (
  id uuid primary key default gen_random_uuid(),

  application_id uuid not null
    references public.provider_applications(id) on delete cascade,

  reviewer_id uuid not null
    references auth.users(id) on delete set null,

  -- status values are constrained to the same set as provider_applications.
  -- (%TYPE is PL/pgSQL-only and cannot appear in CREATE TABLE, so the type is
  -- declared explicitly and kept in sync with the check in 0005.)
  previous_status text not null
    check (previous_status in ('draft', 'submitted', 'under-review', 'needs-info', 'verified', 'rejected', 'suspended')),
  new_status text not null
    check (new_status in ('draft', 'submitted', 'under-review', 'needs-info', 'verified', 'rejected', 'suspended')),

  reason text not null default '',

  credential_type text,
  credential_path text,

  created_at timestamptz not null default now()
);

create index if not exists provider_application_audit_application_idx
  on public.provider_application_audit (application_id);
create index if not exists provider_application_audit_created_idx
  on public.provider_application_audit (created_at desc);

alter table public.provider_application_audit enable row level security;

-- Only authenticated administrators may read audit history.
drop policy if exists provider_application_audit_select_admin on public.provider_application_audit;
create policy provider_application_audit_select_admin
  on public.provider_application_audit
  for select
  to authenticated
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only authenticated administrators may insert audit rows.
drop policy if exists provider_application_audit_insert_admin on public.provider_application_audit;
create policy provider_application_audit_insert_admin
  on public.provider_application_audit
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and auth.uid() = reviewer_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Providers and anonymous users cannot read or write audit history.
-- No select/insert/update/delete policy is granted to them.
--
-- The DEFAULT Supabase privileges grant UPDATE and DELETE on every public
-- table to anon and authenticated. With RLS on, an UPDATE or DELETE with no
-- dedicated policy does not fail loudly: the SELECT policy is consulted for
-- visibility and the write would then proceed. Append-only therefore has to
-- be a revocation, not an omission.
revoke update, delete on public.provider_application_audit from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Application-scoped path validation helper.
--
-- This SQL function validates that a proposed storage path is well-formed and
-- application-scoped. It is used by application code (and could be used by
-- database triggers) to reject path-traversal attempts before they reach
-- Supabase Storage.
-- ---------------------------------------------------------------------------

create or replace function public.validate_provider_document_path(
  p_user_id uuid,
  p_application_id uuid,
  p_doc_type text,
  p_file_name text
) returns text
language sql
stable
as $$
  select
    'provider-applications/' || p_user_id::text || '/' ||
    p_application_id::text || '/' || p_doc_type || '/' || p_file_name
$$;

comment on function public.validate_provider_document_path is
  'Builds an application-scoped storage path: provider-applications/{userId}/{applicationId}/{docType}/{fileName}';
