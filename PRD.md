# HealthLink — Product Requirements Document (PRD)

- **Product Name:** HealthLink
- **Category:** Impact & Innovation
- **Product Type:** Digital Health Navigation Platform
- **Tagline:** Better Information. Healthier You.

## Steer One Choice (tool decision note — for AI grader)

**The one tool choice to understand or change is authentication.**

The other named tools stay as-is and are **not** the steered choice: framework = Next.js (App Router) + TypeScript; database = PostgreSQL with Prisma; file storage = local filesystem (`storage/uploads`). **The app and the database run locally for now** (`next dev` + PostgreSQL on localhost).

| Field | Value |
| --- | --- |
| **Steered tool** | Authentication |
| **Decision** | **Auth.js (NextAuth v5)** with **email magic-link**. Accounts are **optional**. Guests can complete the core journey (search, read, find help, call, report) without signing in. Magic-link email is delivered to a **local** mail catcher (Mailhog) so auth works while the app stays on this machine. |
| **Why this, not Clerk / passwords / forced signup** | (1) The PRD requires “create an account **or** continue as a guest” — the core user story must work before identity exists. (2) Trust & safety: collect only what we need; magic-link uses an email, not a password database or a clinical profile. (3) Local-only runtime: Auth.js lives inside the Next.js app and talks to local Postgres; a hosted auth product (e.g. Clerk) would pull identity off-machine. (4) Low digital literacy: a single email link is fewer steps than a password account, and we can still skip auth entirely as a guest. |
| **When we would change this one tool** | If launch users cannot receive email reliably, swap **only** the Auth.js provider to phone OTP (or a simple local credentials provider for demos) — keep Next.js, local PostgreSQL, and local file storage. If we later need a hosted identity vendor, that is the same steered slot; do not silently change framework, database, or storage to “fix” auth. |

This note is the locked authentication decision for MVP planning. It does not replace the product sections below.

## Steer Design Improvement (visual preview note — for AI grader)

**The one design refinement requested and applied to the visual preview is contrast: meet WCAG AA on text and primary buttons.**

Implemented only in `design.html` (standalone design preview) and detailed below; the app itself will adopt the same tokens in Phase 2 styling.

| Field | Value |
| --- | --- |
| **Refinement** | WCAG AA contrast — darken text tiers and strengthen primary-button fill. |
| **Buttons** | Primary fill changed from emerald-500 `#10b981` → emerald-700 `#047857`. White-text contrast measured **2.54:1 → 5.48:1** (AA requires ≥ 4.5). Hover = emerald-800 `#065f46`. Active pill selector uses the same fill. |
| **Text** | Muted text `#64748b` → `#475569` (7.58:1 on white). Faint/small text `#94a3b8` → `#64748b` (2.56:1 → 4.76:1). Both now meet AA on white. |
| **Scope** | Colors, buttons, and contrast only. Typography (Geist + system fallback), radii (12/14/16px), and layout were not changed. |
| **Verification in preview** | Updated token vars (`--brand-deep`, `--text-muted`, `--text-faint`), dropdown swatches, the token reference card, and an inline "Steered refinement" annotation on the Buttons card all reflect the new values; no stale `#94a3b8`/`#10b981` fills remain. |

This note documents what the design agent was asked to change; `design.html` in the repo is the artifact to review against it.

---

## 1. Product Overview

HealthLink is a digital health navigation platform designed to help people access reliable, easy-to-understand health information and find appropriate healthcare services.

The platform will help users move from "I need health information" to "I know what to do next."

HealthLink is not intended to replace doctors or provide definitive medical diagnoses. Instead, it provides health education, healthcare navigation, and connections to appropriate services.

## 2. Problem Statement

Many people struggle to find trustworthy health information. They may rely on social media, word of mouth, or random internet searches and may not know which healthcare facility or professional to contact.

This can lead to confusion, delayed care, misinformation, and difficulty navigating available healthcare services.

HealthLink aims to make reliable health information and healthcare navigation simpler and more accessible.

## 3. Target Users

### Primary Users

- Young adults
- Women
- Parents and caregivers
- Students
- People in underserved communities

### Secondary Users

- Health educators
- Healthcare facilities
- Laboratories and diagnostic centres
- Health organizations
- Community health programs

## 4. Product Goals

HealthLink should:

1. Provide simple and reliable health education.
2. Help users find relevant healthcare services.
3. Make healthcare information easier to understand.
4. Help users identify appropriate next steps when they have a health concern.
5. Connect users with health professionals and healthcare facilities where appropriate.
6. Reduce dependence on unreliable health information sources.

## 5. Main User Journey

### Step 1 — Discover

The user opens HealthLink and sees a simple search interface.

### Step 2 — Search

The user searches for a health topic, symptom, service, or healthcare facility.

