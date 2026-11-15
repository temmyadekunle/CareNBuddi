-- ============================================================================
-- 0012_integrity_hardening.sql
--
-- Stage 2 verification findings, corrected forward-only. 0010 and 0006 are
-- never rewritten.
--
-- FINDING 1 - community author columns are mutable on UPDATE
--   community_posts and community_comments snapshot the author's display
--   name (author_name) and set created_at from now() on INSERT only. The
--   UPDATE branch of both guard triggers preserved author_id and the space,
--   but not the snapshot or the timestamp, and did not refuse a primary-key
--   change. An author could therefore rewrite the published-by name,
--   backdate created_at, or move the row to a new id - all while remaining
--   inside their own RLS update policy.
--
--   The trigger now restores author_name and created_at from the stored row
--   on every UPDATE, and refuses id changes. edited_at is likewise frozen
--   unless title/body actually changed. Moderators change status only, which
--   those rules do not block.
--
-- FINDING 2 - community_target_author() is client-callable
--   It is SECURITY DEFINER and reads the base tables, but unlike the other
--   helpers in 0010 it was left with Supabase's default EXECUTE grant. Any
--   anon or authenticated caller could invoke it with a guessed UUID and
--   learn (a) whether a published post/comment exists and (b) its author_id,
--   including content in a space the caller cannot read. Its only legitimate
--   caller is the BEFORE INSERT report trigger, which runs as the function
--   owner, so EXECUTE is revoked from public, anon and authenticated.
--
-- FINDING 3 - NOT NULL contradicts ON DELETE SET NULL
--   community_moderation_actions.moderator_id and
--   provider_application_audit.reviewer_id are declared NOT NULL while their
--   foreign keys say ON DELETE SET NULL. Deleting one account can therefore
--   fail with a not-null violation instead of anonymising the audit row, and
--   that failure blocks an account deletion entirely. The columns become
--   nullable; the insert policies/RPCs still require a real actor, so the
--   only rows that can hold NULL are rows whose actor was deleted.
--
-- No data is modified, no policy is relaxed, and no seed row is created.
-- Idempotent: create-or-replace, revoke/grant, and a nullable alteration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Post guard: snapshot, timestamp and identity are immutable on UPDATE.
-- ---------------------------------------------------------------------------
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
  if new.id <> old.id then
    raise exception 'community: post identity is immutable';
  end if;
  if new.author_id <> old.author_id or new.space <> old.space then
    raise exception 'community: author and space are immutable';
  end if;

  -- The display-name snapshot and creation time belong to the stored row.
  -- Restoring them (rather than trusting the attempted values) means an
  -- author cannot rewrite who published a post or when.
  new.author_name := old.author_name;
  new.created_at := old.created_at;

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
  else
    new.edited_at := old.edited_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Comment guard: same rules, no edited_at column.
-- ---------------------------------------------------------------------------
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

  if new.id <> old.id then
    raise exception 'community: comment identity is immutable';
  end if;
  if new.author_id <> old.author_id or new.post_id <> old.post_id then
    raise exception 'community: author and post are immutable';
  end if;

  new.author_name := old.author_name;
  new.created_at := old.created_at;

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

-- ---------------------------------------------------------------------------
-- 3. The report trigger's helper is internal only.
-- ---------------------------------------------------------------------------
revoke all on function public.community_target_author(text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. A deleted actor must anonymise the audit row, not block the deletion.
-- ---------------------------------------------------------------------------
alter table public.community_moderation_actions
  alter column moderator_id drop not null;

alter table public.provider_application_audit
  alter column reviewer_id drop not null;
