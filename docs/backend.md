# Backend & database (Supabase)

HealthLink runs without a backend — every screen works offline against
`localStorage`. Once Supabase is configured, the same screens create real
accounts and keep records in Postgres, synced automatically.

## 1. Create the project

1. Go to <https://supabase.com> → **New project**.
2. Pick a name, a strong database password, and a region near your users
   (Europe for West Africa latency).
3. Wait for the project to finish provisioning.

## 2. Create the tables

Open **SQL Editor → New query**, paste the whole of
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and
press **Run**. It creates:

| Table | Purpose |
| --- | --- |
| `profiles` | One row per person: name, phone, role, language |
| `health_documents` | Personal records (journal, medical records, reminders, passport, care circle, weigh-ins, workouts, bookings) as JSONB, one row per collection |
| `bookings` | Visit and screening requests |
| `provider_requests` | Applications from facilities to join the directory |
| `reports` | Content and provider reports |

Row level security is switched on for all of them, and the only policies are
"you can read and write your own rows" plus "staff can triage requests". The
public anon key cannot read anyone else's health data.

Re-running the file is safe — every statement is written to be idempotent.

## 3. Connect the app

1. Copy `.env.local.example` to `.env.local`.
2. In Supabase → **Project Settings → API**, copy **Project URL** and
   **anon / public** key into it:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

3. Restart the dev server (`npm run dev`) so the values are picked up.

Leave the keys out and the app stays in offline preview mode — the account
screen then shows "Offline preview" and the demo sign-in buttons keep working.

## 4. Email confirmation

By default Supabase asks new accounts to confirm their email address, so
**Authentication → Providers → Email** can be left as is. To let people sign in
without confirming, turn off "Confirm email" on that page.

## 5. How syncing behaves

- Signing in adopts the cloud account into the local session, so every existing
  role gate keeps working.
- Existing device data is uploaded on first sign-in — nothing is lost when
  someone upgrades from the offline preview.
- Edits are pushed about a second after you make them.
- On opening the app on another device, the newer copy of each collection wins,
  so two devices editing different features do not overwrite each other.
- Provider and admin accounts get their role from the `profiles` table, which
  you can edit directly in Supabase → **Table editor**.

## 6. Deploy

The keys are inlined at build time, so rebuild and redeploy after changing them:

```bash
npm run build
netlify deploy --prod --dir out --no-build
```