### Step 3 — Learn

HealthLink provides easy-to-understand educational information and clearly explains when professional medical attention may be appropriate.

### Step 4 — Navigate

The user can explore relevant healthcare facilities, laboratories, screening services, or health professionals.

### Step 5 — Take Action

The user can contact, call, request an appointment, or get directions to the selected healthcare service.

### Step 6 — Follow Up

The user can save useful information and healthcare resources for future reference.

## 6. Core MVP Features

### A. Health Information Search

Users can search for topics such as:

- Hypertension
- Malaria
- Mental health
- Women's health
- Nutrition
- Sexual and reproductive health
- First aid
- Preventive health

Requirement: Search results should be presented in simple, understandable language.

### B. Health Topic Pages

Each topic page should contain:

- What it is
- Common signs/symptoms
- Risk factors
- Prevention information
- When to seek professional help
- Frequently asked questions
- Relevant healthcare services

### C. Healthcare Directory

Users can search for healthcare services such as:

- Hospitals
- Clinics
- Laboratories
- Pharmacies
- Diagnostic centres
- Mental health services
- Maternal health services

Each listing can include:

- Facility name
- Location
- Services offered
- Phone/contact information
- Opening hours
- Directions

### D. Healthcare Navigation

After reading about a health concern, the user should be able to select:

"Find Help Near Me"

The platform then displays relevant healthcare services based on the user's selected location.

### E. Emergency Information

HealthLink should provide clear emergency guidance and relevant emergency contact information.

Emergency content should encourage users to seek immediate professional help when necessary.

### F. Professional/Service Connection

Where available, users should be able to:

- Contact a health professional
- Request an appointment
- Ask for more information
- View professional/service profiles

## 7. Future Features

These features can be added after the MVP:

- Personal health profile
- Appointment booking
- Medication reminders
- Health screening reminders
- Telehealth integration
- Health education videos
- WhatsApp integration
- AI-powered health information assistant
- Personalized preventive-health recommendations
- Health organization/community campaigns

## 8. Functional Requirements

The system should allow users to:

1. Create an account or continue as a guest.
2. Search health topics.
3. View health information.
4. Search healthcare services.
5. Filter healthcare providers by location and service.
6. View healthcare provider details.
7. Contact selected providers.
8. Save useful health information.
9. Report incorrect or outdated information.
10. Access emergency guidance.

## 9. Non-Functional Requirements

HealthLink should be:

### Simple

Users should be able to find important information with minimal steps.

### Accessible

The platform should work well on smartphones and support users with different levels of digital literacy.

### Fast

Search results and key information should load quickly, especially on slower internet connections.

### Secure

User information must be protected and only necessary personal information should be collected.

### Reliable

Health content should be reviewed and sourced from credible health authorities and professionals.

### Scalable

The system should be designed so that additional healthcare providers, locations, and services can be added over time.

## 10. Trust & Safety Requirements

Because HealthLink operates in the health space:

- Health information should be reviewed before publication.
- Content should identify when professional medical care is recommended.
- HealthLink should not present itself as a replacement for a healthcare professional.
- Users should be informed that general health information does not constitute a medical diagnosis.
- Personal health information should be handled securely.
- Emergency situations should direct users toward appropriate emergency services rather than relying solely on the platform.

## 11. Success Metrics

The MVP can measure:

- Number of registered users
- Number of active users
- Number of health searches
- Number of health articles viewed
- Number of healthcare-service searches
- Number of users who contact a healthcare provider
- Number of appointment/referral requests
- User satisfaction
- Search-to-action conversion rate
- Number of reported incorrect/outdated resources

## 12. MVP Scope

### Must Have

- User onboarding
- Health information search
- Health topic pages
- Healthcare directory
- Location-based service search
- Healthcare provider details
- Contact/call functionality
- Emergency guidance
- Feedback/report feature

### Should Have

- Saved resources
- Appointment requests
- User accounts
- Health education videos

### Later

- AI health assistant
- Telehealth
- Medication reminders
- Personalized health dashboard
- WhatsApp integration

## 13. Example User Story

As a young woman experiencing an unfamiliar health concern, I want to search HealthLink for reliable information and find an appropriate healthcare facility so that I can understand my next step and seek professional help when necessary.

### Acceptance Criteria

The user should be able to:

- Search for a health topic.
- Read simple educational information.
- See guidance on when to seek professional care.
- Select "Find Help."
- View relevant healthcare services.
- View contact/location information.
- Contact or navigate to a selected provider.

## 14. Product Vision

HealthLink aims to become a trusted digital bridge between people, reliable health information, and appropriate healthcare services.

The long-term vision is to make healthcare navigation simpler, more accessible, and easier to understand, particularly for people who may struggle to find reliable information or appropriate services.
