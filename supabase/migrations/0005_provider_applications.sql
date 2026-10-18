-- ============================================================================
-- 0005_provider_applications.sql
--
-- Provider application table for the administrator review dashboard.
--
-- Forward-only migration. Creates the provider_applications table with
-- row-level security so that only authenticated administrators can read
-- or write application records.
--
-- Notes:
--   - Document metadata (identity and credential evidence) is stored as
--     JSONB within the application row. Actual file bytes live in a private
--     Supabase Storage bucket and are referenced by path; they are never
--     served through public URLs.
--   - The `grant_role()` function from 0003 is the only supported path for
--     promoting a user to administrator. This migration issues no role
--     changes itself.
-- ============================================================================

create table if not exists public.provider_applications (
  id uuid primary key default gen_random_uuid(),

  -- Account linkage
  user_id uuid references auth.users on delete cascade not null,
  email text not null,
  full_name text not null,
  phone text not null default '',

  -- Acceptance
  accepted_terms boolean not null default false,
  accepted_privacy boolean not null default false,

  -- Professional category
  category text not null default '',
  trainee boolean not null default false,

  -- Professional profile
  speciality text not null default '',
  qualifications text not null default '',
  institution text not null default '',
  registration_number text not null default '',
  licensing_body text not null default '',
  licence_expiry timestamptz,
  years_experience text not null default '',
  bio text not null default '',
  languages text not null default '',
  state text not null default '',
  city text not null default '',
  facility text not null default '',
  services text not null default '',

  -- Evidence (metadata only; file bytes are in private storage)
  identity_document jsonb,
  identity_status text not null default 'not-started'
    check (identity_status in ('not-started', 'submitted', 'verified', 'rejected')),
  credential_evidence jsonb,
  credentials_status text not null default 'not-started'
    check (credentials_status in ('not-started', 'submitted', 'verified', 'rejected')),

  -- Workflow
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under-review', 'needs-info', 'verified', 'rejected', 'suspended')),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),

  -- Review audit
  review_note text not null default '',
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,

  -- One application per account
  unique (user_id)
);

-- Indexes for admin review queries
create index if not exists provider_applications_status_idx on public.provider_applications (status);
create index if not exists provider_applications_user_idx on public.provider_applications (user_id);
create index if not exists provider_applications_category_idx on public.provider_applications (category);
create index if not exists provider_applications_updated_idx on public.provider_applications (updated_at desc);

-- Enable RLS
alter table public.provider_applications enable row level security;

-- Policies: only authenticated administrators may access applications.
-- The admin role is established through grant_role() (0003) and is never
-- self-assignable. No anon or authenticated client role may read or write
-- application records directly.

drop policy if exists provider_applications_select_admin on public.provider_applications;
create policy provider_applications_select_admin
  on public.provider_applications
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

drop policy if exists provider_applications_insert_admin on public.provider_applications;
create policy provider_applications_insert_admin
  on public.provider_applications
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists provider_applications_update_admin on public.provider_applications;
create policy provider_applications_update_admin
  on public.provider_applications
  for update
  to authenticated
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Private storage bucket for provider application documents.
-- Files are referenced by path in identity_document / credential_evidence.
-- Access to the bucket is controlled by separate storage policies (not
-- defined here) that restrict reads to authenticated administrators and
-- writes to the owning applicant.
insert into storage.buckets (id, name, public)
values ('provider-applications', 'provider-applications', false)
on conflict (id) do nothing;
