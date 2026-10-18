-- ============================================================================
-- admin_role_escalation.sql
--
-- REAL PostgreSQL / RLS tests for the administrator escalation fix.
--
--   *** NOT EXECUTED in PGlite. These assertions require a DISPOSABLE
--       Supabase project with Auth. Passing the Node unit tests does not
--       prove any of this: only a real database can show whether a trigger
--       fires, whether a grant holds and whether a policy denies.
--
-- HOW TO RUN (on a disposable Supabase project):
--   1. Apply migrations in order: 0001_init, 0002_rapid_response,
--      0003_admin_role_hardening.
--   2. Create six test users with @qa.test emails and the roles noted
--      below (via SQL insert or Supabase Auth signup). Note each user's
--      UUID - the tests reference them by UUID.
--   3. Run each block as its own transaction/session with that user's
--      JWT claims set: set local request.jwt.claims =
--      '{"sub":"<user-uuid>","role":"authenticated"}';
--   4. EXPECTED FAILURE convention: each assertion below is written as
--      "must raise" or "must return zero rows". A test passes when the
--      statement errors or returns nothing.
--   5. Destroy the project afterwards.
--
-- FIXTURE SETUP (run once, on a fresh database with migrations applied):
--   The six test users and their data. UUIDs are deterministic so the
--   test blocks can reference them directly.
--
--   UUID                                email                    role
--   ----------------------------------  ------------------------  -------
--   admin_uuid        = 'aee3f850-7b3c-4eab-9c5d-9e8a1c2f7a8e'::uuid   admin@qa.test           admin
--   consumer_a_uuid   = 'b1234567-89ab-cdef-0123-456789abcdef'::uuid   consumer-a@qa.test      consumer
--   consumer_b_uuid   = 'c2345678-9abc-def0-1234-56789abcdef0'::uuid   consumer-b@qa.test      consumer
--   provider_uuid     = 'd3456789-abc0-ef12-3456-789abcdef012'::uuid   provider@qa.test        provider
--   provider_b_uuid   = 'e4567890-bc0d-1e2f-3456-789abcdef012'::uuid   provider-b@qa.test      provider
--   visitor_uuid      = 'f5678901-2345-6789-abcd-ef0123456789'::uuid   visitor@qa.test         consumer
--
--   Insert the profiles (run this once):
--   INSERT INTO public.profiles (id, email, role)
--     VALUES
--     ('$admin_uuid',       'admin@qa.test',        'admin'),
--     ('$consumer_a_uuid',  'consumer-a@qa.test',   'consumer'),
--     ('$consumer_b_uuid',  'consumer-b@qa.test',   'consumer'),
--     ('$provider_uuid',    'provider@qa.test',     'provider'),
--     ('$provider_b_uuid',  'provider-b@qa.test',   'provider'),
--     ('$visitor_uuid',     'visitor@qa.test',      'consumer');
--
--   Also insert a few bookings so that booking-count tests have data:
--   INSERT INTO public.bookings (id, user_id, status, created_at)
--     VALUES
--     (gen_random_uuid(), '$consumer_a_uuid', 'pending', now()),
--     (gen_random_uuid(), '$consumer_b_uuid', 'pending', now());
--
--   After running the fixture setup, each test block can reference the
--   UUIDs above literally (replace <XXX_uuid> with the corresponding
--   UUID string). The tests were originally designed to run with a user's
--   JWT claims set to that user's UUID; the UUIDs here let you verify
--   the SQL logic without Supabase Auth.
--
-- ============================================================================


-- ============================================================================
-- T1  Public signup with role='admin' must NOT create an administrator.
--     Run as the service role (provisioning only) to inspect the result.
--     EXPECTED: role = 'consumer'
-- ============================================================================
-- sign up visitor with metadata role='admin', then:
select role as t1_role, 'MUST BE consumer' as expectation
from public.profiles
where email = 'visitor@qa.test';

