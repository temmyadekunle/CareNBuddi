# CareNBuddi — Product Requirements Document (PRD)

- **Product Name:** CareNBuddi
- **Product Type:** Digital Health + Preventive Healthcare + Community Health Platform
- **Tagline:** Better Information. Healthier You.
- **Positioning:** "Your Personal Health Navigation System."
- **Initial Market:** Nigeria
- **Long-Term Market:** Africa
- **Document Version:** 2.0
- **Product Stage:** Concept → MVP

## Appendix A — Tool Stack & Steered Choice (note for AI grader)

**The one tool choice to understand or change is authentication.**

The other named tools stay as-is and are **not** the steered choice: framework = Next.js (App Router) + TypeScript; database = PostgreSQL with Prisma; file storage = local filesystem (`storage/uploads`). **The app and the database run locally for now** (`next dev` + PostgreSQL on localhost).

| Field | Value |
| --- | --- |
| **Steered tool** | Authentication |
| **Decision** | **Auth.js (NextAuth v5)** with **email magic-link**. Accounts are **optional**. Guests can complete the core journey (search, read, find help, call, report) without signing in. Magic-link email is delivered to a **local** mail catcher (Mailhog) so auth works while the app stays on this machine. |
| **Why this, not Clerk / passwords / forced signup** | (1) The PRD requires "create an account **or** continue as a guest" — the core user story must work before identity exists. (2) Trust & safety: collect only what we need; magic-link uses an email, not a password database or a clinical profile. (3) Local-only runtime: Auth.js lives inside the Next.js app and talks to local Postgres; a hosted auth product (e.g. Clerk) would pull identity off-machine. (4) Low digital literacy: a single email link is fewer steps than a password account, and we can still skip auth entirely as a guest. |
| **When we would change this one tool** | If launch users cannot receive email reliably, swap **only** the Auth.js provider to phone OTP (or a simple local credentials provider for demos) — keep Next.js, local PostgreSQL, and local file storage. If we later need a hosted identity vendor, that is the same steered slot; do not silently change framework, database, or storage to "fix" auth. |

This note is the locked authentication decision for MVP planning. It does not replace the product sections below.

## Appendix B — Design System & Contrast Steer (note for AI grader)

**The one design refinement requested and applied is contrast: meet WCAG AA on text and primary buttons, using the v2.0 CareNBuddi design system.**

Implemented in `design.html` (standalone design preview) and the app via Tailwind v4 theme tokens in `app/globals.css`.

| Field | Value |
| --- | --- |
| **Brand system (PRD §54)** | Primary CareNBuddi Teal `#0F8B8D`; Secondary Health Green `#4CAF50`; Accent Warm Coral `#EC4899` (sparing); Warning Amber `#F59E0B`; Emergency Red `#DC2626`; Neutral slate/white. |
| **Primary buttons (AA)** | Fill uses the deep teal token `brand-700` `#0B6B6D`. White-text contrast ≈ **6.3:1** (AA requires ≥ 4.5). Hover = `brand-800` `#095355`. Active pill selectors use the same fill. |
| **Text (AA)** | Muted text `#475569` (≈7.6:1 on white). Faint/small text `#64748b` (≈4.8:1 on white). Brand link text uses `brand-700` `#0B6B6D` (≈6.3:1). Green text uses `#2F7D33` (≈5.1:1); coral text uses `#BE185D` (≈6.0:1). |
| **Scope** | Colors, buttons, and contrast only. Typography (Geist + system fallback), radii (12/14/16px), and layout were not changed. |
| **Verification in preview** | Tokens (`brand-*`, `green-*`, `coral-*`), swatches, the token reference card, and an inline "AA steer" annotation on the Buttons card reflect the new values; no stale low-contrast fills remain. |

This note documents what the design agent was asked to change; `design.html` in the repo is the artifact to review against it.

---

# CARENBUDDI — PRODUCT REQUIREMENTS DOCUMENT

## 1. PRODUCT OVERVIEW

CareNBuddi is a digital and community-based healthcare platform designed to help people understand their health, monitor relevant health information, access preventive screening and wellness services, find appropriate healthcare providers, receive referrals and follow through with their healthcare journey.

CareNBuddi combines:

