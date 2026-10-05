"use client";

import { useState, type ReactNode } from "react";
import { Card, Chip, EmptyState, Screen, SectionHeader, inputClass } from "@/components/app-ui";
import { SearchIcon } from "@/components/icons";
import { ReportAction } from "@/components/report-button";
import { TopicCard, TopicDetail, matchTopic } from "@/components/health";
import { CATEGORY_DESCRIPTIONS, HEALTH_CATEGORY_LABELS } from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";
import {
  KEYS,
  seedReports,
  seedTopics,
  uid,
  useStoredCollection,
  type ContentItem,
} from "@/lib/storage";
import type { Report } from "@/lib/types";

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

  const usedCategories = Array.from(new Set(published.map((tp) => catLabel(tp.healthCategory))));

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

  if (selected) {
    return (
      <Screen>
        <TopicDetail
          topic={selected}
          onBack={() => setSelected(null)}
          report={() => report(selected.id, t("e_report_reason", "Content accuracy or safety concern"))}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader title={t("e_title", "Explore health education")} subtitle={t("e_sub", "")} />

      <label htmlFor="explore-search" className="sr-only">
        {t("h_search", "Search")}
      </label>
      <div className="relative mt-3">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id="explore-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("h_search", "Search")}
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
        <CategoryPill active={category === "All"} onClick={() => setCategory("All")}>
          {t("e_allcat", "All categories")}
        </CategoryPill>
        {usedCategories.map((label) => (
          <CategoryPill key={label} active={category === label} onClick={() => setCategory(label)}>
            {label}
          </CategoryPill>
        ))}
      </div>

      {category === "All" && !q ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {usedCategories.map((label) => (
            <Card key={label} className="text-left" padded>
              <button onClick={() => setCategory(label)} className="block w-full text-left">
                <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                <p className="mt-1 line-clamp-3 text-xs text-slate-600">
                  {CATEGORY_DESCRIPTIONS[lang]?.[catKey(label)] ?? CATEGORY_DESCRIPTIONS.en[catKey(label)]}
                </p>
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title={t("f_no_results", "No results")}
              body={t("exx_none_today", "")}
            />
          ) : (
            filtered.map((tp) => (
              <div key={tp.id} className="relative">
                <TopicCard topic={tp} onSelect={(next) => setSelected(next as ContentItem)} />
                <ReportAction className="absolute right-3 top-3" targetType="topic" targetId={tp.id} />
              </div>
            ))
          )}
        </div>
      )}
    </Screen>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Chip active={active} onClick={onClick}>
      {children}
    </Chip>
  );
}