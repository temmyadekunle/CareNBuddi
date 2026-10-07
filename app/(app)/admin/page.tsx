"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  Tabs,
  inputClass,
  useToast,
} from "@/components/app-ui";
import {
  ActivityIcon,
  CalendarIcon,
  FileTextIcon,
  ShieldIcon,
  StethoscopeIcon,
  ChartIcon,
  UserIcon,
} from "@/components/icons";
import { MiniBars } from "@/components/health-charts";
import { PROVIDER_CATEGORIES } from "@/lib/content";
import { useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedProviderRequests,
  seedProviders,
  seedReports,
  seedTopics,
  seedUsers,
  useSession,
  useStoredCollection,
  type ContentItem,
} from "@/lib/storage";
import type { ProviderRequest, User } from "@/lib/types";

type Tab = "overview" | "content" | "verification" | "users" | "analytics" | "reports";

const CONTENT_CATEGORIES = [
  "General Health",
  "Women's Health",
  "Men's Health",
  "Mental Health",
  "Children's Health",
  "Nutrition",
  "Maternal Health",
  "Preventive Health",
  "Chronic Conditions",
  "First Aid",
];

const REQ_TONE = { pending: "amber", approved: "green", rejected: "rose" } as const;

export default function AdminPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);
  const [tab, setTab] = useState<Tab>("overview");

  if (me?.role !== "admin") {
    return (
      <Screen>
        <SectionHeader
          title={t("ad_title", "Admin console")}
          subtitle={t("ad_signin_req", "Sign in as an administrator to continue.")}
        />
        <Card className="mt-4">
          <EmptyState
            icon={<ShieldIcon className="h-6 w-6" />}
            title={t("ad_title", "Admin console")}
            body={t("ad_signin_req", "Sign in as an administrator to continue.")}
            action={
              <Link href="/account" className="inline-block min-h-11">
                <Button className="min-h-11">{t("a_signin", "Sign in")}</Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title={t("ad_title", "Admin console")} subtitle={t("ad_sub", "Moderate the platform.")} />

      <div className="mt-3">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: t("ad_overview", "Overview") },
            { value: "content", label: t("ad_content", "Content") },
            { value: "verification", label: t("ad_verification", "Verification") },
            { value: "users", label: t("ad_users", "Users") },
            { value: "analytics", label: t("ad_analytics", "Analytics") },
            { value: "reports", label: t("ad_reports", "Reports") },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === "overview" && <Overview />}
        {tab === "content" && <ContentManager />}
        {tab === "verification" && <Verification />}
        {tab === "users" && <UserManager />}
        {tab === "analytics" && <Analytics />}
        {tab === "reports" && <ReportCenter />}
      </div>
    </Screen>
  );
}

function Overview() {
  const t = useT();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [topics] = useStoredCollection(KEYS.topics, seedTopics);
  const [requests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [reports] = useStoredCollection(KEYS.reports, seedReports);

  const cards = [
    { label: t("ad_users", "Users"), value: users.length, icon: <UserIcon className="h-4 w-4" /> },
    { label: t("ad_providers", "Providers"), value: providers.length, icon: <StethoscopeIcon className="h-4 w-4" /> },
    { label: t("ad_verified_p", "Verified"), value: providers.filter((p) => p.verified).length, icon: <ShieldIcon className="h-4 w-4" /> },
    { label: t("ad_topics", "Articles"), value: topics.length, icon: <FileTextIcon className="h-4 w-4" /> },
    {
      label: t("ad_verify_pending", "Verifications pending"),
      value: requests.filter((r) => r.status === "pending").length,
      icon: <ShieldIcon className="h-4 w-4" />,
    },
    { label: t("ad_bookings", "Bookings"), value: bookings.length, icon: <CalendarIcon className="h-4 w-4" /> },
    {
      label: t("ad_reports_open", "Open reports"),
      value: reports.filter((r) => r.status === "open").length,
      icon: <ChartIcon className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <Card key={c.label} className="px-3 py-3">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            {c.icon}
            <span className="truncate">{c.label}</span>
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
        </Card>
      ))}
    </div>
  );
}