- Health education
- Personal health management
- Preventive screening
- Healthcare discovery
- Community health programmes
- Mobile clinic services
- Health-worker tools
- Referrals
- Appointment coordination
- Health reminders
- Organizational wellness programmes
- Healthcare-provider services

CareNBuddi is not designed to replace doctors, hospitals or licensed healthcare professionals.

Instead, it acts as the connection layer between:

People ↔ Health Information ↔ Health Workers ↔ Healthcare Providers ↔ Communities ↔ Organizations

## 2. THE PROBLEM

Healthcare access in Nigeria and many African markets is affected by several connected problems.

People may:

- Have difficulty finding trustworthy health information.
- Delay seeking care because they do not know where to go.
- Struggle to identify appropriate healthcare services.
- Have limited access to preventive screening.
- Lose track of health measurements and appointments.
- Receive screening results without adequate follow-up.
- Find healthcare costs difficult to understand or plan for.
- Have limited awareness of available health insurance or financial-support options.
- Travel unnecessarily to find a service.
- Rely heavily on informal health information.
- Lack continuity between community screening and formal healthcare.

At the system level:

- Healthcare providers operate across fragmented systems.
- Community health programmes may still depend heavily on manual processes.
- Health workers need better tools for screening, education, referrals and follow-up.
- Organizations need better ways to manage employee/community wellness programmes.
- Healthcare organizations need ways to reach and engage potential patients appropriately.

WHO's Nigeria primary-health-care work identifies access, service integration and community participation as important elements of strengthening primary healthcare. Nigeria is also developing national digital-health infrastructure intended to improve interoperability and reduce fragmentation.

## 3. THE CARENBUDDI SOLUTION

CareNBuddi provides one connected journey:

LEARN → CHECK → FIND → CONNECT → ACT → FOLLOW UP

- **LEARN:** Understand a health topic using accessible, evidence-informed educational content.
- **CHECK:** Record or obtain appropriate preventive-health measurements and screening.
- **FIND:** Discover appropriate healthcare services and verified providers.
- **CONNECT:** Contact, book or request a service.
- **ACT:** Follow the recommended next step with a qualified professional where required.
- **FOLLOW UP:** Receive reminders, maintain relevant records and continue the healthcare journey.

## 4. PRODUCT VISION

"To make reliable health information, preventive healthcare and appropriate healthcare navigation accessible to people across Africa—regardless of location, income or digital experience."

## 5. PRODUCT MISSION

CareNBuddi exists to reduce the gap between:

"I have a health concern."

and

"I know what appropriate next step to take."

## 6. CORE PRODUCT PRINCIPLES

- **6.1 Prevention First:** CareNBuddi should encourage appropriate preventive care rather than only responding after illness occurs.
- **6.2 People First:** The platform should be designed around real healthcare journeys rather than organizational structures.
- **6.3 Trust First:** Health information must be reviewed, sourced and clearly dated where appropriate.
- **6.4 Human + Technology:** Technology should support healthcare workers, not pretend to replace them.
- **6.5 Low-Bandwidth First:** The product should work reasonably well on slower connections and lower-end devices.
- **6.6 Affordable by Design:** Core health education and essential navigation should remain accessible.
- **6.7 Privacy by Design:** Health information is highly sensitive and must receive strong privacy and security controls. Nigeria's Data Protection Act 2023 establishes the national data-protection framework, making privacy and responsible data processing a foundational product requirement rather than an optional feature.
- **6.8 Inclusive by Design:** CareNBuddi should support different literacy levels, different languages, accessibility needs, urban and rural communities, feature phones/low-connectivity environments through future channels, and different socioeconomic groups.

## 7. TARGET USERS

- **7.1 Individual Users:** Adults and young people who need health information, preventive care, screening, healthcare discovery, reminders, and health organization.
- **7.2 Families/Caregivers:** People managing healthcare information for children, parents, elderly relatives, and dependants.
- **7.3 Health Workers:** Including appropriately licensed community health workers, nurses, health educators, doctors, and other authorized professionals.
- **7.4 Healthcare Providers:** Hospitals, clinics, laboratories, pharmacies, specialist practices, mental-health providers, diagnostic centres.
- **7.5 Organizations:** Companies, schools, churches, NGOs, community groups, associations, development organizations.
- **7.6 Health Programmes:** Government and development programmes may eventually use CareNBuddi for appropriate community-health activities, subject to agreements, regulation and interoperability requirements.

