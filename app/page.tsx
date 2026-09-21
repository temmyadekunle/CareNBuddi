"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
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
import { MOODS } from "@/lib/types";
import {
  KEYS,
  seedJournal,
  seedRecords,
  seedReminders,
  useStoredCollection,
} from "@/lib/storage";
import { avg, fullDate, round, shortDate } from "@/lib/format";

function moodColor(mood: string): string {
  return MOODS.find((m) => m.value === mood)?.color ?? "bg-slate-300";
}

export default function Dashboard() {
  const [journal] = useStoredCollection(KEYS.journal, seedJournal);
  const [records] = useStoredCollection(KEYS.records, seedRecords);
  const [reminders] = useStoredCollection(KEYS.reminders, seedReminders);

  const sorted = [...journal].sort((a, b) => a.date.localeCompare(b.date));
  const last14 = sorted.slice(-14);

  const moodData = last14.map((e) => ({
    date: shortDate(e.date),
    mood: 5 - MOODS.findIndex((m) => m.value === e.mood),
  }));

  const heartData = last14
    .filter((e) => e.vitals.heartRate != null)
    .map((e) => ({ date: shortDate(e.date), heartRate: e.vitals.heartRate }));

  const weightData = last14
    .filter((e) => e.vitals.weightKg != null)
    .map((e) => ({ date: shortDate(e.date), weight: e.vitals.weightKg }));

  const sleepData = last14
    .filter((e) => e.vitals.sleepHours != null)
    .map((e) => ({ date: shortDate(e.date), sleep: e.vitals.sleepHours }));

  const heartLast7 = heartData.slice(-7).flatMap((d) =>
    d.heartRate != null ? [d.heartRate] : [],
  );
  const sleepLast7 = sleepData.slice(-7).flatMap((d) => (d.sleep != null ? [d.sleep] : []));
  const latestWeight = [...weightData].pop()?.weight;

  const today = fullDate(new Date().toISOString().slice(0, 10));
  const activeReminders = reminders
    .filter((r) => r.enabled)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 4);
  const recentRecords = [...records]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const mostCommonSymptom = (() => {
    const counts = new Map<string, number>();
    last14.forEach((e) =>
      e.symptoms.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)),
    );
    let top = "";
    let topCount = 0;
    counts.forEach((c, s) => {
      if (c > topCount) {
        top = s;
        topCount = c;
      }
    });
    return { symptom: top, count: topCount };
  })();

  const latest = sorted[sorted.length - 1];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{today}</p>
        </div>
        <p className="text-sm text-slate-600">
          Latest mood:{" "}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${moodColor(latest?.mood ?? "okay")}`}
          >
            {MOODS.find((m) => m.value === latest?.mood)?.label ?? "N/A"}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Avg. heart rate (7d)"
          value={
            heartLast7.length ? `${round(avg(heartLast7), 0)} bpm` : "No data"
          }
        />
        <StatCard
          label="Latest weight"
          value={latestWeight != null ? `${latestWeight} kg` : "No data"}
        />
        <StatCard
          label="Avg. sleep (7d)"
          value={sleepLast7.length ? `${round(avg(sleepLast7), 1)} hrs` : "No data"}
        />
        <StatCard
          label="Most reported symptom"
          value={mostCommonSymptom.symptom || "None"}
          sub={
            mostCommonSymptom.count > 0
              ? `${mostCommonSymptom.count}x in 14 days`
              : "in last 14 days"
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Mood trend" subtitle="Last 14 entries (higher is better)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={moodData} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="mood" stroke="#10b981" strokeWidth={2} fill="url(#moodFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Heart rate" subtitle="bpm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={heartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="heartRate" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weight" subtitle="kg">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightData} margin={{ top: 5, right: 5, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Sleep" subtitle="Hours per day">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sleepData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="sleep" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming reminders</h2>
            <Link href="/reminders" className="text-xs font-medium text-emerald-600 hover:underline">
              Manage
            </Link>
          </div>
          {activeReminders.length === 0 ? (
            <p className="text-sm text-slate-500">No active reminders.</p>
          ) : (
            <ul className="space-y-3">
              {activeReminders.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700">
                    {r.time}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{r.title}</p>
                    <p className="truncate text-xs capitalize text-slate-500">{r.type}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent records</h2>
            <Link href="/records" className="text-xs font-medium text-emerald-600 hover:underline">
              View all
            </Link>
          </div>
          {recentRecords.length === 0 ? (
            <p className="text-sm text-slate-500">No medical records yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentRecords.map((r) => (
                <li key={r.id}>
                  <p className="text-sm font-medium text-slate-800">{r.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.provider} · {shortDate(r.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
      <div className="mt-3 h-48">{children}</div>
    </Card>
  );
}