"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CATEGORY_DESCRIPTIONS,
  HEALTH_CATEGORIES,
  TOPICS,
  type Topic,
} from "@/lib/content";
import { TopicCard, TopicDetail, matchTopic } from "@/components/health";

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const params = useSearchParams();
  const initialTopic = params.get("topic");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Topic | null>(
    () => TOPICS.find((t) => t.slug === initialTopic) ?? null,
  );

  const q = query.trim().toLowerCase();

  const topics = useMemo(() => {
    return TOPICS.filter((t) => {
      if (q && !matchTopic(t, q)) return false;
      if (category !== "All" && t.healthCategory !== category) return false;
      return true;
    });
  }, [q, category]);

  const filteredCategories = HEALTH_CATEGORIES.filter(
    (c) => TOPICS.some((t) => t.healthCategory === c) || category === c,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Explore health</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse by topic area or search. Everything is explained in simple,
          understandable language.
        </p>
        <label htmlFor="explore-search" className="sr-only">
          Search topics
        </label>
        <input
          id="explore-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics, symptoms, conditions…"
          className="mt-4 w-full max-w-xl rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <CategoryPill active={category === "All"} onClick={() => setCategory("All")}>
            All
          </CategoryPill>
          {filteredCategories.map((c) => (
            <CategoryPill key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </CategoryPill>
          ))}
        </div>
      </div>

      {selected ? (
        <TopicDetail topic={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {category === "All" && !q ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HEALTH_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300"
                >
                  <h3 className="text-sm font-semibold text-slate-900">{c}</h3>
                  <p className="mt-1 text-sm text-slate-600">{CATEGORY_DESCRIPTIONS[c]}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {topics.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  No topics here yet. Topics in this area are coming soon.
                </p>
              ) : (
                topics.map((t) => <TopicCard key={t.slug} topic={t} onSelect={setSelected} />)
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function CategoryPill({
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
          ? "bg-emerald-700 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}