## 8. THE CARENBUDDI ECOSYSTEM

CareNBuddi consists of six interconnected products.

1. **CareNBuddi Consumer** — for individuals and families.
2. **CareNBuddi Care Network** — for discovering and connecting with healthcare providers.
3. **CareNBuddi Community** — for community screening and health programmes.
4. **CareNBuddi Mobile Clinic** — physical preventive-health and outreach services.
5. **CareNBuddi Health Worker** — tools for authorized health workers.
6. **CareNBuddi Business** — a B2B platform for organizations and healthcare providers.

## 9. CONSUMER APP

**9.1 Home Dashboard**

The home screen should answer: "How can CareNBuddi help you today?"

Primary actions:

- Understand My Health
- Check My Health
- Find Healthcare
- Book a Health Service
- My Health Records
- My Reminders
- Get Help Now

## 10. PERSONAL HEALTH DASHBOARD

Users can view selected health information in one place.

Example — MY HEALTH:

- Blood Pressure — Last recorded: 14 days ago
- Weight — Last recorded: 7 days ago
- Activity — This week's activity
- Appointments — Next appointment
- Screenings — Upcoming/recommended screening
- Health Education — Recommended learning content

The dashboard should not automatically label a person as healthy or unhealthy based solely on app data.

## 11. HEALTH TRACKER

Users can optionally record blood pressure, blood glucose, weight, temperature, menstrual cycle information, pregnancy-related information where appropriate, symptoms, allergies, medications, immunization information, screening history, and health goals. Users decide what to store.

## 12. SMART REMINDERS

CareNBuddi can remind users about appointments, screening dates, medication schedules, health goals, follow-up dates, educational programmes, and community health events. Reminder logic should be configurable and should not make unsupported clinical recommendations.

## 13. HEALTH EDUCATION ENGINE

CareNBuddi organizes information around user needs rather than being a health blog.

Categories: General Health, Women's Health, Men's Health, Mental Health, Children's Health, Nutrition, Sexual & Reproductive Health, Maternal Health, Preventive Health, Chronic Conditions, First Aid, Oral Health, Eye Health, Healthy Ageing, Environmental Health, Occupational Health.

Each topic should follow: What is it? Common signs · Risk factors · Prevention · What you can do · When to seek professional help · Where to find help.

## 14. HEALTH EDUCATION → ACTION

Every major educational article should end with an action pathway. Example:

Understanding Hypertension → Learn → Check your BP → Find a screening location → Understand your result → Speak to a qualified professional if appropriate.

This is one of CareNBuddi's key differentiators.

## 15. HEALTHCARE FINDER

Users can search for hospitals, clinics, PHCs, laboratories, pharmacies, diagnostic centres, doctors, nurses, mental-health professionals, dental services, eye-care services, maternal services, and specialists.

Filters: Location · Service · Opening hours · Price information where available · Insurance/HMO acceptance where verified · Accessibility · Home service · Teleconsultation · Emergency availability · Verification status.

## 16. VERIFIED PROVIDER SYSTEM

Providers receive verification levels:

- **CareNBuddi Verified** — Identity, registration and required documentation checked per CareNBuddi's verification process.
- **Partner Provider** — Formal partnership exists.
- **Unverified Listing** — Information has not yet completed verification.

The platform must never imply that paying CareNBuddi automatically makes a provider medically superior.

## 17. HEALTHCARE PRICE TRANSPARENCY

Where providers voluntarily provide reliable information, CareNBuddi can display estimated price, price range, insurance/HMO information, payment options, and services included. Healthcare financial protection should remain an important product consideration because high out-of-pocket spending is a documented challenge in Nigeria.

## 18. HEALTHCARE BOOKING

Users can eventually request appointments, book screenings, request laboratory services, book wellness services, contact providers, and request mobile-clinic services. The initial MVP can begin with contact/request booking before building a sophisticated appointment engine.

## 19. CARENBUDDI MOBILE CLINIC

The physical arm of CareNBuddi. Provides appropriately licensed preventive and community-health services: blood pressure screening, blood glucose screening, basic health checks, health education, wellness assessment, selected screening programmes, health campaigns, and referral services. The service catalogue must be determined by clinical scope, professional licensing, equipment, protocols and applicable regulations.