-- ASSERT: t1_role = 'consumer'. If it is 'admin' the fix has not been applied.


-- ============================================================================
-- T2  Altered metadata cannot escalate.
--     Sign up with a range of hostile metadata shapes, one user each.
--     EXPECTED: every one lands on 'consumer'
-- ============================================================================
--   options.data.role            = 'admin'
--   options.data.role            = 'ADMIN'            (case variation)
--   options.data.role            = ' provider '       (padded)
--   options.data.roles           = ['admin']          (wrong key)
--   options.data.role            = 'superadmin'       (not in the enum)
--
-- Then, for each created user:
select p.role as t2_role, count(*) as users
from public.profiles p
where p.email like 't2-%@qa.test'
group by p.role;

-- ASSERT: a single group, role = 'consumer', count = 5.


-- ============================================================================
-- T3  A consumer cannot update their own role to administrator.
--     Run as consumer-a.
--     EXPECTED: permission denied (role is not in the update grant)
-- =================================================================================================================================================================
update public.profiles set role = 'admin' where id = 'b1234567-89ab-cdef-0123-456789abcdef'::uuid;

-- ASSERT: ERROR - permission denied for table profiles.
-- Then confirm it did not take effect:
select role as t3_role from public.profiles where id = 'b1234567-89ab-cdef-0123-456789abcdef'::uuid;
-- ASSERT: 'consumer'


-- ============================================================================
-- T4  A provider cannot update their own role to administrator.
--     Run as provider. Identical expectation.
--     EXPECTED: permission denied
-- =================================================================================================================================================================
update public.profiles set role = 'admin' where id = 'd3456789-abc0-ef12-3456-789abcdef012'::uuid;
select role as t4_role from public.profiles where id = 'd3456789-abc0-ef12-3456-789abcdef012'::uuid;

-- ASSERT: ERROR, then t4_role = 'provider'


-- ============================================================================
-- T5  A provider cannot mark themselves verified, and cannot reach any
--     provider-only surface.
--     There is no provider_applications table yet, so verification is
--     unreachable by construction. Assert that, plus the policy denial.
--     EXPECTED: to_regclass is null; bookings select returns zero rows
-- =================================================================================================================================================================
select to_regclass('public.provider_applications') as t5_table;
-- ASSERT: NULL - verification is not representable yet, so it cannot be claimed.

-- As provider (is_staff() must now be false):
select count(*) as t5_bookings from public.bookings;
-- ASSERT: 0. Before the fix this returned every booking in the platform.

select public.is_staff() as t5_is_staff, public.is_admin() as t5_is_admin;
-- ASSERT: false, false


-- ============================================================================
-- T6  A consumer cannot read another consumer's profile.
--     Run as consumer-a.
--     EXPECTED: zero rows
-- =================================================================================================================================================================
select count(*) as t6_rows
from public.profiles
where id = 'c2345678-9abc-def0-1234-56789abcdef0'::uuid;

-- ASSERT: 0


-- ============================================================================
-- T7  A consumer cannot read another consumer's bookings.
--     Run as consumer-a.
--     EXPECTED: zero rows for consumer-b's booking
-- =================================================================================================================================================================
select count(*) as t7_rows
from public.bookings
where user_id = 'c2345678-9abc-def0-1234-56789abcdef0'::uuid;

-- ASSERT: 0


