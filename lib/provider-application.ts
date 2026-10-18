/**
 * Provider application domain model.
 *
 * Deliberately pure: no React, no storage, no browser APIs. Everything here is a
 * plain function over plain data so it can be unit tested under `node --test`
 * without a DOM, and so the same rules can be reused by the applicant screens,
 * the reviewer screens and any future server-side check.
 *
 * Two rules shape the whole file:
 *
 * 1. Identity verification and professional-qualification verification are
 *    separate. A government-issued ID proves *who you are*; a licence from a
 *    professional body proves *you may practise*. Neither implies the other, so
 *    they have independent states and an applicant is only "verified" when both
 *    have cleared.
 *
 * 2. Nothing here ever sets `verified`. Status is changed only by
 *    `reviewApplication`, which is the reviewer-side transition. The applicant
 *    screens can fill in facts; they cannot grant themselves privileges.
 */

/** Storage key. Kept here (not only in storage.ts) so the pure module owns it. */
export const PROVIDER_APPLICATIONS_KEY = "healthlink:provider-applications";

/* -------------------------------------------------------------- categories */

export type ProviderCategoryId =
  | "doctor"
  | "nurse"
  | "midwife"
  | "pharmacist"
  | "laboratory"
  | "mental-health"
  | "health-educator"
  | "public-health"
  | "nutrition"
  | "allied-health"
  | "other";

export interface ProviderCategory {
  id: ProviderCategoryId;
  label: string;
  /** Governing/licensing body, when the category is statutorily registered. */
  regulator: string | null;
  /**
   * True when practice requires a professional licence from a regulator.
   * Categories that do not require one follow an alternative evidence route
   * instead, so the form never implies a licence requirement that does not exist.
   */
  requiresLicence: boolean;
  /** Whether students and trainees may apply (distinct from full registration). */
  allowsTrainees: boolean;
}

export const PROVIDER_CATEGORIES_DETAIL: ProviderCategory[] = [
  { id: "doctor", label: "Doctor", regulator: "Medical and Dental Council of Nigeria", requiresLicence: true, allowsTrainees: true },
  { id: "nurse", label: "Nurse", regulator: "Nursing and Midwifery Council of Nigeria", requiresLicence: true, allowsTrainees: true },
  { id: "midwife", label: "Midwife", regulator: "Nursing and Midwifery Council of Nigeria", requiresLicence: true, allowsTrainees: true },
  { id: "pharmacist", label: "Pharmacist", regulator: "Pharmacists Council of Nigeria", requiresLicence: true, allowsTrainees: true },
  { id: "laboratory", label: "Laboratory professional", regulator: "Professional Association of Medical Laboratory Technologists", requiresLicence: true, allowsTrainees: true },
  { id: "mental-health", label: "Mental health professional", regulator: null, requiresLicence: false, allowsTrainees: true },
  { id: "health-educator", label: "Health educator", regulator: null, requiresLicence: false, allowsTrainees: true },
  { id: "public-health", label: "Public health professional", regulator: null, requiresLicence: false, allowsTrainees: false },
  { id: "nutrition", label: "Nutrition / dietetics professional", regulator: null, requiresLicence: false, allowsTrainees: true },
  { id: "allied-health", label: "Physiotherapist / allied health", regulator: null, requiresLicence: false, allowsTrainees: true },
  { id: "other", label: "Other healthcare professional", regulator: null, requiresLicence: false, allowsTrainees: false },
];

export function categoryById(id: string | null | undefined): ProviderCategory | null {
  if (!id) return null;
  return PROVIDER_CATEGORIES_DETAIL.find((c) => c.id === id) ?? null;
}

/* ----------------------------------------------------------------- statuses */

/** Overall application status. */
export type ProviderApplicationStatus =
  | "draft"
  | "submitted"
  | "under-review"
  | "needs-info"
  | "verified"
  | "rejected"
  | "suspended";

/**
 * Independent check states. Identity and credentials move separately so that a
 * verified ID can never be read as a verified licence.
 */
