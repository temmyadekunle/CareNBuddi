-- HealthLink — initial schema
-- Run this once in Supabase Studio → SQL Editor (or `supabase db push`).
-- Every table is private to its owner: row level security is enabled and the
-- policies below are the only way in. The anon key shipped in the browser can
-- never read another person's health data.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Staff = provider or admin. Used by the booking/report/request policies.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('provider', 'admin')
  );
$$;

-- Creates a profile row whenever someone signs up, so the app always has a
-- profile to attach records to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, lang)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('consumer', 'provider', 'admin')
        then new.raw_user_meta_data ->> 'role'
      else 'consumer'
    end,
    coalesce(new.raw_user_meta_data ->> 'lang', 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role text not null default 'consumer' check (role in ('consumer', 'provider', 'admin')),
  lang text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Personal health records (journal, medical records, reminders, passport,
-- care circle, weigh-ins, workouts, bookings). One row per collection so a
-- feature can evolve without a migration.
create table if not exists public.health_documents (
  user_id uuid not null references auth.users on delete cascade,
  doc_key text not null,
  payload jsonb not null default '[]'::jsonb,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_key)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  provider_id text,
  name text not null,
  phone text not null,
  message text not null default '',
  service text,
  preferred_date date,
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  name text not null,
  email text,
  facility text not null,
  category text not null default '',
  state text not null default '',
  lga text not null default '',
  address text not null default '',
  phone text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  target_type text not null check (target_type in ('topic', 'provider')),
  target_id text not null,
  reason text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists health_documents_user_idx on public.health_documents (user_id);
create index if not exists bookings_user_idx on public.bookings (user_id);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists provider_requests_status_idx on public.provider_requests (status);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists health_documents_set_updated_at on public.health_documents;
create trigger health_documents_set_updated_at
  before update on public.health_documents
  for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.health_documents enable row level security;
alter table public.bookings enable row level security;
alter table public.provider_requests enable row level security;
alter table public.reports enable row level security;

-- profiles: you can read and edit only your own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_staff());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- health documents: strictly one owner, no exceptions.
drop policy if exists documents_owner_all on public.health_documents;
create policy documents_owner_all on public.health_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bookings: anyone signed in can request, staff can triage.
drop policy if exists bookings_insert_own on public.bookings;
create policy bookings_insert_own on public.bookings
  for insert with check (auth.uid() = user_id or auth.uid() is null);

drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select using (auth.uid() = user_id or public.is_staff());

drop policy if exists bookings_update_staff on public.bookings;
create policy bookings_update_staff on public.bookings
  for update using (public.is_staff()) with check (public.is_staff());

-- provider directory applications.
drop policy if exists provider_requests_insert on public.provider_requests;
create policy provider_requests_insert on public.provider_requests
  for insert with check (auth.uid() = user_id or auth.uid() is null);

drop policy if exists provider_requests_select_staff on public.provider_requests;
create policy provider_requests_select_staff on public.provider_requests
  for select using (public.is_staff() or auth.uid() = user_id);

drop policy if exists provider_requests_update_staff on public.provider_requests;
create policy provider_requests_update_staff on public.provider_requests
  for update using (public.is_staff()) with check (public.is_staff());

-- content / provider reports.
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (auth.uid() = user_id or auth.uid() is null);

drop policy if exists reports_select_staff on public.reports;
create policy reports_select_staff on public.reports
  for select using (public.is_staff() or auth.uid() = user_id);

drop policy if exists reports_update_staff on public.reports;
create policy reports_update_staff on public.reports
  for update using (public.is_staff()) with check (public.is_staff());