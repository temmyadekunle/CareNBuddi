-- ============================================================================
-- 0010_community.sql
--
-- Server-authoritative Community.
--
-- Two separate spaces:
--   patients  - consumer accounts only (administrators may read/moderate)
--   providers - providers whose application status is 'verified' only
--
-- Posting, commenting, reporting and moderation are all enforced by the
-- database. The browser never decides who may read or write: the RLS
-- policies below are the only path to the tables, and the moderation RPCs
-- are the only path that can change a post or comment status.
--
-- No seed rows, demo threads or invented discussions are inserted here.
--
-- Forward-only migration. Never rewrites historical migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- A verified provider is a profile with role 'provider' AND an application
-- row whose status is 'verified'. Administrators are deliberately NOT
-- "verified providers"; they get moderation access through is_admin().
create or replace function public.is_verified_provider_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join public.provider_applications a on a.user_id = p.id
     where p.id = p_user
       and p.role = 'provider'
       and a.status = 'verified'
  );
$$;

-- Who may READ a space. Admins read both spaces for moderation.
create or replace function public.community_can_read_space(p_space text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then false
    when p_space = 'patients' then exists (
      select 1 from public.profiles
       where id = p_user and role in ('consumer', 'admin')
    )
    when p_space = 'providers' then
      exists (select 1 from public.profiles where id = p_user and role = 'admin')
      or public.is_verified_provider_user(p_user)
    else false
  end;
$$;

-- Who may WRITE in a space. Admins moderate; they do not post.
create or replace function public.community_can_post_in_space(p_space text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then false
    when p_space = 'patients' then exists (
      select 1 from public.profiles
       where id = p_user and role = 'consumer'
    )
    when p_space = 'providers' then public.is_verified_provider_user(p_user)
    else false
  end;
$$;

revoke all on function public.is_verified_provider_user(uuid) from public, anon;
revoke all on function public.community_can_read_space(text, uuid) from public, anon;
revoke all on function public.community_can_post_in_space(text, uuid) from public, anon;
grant execute on function public.is_verified_provider_user(uuid) to authenticated;
grant execute on function public.community_can_read_space(text, uuid) to authenticated;
grant execute on function public.community_can_post_in_space(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  space text not null check (space in ('patients', 'providers')),
  author_id uuid not null references public.profiles(id) on delete cascade,
  -- Snapshot written by a trigger from profiles.full_name. Profiles are not
  -- publicly readable, so the feed needs the display name at insert time.
  author_name text not null default '',
  title text not null check (char_length(btrim(title)) between 3 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  target_author_id uuid references public.profiles(id) on delete set null,
  reason text not null
    check (reason in ('spam', 'harassment', 'medical_misinformation', 'privacy', 'other')),
  detail text not null default '' check (char_length(detail) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text not null default '',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'report')),
  target_id uuid not null,
  action text not null
    check (action in ('hide', 'restore', 'remove', 'resolve_report', 'dismiss_report')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_posts_space_created_idx
  on public.community_posts (space, created_at desc);
create index if not exists community_posts_author_idx
  on public.community_posts (author_id);
create index if not exists community_posts_status_idx
  on public.community_posts (status);
create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at);
create index if not exists community_comments_author_idx
  on public.community_comments (author_id);
create index if not exists community_reports_status_created_idx
  on public.community_reports (status, created_at desc);
create index if not exists community_reports_target_idx
  on public.community_reports (target_type, target_id);
create index if not exists community_moderation_created_idx
  on public.community_moderation_actions (created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_moderation_actions enable row level security;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- The display name is derived from the profile, never from the client.
create or replace function public.community_set_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(btrim(p.full_name), ''), 'Community member')
    into v_name
    from public.profiles p
   where p.id = new.author_id;

  if v_name is null then
    raise exception 'community: author profile not found';
  end if;

  new.author_name := left(v_name, 120);
  return new;
end;
$$;

-- Posts: force ownership/space/status rules even if a privileged caller
-- writes directly. The RLS policies below are the primary boundary; this
-- trigger is defence in depth for the invariants.
create or replace function public.community_guard_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.author_id <> auth.uid() then
      raise exception 'community: author must be the signed-in user';
    end if;
    if not public.community_can_post_in_space(new.space, new.author_id) then
      raise exception 'community: not allowed to post in this space';
    end if;

    -- Abuse control, best effort but enforced in the database.
    select count(*)::int into v_recent
      from public.community_posts
     where author_id = new.author_id
       and created_at > now() - interval '1 hour';
    if v_recent >= 20 then
      raise exception 'community: rate_limited';
    end if;

    new.status := 'published';
    new.created_at := now();
    new.updated_at := now();
    new.edited_at := null;
    return new;
  end if;

  -- UPDATE
  if new.author_id <> old.author_id or new.space <> old.space then
    raise exception 'community: author and space are immutable';
  end if;

  if new.status <> old.status
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'community: status is moderator-controlled';
  end if;

  if old.status <> 'published'
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'community: only published posts can be edited';
  end if;

  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.community_guard_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
  v_space text;
  v_post_status text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.author_id <> auth.uid() then
      raise exception 'community: author must be the signed-in user';
    end if;

    select p.space, p.status into v_space, v_post_status
      from public.community_posts p
     where p.id = new.post_id;
    if v_space is null then
      raise exception 'community: post not found';
    end if;
    if v_post_status <> 'published' then
      raise exception 'community: post is not open for comments';
    end if;
    if not public.community_can_post_in_space(v_space, new.author_id) then
      raise exception 'community: not allowed to comment in this space';
    end if;

    select count(*)::int into v_recent
      from public.community_comments
     where author_id = new.author_id
       and created_at > now() - interval '1 hour';
    if v_recent >= 120 then
      raise exception 'community: rate_limited';
    end if;

    new.status := 'published';
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.author_id <> old.author_id or new.post_id <> old.post_id then
    raise exception 'community: author and post are immutable';
  end if;
  if new.status <> old.status
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'community: status is moderator-controlled';
  end if;
  if old.status <> 'published'
     and auth.role() <> 'service_role'
     and not public.is_admin() then
    raise exception 'community: only published comments can be edited';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Reported content must exist, be published and belong to someone else.
create or replace function public.community_target_author(p_type text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type = 'post' then (
      select author_id from public.community_posts
       where id = p_id and status = 'published'
    )
    when p_type = 'comment' then (
      select author_id from public.community_comments
       where id = p_id and status = 'published'
    )
    else null
  end;
$$;

create or replace function public.community_guard_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_space text;
  v_recent integer;
begin
  if auth.uid() is not null and new.reporter_id <> auth.uid() then
    raise exception 'community: reporter must be the signed-in user';
  end if;

  v_author := public.community_target_author(new.target_type, new.target_id);
  if v_author is null then
    raise exception 'community: reported content not found';
  end if;

  -- A reporter must be able to read the space they are reporting into.
  -- Without this, knowing a UUID would let any account file a report against
  -- content it cannot see.
  if new.target_type = 'post' then
    select p.space into v_space
      from public.community_posts p
     where p.id = new.target_id and p.status = 'published';
  else
    select p.space into v_space
      from public.community_comments c
      join public.community_posts p on p.id = c.post_id
     where c.id = new.target_id and c.status = 'published';
  end if;
  if not public.community_can_read_space(v_space, new.reporter_id) then
    raise exception 'community: not allowed to report in this space';
  end if;

  if v_author = new.reporter_id then
    raise exception 'community: cannot report your own content';
  end if;

  select count(*)::int into v_recent
    from public.community_reports
   where reporter_id = new.reporter_id
     and created_at > now() - interval '1 hour';
  if v_recent >= 50 then
    raise exception 'community: rate_limited';
  end if;

  new.target_author_id := v_author;
  new.status := 'open';
  new.resolution_note := '';
  new.resolved_by := null;
  new.resolved_at := null;
  new.created_at := now();
  return new;
end;
$$;

-- Reports are polymorphic (no FK), so clean them up when content is deleted.
create or replace function public.community_cleanup_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.community_reports
   where target_type = case when tg_table_name = 'community_posts' then 'post' else 'comment' end
     and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists community_posts_author_name on public.community_posts;
create trigger community_posts_author_name
  before insert on public.community_posts
  for each row execute function public.community_set_author_name();

drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard
  before insert or update on public.community_posts
  for each row execute function public.community_guard_post();

drop trigger if exists community_posts_updated on public.community_posts;
create trigger community_posts_updated
  before update on public.community_posts
  for each row execute function public.set_updated_at();

drop trigger if exists community_posts_cleanup on public.community_posts;
create trigger community_posts_cleanup
  after delete on public.community_posts
  for each row execute function public.community_cleanup_reports();

drop trigger if exists community_comments_author_name on public.community_comments;
create trigger community_comments_author_name
  before insert on public.community_comments
  for each row execute function public.community_set_author_name();

drop trigger if exists community_comments_guard on public.community_comments;
create trigger community_comments_guard
  before insert or update on public.community_comments
  for each row execute function public.community_guard_comment();

drop trigger if exists community_comments_updated on public.community_comments;
create trigger community_comments_updated
  before update on public.community_comments
  for each row execute function public.set_updated_at();

drop trigger if exists community_comments_cleanup on public.community_comments;
create trigger community_comments_cleanup
  after delete on public.community_comments
  for each row execute function public.community_cleanup_reports();

drop trigger if exists community_reports_guard on public.community_reports;
create trigger community_reports_guard
  before insert on public.community_reports
  for each row execute function public.community_guard_report();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select
  on public.community_posts
  for select
  to authenticated
  using (
    public.is_admin()
    or author_id = auth.uid()
    or (
      status = 'published'
      and public.community_can_read_space(space, auth.uid())
    )
  );

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert
  on public.community_posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.community_can_post_in_space(space, auth.uid())
  );

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update
  on public.community_posts
  for update
  to authenticated
  using (author_id = auth.uid() and status = 'published')
  with check (author_id = auth.uid() and status = 'published');

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete
  on public.community_posts
  for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select
  on public.community_comments
  for select
  to authenticated
  using (
    public.is_admin()
    or author_id = auth.uid()
    or (
      status = 'published'
      and exists (
        select 1 from public.community_posts p
         where p.id = post_id
           and p.status = 'published'
           and public.community_can_read_space(p.space, auth.uid())
      )
    )
  );

drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert
  on public.community_comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
       where p.id = post_id
         and p.status = 'published'
         and public.community_can_post_in_space(p.space, auth.uid())
    )
  );

drop policy if exists community_comments_update on public.community_comments;
create policy community_comments_update
  on public.community_comments
  for update
  to authenticated
  using (author_id = auth.uid() and status = 'published')
  with check (author_id = auth.uid() and status = 'published');

drop policy if exists community_comments_delete on public.community_comments;
create policy community_comments_delete
  on public.community_comments
  for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists community_reports_select on public.community_reports;
create policy community_reports_select
  on public.community_reports
  for select
  to authenticated
  using (public.is_admin() or reporter_id = auth.uid());

drop policy if exists community_reports_insert on public.community_reports;
create policy community_reports_insert
  on public.community_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- No UPDATE or DELETE policy: reports are closed only by the moderation RPC.

drop policy if exists community_moderation_select on public.community_moderation_actions;
create policy community_moderation_select
  on public.community_moderation_actions
  for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy: the audit trail is append-only through the
-- SECURITY DEFINER moderation RPCs below.

-- ---------------------------------------------------------------------------
-- Moderation RPCs
-- ---------------------------------------------------------------------------

create or replace function public.moderate_community_content(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_found boolean := false;
begin
  if not public.is_admin() then
    raise exception 'community: moderator only';
  end if;
  if p_target_type not in ('post', 'comment') then
    raise exception 'community: unknown target type';
  end if;
  if p_action not in ('hide', 'restore', 'remove') then
    raise exception 'community: unknown moderation action';
  end if;

  v_status := case p_action
    when 'hide' then 'hidden'
    when 'restore' then 'published'
    when 'remove' then 'removed'
  end;

  if p_target_type = 'post' then
    update public.community_posts
       set status = v_status
     where id = p_target_id
    returning true into v_found;
  else
    update public.community_comments
       set status = v_status
     where id = p_target_id
    returning true into v_found;
  end if;

  if not coalesce(v_found, false) then
    raise exception 'community: target not found';
  end if;

  insert into public.community_moderation_actions
    (moderator_id, target_type, target_id, action, note)
  values
    (auth.uid(), p_target_type, p_target_id, p_action, left(coalesce(p_note, ''), 2000));
end;
$$;

create or replace function public.resolve_community_report(
  p_report_id uuid,
  p_resolution text,
  p_note text default '',
  p_content_action text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report record;
  v_status text;
  v_found boolean := false;
begin
  if not public.is_admin() then
    raise exception 'community: moderator only';
  end if;
  if p_resolution not in ('resolved', 'dismissed') then
    raise exception 'community: unknown resolution';
  end if;
  if p_content_action is not null and p_content_action not in ('hide', 'restore', 'remove') then
    raise exception 'community: unknown moderation action';
  end if;

  select * into v_report
    from public.community_reports
   where id = p_report_id
   for update;

  if v_report.id is null then
    raise exception 'community: report not found';
  end if;
  if v_report.status <> 'open' then
    raise exception 'community: report already closed';
  end if;

  if p_content_action is not null then
    v_status := case p_content_action
      when 'hide' then 'hidden'
      when 'restore' then 'published'
      when 'remove' then 'removed'
    end;

    if v_report.target_type = 'post' then
      update public.community_posts
         set status = v_status
       where id = v_report.target_id
      returning true into v_found;
    else
      update public.community_comments
         set status = v_status
       where id = v_report.target_id
      returning true into v_found;
    end if;

    if not coalesce(v_found, false) then
      raise exception 'community: target no longer exists';
    end if;

    insert into public.community_moderation_actions
      (moderator_id, target_type, target_id, action, note)
    values
      (auth.uid(), v_report.target_type, v_report.target_id, p_content_action,
       left(coalesce(p_note, ''), 2000));
  end if;

  update public.community_reports
     set status = p_resolution,
         resolution_note = left(coalesce(p_note, ''), 2000),
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_report_id;

  insert into public.community_moderation_actions
    (moderator_id, target_type, target_id, action, note)
  values
    (auth.uid(), 'report', p_report_id,
     case p_resolution when 'resolved' then 'resolve_report' else 'dismiss_report' end,
     left(coalesce(p_note, ''), 2000));
end;
$$;

revoke all on function public.moderate_community_content(text, uuid, text, text)
  from public, anon;
revoke all on function public.resolve_community_report(uuid, text, text, text)
  from public, anon;
grant execute on function public.moderate_community_content(text, uuid, text, text)
  to authenticated;
grant execute on function public.resolve_community_report(uuid, text, text, text)
  to authenticated;