export type VerificationState = "not-started" | "submitted" | "verified" | "rejected";

/** Government-issued identity documents CareNBuddi accepts. */
export const IDENTITY_DOCUMENT_TYPES = [
  "NIN-related identity credential",
  "National Identity Card",
  "Voter's card",
  "Driver's licence",
  "International passport",
  "Other approved government-issued ID",
] as const;

export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

/**
 * A document the applicant has attached. Only metadata is held — never the
 * image data itself — so a document cannot leak through a profile URL or into
 * an export.
 */
export interface DocumentRef {
  docType: string;
  /** Original filename, for the applicant's own reference. */
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  addedAt: string;
  /** Supabase Storage path, populated only after a successful upload. */
  storagePath?: string;
}

export interface ProviderApplication {
  id: string;
  /** The CareNBuddi account this application belongs to. One per account. */
  userId: string;
  email: string;
  fullName: string;
  phone: string;

  /* account */
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;

  /* professional category */
  category: ProviderCategoryId | "";
  /** Students and trainees are tracked separately from full registration. */
  trainee: boolean;

  /* professional profile */
  speciality: string;
  qualifications: string;
  institution: string;
  registrationNumber: string;
  licensingBody: string;
  licenceExpiry: string;
  yearsExperience: string;
  bio: string;
  languages: string;
  state: string;
  city: string;
  facility: string;
  services: string;

  /* evidence */
  identityDocument: DocumentRef | null;
  identityStatus: VerificationState;
  credentialEvidence: DocumentRef | null;
  credentialsStatus: VerificationState;

