"use client";

import Link from "next/link";
import {
  directionsUrl,
  whatsappUrl,
  PROVIDER_CATEGORY_LABELS,
  providerCostTier,
  COST_TIER_LABELS,
  type Provider,
  type Topic,
} from "@/lib/content";
import { useT, useLang } from "@/lib/i18n";
import {
  topicTitle,
  topicSummary,
  topicWhatItIs,
  topicSymptoms,
  topicRiskFactors,
  topicPrevention,
  topicWhenToSeekHelp,
  topicFaqs,
} from "@/lib/content";

export const CATEGORY_STYLES: Record<string, string> = {
  Hospital: "bg-sky-50 text-sky-700",
  Clinic: "bg-violet-50 text-violet-700",
  "Primary health centre": "bg-emerald-50 text-emerald-700",
  Laboratory: "bg-amber-50 text-amber-700",
  Pharmacy: "bg-teal-50 text-teal-700",
  "Diagnostic centre": "bg-indigo-50 text-indigo-700",
  "Mental health service": "bg-rose-50 text-rose-700",
  "Maternal health service": "bg-pink-50 text-pink-700",
  Professional: "bg-slate-100 text-slate-700",
};

export function matchTopic(t: Topic | { title: string; summary: string; healthCategory: string }, q: string): boolean {
  const hay = `${t.title} ${t.summary} ${t.healthCategory}`.toLowerCase();
  return hay.includes(q);
}

export function matchProvider(p: Provider, q: string): boolean {
  const hay = `${p.name} ${p.category} ${p.city} ${p.state} ${p.lga} ${p.services.join(" ")}`.toLowerCase();
  return hay.includes(q);
}

export function TopicCard({ topic, onSelect }: { topic: Topic; onSelect: (t: Topic) => void }) {
  const t = useT();
  const lang = useLang();
  const title = topicTitle(topic, lang);
  const summary = topicSummary(topic, lang);
  return (
    <button
      onClick={() => onSelect(topic)}
      className="group rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-300"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">{title}</h3>
        <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
          {topic.healthCategory}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{summary}</p>
      <span className="mt-2 inline-block text-xs font-medium text-brand-700">{t("hd_read_more")} →</span>
    </button>
  );
}

export function TopicDetail({ topic, onBack, report }: { topic: Topic; onBack?: () => void; report?: (t: Topic) => void }) {
  const lang = useLang();
  const t = useT();
  const title = topicTitle(topic, lang);
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      {onBack && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            ← {t("c_back")}
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">
              {t("hd_reviewed")} {topic.reviewedBy} · {topic.reviewedOn}
            </span>
            {report && (
              <button
                onClick={() => report(topic)}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 hover:border-amber-300 hover:text-amber-700"
              >
                ⚠ {t("hd_report")}
              </button>
            )}
          </div>
        </div>
      )}

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{topicSummary(topic, lang)}</p>

      <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>{t("hd_when")}:</strong> {topicWhenToSeekHelp(topic, lang)}
      </div>

      <div className="mt-6 space-y-6">
        <DetailBlock title={t("hd_what")}>
          <p className="text-sm text-slate-700">{topicWhatItIs(topic, lang)}</p>
        </DetailBlock>
        <DetailBlock title={t("hd_symptoms")}>
          <BulletList items={topicSymptoms(topic, lang)} />
        </DetailBlock>
        <DetailBlock title={t("hd_risk")}>
          <BulletList items={topicRiskFactors(topic, lang)} />
        </DetailBlock>
        <DetailBlock title={t("hd_prevention")}>
          <BulletList items={topicPrevention(topic, lang)} />
        </DetailBlock>
      </div>

      <details open className="mt-6 border-t border-slate-100 pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          {t("hd_faqs")}
        </summary>
        <div className="mt-3 space-y-3">
          {topicFaqs(topic, lang).map((f) => (
            <div key={f.q} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{f.q}</p>
              <p className="mt-1 text-sm text-slate-600">{f.a}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <p className="text-xs text-slate-400">{t("hd_source")} {topic.source}</p>
        <Link
          href={`/find-care?category=${encodeURIComponent(topic.categories[0] ?? "Hospital")}`}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
        >
          {t("hd_find_help")} →
        </Link>
      </div>
    </article>
  );
}

function CostBadge({ category }: { category: Provider["category"] }) {
  const tier = providerCostTier(category);
  const style = tier === "low" ? "bg-emerald-50 text-emerald-800" : tier === "high" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{COST_TIER_LABELS[tier]}</span>;
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const t = useT();
  const lang = useLang();
  const categoryLabel = PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{provider.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[provider.category] ?? "bg-slate-100 text-slate-700"}`}
        >
          {categoryLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {provider.city}, {provider.state} · {provider.lga}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {provider.verified && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            ✓ {t("f_verified")}
          </span>
        )}
        {provider.rating && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            ★ {provider.rating.toFixed(1)}
          </span>
        )}
        {provider.emergency && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
            {t("f_open_24")}
          </span>
        )}
        <CostBadge category={provider.category} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {provider.services.slice(0, 4).map((s) => (
          <span key={s} className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
            {s}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">{provider.hours}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <a
          href={`tel:${provider.phone}`}
          className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-800"
        >
          {t("f_call")} {provider.phone}
        </a>
        <a
          href={whatsappUrl(provider)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-green-700 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 transition-colors hover:bg-green-100"
        >
          {t("f_whatsapp")}
        </a>
        <Link
          href={`/find-care/${provider.id}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {t("f_request")} →{/* link to profile */}
        </Link>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <a
          href={directionsUrl(provider)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-brand-700 underline hover:text-brand-800"
        >
          {t("f_dir")} ↗
        </a>
        <Link
          href={`/find-care/${provider.id}`}
          className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
        >
          {t("f_desc")}
        </Link>
      </div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-slate-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          {item}
        </li>
      ))}
    </ul>
  );
}