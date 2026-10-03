"use client";

import { useMemo, useState } from "react";
import {
  RECORD_CATEGORIES,
  type MedicalRecord,
  type RecordCategory,
} from "@/lib/types";
import { KEYS, seedRecords, todayIso, uid, useStoredCollection } from "@/lib/storage";
import { fullDate } from "@/lib/format";

const CATEGORY_STYLES: Record<RecordCategory, string> = {
  visit: "bg-sky-50 text-sky-700",
  lab: "bg-violet-50 text-violet-700",
  imaging: "bg-indigo-50 text-indigo-700",
  prescription: "bg-amber-50 text-amber-700",
  vaccination: "bg-emerald-50 text-emerald-700",
};

export default function RecordsPage() {
  const [records, setRecords] = useStoredCollection(KEYS.records, seedRecords);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<RecordCategory>("visit");
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [filter, setFilter] = useState<RecordCategory | "all">("all");

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records],
  );

  const filtered = filter === "all" ? sorted : sorted.filter((r) => r.category === filter);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: MedicalRecord = {
      id: uid(),
      title: title.trim(),
      provider: provider.trim(),
      date,
      category,
      summary: summary.trim(),
      link: link.trim(),
    };
    setRecords((prev) => [...prev, record]);
    setTitle("");
    setProvider("");
    setSummary("");
    setLink("");
  };

  const remove = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Medical records</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep a linkable archive of visits, labs, and prescriptions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={submit}
          className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add record</h2>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Title</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Blood test results"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Provider / facility</span>
              <input
                type="text"
                required
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Dr. Smith, City Clinic"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RecordCategory)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  {RECORD_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Summary / result</span>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Key findings or notes…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Link (optional)</span>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Save record
          </button>
        </form>

        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterPill>
            {RECORD_CATEGORIES.map((c) => (
              <FilterPill
                key={c.value}
                active={filter === c.value}
                onClick={() => setFilter(c.value)}
              >
                {c.label}
              </FilterPill>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No records here yet.
              </div>
            ) : (
              filtered.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {record.title}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[record.category]}`}
                        >
                          {RECORD_CATEGORIES.find((c) => c.value === record.category)?.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {record.provider} · {fullDate(record.date)}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(record.id)}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                  {record.summary && (
                    <p className="mt-2 text-sm text-slate-700">{record.summary}</p>
                  )}
                  {record.link && (
                    <a
                      href={record.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-emerald-600 hover:underline"
                    >
                      Open attached record ↗
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}