  /* workflow */
  status: ProviderApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

/* ------------------------------------------------------------------ factory */

export function newApplication(params: {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  phone?: string;
  now?: string;
}): ProviderApplication {
  const now = params.now ?? new Date().toISOString();
  return {
    id: params.id,
    userId: params.userId,
    email: params.email,
    fullName: params.fullName ?? "",
    phone: params.phone ?? "",
    acceptedTerms: false,
    acceptedPrivacy: false,
    category: "",
    trainee: false,
    speciality: "",
    qualifications: "",
    institution: "",
    registrationNumber: "",
    licensingBody: "",
    licenceExpiry: "",
    yearsExperience: "",
    bio: "",
    languages: "",
    state: "",
    city: "",
    facility: "",
    services: "",
    identityDocument: null,
    identityStatus: "not-started",
    credentialEvidence: null,
    credentialsStatus: "not-started",
    status: "draft",
    submittedAt: null,
    updatedAt: now,
    reviewNote: "",
    reviewedBy: null,
    reviewedAt: null,
  };
}

/* ------------------------------------------------------------------ helpers */

/**
 * The authoritative status-transition matrix.
 *
 * This is the single list both halves of the workflow read:
 *  - the reviewer UI builds its decision buttons from the current status;
 *  - the database function `review_provider_application` (migration 0007)
 *    enforces exactly these pairs inside PostgreSQL, where the caller cannot
 *    be trusted.
 *
 * The applicant path is deliberately narrow: only `draft -> submitted` and
 * `needs-info -> submitted` (resubmission after a request for information).
 * Everything else is an administrator decision. `rejected` is terminal.
 */
export const APPLICATION_TRANSITIONS: Record<ProviderApplicationStatus, ProviderApplicationStatus[]> = {
  draft: ["submitted"],
  submitted: ["under-review", "needs-info", "verified", "rejected"],
  "under-review": ["needs-info", "verified", "rejected", "suspended"],
  "needs-info": ["under-review", "verified", "rejected", "suspended"],
  verified: ["suspended"],
  rejected: [],
  suspended: ["verified", "rejected"],
};

export function canTransition(from: ProviderApplicationStatus, to: ProviderApplicationStatus): boolean {
  return (APPLICATION_TRANSITIONS[from] ?? []).includes(to);
}

export function isLicensedCategory(app: ProviderApplication): boolean {
  return categoryById(app.category)?.requiresLicence ?? false;
}

/** The four onboarding screens, in order. */
export const ONBOARDING_STEPS = ["welcome", "profile", "identity", "credentials", "review"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Per-step completion. `review` is satisfied only once the application has
 * actually been submitted, so it cannot be ticked by the applicant.
 */
export function isStepComplete(app: ProviderApplication, step: OnboardingStep): boolean {
  switch (step) {
    case "welcome":
      return app.acceptedTerms && app.acceptedPrivacy;
    case "profile":
      return Boolean(
        app.fullName.trim() &&
          app.category &&
          app.speciality.trim() &&
          app.state.trim() &&
          app.city.trim(),
      );
    case "identity":
      return Boolean(app.identityDocument) && app.identityStatus !== "rejected";
    case "credentials":
      if (app.credentialEvidence && app.credentialsStatus !== "rejected") return true;
      // A category that needs no licence can be evidenced by written
      // qualifications alone; a licensed one cannot.
      if (isLicensedCategory(app)) {
        return Boolean(
          app.qualifications.trim() &&
            app.registrationNumber.trim() &&
            app.licensingBody.trim(),
        );
      }
      return Boolean(app.qualifications.trim() && app.institution.trim());
    case "review":
      return app.submittedAt !== null;
  }
}

/** First step the applicant still has to do. */
export function nextIncompleteStep(app: ProviderApplication): OnboardingStep | null {
  for (const step of ONBOARDING_STEPS) {
    if (!isStepComplete(app, step)) return step;
  }
  return null;
}

/** True when every step is done and the application can be submitted. */
export function isReadyToSubmit(app: ProviderApplication): boolean {
  return ONBOARDING_STEPS.filter((s) => s !== "review").every((s) => isStepComplete(app, s));
}

/** Plain-language list of what is still missing. */
export function missingRequirements(app: ProviderApplication): string[] {
  const missing: string[] = [];
  if (!app.acceptedTerms || !app.acceptedPrivacy) {
    missing.push("Accept the Terms of Service and Privacy Policy");
  }
  if (!app.fullName.trim()) missing.push("Full professional name");
  if (!app.category) missing.push("Professional category");
  if (!app.speciality.trim()) missing.push("Speciality or area of practice");
  if (!app.state.trim()) missing.push("State of practice");
  if (!app.city.trim()) missing.push("City of practice");
  if (!app.identityDocument) missing.push("Government-issued identity document");

  if (app.category && isLicensedCategory(app)) {
    if (!app.qualifications.trim()) missing.push("Professional qualifications");
    if (!app.registrationNumber.trim()) missing.push("Professional registration number");
    if (!app.licensingBody.trim()) missing.push("Licensing / regulatory body");
  } else if (app.category) {
    if (!app.qualifications.trim()) missing.push("Qualifications");
    if (!app.institution.trim()) missing.push("Awarding institution");
  }
  return missing;
}

/* ------------------------------------------------------- applicant actions */

export function submitApplication(app: ProviderApplication, now: string): ProviderApplication {
  return {
    ...app,
    status: "submitted",
    submittedAt: app.submittedAt ?? now,
    updatedAt: now,
  };
}

/**
 * Reviewer-side transition. This is the only function that can produce
 * "verified", and it records who decided and when.
 */
export function reviewApplication(
  app: ProviderApplication,
  decision: {
    status: Extract<ProviderApplicationStatus, "under-review" | "needs-info" | "verified" | "rejected" | "suspended">;
    note?: string;
    reviewerId: string;
    now: string;
  },
): ProviderApplication {
  return {
    ...app,
    status: decision.status,
    identityStatus:
      decision.status === "verified" ? "verified" : app.identityStatus,
    credentialsStatus:
      decision.status === "verified" ? "verified" : app.credentialsStatus,
    reviewNote: decision.note ?? app.reviewNote,
    reviewedBy: decision.reviewerId,
    reviewedAt: decision.now,
    updatedAt: decision.now,
  };
}

/* ------------------------------------------------------------------ gating */

/* Routing decisions (where does this account go next?) live in lib/post-auth.ts,
   so this module stays free of any import and remains directly unit testable. */