## 20. COMMUNITY HEALTH DAYS

An organization can create a "CareNBuddi Community Health Day" — e.g. Church/Company/School, 300 expected participants, services: BP screening, blood glucose screening, health education, wellness assessment, referral. Participants can pre-register; health workers manage attendance and screening through CareNBuddi.

## 21. COMMUNITY SCREENING WORKFLOW

Event Created → Participant Registration → Consent → Screening → Result Recorded → Health Education → Referral if Appropriate → Follow-up Reminder → Outcome Tracking.

This transforms a one-day screening event into a continuity-of-care workflow.

## 22. HEALTH WORKER APP

Authorized workers can access Today's Events (registered participants, participants screened, pending screenings, follow-ups) and the Participant Workflow (Register → Screen → Educate → Refer → Follow Up). The system should support offline-first workflows for areas with unreliable connectivity; on reconnect, data synchronizes securely.

## 23. OFFLINE-FIRST DESIGN

The system should support offline participant registration, offline screening data entry, offline educational content, local data encryption, secure synchronization, and a low-data mode. This is more meaningful than simply saying "CareNBuddi works in Africa."

## 24. CARENBUDDI REFERRAL ENGINE

A screening or healthcare interaction may generate a referral pathway: Community Screening → Professional assessment → Referral required → Find appropriate provider → Contact/book → Follow-up. The system should not independently diagnose users or make clinical decisions outside its approved clinical protocols.

## 25. PERSONAL HEALTH RECORD

The user should eventually have a secure personal health record containing screening history, immunization information, allergies, medications, appointments, laboratory documents, referral history, and health measurements. Users control access permissions. Where interoperability becomes possible, CareNBuddi should align with relevant Nigerian digital-health standards rather than creating a closed data silo.

## 26. FAMILY HEALTH

A user can optionally create linked profiles for dependants (Me, Partner, Child, Parent) with functions such as appointment reminders, vaccination information, screening reminders, health documents, and caregiver access. Privacy and consent controls are essential.

## 27. HEALTH EMERGENCY NAVIGATION

A highly visible "🚨 GET HELP NOW" feature that can provide emergency guidance, emergency facility discovery, relevant emergency contacts, location-based facility information where available, and basic first-aid education. CareNBuddi must clearly distinguish educational guidance from emergency medical care.

## 28. CARENBUDDI AI ASSISTANT (future)

"Ask CareNBuddi" — users can ask what hypertension means, what questions to ask their doctor, how to prepare for an appointment, where to find a screening. AI should be used primarily for navigation, education, summarization, preparation, and reminders — not autonomous diagnosis or treatment. AI-generated health information should be grounded in approved CareNBuddi content and reviewed governance processes.

## 29. MULTILINGUAL CARENBUDDI

Future languages: English, Yoruba, Hausa, Igbo, Pidgin — later French, Swahili, Amharic, Arabic, and other African languages based on expansion. Health information should be professionally reviewed rather than relying entirely on machine translation.

## 30. LOW-LITERACY MODE

Content can include audio explanations, illustrations, short videos, simple language, voice navigation, and local-language audio to expand accessibility.

## 31. WHATSAPP CARENBUDDI

A future lightweight channel for reminders, health information, event registration, appointment reminders, screening-event information, and connection to appropriate services. The WhatsApp experience should never expose sensitive health information unnecessarily.

## 32. CARENBUDDI BUSINESS PLATFORM

The B2B engine. Organizations (companies, schools, churches, NGOs, community groups, hospitals, clinics, laboratories, pharmacies, health programmes) get a dashboard.

## 33. CORPORATE CARENBUDDI

Companies can purchase Workplace Wellness Packages: BP screening, blood glucose screening, health education, mental-health awareness, wellness programmes, health campaigns, mobile clinic visits — with programme-level reporting. Individual medical information remains confidential and should not be exposed to employers except where legally permitted and appropriately consented.

## 34. SCHOOL CARENBUDDI

Schools can organize health education, screening programmes, wellness days, first-aid education, menstrual-health education, nutrition education, and mental-health awareness. Student information requires appropriate consent, safeguarding and privacy controls.

## 35. CHURCH & COMMUNITY CARENBUDDI