function ContentManager() {
  const t = useT();
  const { push } = useToast();
  const [topics, setTopics] = useStoredCollection(KEYS.topics, seedTopics);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("General Health");
  const [notice, setNotice] = useState("");

  const addDraft = () => {
    if (!slug.trim() || !title.trim()) {
      setNotice(t("ad_c_required", "Slug and title are required."));
      return;
    }
    const seed = seedTopics[0];
    const base: ContentItem = {
      ...seed,
      id: slug.trim(),
      slug: slug.trim(),
      title: title.trim(),
      summary: summary.trim() || t("ad_c_draft_note", "Draft — summary still needed."),
      healthCategory: category,
      locale: undefined,
      whenToSeekHelp: t("ad_c_empty_summary", "Add guidance when to seek help."),
    };
    if (topics.some((tp) => tp.id === base.id)) {
      setNotice(t("ad_c_exists", "That slug already exists."));
      return;
    }
    setTopics((prev) => [...prev, { ...base, status: "draft" } as ContentItem]);
    setSlug("");
    setTitle("");
    setSummary("");
    setNotice("");
    push(t("ad_c_created", "Draft created"), "success");
  };

  const toggleStatus = (id: string, status: ContentItem["status"]) =>
    setTopics((prev) => prev.map((tp) => (tp.id === id ? { ...tp, status } : tp)));

  const remove = (id: string) => setTopics((prev) => prev.filter((tp) => tp.id !== id));

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{t("ad_c_add", "Add article")}</h2>
        <div className="mt-3 space-y-3">
          <Field label={t("ad_c_slug", "Slug")}>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("ad_c_title", "Title")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("ad_c_summary", "Summary")}>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("ad_a_cat", "Category")}>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CONTENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Button full className="mt-3" onClick={addDraft}>
          {t("ad_c_add_draft", "Add draft")}
        </Button>
        {notice && <p className="mt-2 text-xs text-slate-500">{notice}</p>}
      </Card>

      <div className="space-y-2.5">
        {topics.map((tp) => (
          <Card key={tp.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{tp.title}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {tp.id} · {tp.healthCategory}
                </p>
              </div>
              <Badge tone={tp.status === "published" ? "green" : "amber"}>{tp.status}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                full
                tone="secondary"
                onClick={() => toggleStatus(tp.id, tp.status === "published" ? "draft" : "published")}
              >
                {tp.status === "published" ? t("ad_c_unpublish", "Unpublish") : t("ad_c_publish", "Publish")}
              </Button>
              <Button tone="ghost" onClick={() => remove(tp.id)}>
                {t("ad_c_delete", "Delete")}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Verification() {
  const t = useT();
  const { push } = useToast();
  const [requests, setRequests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);
  const [, setProviders] = useStoredCollection(KEYS.providers, seedProviders);

  const approve = (req: ProviderRequest) => {
    setProviders((prev) => [
      ...prev,
      {
        id: `prv-${req.id}`,
        name: req.facility,
        category: (PROVIDER_CATEGORIES.includes(req.category as never) ? req.category : "Clinic") as never,
        services: ["General consultation"],
        city: req.lga,
        state: req.state,
        lga: req.lga,
        address: req.address || "Address pending",
        phone: req.phone,
        hours: "Mon–Sat, 8am–5pm",
        verified: true,
        description: t("ad_v_approved_desc", "Verified CareNBuddi partner facility."),
        emergency: false,
      },
    ]);
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "approved" } : r)));
    push(t("ad_v_approved_toast", "Facility verified"), "success");
  };

  const reject = (id: string) =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<ShieldIcon className="h-6 w-6" />}
        title={t("ad_v_none", "No registrations yet")}
        body={t("ad_v_none_d", "Facility registration requests appear here for review.")}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {requests.map((req) => (
        <Card key={req.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{req.facility}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {req.name} · {req.email} · {req.phone}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {req.category} · {req.lga}, {req.state}
              </p>
            </div>
            <Badge tone={REQ_TONE[req.status] ?? "slate"}>
              {req.status === "pending"
                ? t("c_pending", "Pending")
                : req.status === "approved"
                  ? t("c_approved", "Approved")
                  : t("c_rejected", "Rejected")}
            </Badge>
          </div>
          {req.status === "pending" && (
            <div className="mt-3 flex gap-2">
              <Button full onClick={() => approve(req)}>
                {t("ad_v_verify", "Verify")}
              </Button>
              <Button full tone="secondary" onClick={() => reject(req.id)}>
                {t("ad_v_reject", "Reject")}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function UserManager() {
  const t = useT();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);

  const setRole = (id: string, role: User["role"]) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));

  return (
    <div className="space-y-2.5">
      {users.map((u) => (
        <Card key={u.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{u.email}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {t("ad_u_joined", "Joined")} {u.createdAt.slice(0, 10)}
              </p>
            </div>
            <Badge tone={u.role === "admin" ? "brand" : u.role === "provider" ? "green" : "slate"}>{u.role}</Badge>
          </div>
          <div className="mt-3">
            <Field label={t("ad_u_role", "Role")}>
              <select
                value={u.role}
                onChange={(e) => setRole(u.id, e.target.value as User["role"])}
                className={`${inputClass} py-2.5 text-sm`}
              >
                <option value="consumer">consumer</option>
                <option value="provider">provider</option>
                <option value="admin">admin</option>
              </select>
            </Field>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Analytics() {
  const t = useT();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [requests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);

  const byCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    providers.forEach((p) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [providers]);

  const byState = useMemo(() => {
    const counts: Record<string, number> = {};
    providers.forEach((p) => {
      counts[p.state] = (counts[p.state] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [providers]);

  const bookingsByDay = useMemo(() => {
    const days: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toISOString().slice(0, 10);
      days.push(bookings.filter((b) => b.createdAt.slice(0, 10) === label).length);
    }
    return days;
  }, [bookings]);

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{t("ad_a_cat", "Providers by category")}</h2>
        <BarList rows={byCategory} tone="bg-brand-500" />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{t("ad_a_state", "Providers by state")}</h2>
        <BarList rows={byState} tone="bg-emerald-500" />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {t("ad_a_bookings", "Requests — last 14 days")}
        </h2>
        <MiniBars values={bookingsByDay} className="mt-3 h-24" />
        <p className="mt-2 text-xs text-slate-400">
          {t("ad_a_pipeline", "Verification pipeline:")} {requests.length} {t("ad_a_submitted", "submitted")},{" "}
          {requests.filter((r) => r.status === "approved").length} {t("ad_a_approved", "approved")},{" "}
          {requests.filter((r) => r.status === "pending").length} {t("ad_a_pending0", "pending")}.
        </p>
      </Card>
    </div>
  );
}

function BarList({ rows, tone }: { rows: { name: string; value: number }[]; tone: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="mt-3 space-y-2">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-slate-600">{r.name}</span>
            <span className="font-semibold tabular-nums text-slate-900">{r.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportCenter() {
  const t = useT();
  const [reports, setReports] = useStoredCollection(KEYS.reports, seedReports);

  const resolve = (id: string) =>
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: "resolved" } : r)));

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<ActivityIcon className="h-6 w-6" />}
        title={t("ad_r_empty", "No reports")}
        body={t("ad_r_empty_d", "Community reports will appear here for review.")}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {r.targetType}: <span className="text-slate-600">{r.targetId}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-600">{r.reason}</p>
              {r.detail && <p className="mt-0.5 text-xs text-slate-400">{r.detail}</p>}
              <p className="mt-1 text-[11px] text-slate-400">{r.createdAt.slice(0, 10)}</p>
            </div>
            <Badge tone={r.status === "open" ? "amber" : "green"}>{r.status}</Badge>
          </div>
          {r.status === "open" && (
            <Button full className="mt-3" onClick={() => resolve(r.id)}>
              {t("ad_r_resolve", "Resolve")}
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}