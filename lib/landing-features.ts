/**
 * The landing page's feature register.
 *
 * Every status claim on the marketing page comes from here, so the page and
 * the application cannot drift apart silently. `implemented` and `verified`
 * are deliberately separate: a screen can exist and still be a placeholder,
 * and a status badge must never be earned by a button alone.
 *
 * Verified means checked against the application source and its tests, not
 * against a live Supabase project. Deployment-level checks are recorded in the
 * integration report rather than asserted on this page.
 */

export type FeatureStatus = "available" | "coming-soon" | "roadmap" | "vision";

export type RoadmapGroupId = "patient" | "provider" | "facility" | "ai";

export interface LandingFeature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  implemented: boolean;
  verified: boolean;
  href?: string;
  group?: RoadmapGroupId;
  note?: string;
}

/**
 * Available now. Each entry is a screen or flow that exists in the app and
 * behaves as described; none relies on seeded or simulated activity.
 */
export const AVAILABLE_NOW: readonly LandingFeature[] = [
  {
    id: "accounts",
    name: "Secure patient accounts",
    description: "Create an account, confirm your email and sign in to your own health space.",
    status: "available",
    implemented: true,
    verified: true,
    href: "/onboarding",
  },
  {
    id: "dashboard",
    name: "Personal health dashboard",
    description: "See upcoming care, reminders and health activity in one overview.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "passport",
    name: "Health Passport",
    description:
      "Keep blood group, allergies, medicines and emergency contacts together with a scannable summary.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "companion",
    name: "Health Companion",
    description:
      "Ask health questions and get guided next steps. Emergency signals are caught before any AI reply.",
    status: "available",
    implemented: true,
    verified: true,
    note: "Guidance only, never a diagnosis. Falls back to local guidance when the AI service is unavailable.",
  },
  {
    id: "languages",
    name: "Four-language experience",
    description: "English, Yoruba, Hausa and Igbo across the app.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "directory",
    name: "Find care directory",
    description:
      "Hospitals, clinics, primary health centres, laboratories and pharmacies across seven states, with call, WhatsApp and directions links.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "records",
    name: "Records, journal and health diary",
    description: "Keep records, notes, mood, cycle, symptoms and exercise logs in one place.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "reminders",
    name: "Health reminders",
    description: "Keep medicines and health activities in a simple reminder list.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "care-circle",
    name: "Care Circle",
    description: "Add family or trusted contacts and keep their key health details nearby.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "emergency",
    name: "Emergency help",
    description:
      "Call verified emergency numbers and find nearby emergency care. Guidance only, not a dispatch service.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "offline",
    name: "Installable, offline-ready app",
    description: "Add CareNBuddi to your home screen and keep opening it after the first load.",
    status: "available",
    implemented: true,
    verified: true,
  },
  {
    id: "provider-application",
    name: "Provider registration",
    description:
      "Apply to join, upload credentials to private storage and follow your verification status.",
    status: "available",
    implemented: true,
    verified: true,
    href: "/provider/register",
  },
  {
    id: "community",
    name: "Patient Community",
    description:
      "A moderated discussion space for signed-in patients: post questions, reply to others and report content that breaks the rules.",
    status: "available",
    implemented: true,
    verified: true,
    href: "/community",
    note: "Needs a signed-in account and the CareNBuddi backend. There is no offline or demo feed.",
  },
  {
    id: "provider-community",
    name: "Verified-provider Community",
    description:
      "A separate professional discussion space. Access requires a verified healthcare provider account.",
    status: "available",
    implemented: true,
    verified: true,
    href: "/provider/community",
    note: "Administrators can review and moderate, but only verified providers take part.",
  },
];

/**
 * Coming soon. Each item has working groundwork in the codebase and is being
 * prepared; nothing here is presented as usable today.
 */
