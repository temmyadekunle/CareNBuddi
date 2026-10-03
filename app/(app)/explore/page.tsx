"use client";

import { useState } from "react";
import {
  KEYS,
  seedReports,
  seedTopics,
  uid,
  useStoredCollection,
  type ContentItem,
} from "@/lib/storage";
import { CATEGORY_DESCRIPTIONS, HEALTH_CATEGORY_LABELS } from "@/lib/content";
import type { Report } from "@/lib/types";
import { TopicCard, TopicDetail, matchTopic } from "@/components/health";
import { ReportAction } from "@/components/report-button";
import { useT, useLang } from "@/lib/i18n";

export default function ExplorePage() {
  const t = useT();
  const lang = useLang();
  const [topics] = useStoredCollection(KEYS.topics, seedTopics);
  const [, setReports] = useStoredCollection(KEYS.reports, seedReports);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<ContentItem | null>(null);

  const published = topics.filter((tp) => tp.status === "published");
  const q = query.trim().toLowerCase();

  const catLabel = (c: string) => HEALTH_CATEGORY_LABELS[lang]?.[c] ?? c;
  const catKey = (label: string) =>
    Object.entries(HEALTH_CATEGORY_LABELS[lang] ?? {}).find(([, v]) => v === label)?.[0] ??
    Object.entries(HEALTH_CATEGORY_LABELS.en).find(([, v]) => v === label)?.[0] ??
    label;

  const filtered = published.filter((tp) => {
    if (q && !matchTopic(tp, q)) return false;
    if (category !== "All" && catKey(category) !== tp.healthCategory) return false;
    return true;
  });

  const usedCategories = Array.from(
    new Set(published.map((tp) => catLabel(tp.healthCategory))),
  );

  const report = (topicId: string, reason: string) => {
    setReports((prev) => [
      ...prev,
      {
        id: uid(),
        targetType: "topic",
        targetId: topicId,
        reason,
        status: "open",
        createdAt: new Date().toISOString(),
      } satisfies Report,
    ]);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("e_title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("e_sub")}</p>
        <label htmlFor="explore-search" className="sr-only">
          {t("h_search")}
        </label>
        <input
          id="explore-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("h_search")}
          className="mt-4 w-full max-w-xl rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <CategoryPill active={category === "All"} onClick={() => setCategory("All")}>
            {t("e_allcat")}
          </CategoryPill>
          {usedCategories.map((label) => (
            <CategoryPill
              key={label}
              active={category === label}
              onClick={() => setCategory(label)}
            >
              {label}
            </CategoryPill>
          ))}
        </div>
      </div>

      {selected ? (
        <TopicDetail
          topic={selected}
          onBack={() => setSelected(null)}
          report={() => report((selected as ContentItem).id, t("e_report_reason"))}
        />
      ) : (
        <>
          {category === "All" && !q ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {usedCategories.map((label) => (
                <button
                  key={label}
                  onClick={() => setCategory(label)}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-300"
                >
                  <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {CATEGORY_DESCRIPTIONS[lang]?.[catKey(label)] ??
                      CATEGORY_DESCRIPTIONS.en[catKey(label)]}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  {t("f_no_results")}
                </p>
              ) : (
                filtered.map((tp) => (
                  <div key={tp.id} className="relative">
                    <TopicCard topic={tp} onSelect={(t) => setSelected(t as ContentItem)} />
                    <ReportAction
                      className="absolute right-3 top-3"
                      targetType="topic"
                      targetId={tp.id}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export function CategoryPill({
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
          ? "bg-brand-700 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}