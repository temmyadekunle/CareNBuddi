"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthError, AuthField } from "@/components/auth-form";
import {
  Button,
  Card,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { CheckIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { NIGERIAN_STATES } from "@/lib/states";
import {
  IDENTITY_DOCUMENT_TYPES,
  ONBOARDING_STEPS,
  PROVIDER_CATEGORIES_DETAIL,
  categoryById,
  isLicensedCategory,
  isReadyToSubmit,
  isStepComplete,
  missingRequirements,
  newApplication,
  nextIncompleteStep,
  type DocumentRef,
  type OnboardingStep,
  type ProviderApplication,
} from "@/lib/provider-application";
import { KEYS, seedUsers, uid, useSession, useStoredCollection } from "@/lib/storage";
import { useProviderApplications } from "@/lib/use-provider-application";
import {
  uploadDocument,
  isDocumentStorageAvailable,
  buildStoragePath,
  type DocumentCategory,
} from "@/lib/storage/upload";
import { isCloudEnabled } from "@/lib/supabase/client";
import { saveApplicationToServer } from "@/lib/server-provider-applications";
import type { User } from "@/lib/types";

const MAX_DOC_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: "Start",
  profile: "Profile",
  identity: "Identity",
  credentials: "Credentials",
  review: "Review",
};

/** Reads the signed-in user and their single provider application. */
function useApplication() {
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const { forUser, upsert } = useProviderApplications();

  const me: User | null = users.find((u) => u.id === session.userId) ?? null;
  const app = forUser(session.userId);

  function save(patch: Partial<ProviderApplication>): ProviderApplication | null {
    if (!me) return null;
    const base =
      forUser(me.id) ??
      newApplication({
        id: uid(),
        userId: me.id,
        email: me.email,
        fullName: me.name,
        phone: me.phone ?? "",
      });
    const next: ProviderApplication = { ...base, ...patch, updatedAt: new Date().toISOString() };
    upsert(next);
    // Best-effort draft sync. The device copy is the editable form; the
    // server row is authority for status but never for in-progress edits.
    // Failures are ignored here: drafts stay usable offline, and submission
    // (StepReview) is the step that must actually reach the server.
    if (isCloudEnabled) {
      void saveApplicationToServer(next, false).then(() => undefined);
    }
    return next;
  }

  return { session, me, app, save };
}

export default function ProviderOnboardingPage() {
  const t = useT();
  const { session, me, app } = useApplication();

  // Derived rather than stored in state: until the applicant taps a step we
  // show the first thing still outstanding, so saved progress is respected.
  // `chosen` only records an explicit tap.
  const [chosen, setChosen] = useState<OnboardingStep | null>(null);
  const step: OnboardingStep | null = chosen ?? (app ? (nextIncompleteStep(app) ?? "review") : null);
  const setStep = setChosen;

  if (!session.userId || !me) {
    return (
      <Screen>
        <Card className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            {t("pr_signin_first", "Sign in to continue your provider application.")}
          </p>
          <Link href="/auth/sign-in" className="tap mt-3 inline-block">
            <Button>{t("a_signin", "Sign in")}</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  if (!app || step === null) {
    return (
      <Screen>
        <p className="mt-6 text-center text-sm text-slate-500">{t("app.loading", "Loading…")}</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("pr_onb_title", "Welcome to CareNBuddi Professional")}
        subtitle={t(
          "pr_onb_sub",
          "Complete your professional profile and verification requirements to apply to offer healthcare services through CareNBuddi.",
        )}
      />

      {/* What happens next, on every step. This sat inside the first step
          originally, which meant an applicant whose consent was already
          captured during registration landed on "Profile" and never saw it —
          the exact person who most needs to know what they have signed up for. */}
      <ol className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        <li className="flex gap-2">
          <span className="font-semibold">1.</span>
          <span>{t("pr_next_1", "Tell us who you are and what you do — about 5 minutes. You can stop and come back at any time.")}</span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold">2.</span>
          <span>{t("pr_next_2", "Add your identity document and your professional registration. We keep both private.")}</span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold">3.</span>
          <span>{t("pr_next_3", "Submit. Our review team checks your application and updates your status — you can follow it at any time.")}</span>
        </li>
      </ol>

      <ol className="mt-4 flex items-center gap-1.5" aria-label={t("pr_progress", "Progress")}>
        {ONBOARDING_STEPS.map((s) => {
          const done = isStepComplete(app, s);
          const current = s === step;
          const label = STEP_LABELS[s];
          return (
            <li key={s} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(s)}
                aria-current={current ? "step" : undefined}
                /* A completed step renders as a tick, so the label has to live
                   in the accessible name or the control is announced blank. */
                aria-label={`${label}${done ? " (done)" : ""}${current ? " (current)" : ""}`}
                title={label}
                className={`tap w-full rounded-full px-1 py-1.5 text-[10px] font-semibold ${
                  current
                    ? "bg-brand-600 text-white"
                    : done
                      ? "bg-brand-100 text-brand-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done && !current ? <CheckIcon className="mx-auto h-3 w-3" /> : label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        {step === "welcome" ? <StepWelcome app={app} onNext={() => setStep("profile")} /> : null}
        {step === "profile" ? (
          <StepProfile app={app} onBack={() => setStep("welcome")} onNext={() => setStep("identity")} />
        ) : null}
        {step === "identity" ? (
          <StepIdentity app={app} onBack={() => setStep("profile")} onNext={() => setStep("credentials")} />
        ) : null}
        {step === "credentials" ? (
          <StepCredentials app={app} onBack={() => setStep("identity")} onNext={() => setStep("review")} />
        ) : null}
        {step === "review" ? <StepReview app={app} onBack={() => setStep("credentials")} /> : null}
      </div>
    </Screen>
  );
}

function StepNav({
  complete,
  onBack,
  onNext,
  nextLabel,
}: {
  complete: boolean;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const t = useT();
  return (
    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
      {onBack ? (
        <Button tone="secondary" className="flex-1" onClick={onBack}>
          {t("pr_prev", "Back")}
        </Button>
      ) : null}
      {onNext ? (
        <Button className="flex-1" disabled={!complete} onClick={onNext}>
          {nextLabel ?? t("pr_next", "Continue")}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

function StepWelcome({ app, onNext }: { app: ProviderApplication; onNext: () => void }) {
  const t = useT();
  const { save } = useApplication();
  const [terms, setTerms] = useState(app.acceptedTerms);
  const [privacy, setPrivacy] = useState(app.acceptedPrivacy);
  const complete = terms && privacy;

  const savedStep = nextIncompleteStep(app);

  return (
    <Card className="space-y-3">
      <p className="text-sm leading-relaxed text-slate-600">
        {t(
          "pr_welcome_body",
          "Before you apply we need your consent to process the information and documents you provide for verification.",
        )}
      </p>

      {savedStep && savedStep !== "welcome" ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-700">
          {t("pr_resumed", "Picking up where you left off.")}
        </p>
      ) : null}

      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => {
            setTerms(e.target.checked);
            save({ acceptedTerms: e.target.checked });
          }}
          className="mt-0.5 h-5 w-5 rounded border-slate-300"
        />
        <span>
          {t("pr_terms", "I agree to the")}{" "}
          <Link href="/terms" className="font-semibold text-brand-700 underline">
            {t("a_terms", "Terms of Service")}
          </Link>
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => {
            setPrivacy(e.target.checked);
            save({ acceptedPrivacy: e.target.checked });
          }}
          className="mt-0.5 h-5 w-5 rounded border-slate-300"
        />
        <span>
          {t("pr_privacy", "I agree to the")}{" "}
          <Link href="/privacy" className="font-semibold text-brand-700 underline">
            {t("a_privacy", "Privacy Policy")}
          </Link>
        </span>
      </label>

      <StepNav complete={complete} onNext={onNext} />
    </Card>
  );
}

function StepProfile({
  app,
  onBack,
  onNext,
}: {
  app: ProviderApplication;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const { save } = useApplication();
  const [fullName, setFullName] = useState(app.fullName);
  const [category, setCategory] = useState(app.category);
  const [speciality, setSpeciality] = useState(app.speciality);
  const [years, setYears] = useState(app.yearsExperience);
  const [languages, setLanguages] = useState(app.languages);
  const [state, setState] = useState(app.state);
  const [city, setCity] = useState(app.city);
  const [facility, setFacility] = useState(app.facility);
  const [services, setServices] = useState(app.services);
  const [bio, setBio] = useState(app.bio);

  function commit() {
    return save({
      fullName: fullName.trim(),
      category,
      speciality: speciality.trim(),
      yearsExperience: years.trim(),
      languages: languages.trim(),
      state,
      city: city.trim(),
      facility: facility.trim(),
      services: services.trim(),
      bio: bio.trim(),
    });
  }

  function goNext() {
    commit();
    onNext();
  }

  return (
    <Card className="space-y-3">
      <SectionHeader
        title={t("pr_profile_title", "Professional profile")}
        subtitle={t("pr_profile_d", "This is what patients and colleagues will see.")}
      />

      <AuthField label={t("a_name", "Full name")} value={fullName} onChange={(e) => setFullName(e.target.value)} />

      <Field label={t("prg_category", "Category")}>
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={inputClass}>
          <option value="">{t("pr_pick_category", "Select your category")}</option>
          {PROVIDER_CATEGORIES_DETAIL.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <AuthField
        label={t("pr_speciality", "Speciality or area of practice")}
        value={speciality}
        onChange={(e) => setSpeciality(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("pr_state", "State")}>
          <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
            <option value="">{t("pr_pick", "Select")}</option>
            {[...NIGERIAN_STATES].sort().map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <AuthField label={t("pr_city", "City")} value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <AuthField label={t("pr_years", "Years of experience")} value={years} onChange={(e) => setYears(e.target.value)} placeholder="e.g. 7" />
      <AuthField label={t("pr_languages", "Languages spoken")} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hausa" />
      <AuthField label={t("pr_facility", "Practice or facility")} value={facility} onChange={(e) => setFacility(e.target.value)} />
      <AuthField label={t("pr_services", "Services you intend to offer")} value={services} onChange={(e) => setServices(e.target.value)} />

      <Field label={t("pr_bio", "Professional biography")}>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className={inputClass} />
      </Field>

      <StepNav complete={isStepComplete({ ...app, fullName, category, speciality, state, city }, "profile")} onBack={onBack} onNext={goNext} />
    </Card>
  );
}

function DocumentPicker({
  label,
  hint,
  value,
  onPick,
  error,
  userId,
  applicationId,
  docType,
}: {
  label: string;
  hint: string;
  value: DocumentRef | null;
  onPick: (ref: DocumentRef | null) => void;
  error?: string | null;
  userId?: string;
  applicationId?: string;
  docType?: DocumentCategory;
}) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(error ?? null);
  const storageAvailable = isDocumentStorageAvailable();

  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="tap inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          {value ? t("pr_replace_doc", "Replace") : t("pr_upload_doc", "Choose file")}
          <input
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            className="sr-only"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;

              // Validate locally first
              const problem = validateDocFromFile(file);
              if (problem) {
                setLocalError(problem);
                return;
              }

              // If cloud storage is available and we have user/app context, upload
              if (storageAvailable && userId && applicationId && docType) {
                setUploading(true);
                setLocalError(null);
                try {
                  const { documentRef, storagePath } = await uploadDocument(
                    userId,
                    applicationId,
                    docType,
                    file,
                  );
                  onPick({ ...documentRef, storagePath });
                } catch (err) {
                  setLocalError(
                    err instanceof Error ? err.message : t("aa_download_failed"),
                  );
                } finally {
                  setUploading(false);
                }
              } else {
                // No cloud storage: store metadata only
                onPick({
                  docType: value?.docType ?? docType ?? "",
                  fileName: file.name,
                  sizeBytes: file.size,
                  mimeType: file.type,
                  addedAt: new Date().toISOString(),
                });
              }
            }}
          />
        </label>
        {value ? (
          <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
            {value.fileName} {"·"} {Math.max(1, Math.round(value.sizeBytes / 1024))} KB
            <button
              type="button"
              onClick={() => onPick(null)}
              className="ml-2 font-semibold text-rose-600 underline"
            >
              {t("c_remove", "Remove")}
            </button>
          </span>
        ) : (
          <span className="text-xs text-slate-400">{t("pr_no_doc", "No document attached")}</span>
        )}
        {uploading && <span className="text-xs text-slate-400">{t("pr_uploading", "Uploading…")}</span>}
      </div>
    </Field>
  );
}

function validateDocFromFile(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type)) {
    return "Use a JPG, PNG, WEBP or PDF file.";
  }
  if (file.size > MAX_DOC_BYTES) {
    return "That file is too large. The maximum is 8 MB.";
  }
  return null;
}

function validateDoc(ref: DocumentRef): string | null {
  if (ref.sizeBytes > MAX_DOC_BYTES) return "That file is too large. The maximum is 8 MB.";
  if (!ACCEPTED_MIME.includes(ref.mimeType)) return "Use a JPG, PNG, WEBP or PDF file.";
  return null;
}

function StepIdentity({
  app,
  onBack,
  onNext,
}: {
  app: ProviderApplication;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const { session, me, save } = useApplication();
  const [docType, setDocType] = useState<string>(app.identityDocument?.docType ?? "");
  const [error, setError] = useState<string | null>(null);

  function setDoc(ref: DocumentRef | null) {
    if (ref && !docType) {
      setError(t("pr_doc_type_first", "Choose the document type first."));
      return;
    }
    if (ref) {
      const problem = validateDoc(ref);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    save({
      identityDocument: ref ? { ...ref, docType } : null,
      identityStatus: ref ? "submitted" : "not-started",
    });
  }

  const preview: ProviderApplication = {
    ...app,
    identityDocument: app.identityDocument ? { ...app.identityDocument, docType } : null,
    identityStatus: app.identityDocument ? "submitted" : "not-started",
  };

  return (
    <Card className="space-y-3">
      <SectionHeader
        title={t("pr_identity_title", "Identity verification")}
        subtitle={t(
          "pr_identity_d",
          "Confirm who you are. This is separate from your professional registration and does not by itself make you a verified provider.",
        )}
      />

      <Field label={t("pr_doc_type", "Document type")}>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputClass}>
          <option value="">{t("pr_pick_doc", "Select a document")}</option>
          {IDENTITY_DOCUMENT_TYPES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>

      <DocumentPicker
        label={t("pr_doc_upload", "Identity document")}
        hint={t(
          "pr_doc_hint",
          "JPG, PNG, WEBP or PDF. Up to 8 MB. Kept private and never shown on your public profile.",
        )}
        value={app.identityDocument}
        error={error}
        onPick={setDoc}
        userId={session.userId ?? undefined}
        applicationId={app.id}
        docType="identity"
      />

      {app.identityDocument ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {t("pr_identity_status", "Identity status")}: {app.identityStatus}
        </p>
      ) : null}

      <StepNav complete={isStepComplete(preview, "identity")} onBack={onBack} onNext={onNext} />
    </Card>
  );
}

function StepCredentials({
  app,
  onBack,
  onNext,
}: {
  app: ProviderApplication;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const { session, me, save } = useApplication();
  const licensed = isLicensedCategory(app);
  const cat = categoryById(app.category);

  const [qualifications, setQualifications] = useState(app.qualifications);
  const [institution, setInstitution] = useState(app.institution);
  const [registrationNumber, setRegistrationNumber] = useState(app.registrationNumber);
  const [licensingBody, setLicensingBody] = useState(app.licensingBody);
  const [licenceExpiry, setLicenceExpiry] = useState(app.licenceExpiry);
  const [error, setError] = useState<string | null>(null);

  const draft: ProviderApplication = {
    ...app,
    qualifications: qualifications.trim(),
    institution: institution.trim(),
    registrationNumber: registrationNumber.trim(),
    licensingBody: licensingBody.trim(),
    licenceExpiry: licenceExpiry.trim(),
  };

  function goNext() {
    save(draft);
    onNext();
  }

  return (
    <Card className="space-y-3">
      <SectionHeader
        title={t("pr_cred_title", "Professional credentials")}
        subtitle={
          licensed
            ? t("pr_cred_d_licensed", `${cat?.label ?? "This category"} requires registration with a professional body.`)
            : t(
                "pr_cred_d_open",
                "This category does not require a licence, so tell us about your qualifications instead.",
              )
        }
      />

      <AuthField
        label={t("pr_qualifications", "Qualifications")}
        value={qualifications}
        onChange={(e) => setQualifications(e.target.value)}
        placeholder="e.g. MBBS, BSc Nursing"
      />
      <AuthField
        label={t("pr_institution", "Institution / awarding body")}
        value={institution}
        onChange={(e) => setInstitution(e.target.value)}
      />

      {licensed ? (
        <>
          <AuthField
            label={t("pr_regno", "Professional registration number")}
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
          />
          <AuthField
            label={t("pr_licbody", "Licensing / regulatory body")}
            value={licensingBody}
            onChange={(e) => setLicensingBody(e.target.value)}
            placeholder={cat?.regulator ?? ""}
          />
          <AuthField
            label={t("pr_licence_expiry", "Licence expiry (if applicable)")}
            type="date"
            value={licenceExpiry}
            onChange={(e) => setLicenceExpiry(e.target.value)}
          />
        </>
      ) : null}

      <DocumentPicker
        label={t("pr_cred_evidence", "Supporting evidence")}
        hint={t("pr_cred_hint", "Optional, but it speeds up review. JPG, PNG, WEBP or PDF up to 8 MB.")}
        value={app.credentialEvidence}
        error={error}
        onPick={(ref) => {
          if (ref) {
            const problem = validateDoc(ref);
            if (problem) {
              setError(problem);
              return;
            }
          }
          setError(null);
          save({
            credentialEvidence: ref,
            credentialsStatus: ref ? "submitted" : "not-started",
          });
        }}
        userId={session.userId ?? undefined}
        applicationId={app.id}
        docType="credentials"
      />

      <StepNav complete={isStepComplete(draft, "credentials")} onBack={onBack} onNext={goNext} />
    </Card>
  );
}

function StepReview({ app, onBack }: { app: ProviderApplication; onBack: () => void }) {
  const t = useT();
  const { push } = useToast();
  const router = useRouter();
  const { save } = useApplication();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = missingRequirements(app);
  const ready = isReadyToSubmit(app);

  async function submit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    // Submission is server-authoritative: the draft is not accepted as
    // submitted until the database confirms it, and the local status copy
    // is written from the returned row, never from the caller's guess.
    const result = await saveApplicationToServer(app, true);
    if (!result.ok || !result.value) {
      setSubmitting(false);
      setError(
        result.error ?? t("pr_submit_failed", "The application could not be submitted. Try again."),
      );
      return;
    }
    const server = result.value;
    save({ status: server.status, submittedAt: server.submittedAt });
    push(t("pr_submitted", "Application submitted"), "success");
    router.push("/provider/status");
  }

  return (
    <Card className="space-y-3">
      <SectionHeader
        title={t("pr_review_title", "Review and submit")}
        subtitle={t("pr_review_d", "Check your details before sending your application for review.")}
      />

      <dl className="space-y-2 text-sm">
        <Row k={t("a_name", "Full name")} v={app.fullName} />
        <Row k={t("prg_category", "Category")} v={categoryById(app.category)?.label ?? ""} />
        <Row k={t("pr_speciality", "Speciality")} v={app.speciality} />
        <Row
          k={t("pr_state", "State")}
          v={`${app.state}${app.city ? ` · ${app.city}` : ""}`.trim()}
        />
        <Row k={t("pr_trainee", "Student / trainee")} v={app.trainee ? t("c_yes", "Yes") : t("c_no", "No")} />
        <Row
          k={t("pr_identity_title", "Identity")}
          v={app.identityDocument ? `${app.identityDocument.docType} · ${app.identityDocument.fileName}` : ""}
        />
        <Row k={t("pr_cred_title", "Credentials")} v={app.qualifications} />
        {isLicensedCategory(app) ? <Row k={t("pr_regno", "Registration no.")} v={app.registrationNumber} /> : null}
      </dl>

      {missing.length > 0 ? (
        <AuthError>
          {t("pr_missing", "Still needed")}: {missing.join(" · ")}
        </AuthError>
      ) : null}

      {error ? <AuthError>{error}</AuthError> : null}

      <p className="text-[11px] leading-relaxed text-slate-500">
        {t(
          "pr_review_note",
          "Your application is reviewed by the CareNBuddi team. Submitting does not yet make you a verified provider.",
        )}
      </p>

      <StepNav complete={false} onBack={onBack} />
      <Button full disabled={!ready || submitting} onClick={() => void submit()}>
        {submitting ? t("pr_submitting", "Submitting…") : t("pr_submit_application", "Submit application")}
      </Button>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-slate-800">{v || "—"}</dd>
    </div>
  );
}