"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { PROVIDER_CATEGORIES } from "@/lib/content";
import type { ProviderRequest, Report, User } from "@/lib/types";
import { useT } from "@/lib/i18n";

type Tab = "overview" | "content" | "verification" | "users" | "analytics" | "reports";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "ad_overview", icon: "📊" },
  { id: "content", label: "ad_content", icon: "📝" },
  { id: "verification", label: "ad_verification", icon: "🛡️" },
  { id: "users", label: "ad_users", icon: "👥" },
  { id: "analytics", label: "ad_analytics", icon: "📈" },
  { id: "reports", label: "ad_reports", icon: "⚠️" },
];

export default function AdminPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);

  const isAdmin = me?.role === "admin";
  const [tab, setTab] = useState<Tab>("overview");

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("ad_title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t("ad_signin_req")}</p>
        <Link
          href="/account"
          className="mt-5 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          {t("a_signin")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("ad_title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("ad_sub")}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === tb.id
                ? "bg-brand-700 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tb.icon} {t(tb.label)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "content" && <ContentManager />}
        {tab === "verification" && <Verification />}
        {tab === "users" && <UserManager />}
        {tab === "analytics" && <Analytics />}
        {tab === "reports" && <ReportCenter />}
      </div>
    </main>
  );
}

function Overview() {
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [topics] = useStoredCollection(KEYS.topics, seedTopics);
  const [requests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [reports] = useStoredCollection(KEYS.reports, seedReports);
  const t = useT();

  const cards = [
    { label: t("ad_users"), icon: "👥", value: users.length },
    { label: t("ad_providers"), icon: "🏥", value: providers.length },
    { label: t("ad_verified_p"), icon: "✓", value: providers.filter((p) => p.verified).length },
    { label: t("ad_topics"), icon: "📝", value: topics.length },
    { label: t("ad_verify_pending"), icon: "🛡️", value: requests.filter((r) => r.status === "pending").length },
    { label: t("ad_bookings"), icon: "📅", value: bookings.length },
    { label: t("ad_reports_open"), icon: "⚠️", value: reports.filter((r) => r.status === "open").length },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            {c.icon} {c.label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function ContentManager() {
  const t = useT();
  const [topics, setTopics] = useStoredCollection(KEYS.topics, seedTopics);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("General Health");
  const [notice, setNotice] = useState("");

  const addDraft = () => {
    if (!slug.trim() || !title.trim()) {
      setNotice(t("ad_c_required"));
      return;
    }
    const base: ContentItem = (() => {
      const seed = seedTopics[0];
      return {
        ...seed,
        slug: slug.trim(),
        id: slug.trim(),
        title: title.trim(),
        summary: summary.trim() || t("ad_c_draft_note"),
        healthCategory: category,
        locale: undefined,
        whenToSeekHelp: t("ad_c_empty_summary"),
      };
    })();
    if (topics.some((tp) => tp.id === base.id)) {
      setNotice(t("ad_c_exists"));
      return;
    }
    setTopics((prev) => [...prev, { ...base, status: "draft" }] as ContentItem[]);
    setSlug("");
    setTitle("");
    setSummary("");
    setNotice(t("ad_c_created"));
  };

  const toggleStatus = (id: string, status: ContentItem["status"]) => {
    setTopics((prev) => prev.map((tp) => (tp.id === id ? { ...tp, status } : tp)));
  };

  const remove = (id: string) => setTopics((prev) => prev.filter((tp) => tp.id !== id));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{t("ad_c_add")}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input placeholder={t("ad_c_slug")} value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder={t("ad_c_title")} value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder={t("ad_c_summary")} value={summary} onChange={(e) => setSummary(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {["General Health", "Women's Health", "Men's Health", "Mental Health", "Children's Health", "Nutrition", "Maternal Health", "Preventive Health", "Chronic Conditions", "First Aid"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={addDraft} className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          {t("ad_c_add_draft")}
        </button>
        {notice && <span className="text-sm text-slate-500">{notice}</span>}
      </div>

      <div className="mt-6 space-y-2">
        {topics.map((tp) => (
          <div key={tp.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {tp.title}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${tp.status === "published" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {tp.status}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{tp.id} · {tp.healthCategory}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleStatus(tp.id, tp.status === "published" ? "draft" : "published")}
                className="rounded-lg border border-brand-700 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                {tp.status === "published" ? t("ad_c_unpublish") : t("ad_c_publish")}
              </button>
              <button onClick={() => remove(tp.id)} className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-red-600">
                {t("ad_c_delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Verification() {
  const t = useT();
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
        description: t("ad_v_approved_desc"),
        emergency: false,
      },
    ]);
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "approved" } : r)));
  };

  const reject = (id: string) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
  };

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{t("ad_v_none")}</p>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{req.facility}</p>
                <p className="text-xs text-slate-500">
                  {req.name} · {req.email} · {req.phone}
                </p>
                <p className="text-xs text-slate-500">
                  {req.category} · {req.lga}, {req.state} ·{" "}
                  <span className={`rounded-full px-2 py-0.5 font-medium ${req.status === "pending" ? "bg-amber-100 text-amber-800" : req.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {req.status === "pending" ? t("c_pending") : req.status === "approved" ? t("c_approved") : t("c_rejected")}
                  </span>
                </p>
              </div>
              {req.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => approve(req)} className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800">
                    {t("ad_v_verify")}
                  </button>
                  <button onClick={() => reject(req.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    {t("ad_v_reject")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function UserManager() {
  const t = useT();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);

  const setRole = (id: string, role: User["role"]) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-4 py-2 font-medium">{t("ad_u_name")}</th>
            <th className="px-4 py-2 font-medium">{t("ad_u_email")}</th>
            <th className="px-4 py-2 font-medium">{t("ad_u_role")}</th>
            <th className="px-4 py-2 font-medium">{t("ad_u_joined")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
              <td className="px-4 py-2 text-slate-600">{u.email}</td>
              <td className="px-4 py-2">
                <select
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value as User["role"])}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="consumer">consumer</option>
                  <option value="provider">provider</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="px-4 py-2 text-xs text-slate-400">{u.createdAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [providers]);

  const bookingsByDay = useMemo(() => {
    const last14: { label: string; Requests: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toISOString().slice(0, 10);
      const count = bookings.filter((b) => b.createdAt.slice(0, 10) === label).length;
      last14.push({ label: label.slice(5), Requests: count });
    }
    return last14;
  }, [bookings]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={t("ad_a_cat")}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0f8b8d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title={t("ad_a_state")}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byState} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#4caf50" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title={t("ad_a_bookings")} wide>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bookingsByDay} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="Requests" name={t("ad_a_requests")} stroke="#0f8b8d" strokeWidth={2.5} dot={{ r: 3, fill: "#0f8b8d" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {t("ad_a_pipeline")} {requests.length} {t("ad_a_submitted")},{" "}
          {requests.filter((r) => r.status === "approved").length} {t("ad_a_approved")},{" "}
          {requests.filter((r) => r.status === "pending").length} {t("ad_a_pending0")}.
        </p>
      </Card>
    </div>
  );
}

function ReportCenter() {
  const [reports, setReports] = useStoredCollection(KEYS.reports, seedReports);

  const resolve = (id: string) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: "resolved" } : r)));
  };

  return (
    <div className="space-y-3">
      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No reports.</p>
      ) : (
        reports.map((r: Report) => (
          <div key={r.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {r.targetType}: <span className="text-slate-600">{r.targetId}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{r.reason}</p>
                {r.detail && <p className="text-xs text-slate-400">{r.detail}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{r.createdAt.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status === "open" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                  {r.status}
                </span>
                {r.status === "open" && (
                  <button onClick={() => resolve(r.id)} className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}