"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, Card, Screen, SectionHeader } from "@/components/app-ui";
import { useT } from "@/lib/i18n";
import {
  categoryById,
  missingRequirements,
  nextIncompleteStep,
  type ProviderApplication,
  type ProviderApplicationStatus,
  type VerificationState,
} from "@/lib/provider-application";
import { canAccessProviderWorkspace } from "@/lib/post-auth";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { useProviderApplications } from "@/lib/use-provider-application";

const STATUS_LABEL: Record<ProviderApplicationStatus, string> = {
  draft: "Not started",
  submitted: "Submitted",
  "under-review": "Under review",
  "needs-info": "More information required",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

const STATUS_TONE: Record<ProviderApplicationStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-sky-50 text-sky-700",
  "under-review": "bg-amber-50 text-amber-700",
  "needs-info": "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  suspended: "bg-rose-50 text-rose-700",
};

/** Status is displayed, never chosen. The applicant cannot set any of these. */
function StatusPill({ status }: { status: ProviderApplicationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function CheckRow({ label, state }: { label: string; state: VerificationState }) {
  const tone =
    state === "verified"
      ? "bg-emerald-50 text-emerald-700"
      : state === "rejected"
        ? "bg-rose-50 text-rose-700"
        : state === "submitted"
          ? "bg-sky-50 text-sky-700"
          : "bg-slate-100 text-slate-500";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>
        {state}
      </span>
    </div>
  );
}

export default function ProviderStatusPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const { forUser } = useProviderApplications();

  const me = users.find((u) => u.id === session.userId) ?? null;
  const app = forUser(session.userId);

  if (!session.userId || !me) {
    return (
      <Screen>
        <Card className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            {t("pr_signin_first", "Sign in to see your application status.")}
          </p>
          <Link href="/auth/sign-in" className="tap mt-3 inline-block">
            <Button>{t("a_signin", "Sign in")}</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  if (!app) {
    return (
      <Screen>
        <SectionHeader
          title={t("pr_status_none_title", "No provider application yet")}
          subtitle={t(
            "pr_status_none_d",
            "You have a provider account but have not started an application.",
          )}
        />
        <Link href="/provider/onboarding" className="tap mt-4 inline-block">
          <Button>{t("pr_begin", "Start your application")}</Button>
        </Link>
      </Screen>
    );
  }

  return <StatusBody app={app} />;
}

function StatusBody({ app }: { app: ProviderApplication }) {
  const t = useT();
  const router = useRouter();
  const missing = missingRequirements(app);
  const next = nextIncompleteStep(app);

  const headline =
    app.status === "under-review" || app.status === "submitted"
      ? t("pr_under_review", "Your application is under review")
      : app.status === "needs-info"
        ? t("pr_needs_info", "More information is required")
        : app.status === "verified"
          ? t("pr_verified", "Your application is verified")
          : app.status === "rejected"
            ? t("pr_rejected", "Your application was not approved")
            : app.status === "suspended"
              ? t("pr_suspended", "Your provider access is suspended")
              : t("pr_draft", "Your application is not finished");

  const body =
    app.status === "under-review" || app.status === "submitted"
      ? t(
          "pr_under_review_d",
          "Thank you for submitting your CareNBuddi provider application. Our authorised review team will assess the information provided. You can check your application status here.",
        )
      : app.status === "needs-info"
        ? t(
            "pr_needs_info_d",
            "Our review team has asked for more information. Please provide what is listed below.",
          )
        : app.status === "verified"
          ? t("pr_verified_d", "The applicable verification checks are complete.")
          : app.status === "rejected"
            ? t("pr_rejected_d", "You can contact support if you believe this is a mistake.")
            : app.status === "suspended"
              ? t("pr_suspended_d", "Contact support to discuss your access.")
              : t("pr_draft_d", "Finish the steps below to submit your application for review.");

  return (
    <Screen>
      <SectionHeader title={t("pr_status_title", "Provider application")} subtitle={headline} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill status={app.status} />
        {app.submittedAt ? (
          <span className="text-xs text-slate-500">
            {t("pr_submitted_on", "Submitted")} {new Date(app.submittedAt).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      <Card className="mt-4">
        <p className="text-sm leading-relaxed text-slate-600">{body}</p>
      </Card>

      <Card className="mt-3">
        <p className="section-label">{t("pr_checks", "Checks")}</p>
        <CheckRow label={t("pr_identity_title", "Identity verification")} state={app.identityStatus} />
        <CheckRow label={t("pr_cred_title", "Professional credentials")} state={app.credentialsStatus} />
      </Card>

      {app.category ? (
        <Card className="mt-3">
          <p className="section-label">{t("pr_summary", "Your application")}</p>
          <p className="text-sm text-slate-700">
            <strong>{categoryById(app.category)?.label}</strong>
            {app.trainee ? ` · ${t("pr_trainee", "Student / trainee")}` : ""}
          </p>
          {app.reviewNote ? (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
              <strong>{t("pr_reviewer_note", "Reviewer note")}:</strong> {app.reviewNote}
            </p>
          ) : null}
        </Card>
      ) : null}

      {missing.length > 0 && app.status !== "verified" ? (
        <Card className="mt-3">
          <p className="section-label">{t("pr_outstanding", "Outstanding")}</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {missing.map((m) => (
              <li key={m} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                {m}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {canAccessProviderWorkspace(app) ? (
          <Button full onClick={() => router.push("/provider")}>
            {t("pr_enter_workspace", "Enter provider workspace")}
          </Button>
        ) : next ? (
          <Button full onClick={() => router.push(`/provider/onboarding?step=${next}`)}>
            {t("pr_continue", "Continue your application")}
          </Button>
        ) : app.status === "draft" ? (
          <Button full onClick={() => router.push("/provider/onboarding?step=review")}>
            {t("pr_go_submit", "Review and submit")}
          </Button>
        ) : null}
        <Link href="/support" className="tap mt-1 inline-block text-center text-xs font-semibold text-brand-700 underline">
          {t("prof_help", "Help & Support")}
        </Link>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        {t(
          "pr_status_disclaimer",
          "Verification decisions are made by authorised CareNBuddi reviewers. You cannot change your application status yourself.",
        )}
      </p>
    </Screen>
  );
}