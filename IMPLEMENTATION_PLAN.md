# HealthLink — Implementation Plan

Base: PRD v2.0 (root `PRD.md`) · Repo: temmyadekunle/HealthLink

## 0. Reset — where we are vs. where the product needs to go

A personal health **tracker prototype** (journal/records/reminders) was built before the product direction crystallized. The confirmed direction (PRD v2.0) is a **digital + community-based preventive healthcare ecosystem**: one connected journey Learn → Check → Find → Connect → Act → Follow Up, mapped to PRD §47–§51 versions (V1, V1.5, V2, V3, V4).

**Decision gate (V1 start):** archive the tracker routes to a branch (`git branch tracker-prototype`) and remove `journal`, `records`, `reminders` — reuse only the shared design tokens (PRD §54: HealthLink Teal / Health Green / Warm Coral with the AA steer, Geist font, radii).

Locked tool decisions (from PRD "Appendix A — Steered Choice" — do not change without an explicit steer):

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript (already in repo) |
| Database | PostgreSQL (local, on localhost) |
| ORM | Prisma |
| File storage | Local filesystem `storage/uploads` |
| Authentication (steered) | Auth.js (NextAuth v5), email magic-link, optional accounts (guest-first), local Mailhog SMTP |
| Runtime | `next dev` + local Postgres only in MVP; no cloud deploy |

Current working state (static, no DB) — this now mirrors **PRD §9 Home**, **§13/§14 Education**, **§15 Finder**, **§19 Mobile Clinic/§18 Booking**, **§41 Prevention Checklist** and **§27 Emergency**:

- **Home** (`/`): "How can we help you today?" + search + the 7 PRD primary actions (Understand My Health · Check My Health · Find Healthcare · Book a Health Service · My Health Records · My Reminders · Get Help Now) + emergency banner.
- **Explore** (`/explore`): 16 PRD education categories (§13) + topic pages with the full Learn→Action pathway (§14) and trust attribution (§44).
- **Find Care** (`/find-care`): provider directory with state/category filters + call/directions (PRD §15).
- **Services** (`/services`): Check My Health + service catalog + request/booking form (PRD §18/§19; formerly "Mobile Clinic" route).
- **Health** (`/health`): personal dashboard hub — prevention checklist, records, reminders (PRD §10/§41).
- **Emergency** (`/emergency`): Get Help Now — contacts, first-aid steps, emergency-ready facilities (PRD §27).
- **Profile** (`/profile`): guest-first personal area (PRD §7/§9).

- Content in `lib/content.ts` (TOPICS, PROVIDERS, EMERGENCY_CONTACTS, 16 categories, accurate reviewer attribution — no invented clinician titles); reusable UI in `components/health.tsx`; brand tokens in `app/globals.css` (Tailwind v4 `@theme`).

---

## Phase A — PRD V1 (Digital HealthLink MVP)

Goal: prove people need and use HealthLink. Scope = PRD §47: Consumer (1–11), Provider (12–16), Admin (17–21). The whole "Digital HealthLink" journey (search → learn → navigate → act) on the local stack.

### Step A.1 — Local environment & schema
- Provision **PostgreSQL 17** (winget) + verify `psql` and service running; provision **Mailhog** (Windows binary; fallback: SMTP dev inbox, flagged).
- Prisma: `prisma/schema.prisma`, `prisma migrate dev`, idempotent seed; `.env` (gitignored) + `.env.example`.
- Models (V1): Auth.js tables (`User`, `Account`, `Session`, `VerificationToken`); `Category` (16 education categories); `Topic` (slug, title, `healthCategory`, summary, structured sections, sources, `reviewedBy`, `reviewedOn`, status), `Faq`; `ProviderCategory` (enum: PRD §15 types), `Provider`, `Service` (M2M), `ProviderImage` (`storage/uploads`), `VerificationLevel` (HealthLink Verified / Partner / Unverified, PRD §16); `SavedResource`, `Report`, `AppointmentRequest`, `ServiceRequest` (PRD §18/§19), `UserHealthItem` (PRD §11 tracker basics), `Reminder` (PRD §12), `EmergencyContact`; `SearchLog` + counters (metrics, PRD §59).

### Step A.2 — Auth & guest-first shell
- Auth.js v5 magic-link + Prisma adapter + `app/api/auth/[...nextauth]/route.ts`.
- Guest-first routing: content, directory, services, and emergency are fully usable unsigned-in; accounts optional (PRD §9).

