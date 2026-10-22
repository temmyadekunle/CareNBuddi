-- ============================================================================
-- 0009_profile_photo_and_avatars.sql
--
-- Durable profile photo for the patient account.
--
-- Problem being fixed: the profile photo used to exist only in the browser's
-- localStorage ("healthlink:u:<uid>:profile-photos"). Sign-out purges that
-- namespace by design (data minimisation), it does not sync
-- -- healthlink:profile-photos is not one of lib/supabase/sync.ts
-- SYNCED_KEYS -- and no copy lives anywhere server-side. After logging back
-- in, the photo was therefore gone and had to be re-uploaded on every device.
--
-- This migration gives the picture a durable home:
--
--   public.profiles.photo_path  = the Storage object path of the avatar, e.g.
--                                 'avatars/{userId}/{timestamp}.jpg'
--   storage bucket 'avatars'    = private bucket holding the JPEG bytes.
--
-- Forward-only migration, complements (never rewrites) 0001..0008.
--
-- Security posture (deliberate choices):
--   * The column is granted for UPDATE explicitly. 0003 revoked table-level
--     UPDATE on profiles and granted back only (full_name, email, phone,
--     lang, updated_at); a new column is not writable until granted, so we
--     grant exactly one more column - never the role column.
--   * photo_path is scope-checked: only paths inside the uploader's own
--     'avatars/{id}/' segment can be stored, so a user cannot point their
--     picture at somebody else's object (not that a signed URL for a foreign
--     object would succeed - but the constraint makes intent explicit and
--     keeps the column honest under future policy churn).
--   * The avatars bucket is private with the same owner-segment policies the
--     provider-applications bucket uses in 0006: profile photos are personal
--     data and must not be publicly readable.
--   * UPDATE/DELETE on storage.objects remain revoked from client roles (0006).
--     The app therefore never overwrites an avatar object in place: each new
--     photo is written under a fresh timestamped path and photo_path is
--     repointed. Abandoned old objects are small (few hundred KiB, at upload
--     frequency "occasionally") and are documented as such; automatic
--     reclamation would need a service-role job, not client privileges.
--
-- Client counterpart: lib/avatar-storage.ts (path builder + validation),
-- lib/profile-photo-server.ts (upload, signed-URL hydration).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.photo_path column, scoped to the row's own Storage segment.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists photo_path text;

-- Row-scoped CHECK: the path must look like avatars/{this row's id}/...
-- (uuid::text is lowercase, as Storage paths are built from auth user ids).
alter table public.profiles drop constraint if exists profiles_photo_path_scoped;
alter table public.profiles add constraint profiles_photo_path_scoped
  check (
    photo_path is null
    or (
      left(photo_path, 8) = 'avatars/'
      and split_part(photo_path, '/', 2) = id::text
      and split_part(photo_path, '/', 3) <> ''
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Column grant. 0003's model is: UPDATE on profiles granted per column.
-- Grant photo_path, and only photo_path.
-- ---------------------------------------------------------------------------

grant update (photo_path) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Private avatars bucket with the client-realistic limits.
--
-- The client always uploads finished 320px JPEGs (lib/profile-photo.ts sizes,
-- typically 15-30 KB, worst case well under 1 MiB), so a 2 MiB limit and a
-- JPEG-only MIME list admit the app's real traffic and nothing larger. The
-- same "the client validates first" caveats documented in 0008 apply here:
-- bucket configuration shapes what an already-authorized upload may contain;
-- it is not a forensic guarantee of a payload's bytes.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'avatars',
      'avatars',
      false,
      2097152, -- 2 MiB, ample headroom over 320px JPEG output
      array[ 'image/jpeg' ]
    )
    on conflict (id) do update
      set file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types,
          public = false;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Owner-scoped Storage policies, mirroring 0006's pattern.
--
-- Path scheme: avatars/{userId}/{timestamp}.jpg
--   The bucket's own name is repeated as the first in-bucket folder (the
--   same convention the provider-applications path scheme has always
--   followed), so (storage.foldername(name))[2] is the owner's user id and
--   the policy reads exactly like the provider-document policy.
--
-- Roles granted: INSERT to the owner's segment only, SELECT to the owner
-- only. Administrators do NOT get avatar read access: the photo is the
-- patient's personal data, no administration workflow needs it, and fewer
-- policies than the review bucket means less to audit. Anonymous roles get
-- nothing.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists avatars_upload_own on storage.objects;
    create policy avatars_upload_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );

    drop policy if exists avatars_view_own on storage.objects;
    create policy avatars_view_own
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end $$;

-- UPDATE and DELETE on storage.objects stay revoked from anon and
-- authenticated (set in 0006 and deliberately not re-granted here): nobody
-- can rewrite or remove an object from the client. Old avatar objects are
-- therefore never mutated or deleted by the app; photo_path simply points
-- at the newest upload and superseded objects are left for manual,
-- service-role reclamation if ever needed.
