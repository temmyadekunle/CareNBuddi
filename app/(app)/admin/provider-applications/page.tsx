"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  SectionHeader,
  Screen,
  BottomSheet,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { FileTextIcon, ShieldIcon, UserIcon, SearchIcon, FilterIcon, CalendarIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import {
  KEYS,
  seedUsers,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import {
  PROVIDER_APPLICATIONS_KEY,
  type ProviderApplication,
  type ProviderApplicationStatus,
  categoryById,
  isLicensedCategory,
} from "@/lib/provider-application";

type ApplicationFilter = "all" | "draft" | "submitted" | "under-review" | "needs-info" | "verified" | "rejected" | "suspended" | "expired";

interface FilterState {
  status: ApplicationFilter;
  category: string;
  search: string;
}

const FILTERS: { value: ApplicationFilter; labelKey: string }[] = [
  { value: "all", labelKey: "aa_all" },
  { value: "draft", labelKey: "aa_draft" },
  { value: "submitted", labelKey: "aa_submitted" },
  { value: "under-review", labelKey: "aa_under_review" },
  { value: "needs-info", labelKey: "aa_needs_info" },
  { value: "verified", labelKey: "aa_verified" },
  { value: "rejected", labelKey: "aa_rejected" },
  { value: "suspended", labelKey: "aa_suspended" },
];

const STATUS_TONE: Record<ProviderApplicationStatus, "brand" | "green" | "amber" | "rose" | "slate"> = {
  draft: "slate",
  submitted: "amber",
  "under-review": "brand",
  "needs-info": "brand",
  verified: "green",
  rejected: "rose",
  suspended: "slate",
};

export default function AdminProviderApplicationsPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);

  if (me?.role !== "admin") {
    return (
      <Screen>
        <SectionHeader
          title={t("ad_title")}
          subtitle={t("ad_signin_req")}
        />
        <Card className="mt-4">
          <EmptyState
            icon={<ShieldIcon className="h-6 w-6" />}
            title={t("ad_title")}
            body={t("ad_signin_req")}
            action={
              <Link href="/account" className="inline-block min-h-11">
                <Button className="min-h-11">{t("a_signin")}</Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  const [apps] = useStoredCollection<ProviderApplication>(PROVIDER_APPLICATIONS_KEY, []);
  const [filter, setFilter] = useState<FilterState>({
    status: "all",
    category: "",
    search: "",
  });

  const [selectedApp, setSelectedApp] = useState<ProviderApplication | null>(null);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const byStatus = filter.status === "all" || app.status === filter.status;
      const byCategory = !filter.category || app.category === filter.category;
      const bySearch =
        !filter.search ||
        app.fullName.toLowerCase().includes(filter.search.toLowerCase()) ||
        app.email.toLowerCase().includes(filter.search.toLowerCase()) ||
        app.id.toLowerCase().includes(filter.search.toLowerCase());
      return byStatus && byCategory && bySearch;
    });
  }, [apps, filter]);

  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of apps) {
      counts[app.status] = (counts[app.status] ?? 0) + 1;
    }
    return counts;
  }, [apps]);

  const categories = useMemo(
    () => [...new Set(apps.map((a) => a.category).filter(Boolean))].sort(),
    [apps],
  );

  const openDetail = useCallback((app: ProviderApplication) => {
    setSelectedApp(app);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedApp(null);
  }, []);

  return (
    <Screen>
      <SectionHeader
        title={t("aa_title")}
        subtitle={t("aa_sub")}
      />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {[
          { label: t("aa_total"), value: apps.length, icon: <UserIcon className="h-4 w-4" /> },
          { label: t("aa_draft_count"), value: summaryCounts.draft ?? 0, icon: <FileTextIcon className="h-4 w-4" /> },
          { label: t("aa_submitted_count"), value: summaryCounts.submitted ?? 0, icon: <CalendarIcon className="h-4 w-4" /> },
          { label: t("aa_under_review_count"), value: summaryCounts["under-review"] ?? 0, icon: <CalendarIcon className="h-4 w-4" /> },
          { label: t("aa_verified_count"), value: summaryCounts.verified ?? 0, icon: <ShieldIcon className="h-4 w-4" /> },
          { label: t("aa_rejected_count"), value: summaryCounts.rejected ?? 0, icon: <FileTextIcon className="h-4 w-4" /> },
        ].map((card) => (
          <Card key={card.label} className="px-3 py-3">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              {card.icon}
              <span className="truncate">{card.label}</span>
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{card.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 px-4 py-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <Field label={t("aa_status")}>
            <select
              value={filter.status}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, status: e.target.value as ApplicationFilter }))
              }
              className={inputClass}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {t(f.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("aa_category")}>
            <select value={filter.category} onChange={(e) => setFilter((prev) => ({ ...prev, category: e.target.value }))} className={inputClass}>
              <option value="">{t("aa_all_categories")}</option>
              {categories.map((cat) => {
                const c = categoryById(cat);
                return (
                  <option key={cat} value={cat}>
                    {c?.label ?? cat}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label={t("aa_search")}>
            <input
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              className={inputClass}
              placeholder={t("aa_search_placeholder")}
            />
          </Field>
          <div className="flex items-end">
            <Button
              full
              onClick={() => setFilter({ status: "all", category: "", search: "" })}
              tone="secondary"
            >
              {t("aa_clear")}
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        {filteredApps.length === 0 ? (
          <EmptyState
            icon={<SearchIcon className="h-6 w-6" />}
            title={t("aa_none")}
            body={t("aa_none_d")}
          />
        ) : (
          <div className="space-y-2">
            {filteredApps.map((app) => (
              <ApplicationCard key={app.id} app={app} me={me} t={t} onReview={openDetail} />
            ))}
          </div>
        )}
      </div>

      {selectedApp && (
        <BottomSheet
          open={true}
          onClose={closeDetail}
          title={t("aa_review_title")}
        >
          <ApplicationDetailCard app={selectedApp} me={me} t={t} onClose={closeDetail} />
        </BottomSheet>
      )}
    </Screen>
  );
}

function ApplicationCard({
  app,
  me,
  t,
  onReview,
}: {
  app: ProviderApplication;
  me: { id: string; name: string };
  t: (key: string) => string;
  onReview: (app: ProviderApplication) => void;
}) {
  const category = categoryById(app.category);
  const isLicensed = isLicensedCategory(app);

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{app.fullName}</p>
            <Badge tone={STATUS_TONE[app.status]}>{app.status}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-600">{app.email}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {(category?.label ?? app.category) ?? "-"} . {isLicensed ? "licensed" : "non-licensed"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t("aa_submitted")} {app.submittedAt ? app.submittedAt.slice(0, 10) : "-"} . {t("aa_updated")} {app.updatedAt.slice(0, 10)}
          </p>
        </div>
        <Button onClick={() => onReview(app)}>{t("aa_review")}</Button>
      </div>
    </Card>
  );
}

function ApplicationDetailCard({
  app,
  me,
  t,
  onClose,
}: {
  app: ProviderApplication;
  me: { id: string; name: string };
  t: (key: string) => string;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<"under-review" | "needs-info" | "verified" | "rejected" | "suspended" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const category = categoryById(app.category);
  const isLicensed = isLicensedCategory(app);

  const DECISIONS: { value: "under-review" | "needs-info" | "verified" | "rejected" | "suspended"; labelKey: string; tone: string }[] = [
    { value: "under-review", labelKey: "aa_mark_under_review", tone: "secondary" },
    { value: "needs-info", labelKey: "aa_request_info", tone: "secondary" },
    { value: "verified", labelKey: "aa_approve_verify", tone: "primary" },
    { value: "rejected", labelKey: "aa_reject", tone: "danger" },
    { value: "suspended", labelKey: "aa_suspend", tone: "danger" },
  ];

  const handleDecision = useCallback(
    (next: "under-review" | "needs-info" | "verified" | "rejected" | "suspended") => {
      if (submitting) return;
      setDecision(next);
      setReviewNote("");
    },
    [submitting],
  );

  const handleSubmitDecision = useCallback(() => {
    if (!reviewNote.trim() || submitting) return;
    setSubmitting(true);
    setDecision(null);
    setReviewNote("");
    setSubmitting(false);
    onClose();
  }, [reviewNote, submitting, onClose]);

  return (
    <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-slate-900">{app.fullName}</h2>
        <Badge tone={STATUS_TONE[app.status]}>{app.status}</Badge>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("aa_provider_info")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_email")}</p>
            <p className="text-sm text-slate-900">{app.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_phone")}</p>
            <p className="text-sm text-slate-900">{app.phone}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_category_label")}</p>
            <p className="text-sm text-slate-900">{category?.label ?? app.category}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_specialty")}</p>
            <p className="text-sm text-slate-900">{app.speciality}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_registration_number")}</p>
            <p className="text-sm text-slate-900">{app.registrationNumber}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_licensing_body")}</p>
            <p className="text-sm text-slate-900">{app.licensingBody}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_state")}</p>
            <p className="text-sm text-slate-900">{app.state}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_city")}</p>
            <p className="text-sm text-slate-900">{app.city}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("aa_documents")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
          <DocumentCard
            title={t("aa_identity_document")}
            state={app.identityStatus}
            doc={app.identityDocument}
            required={true}
            t={t}
          />
          <DocumentCard
            title={t("aa_credential_evidence")}
            state={app.credentialsStatus}
            doc={app.credentialEvidence}
            required={isLicensed}
            t={t}
          />
        </div>
        {app.licenceExpiry && (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_licence_expiry")}</p>
            <p className="text-sm text-slate-900">{app.licenceExpiry}</p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">{t("aa_decision")}</h3>
        <p className="text-xs text-slate-500 mb-3">
          {t("aa_decision_hint")}
        </p>
        <div className="space-y-2">
          {DECISIONS.map((d) => (
            <Button
              key={d.value}
              full
              tone={d.tone as "primary" | "secondary" | "danger"}
              onClick={() => handleDecision(d.value)}
              disabled={submitting || decision !== null}
            >
              {t(d.labelKey)}
            </Button>
          ))}
          {decision !== null && (
            <div className="space-y-2">
              <Field label={t("aa_reason")}>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder={t("aa_reason_placeholder")}
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  full
                  onClick={handleSubmitDecision}
                  disabled={!reviewNote.trim() || submitting}
                >
                  {t("aa_confirm")}
                </Button>
                <Button
                  full
                  tone="secondary"
                  onClick={() => {
                    setDecision(null);
                    setReviewNote("");
                  }}
                >
                  {t("aa_cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
        {app.reviewedBy && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-1">
            <p className="text-[11px] font-medium text-slate-500">{t("aa_audit")}</p>
            <p className="text-sm text-slate-900">
              {t("aa_decided_by")}: {app.reviewedBy} . {t("aa_previous_status")}: {app.status} . {t("aa_new_status")}: {app.status} . {t("aa_decided_at")}: {app.reviewedAt ? app.reviewedAt.slice(0, 16) : "-"}
            </p>
            {app.reviewNote && (
              <p className="text-sm text-slate-700">{app.reviewNote}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function DocumentCard({
  title,
  state,
  doc,
  required,
  t,
}: {
  title: string;
  state: "not-started" | "submitted" | "verified" | "rejected";
  doc: { docType: string; fileName: string; sizeBytes: number; mimeType: string; addedAt: string } | null;
  required: boolean;
  t: (key: string) => string;
}) {
  const STATE_TONE: Record<string, "brand" | "green" | "amber" | "rose" | "slate"> = {
    "not-started": "slate",
    submitted: "amber",
    verified: "green",
    rejected: "rose",
  };
  return (
    <Card className="p-3">
      <p className="text-[11px] font-medium text-slate-500 mb-1">{title}</p>
      {doc ? (
        <div className="space-y-1">
          <p className="text-sm text-slate-900">{doc.fileName}</p>
          <p className="text-[11px] text-slate-500">
            {doc.mimeType} . {(doc.sizeBytes / 1024).toFixed(0)} KB . {doc.addedAt.slice(0, 10)}
          </p>
          <Badge tone={STATE_TONE[state]}>{state}</Badge>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{t("aa_no_document")}</p>
          {required && <Badge tone="rose">{t("aa_required")}</Badge>}
        </div>
      )}
    </Card>
  );
}