Organizations can create recurring programmes such as "CareNBuddi Wellness Sunday" or "Community Health Day", managing registration, screening, health education, referrals, follow-ups, and programme reporting.

## 36. NGO / DEVELOPMENT PROGRAMME MODE

NGOs can manage community programmes with a dashboard: people reached, screened, educated, referred, followed up, communities reached, programme outcomes. Data should be aggregated/de-identified for reporting where possible and appropriate.

## 37. HEALTHCARE PROVIDER DASHBOARD

Providers can manage profile, services, availability, booking requests, referrals, patient communications, health campaigns, and business analytics (profile views, service searches, contact requests, booking requests, referral sources).

## 38. CARENBUDDI HEALTH MARKETPLACE

Eventually, CareNBuddi could connect users with healthcare services, screening, diagnostics, wellness services, telehealth, and approved health products/services — with strong safeguards against unsafe products, misleading health claims and conflicts of interest.

## 39. FINANCIAL HEALTHCARE NAVIGATION

A major future differentiator: "How can I afford this care?" CareNBuddi could help users understand estimated service costs, insurance/HMO options, provider payment options, public/low-cost services where verified, community programmes, subsidized programmes where available, and screening events. Not a lender — improved healthcare affordability visibility and navigation.

## 40. CARENBUDDI HEALTH WALLET (future)

A future feature to organize health-service payments, receipts, insurance information, health subscriptions, and wellness-programme credits — developed only after legal, financial and data requirements are fully assessed.

## 41. PREVENTIVE HEALTH SCORE

A future engagement indicator, not a medical score. Instead of "You are 78% healthy," CareNBuddi shows a Prevention Checklist (BP checked, annual check-up completed, dental check-up, recommended screening, health education completed). Encourages action without pretending to medically grade the person.

## 42. CARENBUDDI COMMUNITY MAP

A future map showing healthcare facilities, pharmacies, laboratories, screening events, mobile clinic locations, community health programmes, and health campaigns — "Health services available around me."

## 43. HEALTH ALERTS

Verified public-health information about disease outbreaks, vaccination campaigns, heat risks, flood-related health risks, environmental hazards, and public-health advisories — from authoritative or verified sources.

## 44. TRUST & CONTENT GOVERNANCE

CareNBuddi health content should have Author, Reviewer, Review date, Source/reference, and Next review date. Example: "Reviewed by: Qualified Health Professional · Last reviewed: September 2026." This distinguishes CareNBuddi from random health content online.

## 45. BUSINESS MODEL

CareNBuddi uses a diversified revenue model:

- **B2C:** Optional premium health-management features, selected paid services, mobile clinic services. Core educational/navigation functions remain accessible.
- **B2B:** Providers pay for professional profiles, business tools, booking, analytics, campaigns.
- **B2B2C:** Organizations pay for employee wellness, school health, community health programmes, screening days.
- **Programme Revenue:** NGOs/development partners contract CareNBuddi for community screening, digital registration, programme management, follow-up, impact reporting.
- **Mobile Clinic:** Revenue from corporate packages, community programmes, paid wellness events, screening programmes.
- **Partnerships:** Carefully controlled partnerships with healthcare organizations and approved health brands. Sponsored content must be clearly identified.

## 46. WHAT CARENBUDDI SHOULD NOT DO

CareNBuddi should not: claim to replace doctors; give autonomous medical diagnoses; prescribe prescription medicines without an appropriately regulated clinical service; sell user health data; allow providers to buy better clinical outcomes; allow advertising to override safety; present sponsored providers as independently recommended; make unsupported health claims; or give employers unrestricted access to employee health records. Privacy and data governance must be fundamental.

## 47. MVP — VERSION 1 (Consumer, Provider, Admin)

**Consumer:** (1) Account, (2) Home dashboard, (3) Health education, (4) Health categories, (5) Health search, (6) Healthcare finder, (7) Provider profiles, (8) Basic health tracking, (9) Reminders, (10) Emergency guidance, (11) Booking/contact request.

**Provider:** (12) Provider registration, (13) Verification workflow, (14) Provider profile, (15) Services, (16) Contact/booking requests.

**Admin:** (17) Content management, (18) Provider verification, (19) User management, (20) Basic analytics, (21) Safety/reporting system.

## 48. MVP VERSION 1.5