-- ============================================================================
-- T8  A provider cannot read an unrelated booking (provider-b's patient).
--     Run as provider.
--     EXPECTED: zero rows
--     EXPECTED: zero rows. Before the fix, is_staff() was true for 'provider' and this
--         returned every booking belonging to every provider.
-- =================================================================================================================================================================
select count(*) as t8_rows
from public.bookings
where user_id = 'b1234567-89ab-cdef-0123-456789abcdef'::uuid;

-- ASSERT: 0.


-- ============================================================================
-- T9  Legitimately provisioned administrators retain their permissions.
--     Provision with the service role, then verify as admin.
--     EXPECTED: grant succeeds; admin sees all profiles and all bookings
-- =================================================================================================================================================================
-- As service role:
select public.grant_role('aee3f850-7b3c-4eab-9c5d-9e8a1c2f7a8e'::uuid, 'admin');
-- ASSERT: returns without error.

-- As admin:
select public.is_staff() as t9_is_staff, public.is_admin() as t9_is_admin;
-- ASSERT: true, true

select count(*) as t9_profiles from public.profiles;
-- ASSERT: 6 (all users)

select count(*) as t9_bookings from public.bookings;
-- ASSERT: all seeded bookings


-- ============================================================================
-- T10 No client role may call grant_role().
--     Run as admin, consumer and provider in turn.
--     EXPECTED: permission denied for all three, including admins
-- =================================================================================================================================================================
select public.grant_role('b1234567-89ab-cdef-0123-456789abcdef'::uuid, 'admin');

-- ASSERT for each of admin / consumer-a / provider:
--   ERROR - permission denied for function grant_role

--
-- This is intentional. Administration goes through the Worker's service-role
-- credential, which is not shipped to the browser. An administrator's own
-- session must not be able to promote anybody.


-- ============================================================================
-- T11 No other route to escalation through the anon key.
--     Run with the anon key and NO session at all.
--     EXPECTED: zero rows everywhere
-- =================================================================================================================================================================
select count(*) as t11_profiles from public.profiles;
select count(*) as t11_bookings from public.bookings;
select count(*) as t11_documents from public.health_documents;
select public.is_staff() as t11_is_staff;
select public.is_admin() as t11_is_admin;

-- ASSERT: 0, 0, 0, false, false


-- ============================================================================
-- T12 Existing administrators are not demoted by the migration.
--     Record roles before applying 0003, then compare.
--     EXPECTED: unchanged
-- =================================================================================================================================================================
-- Before 0003:
--   select email, role from public.profiles order by email;   > save output
-- After 0003:
--   select email, role from public.profiles order by email;

-- ASSERT: identical, including any pre-existing 'admin' rows. 0003 only
--         re-creates functions and changes grants; it issues no UPDATE on
--         profiles, so nobody is silently demoted.


-- ============================================================================
-- T13 Safe provisioning path works end to end.
--     EXPECTED: provider promoted to admin; a second call to a bad role fails
-- =================================================================================================================================================================
select public.grant_role('e4567890-bc0d-1e2f-3456-789abcdef012'::uuid, 'admin');
-- ASSERT: no error
select role as t13_role from public.profiles where id = 'e4567890-bc0d-1e2f-3456-789abcdef012'::uuid;
-- ASSERT: 'admin'

select public.grant_role('e4567890-bc0d-1e2f-3456-789abcdef012'::uuid, 'superuser');
-- ASSERT: ERROR - grant_role: unknown role superuser

select public.grant_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin');
-- ASSERT: ERROR - grant_role: no such profile


-- ============================================================================
-- T14 Health documents are still owner-only and were not reopened.
--     Run as consumer-a.
--     EXPECTED: only consumer-a's own rows
-- =================================================================================================================================================================
select count(*) as t14_docs
from public.health_documents
where user_id <> 'b1234567-89ab-cdef-0123-456789abcdef'::uuid;

-- ASSERT: 0


-- ============================================================================
-- T15 Provider registration does not grant verification.
--     Sign a provider up through the real metadata path.
--     EXPECTED: role = 'provider', no verification state anywhere
-- =================================================================================================================================================================
select p.role as t15_role,
       (select count(*) from public.provider_applications) as t15_apps
from public.profiles p
where p.email = 'provider@qa.test';

-- ASSERT: 'provider', 0. Registration is not verification, and the fix keeps
--         that separation.
-- =================================================================================================================================================================