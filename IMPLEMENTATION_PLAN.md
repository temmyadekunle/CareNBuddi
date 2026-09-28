# HealthLink — Implementation Plan

Base: PRD (Desktop\HealthLink\PRD.md) · Repo: temmyadekunle/HealthLink

## 0. Reset — where we are vs. where the PRD wants to go

The current repo contains a **personal health tracker prototype** (journal / records / reminders) built before the PRD was applied. The PRD specifies a **Digital Health Navigation Platform** (search → learn → navigate → act → follow up). These overlap only in branding; the tracker features map to the PRD's "Later" bucket (med reminders, personalized dashboard).

**Decision gate (Phase 1 start):** archive the tracker routes to a branch (`git branch tracker-prototype`) and remove `journal`, `records`, `reminders` from the app, reusing only the UI shell (nav, card styles, Tailwind theme). Do not reuse the `localStorage` store.

Locked tool decisions (from PRD §Steer One Choice — do not change without an explicit steer):

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript (already in repo) |
| Database | PostgreSQL (local, on localhost) |
| ORM | Prisma |
| File storage | Local filesystem `storage/uploads` |
| Authentication (steered) | Auth.js (NextAuth v5), email magic-link, optional accounts (guest-first), local Mailhog SMTP |
| Runtime | `next dev` + local Postgres only (no cloud deploy in MVP) |

---

## Phase 1 — Foundation & local environment

Goal: a reproducible local stack with a working schema and a logged-in/guest auth path. Nothing else happens until this is green.

### Tasks
- Provision local tools: **PostgreSQL 17** (winget `PostgreSQL.PostgreSQL.17`), verify `psql` + service `postgresql-x64-17` running; **Mailhog** Windows binary (or fallback: SMTP test inbox / nodemailer build-in transport — must still accept a magic-link).
- Scaffold Prisma: `prisma/schema.prisma`, add `@prisma/client`, `prisma migrate dev`, `prisma db seed`. `DATABASE_URL` in `.env` (add `.env` to `.gitignore`; ship `.env.example`).
- Auth.js v5: install `next-auth@beta @auth/prisma-adapter nodemailer`; configure `auth.ts` with **email provider** / magic-link + Prisma adapter; add API route `app/api/auth/[...nextauth]/route.ts`; guest-first routing (no guard on content/directory pages).
- Add `storage/uploads/.gitkeep` for local files.

### Prisma models (MVP, first cut)
- Auth.js tables: `User`, `Account`, `Session`, `VerificationToken`
- `Topic` (slug, title, category, summary, structured content: whatItIs, symptoms, riskFactors, prevention, whenToSeekHelp; `sources` (JSON), `reviewedBy`, `reviewedAt`, `status`), `Faq` (topicId, question, answer)
- `ProviderCategory` (enum: HOSPITAL, CLINIC, LABORATORY, PHARMACY, DIAGNOSTIC, MENTAL_HEALTH, MATERNAL), `Provider`, `Service` (M2M), `ProviderImage` (path in `storage/uploads`)
- `SavedResource` (userId, type TOPIC|PROVIDER, targets), `Report` (targetType, targetId, issue, details, email, status), `AppointmentRequest` (providerId, name, email, phone, message, status), `EmergencyContact` (region, name, number, type)
- `SearchLog` (query, location, resultCount, type, createdAt) — feeds §Success Metrics without heavy infra.

