"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, Card, Field, Screen, SectionHeader, inputClass } from "@/components/app-ui";
import { useT } from "@/lib/i18n";
import {
  categoryById,
  isLicensedCategory,
  missingRequirements,
  reviewApplication,
  type ProviderApplication,
  type ProviderApplicationStatus,
} from "@/lib/provider-application";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { useProviderApplications } from "@/lib/use-provider-application";

type Decision = Extract<
  ProviderApplicationStatus,
  "under-review" | "needs-info" | "verified" | "rejected" | "suspended"
>;

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "under-review", label: "Mark under review" },
  { value: "needs-info", label: "Request more information" },
  { value: "verified", label: "Approve and verify" },
  { value: "rejected", label: "Reject" },
  { value: "suspended", label: "Suspend access" },
];

/**
 * Reviewer console for provider applications.
 *
 * This is the only surface that can move an application to "verified". It is
 * reachable only by an account whose role is admin or provider (enforced by
 * AppGuard on the /admin prefix), and it records who reviewed and when.
 *
 * Note for the record: with no backend configured these records live in this
 * browser's local storage, so the authorisation is client-side only. A real
 * deployment must enforce the same rule with database policies.
 */
export default function AdminProvidersPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const { apps, upsert } = useProviderApplications();

  const me = users.find((u) => u.id === session.userId);
  const isReviewer = me?.role === "admin" || me?.role === "provider";
  const [openId, setOpenId] = useState<string | null>(null);

  if (!session.userId || !isReviewer) {
    return (
      <Screen>
        <SectionHeader
          title={t("pv_title", "Provider")}
          subtitle={t("pv_guard", "Sign in as a provider or admin to continue.")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("apr_title", "Provider applications")}
        subtitle={t(
          "apr_d",
          "Review submitted applications. Identity and professional credentials are assessed separately.",
        )}
      />

      {apps.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-slate-600">{t("apr_none", "No applications to review yet.")}</p>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {apps.map((app) =>
            openId === app.id ? (
              <ReviewCard key={app.id} app={app} onClose={() => setOpenId(null)} onDecide={(next) => upsert(next)} reviewerId={me.id} />
            ) : (
              <button
                key={app.id}
                type="button"
                onClick={() => setOpenId(app.id)}
                className="tap block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{app.fullName || app.email}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {app.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {categoryById(app.category)?.label ?? "—"} · {app.email}
                </p>
              </button>
            ),
          )}
        </div>
      )}

      <Link href="/admin" className="tap mt-4 inline-block text-xs font-semibold text-brand-700 underline">
        {t("apr_back", "Back to admin")}
      </Link>
    </Screen>
  );
}

function ReviewCard({
  app,
  reviewerId,
  onClose,
  onDecide,
}: {
  app: ProviderApplication;
  reviewerId: string;
  onClose: () => void;
  onDecide: (next: ProviderApplication) => void;
}) {
  const t = useT();
  const [decision, setDecision] = useState<Decision>("under-review");
  const [note, setNote] = useState(app.reviewNote);
  const missing = missingRequirements(app);
  const licensed = isLicensedCategory(app);

  function apply() {
    onDecide(
      reviewApplication(app, {
        status: decision,
        note: note.trim(),
        reviewerId,
        now: new Date().toISOString(),
      }),
    );
    onClose();
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{app.fullName || app.email}</p>
          <p className="truncate text-xs text-slate-500">{app.email}</p>
        </div>
        <button type="button" onClick={onClose} className="tap text-xs font-semibold text-slate-500 underline">
          {t("c_close", "Close")}
        </button>
      </div>

      <dl className="space-y-1.5 text-xs">
        <Line k={t("prg_category", "Category")} v={categoryById(app.category)?.label ?? "—"} />
        <Line k={t("pr_speciality", "Speciality")} v={app.speciality || "—"} />
        <Line k={t("pr_state", "State")} v={`${app.state}${app.city ? ` · ${app.city}` : ""}` || "—"} />
        <Line k={t("pr_trainee", "Student / trainee")} v={app.trainee ? t("c_yes", "Yes") : t("c_no", "No")} />
        <Line
          k={t("pr_identity_title", "Identity")}
          v={app.identityDocument ? `${app.identityDocument.docType} · ${app.identityDocument.fileName} (${app.identityStatus})` : "—"}
        />
        <Line k={t("pr_qualifications", "Qualifications")} v={app.qualifications || "—"} />
        {licensed ? <Line k={t("pr_regno", "Registration no.")} v={app.registrationNumber || "—"} /> : null}
        {licensed ? <Line k={t("pr_licbody", "Licensing body")} v={app.licensingBody || "—"} /> : null}
        <Line
          k={t("pr_cred_evidence", "Supporting evidence")}
          v={app.credentialEvidence ? `${app.credentialEvidence.fileName} (${app.credentialsStatus})` : "—"}
        />
        {app.submittedAt ? (
          <Line k={t("pr_submitted_on", "Submitted")} v={new Date(app.submittedAt).toLocaleString()} />
        ) : null}
        {app.reviewedAt ? (
          <Line k={t("apr_reviewed", "Last reviewed")} v={`${app.reviewedBy ?? "—"} · ${new Date(app.reviewedAt).toLocaleString()}`} />
        ) : null}
      </dl>

      {missing.length > 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          {t("pr_missing", "Still needed")}: {missing.join(" · ")}
        </p>
      ) : null}

      <Field label={t("apr_decision", "Decision")}>
        <select value={decision} onChange={(e) => setDecision(e.target.value as Decision)} className={inputClass}>
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("apr_note", "Note to applicant")}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputClass} />
      </Field>

      <Button full onClick={apply}>
        {t("apr_apply", "Record decision")}
      </Button>
    </Card>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}