export const COMING_SOON: readonly LandingFeature[] = [
  {
    id: "directory-expansion",
    name: "Expanded facility directory",
    description: "More facilities, states and service details as listings are reviewed.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "published-providers",
    name: "Verified profiles in the directory",
    description: "Approved providers published with their services and practice details.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "provider-facility-links",
    name: "Provider–facility connections",
    description: "Link professionals to the facilities where they practise.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "provider-management",
    name: "Enhanced provider onboarding",
    description: "Richer applications and ongoing profile management.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "appointment-management",
    name: "Appointment management",
    description: "Provider-side confirmation and scheduling for visit requests.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "records-enhancement",
    name: "Enhanced patient records",
    description: "Clearer record types, summaries and sharing options.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "medical-uploads",
    name: "Secure medical document uploads",
    description: "Store results and letters privately alongside your records.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "navigation",
    name: "Improved in-app care navigation",
    description: "Better guidance from a question to the right next step.",
    status: "coming-soon",
    implemented: false,
    verified: false,
  },
  {
    id: "telemedicine",
    name: "Telemedicine & Virtual Consultations",
    description:
      "Remote consultations, virtual follow-up appointments and access to healthcare professionals in different locations.",
    status: "coming-soon",
    implemented: true,
    verified: false,
    note: "Patient requests, provider scheduling and secure join flows are built. Live video stays off until the video service is configured and tested end to end.",
  },
];

/** On our roadmap. Names are the plan; no dates are promised. */
export const ROADMAP_GROUPS: readonly {
  id: RoadmapGroupId;
  label: string;
  items: readonly string[];
}[] = [
  {
    id: "patient",
    label: "Patient experience",
    items: [
      "Peer support groups",
      "Wellness communities",
      "Advanced family care coordination",
      "Advanced patient records",
      "Medication adherence and reminders",
      "Enhanced Health Passport capabilities",
    ],
  },
  {
    id: "provider",
    label: "Healthcare provider experience",
    items: [
      "Professional networking",
      "Knowledge sharing",
      "Clinical education",
      "Healthcare events",
      "Provider collaboration",
      "Advanced consultation management",
      "Secure patient–provider communication",
    ],
  },
  {
    id: "facility",
    label: "Facility experience",
    items: [
      "Advanced facility management",
      "Department and service management",
      "Staff and team management",
      "Advanced facility profiles",
      "Operating-hours management",
      "Facility analytics",
    ],
  },
  {
    id: "ai",
    label: "AI and technology",
    items: [
      "Persistent AI conversation history",
      "Personalised health guidance with consent",
      "Improved provider recommendations",
      "Expanded cloud synchronisation",
      "Advanced document management",
      "Advanced notifications",
    ],
  },
];

/** Our bigger vision. Direction, not a delivery plan. */
export const BIGGER_VISION: readonly LandingFeature[] = [
  {
    id: "connected-facilities",
    name: "Connected healthcare facilities",
    description: "Facilities working from the same picture of a person's care.",
    status: "vision",
    implemented: false,
    verified: false,
  },
  {
    id: "coordination",
    name: "Better care coordination",
    description: "Patients and professionals reaching each other with less friction.",
    status: "vision",
    implemented: false,
    verified: false,
  },
  {
    id: "connected-experiences",
    name: "Patient, family and provider continuity",
    description: "One connected experience across the people involved in care.",
    status: "vision",
    implemented: false,
    verified: false,
  },
  {
    id: "emergency-coordination",
    name: "Emergency response coordination",
    description: "A future ambition for coordinating response, not a live dispatch service.",
    status: "vision",
    implemented: false,
    verified: false,
    note: "Future ambition only. CareNBuddi does not dispatch emergency services today.",
  },
  {
    id: "system-navigation",
    name: "Healthcare navigation across the system",
    description: "Clearer routes through a complex healthcare landscape.",
    status: "vision",
    implemented: false,
    verified: false,
  },
  {
    id: "intelligent-assistance",
    name: "Intelligent healthcare assistance",
    description: "Assistance that understands context and knows its limits.",
    status: "vision",
    implemented: false,
    verified: false,
  },
  {
    id: "integrations",
    name: "Expanded healthcare integrations",
    description: "Connections to the tools and services people already rely on.",
    status: "vision",
    implemented: false,
    verified: false,
  },
  {
    id: "ecosystem",
    name: "A more connected healthcare ecosystem",
    description: "The long-term direction behind everything above.",
    status: "vision",
    implemented: false,
    verified: false,
  },
];