### Seed data
- `prisma/seed.ts`: 8-10 topics from PRD curriculum (hypertension, malaria, mental health, women's health, nutrition, sexual & reproductive health, first aid, preventive health) with reviewed content + canonical sources (WHO/local authority); 40+ providers across all 7 categories in 3-4 regions; emergency contacts table.

### Concrete deliverables
- Running Postgres + Mailhog on localhost; `prisma migrate dev` applied; seed script idempotent
- `auth.ts`, NextAuth route, `.env(.example)`
- Magic-link sign-in works end-to-end locally; guest visits all pages without sign-in
- `npm run lint` + `npm run build` green

### Definition of done
A new visitor can search nothing yet but can: open home, click "Continue as guest" (implied, no friction) or receive a magic-link email and land signed-in; indexes created; seed rerunnable.

---

## Phase 2 — Core navigation shell + search UI (Journey steps 1-2)

Goal: the "Discover / Search" surface. The canonical read path for all later phases.

### Tasks
- App shell: responsive header (brand, search trigger, sign-in status), footer with emergency banner + disclaimers; mobile-first. Reuse/trim existing `components/nav.tsx` + Tailwind theme.
- Homepage: single prominent search box + quick topic shortcuts + emergency callout.
- `/search?q=` page: query against topics (title/category/summary) and providers (name/city/state/services) via Prisma (`ILIKE`/full-text), debounced, with result grouping "Topics / Facilities"; empty and no-result states; "immediate medical attention" suggestion when query matches urgent keywords.
- Server components + ISR for content; client search interactions.

### Concrete deliverables
- `app/page.tsx` (Discover), `app/search/page.tsx`, `components/search.tsx` (reusable search box)
- Topic + provider search wired to Postgres with ranking and typing (search-as-you-type)
- Footer legal/medical disclaimer (PRD §10)

### Definition of done
From home, a user can type "malaria" or "clinic in Lagos" and see grouped, relevant, fast results on a phone-sized viewport.

---

## Phase 3 — Health topics & content (Feature A, B; journey step 3)

Goal: authoritative, readable educational pages.

### Tasks
- `/topics/[slug]` page rendering all PRD-required sections: what it is, common signs/symptoms, risk factors, prevention, **when to seek professional help** (must include "call/see a professional" guidance), FAQs (accordion), relevant healthcare services (from tag → provider category mapping), sources + review-by flags, report-incorrect link.
- Content model support: section order, tags linking topics ↔ provider categories.
- Emergency guidance page `/emergency` (Feature E): clear escalation guidance, emergency contact numbers from DB, always-visibly-announced "emergency ≠ app guidance" messaging.
- Content QA: seeded topics reviewed against credible sources; render "Reviewed by X / date" and "Not a diagnosis" banner.

### Concrete deliverables
- `app/topics/[slug]/page.tsx`, `app/topics/page.tsx` (index), `app/emergency/page.tsx`
- Topic ↔ service linking and "Find Help Near Me" entry point (builds Phase 4)
- Report/feedback affordance on every topic page (feature into Phase 5)

### Definition of done
Each seeded topic satisfies PRD §B structure; content recommends professional care where relevant; a grader can follow a topic → "Find Help" in two clicks.

---

## Phase 4 — Directory, navigation & connection (Features C, D, F; steps 4-5)

Goal: the core value loop — "I read about it, now what/where?"

### Tasks
- `/providers` directory: filter by category, city/region, and service (from DB); sort by name/region; listing card = name, category, location, phone, hours.
- `/providers/[id]` detail: full profile (services offered, opening hours, contact, directions link via map URL, website link), images from `storage/uploads`, related topic links, report link, **Contact / Request appointment** actions.
- "Find Help Near Me": from a topic or navigation menu, pick a region; returns matching providers (topic-category link → provider list), contact/call actions (`tel:`), directions.
- **Appointment request** (should-have for connection): form (name, email, phone, preferred date, message) persisted to `AppointmentRequest` with status lifecycle (PENDING → CONFIRMED/DECLINED); acknowledgement screen. No scheduling logic in MVP.
- Contact actions: `tel:` links + "ask for more information" mailto/contact form tied to provider.

### Concrete deliverables
- `app/providers/page.tsx`, `app/providers/[id]/page.tsx`, `app/find-help/page.tsx`, `app/appointments/request/page.tsx`
- Prisma queries for filters/location; per-provider images served from `storage/uploads`
- Appointment request flow end-to-end (submit → stored → status page)

### Definition of done
From any topic page, user clicks "Find Help Near Me", selects a location, sees relevant providers, opens a detail page, and can call or submit an appointment request that is visible in the DB.

---

## Phase 5 — Accounts, saved resources & reporting (Steps: follow-up; Should-have)

Goal: identity-backed follow-up and the trust&safety loop.

### Tasks
- User account surface: `/account` (signed-in only) with profile (name/email), "Sign out"; magic-link login already exists from Phase 1.
- **Saved resources** (should-have): bookmark a topic or provider (requires sign-in); `/account/saved` list with links; PRD "Follow Up" step.
- **Report incorrect/outdated info** (must-have): `/report` form + per-content "report this" buttons; persists to `Report`; `/admin/reports` lightweight inbox to view/close reports (no auth gate beyond signed-in for MVP).
- Trust & safety sweep: disclaimers on topic pages, emergency messaging, "general info ≠ medical diagnosis" footer, accessibility pass on forms.

### Concrete deliverables
- `app/account/page.tsx`, `app/account/saved/page.tsx`, `app/report/page.tsx`, `app/admin/reports/page.tsx`
- Bookmark toggles on topic & provider pages; SavedResource CRUD via Prisma
- Report CRUD + inbox; saved/report states survive reload (DB-backed, not localStorage)

### Definition of done
Signed-in user can save a topic and a facility, see them under Account, report an error on a page, and a moderator list shows the report as OPEN.

---

## Phase 6 — Metrics, QA & polish

Goal: measurable, reliable MVP.

### Tasks
- Instrument success metrics (PRD §11) with minimal tracking: `SearchLog` writes, `analytics` counters for article view, provider view, contact click, appointment submit; dashboard `/admin/metrics` reads aggregates.
- Performance: ISR/static rendering for topics & providers; image optimization; cache headers for public directory data; test on throttled network (PRD NFR: fast on slow connections).
- a11y (PRD NFR: accessible): keyboard nav, ARIA on search results/accordions/forms, contrast check, mobile tap targets.
- Test coverage: Vitest for prisma queries + content source-validation lint; route-level smoke tests; manual QA checklist (guest & signed-in journeys end-to-end).
- Health education videos (should-have, stretch): uploads + embed field on topics; gate to Phase 7 if time.

### Concrete deliverables
- `lib/analytics.ts` + `app/admin/metrics/page.tsx`
- Unit/smoke test suite + QA checklist doc (`docs/qa-checklist.md`)
- Lighthouse/a11y fixes; `npm run lint` + `npm run build` + full justified test run green

### Definition of done
Every PRD success metric has a recorded signal; the example user story (§13) passes as a manual walkthrough in both guest and signed-in modes.

---

## Phase 7 — Out of MVP scope (PRD Later / Future), sequenced after launch of v1

- Personalized health dashboard + profile
- Medication & screening reminders (revive tracker components if desired)
- AI-powered health assistant and personalized preventive recommendations
- Telehealth integration
- WhatsApp integration
- Health organization/community campaigns
- Rollout of hosted identity vendor would only ever replace the auth slot (per PRD steer note)

---

## Cross-phase rules & risks

- **Locked stack discipline:** no PRD-steered tool changes without explicit user steer (see §0 table).
- **Content trust:** a topic ships only when `status = REVIEWED`, `sources` populated, and "when to seek help" present (Phase 3 gates).
- **Data migration knob:** schema changes use `prisma migrate dev`; seeds are idempotent.
- **Windows specifics:** Postgres install via winget requires UAC; Mailhog needs a Windows binary (fallback SMTP dev allowed but flagged). Node already installed.
- **Biggest risk:** content authoring quality/volume. Mitigate by curating the 8 core topics first and making the schema schema-friendly for quick additions.
- **Decisions flagged during build**: appointment request fields, provider approval workflow, report escalation — confirm with owner when reached, not silently.