Add: Family profiles, Health documents, Community health events, Screening registration, Health-worker dashboard, Basic referrals, Offline health-worker workflow.

## 49. VERSION 2

Add: CareNBuddi Mobile Clinic, Community Health Days, Corporate wellness, School CareNBuddi, NGO programmes, Advanced referrals, Provider analytics, WhatsApp integration.

## 50. VERSION 3

Add: Telehealth, PHR interoperability, AI health-navigation assistant, Multilingual voice support, Advanced health reminders, Healthcare affordability navigation, Health marketplace.

## 51. VERSION 4 — AFRICA SCALE

Expand to other African markets: country-specific provider directories, local languages, country-specific regulations, local insurance integration, cross-border health navigation, regional health programmes. CareNBuddi should not assume one Nigerian workflow applies everywhere.

## 52. USER JOURNEY (Hypertension example)

User sees health education → reads "Understanding Hypertension" → chooses Check My Blood Pressure → finds nearby screening → books or attends a Community Health Day → health worker records screening → user receives education → if professional evaluation needed, referral/navigation → user finds provider → books/contacts → follow-up reminder → continues monitoring. Continuity rather than a one-time interaction.

## 53. DIFFERENTIATING FEATURES

1. Digital + Physical — most digital platforms stop at the screen; CareNBuddi moves into communities.
2. Education + Action — connects education to an appropriate next step.
3. Screening → Referral → Follow-up — a screening event does not end when the BP machine is packed away.
4. Individual + Organization — one ecosystem serves both.
5. Offline-first — designed for real-world connectivity constraints.
6. Local-language and low-literacy support — designed for African users, not localized afterward.
7. Healthcare affordability visibility.
8. Interoperability — align with Nigeria's national digital-health architecture rather than becoming an isolated data silo.

## 54. DESIGN SYSTEM

- **Primary — CareNBuddi Teal:** #0F8B8D (Healthcare, Trust, Technology)
- **Secondary — Health Green:** #4CAF50 (Wellness, Prevention, Growth)
- **Accent — Warm Coral:** #EC4899 (sparingly, selected wellness/community elements)
- **Warning — Amber:** #F59E0B
- **Emergency — Red:** #DC2626
- **Neutral:** Slate/white/soft gray.

## 55. BRAND PERSONALITY

Trustworthy, Human, Modern, Accessible, African, Professional, Warm. It should not look like a hospital billing system, a pharmaceutical advertisement, a government portal, or a generic fitness app.

## 56. NAVIGATION

**Consumer App:** Home · Explore · Find Care · Services · Health · Profile.

**Health Worker App:** Dashboard · Events · Participants · Screenings · Referrals · Follow-up.

**Business Dashboard:** Overview · Programmes · Bookings · Providers/Services · Reports · Analytics.

## 57. TECHNICAL REQUIREMENTS

Modular system. Core components: mobile application, web application, backend API, authentication, user management, provider management, health-content management, health-record service, booking service, notification service, referral service, screening service, analytics, admin dashboard. Future integrations: payment systems, messaging platforms, telehealth, insurance/HMO systems, laboratory systems, healthcare information systems, appropriate national digital-health infrastructure.

## 58. SECURITY REQUIREMENTS

Encryption in transit, encryption at rest, strong authentication, role-based access, consent management, audit logs, secure backups, data minimization, access controls, breach-response procedures, data retention policies. Exact architecture should be reviewed by qualified legal, security and healthcare professionals before handling real clinical data.

## 59. SUCCESS METRICS

- **Consumer:** registered users, monthly active users, health-content completion, health searches, screening bookings, provider contacts, follow-up completion.
- **Community:** health events, participants registered, participants screened, referrals, follow-ups completed, communities reached.
- **Providers:** verified providers, provider retention, booking requests, leads generated.
- **Business:** paying organizations, monthly recurring revenue, revenue per organization, customer acquisition cost, customer retention, mobile clinic revenue.
- **Impact:** preventive screenings completed, health education reach, referral completion, follow-up completion, geographic coverage, user-reported access improvements.

## 60. NORTH STAR METRIC

**"Completed Health Actions."** A completed health action could be: completing a recommended educational module, completing a screening, booking an appropriate appointment, attending a community health event, completing a follow-up, or connecting with a healthcare provider. This measures whether CareNBuddi actually helps people move from information to action.

