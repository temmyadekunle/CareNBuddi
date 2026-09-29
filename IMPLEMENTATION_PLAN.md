# HealthLink — Implementation Plan

Base: PRD (root `PRD.md`) · Repo: temmyadekunle/HealthLink

## 0. Reset — where we are vs. where the product needs to go

A personal health **tracker prototype** (journal/records/reminders) was built before the product direction crystallized. The confirmed product direction is a **digital and mobile healthcare platform** connecting people to reliable health information, preventive services, and the right providers. Tracker features map to the later "Advanced" phase only.

**Decision gate (Phase 1 start):** archive the tracker routes to a branch (`git branch tracker-prototype`) and remove `journal`, `records`, `reminders` — reuse only the shared UI tokens (emerald/slate palette with the AA-contrast steer, Geist font, radii).

Locked tool decisions (from PRD "Steer One Choice" — do not change without an explicit steer):

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript(already in repo) |
| Database | PostgreSQL (local, on localhost) |
| ORM | Prisma |
| File storage | Local filesystem `storage/uploads` |
| Authentication (steered) | Auth.js (NextAuth v5), email magic-link, optional accounts (guest-first), local Mailhog SMTP |
| Runtime | `next dev` + local Postgres only in MVP; no cloud deploy |

Current working state (static, no DB): homepage ("How can we help you today?" + 4 options), Explore (health categories + topic pages), Find Care (directory + call/directions), Mobile Clinic (services + booking request), Profile (guest stub), content in `lib/content.ts`, reusable UI in `components/health.tsx`.

---

## Phase 1 — Digital HealthLink (foundation + core journey)

Goal: prove people need and use HealthLink. This is the whole "Digital HealthLink" scope: search → learn → navigate → act, on the local stack.

### Step 1.1 — Local environment & schema
- Provision **PostgreSQL 17** (winget) + verify `psql` and service running; provision **Mailhog** (Windows binary; fallback: SMTP dev inbox, flagged).
- Prisma: `prisma/schema.prisma`, `prisma migrate dev`, idempotent seed; `.env` (gitignored) + `.env.example`.
- Models (MVP): Auth.js tables (`User`, `Account`, `Session`, `VerificationToken`); `Topic` (slug, title, `healthCategory`, summary, structured sections, sources, `reviewedBy`, `reviewedOn`, status), `Faq`; `ProviderCategory` (enum), `Provider`, `Service` (M2M), `ProviderImage` (`storage/uploads`); `SavedResource`, `Report`, `AppointmentRequest`, `MobileClinicVisit`, `EmergencyContact`; `SearchLog` (metrics).

### Step 1.2 — Auth & guest-first shell
- Auth.js v5 magic-link + Prisma adapter + `app/api/auth/[...nextauth]/route.ts`.
- Guest-first routing: content, directory, and emergency are fully usable unsigned-in; accounts optional.

### Step 1.3 — Convert static pages to DB-backed
- Home: greeting + search + 4 option cards (Understand My Health / Find Healthcare / Book Mobile Clinic / Manage My Health) and emergency banner.
- Explore: `healthCategory` grid + topic pages with all PRD sections + "when to seek help" + reviewed-by (health educators/professionals) + report link.
- Find Care: category/location filters, provider profiles, `tel:` + directions, appointment request → `AppointmentRequest`.
- Mobile Clinic: services catalog + book-a-visit → `MobileClinicVisit` (name, phone, service, date, area; confirmation by phone).
- Emergency guidance page with contact numbers.

### Deliverables (Phase 1)
- Local Postgres + Mailhog running; migrations applied; seed rerunnable (8+ topics, 40+ providers, emergency contacts)
- Auth magic-link works locally; guests complete the full journey
- All five nav areas served from Prisma; `npm run lint` + `npm run build` green

### Definition of done
The example user story passes in guest and signed-in modes: search a topic → read simple content → "Find Help Near Me" → view provider → call or request appointment; mobile-clinic request persists to DB.

---

## Phase 2 — Personal layer, trust loop & metrics (finish Digital MVP)

Goal: identity-backed follow-up, accountability, and measurement.

- Accounts surface (`/profile`): profile, saved providers/resources (`SavedResource`), sign-out. Reminders/appointments placeholders become real where legally/technically appropriate.
- Report incorrect/outdated information → `Report` + admin inbox.
- Metrics from `SearchLog` + counters (article view, provider view, contact click, booking submit, conversion) surfaced on `/admin/metrics`; map to PRD success metrics.
- a11y + performance: ISR/static for topics/providers, throttled-network test, keyboard/contrast pass (continues the AA steer).
- QA checklist doc + unit/smoke tests.

---

## Phase 3 — HealthLink Mobile Clinic

Goal: take HealthLink from the phone into the community.

- Admin scheduling + visit lifecycle (REQUESTED → CONFIRMED → DONE), team assignment.
- Service catalog: BP screening, blood glucose, wellness checks, health education, community outreach, workplace health days, referral services.
- Booking surfaces for individuals, communities, and companies (corporate wellness).
- Referral handoff to listed providers (ties into Network phase).
- Revenue: paid screening/outreach events; corporate packages (see Business Model).

---

## Phase 4 — Healthcare Network

Goal: make HealthLink a bridge between people and healthcare providers — and earn provider revenue.

- Partner onboarding & verified profiles (subscription tiers: visibility, booking tools, business analytics).
- Provider dashboards: incoming appointment/visit requests, profile page, analytics.
- Labs/pharmacies/maternity/mental-health categories; HMO & health-organization integrations.
- Clear disclosure on sponsored/campaign content.

---

## Phase 5 — Advanced HealthLink

Only after the foundation works:

- Telehealth, health & screening reminders, personal health dashboard, AI-assisted health navigation, WhatsApp integration, corporate wellness expansion, multilingual support.

---

## Business model (captured in PRD)

B2C, B2B and B2B2C: free digital health services (info + basic navigation) for individuals; premium individual services; healthcare-provider subscriptions (profiles, visibility, booking, analytics); corporate wellness programmes; community/mobile-clinic bookings; approved, disclosed health partnerships. No single revenue dependency; not "advertising only".

---

## Cross-phase rules & risks

- Locked stack discipline: no PRD-steered tool changes without an explicit steer (see §0 table).
- Content trust: a topic ships only with `status = REVIEWED`, sources, and "when to seek help"; reviewer attribution uses accurate credentials (health educator / counsellor, not invented doctor titles).
- Schema changes via `prisma migrate dev`; seeds idempotent.
- Windows specifics: Postgres install (winget) requires UAC; Mailhog needs a Windows binary (fallback flagged). Node already installed.
- Biggest risks: content volume/quality (mitigate by curating core topics first) and scope creep (build Digital HealthLink fully before Clinic/Network/Advanced).
- Decisions to confirm with owner when reached: appointment fields, provider approval workflow, report escalation, corporate pricing.