### Step A.3 — Convert static pages to DB-backed
- **Home:** greeting + search + 7 action cards + emergency banner (PRD §9).
- **Explore:** 16-category grid + topic pages with all PRD sections + "when to seek help" + reviewed-by + report link (PRD §13/§14/§44).
- **Find Care:** category/location/open-hours/price filters where available, provider profiles with verification status, `tel:` + directions, appointment request → `AppointmentRequest` (PRD §15–§18).
- **Services:** Check My Health + service catalog + request → `ServiceRequest` (PRD §18/§19).
- **Health:** dashboard + tracker items + reminders (PRD §10–§12, §41) — personal data only behind consent; never auto-labels healthy/unhealthy.
- **Emergency:** Get Help Now page + contacts (PRD §27).
- **Admin:** content management, provider verification, user management, basic analytics, safety/reporting (PRD §47 Admin 17–21).

### Deliverables (Phase A)
- Local Postgres + Mailhog running; migrations applied; seed rerunnable (core topics across the 16 PRD categories, 40+ providers with verification levels, emergency contacts).
- Auth magic-link works locally; guests complete the full journey.
- All six consumer nav areas served from Prisma; `npm run lint` + `npm run build` green.

### Definition of done
The PRD §52 user journey (hypertension example) passes in guest and signed-in modes: read education → choose Check My BP → find screening → book/attend → education → referral/navigation → find provider → book → follow-up reminder → continue monitoring. Service requests persist to DB.

---

## Phase B — PRD V1.5 (Family, documents, community + health-worker workflow)

Goal: continuity of care across screening events and dependants.

- Family profiles + caregiver access / consent (PRD §26).
- Health documents upload to local `storage/uploads` (PRD §25).
- Community health events + screening registration (PRD §20).
- Community screening workflow: Event → Registration → Consent → Screening → Result → Education → Referral → Reminder → Outcome (PRD §21).
- Health-worker dashboard + basic referrals (PRD §22/§24).
- Offline-first health-worker data entry with secure sync (PRD §22/§23).
- NGO/development programme mode: aggregated/de-identified reporting (PRD §36).

---

## Phase C — PRD V2 (Mobile clinic, organizations, digital-physical)

Goal: take HealthLink from the phone into the community.

- HealthLink Mobile Clinic operating arm + service catalogue (PRD §19) with clinical-scope discipline.
- Community Health Days + "Know Your Numbers" first campaign (PRD §20/§64).
- Corporate HealthLink / School HealthLink / Church & Community programmes (PRD §33–§35).
- Advanced referrals with provider handoff (PRD §24).
- Provider analytics + WhatsApp integration (PRD §37/§31).
- Business platform dashboards (PRD §32).

---

## Phase D — PRD V3 (Advanced HealthLink)

Only after the foundation works: Telehealth, PHR interoperability aligned with Nigerian digital-health architecture (PRD §25), AI health-navigation assistant grounded in approved content (PRD §28), multilingual + voice + low-literacy mode (PRD §29/§30), advanced reminders, healthcare affordability navigation (PRD §39), HealthLink marketplace with safety safeguards (PRD §38). Health Wallet (PRD §40) only after legal/financial review.

---

## Phase E — PRD V4 (Africa scale)

Country-specific directories, local languages, country-specific regulations, local insurance integration, cross-border navigation, regional health programmes (PRD §51).

---

## Business model (captured in PRD §45)

B2C (free education/navigation; optional premium + mobile-clinic services), B2B (provider profiles/tools/booking/analytics/campaigns), B2B2C (corporate, school, community programmes, screening days), programme revenue (NGO/development partners), mobile clinic revenue, controlled disclosed partnerships. No single revenue dependency.

---

## Cross-phase rules & risks

- Locked stack discipline: no PRD-steered tool changes without an explicit steer (see §0 table).
- Content trust: a topic ships only with `status = REVIEWED`, sources, and "when to seek help"; reviewer attribution uses accurate credentials (health educator / counsellor — never invented doctor/nurse titles). Ships only per PRD §44 governance.
- Schema changes via `prisma migrate dev`; seeds idempotent.
- Windows specifics: Postgres install (winget) requires UAC; Mailhog needs a Windows binary (fallback flagged). Node already installed.
- Biggest risks: content volume/quality (mitigate by curating core topics in the 16 PRD categories first) and scope creep (build V1 fully before V1.5/V2/V3).
- Decisions to confirm with owner when reached: appointment fields, provider approval workflow, report escalation, corporate pricing.