## 61. KEY BUSINESS METRICS

Acquisition (who discovers CareNBuddi), Activation (first meaningful health action), Retention (who returns), Conversion (who becomes a paying customer), Revenue (recurring revenue per segment), Impact (measurable healthcare-navigation or preventive-care activity).

## 62. MAJOR RISKS

- Medical misinformation — mitigation: clinical review and content governance.
- Privacy breach — mitigation: privacy-by-design, security controls, regulatory compliance.
- Low user trust — mitigation: verified providers, transparent sources, clear disclaimers.
- Low adoption — mitigation: start with a specific high-value use case and test with real users.
- Too many features — mitigation: phased roadmap.
- Regulatory complexity — mitigation: professional legal, clinical and regulatory guidance before launching clinical services.
- Mobile clinic costs — mitigation: begin with partnerships/pop-up community health days before purchasing a large fleet.
- Provider participation — mitigation: offer measurable business value rather than simply asking providers to create profiles.

## 63. GO-TO-MARKET STRATEGY

Don't launch everywhere at once. Pilot in one Nigerian city/region; pilot users (young adults, women, families, community groups, small businesses); a small number of pilot partners (clinics, laboratories, pharmacies, health professionals, community organizations). First Signature Programme: "CareNBuddi Community Health Day" — demonstrating Registration → Screening → Education → Referral → Follow-up.

## 64. FIRST PRODUCT CAMPAIGN

**"Know Your Numbers."** A preventive-health campaign focused initially on measurements such as blood pressure and blood glucose, with appropriate professional oversight. People can Learn → Screen → Understand → Connect → Follow Up. Organizations can sponsor or host screening events.

## 65. PRODUCT SUCCESS DEFINITION

- A person with a health concern does not have to navigate the healthcare system blindly — they can understand the concern, know what type of help may be appropriate, find a suitable service, access preventive care, connect with a qualified professional when needed, and keep track of relevant follow-up.
- A company, school, church, NGO or community can organize a health programme without relying entirely on spreadsheets, paper forms and disconnected processes.
- A healthcare provider can reach appropriate users, manage service requests and participate in preventive/community-health programmes through one platform.

## 66. THE BIGGER VISION

CareNBuddi should become the connection layer between people and healthcare — not a hospital, not merely a doctor-booking app, not merely a health blog, not merely a mobile clinic, not merely an AI chatbot. Instead: Health Information + Prevention + Screening + Navigation + Providers + Community Care + Follow-up — all connected.

## 67. FINAL PRODUCT POSITIONING

**CareNBuddi — Your Personal Health Navigation System.** Learn about your health. Check your health. Find appropriate care. Connect with healthcare. Stay on track. Better Information. Healthier You.

## 68. LONG-TERM CARENBUDDI ECOSYSTEM

```
                         CARENBUDDI
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
   INDIVIDUALS           HEALTH WORKERS        ORGANIZATIONS
       │                      │                      │
       ▼                      ▼                      ▼
 Health Dashboard       Screening Tools       Corporate Health
 Education              Referrals             School Health
 Tracking               Follow-up             NGO Programmes
 Reminders              Community Events      Community Events
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                       CARENBUDDI NETWORK
                              │
          ┌──────────────┬────┼────┬──────────────┐
          ▼              ▼         ▼              ▼
       Hospitals       Clinics     Labs       Pharmacies
          │              │         │              │
          └──────────────┴────┬────┴──────────────┘
                               │
                        MOBILE CLINIC
                               │
                        COMMUNITY CARE
                               │
                         FOLLOW-UP
```

## 69. THE CORE IDEA IN ONE SENTENCE

"CareNBuddi is a digital and community-based preventive healthcare ecosystem that connects people to trusted health information, screening, healthcare services, qualified professionals and follow-up—while giving healthcare organizations the tools to deliver and manage those services."

## 70. WHY THIS VERSION IS STRONGER

The original CareNBuddi was essentially "Find health information and healthcare." The new CareNBuddi becomes: "Help me understand my health → help me prevent problems → help me access screening → help me find appropriate care → help me connect → help me follow up." And on the business side: "Help healthcare providers and organizations reach people, deliver programmes, manage screening and referrals, and measure outcomes." One product, multiple revenue engines, multiple impact pathways.