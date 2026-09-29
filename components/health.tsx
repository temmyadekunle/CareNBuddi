"use client";

import Link from "next/link";
import {
  directionsUrl,
  type Provider,
  type Topic,
} from "@/lib/content";

export const CATEGORY_STYLES: Record<string, string> = {
  Hospital: "bg-sky-50 text-sky-700",
  Clinic: "bg-violet-50 text-violet-700",
  Laboratory: "bg-amber-50 text-amber-700",
  Pharmacy: "bg-emerald-50 text-emerald-700",
  "Diagnostic centre": "bg-indigo-50 text-indigo-700",
  "Mental health service": "bg-rose-50 text-rose-700",
  "Maternal health service": "bg-teal-50 text-teal-700",
};

export function matchTopic(t: Topic, q: string): boolean {
  const hay = `${t.title} ${t.summary} ${t.symptoms.join(" ")} ${t.whatItIs} ${t.healthCategory}`.toLowerCase();
  return hay.includes(q);
}

export function matchProvider(p: Provider, q: string): boolean {
  const hay = `${p.name} ${p.category} ${p.city} ${p.state} ${p.services.join(" ")}`.toLowerCase();
  return hay.includes(q);
}

export function TopicCard({ topic, onSelect }: { topic: Topic; onSelect: (t: Topic) => void }) {
  return (
    <button
      onClick={() => onSelect(topic)}
      className="group rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-300"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
          {topic.title}
        </h3>
        <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
          {topic.healthCategory}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{topic.summary}</p>
      <span className="mt-2 inline-block text-xs font-medium text-brand-700">Read more →</span>
    </button>
  );
}

export function TopicDetail({ topic, onBack }: { topic: Topic; onBack?: () => void }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      {onBack && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            ← Back
          </button>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">
            Reviewed by {topic.reviewedBy} · {topic.reviewedOn}
          </span>
        </div>
      )}

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{topic.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{topic.summary}</p>

      <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>When to seek professional help:</strong> {topic.whenToSeekHelp}
      </div>

      <div className="mt-6 space-y-6">
        <DetailBlock title="What it is">
          <p className="text-sm text-slate-700">{topic.whatItIs}</p>
        </DetailBlock>
        <DetailBlock title="Common signs and symptoms">
          <BulletList items={topic.symptoms} />
        </DetailBlock>
        <DetailBlock title="Risk factors">
          <BulletList items={topic.riskFactors} />
        </DetailBlock>
        <DetailBlock title="Prevention">
          <BulletList items={topic.prevention} />
        </DetailBlock>
      </div>

      <details open className="mt-6 border-t border-slate-100 pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Frequently asked questions
        </summary>
        <div className="mt-3 space-y-3">
          {topic.faqs.map((f) => (
            <div key={f.q} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{f.q}</p>
              <p className="mt-1 text-sm text-slate-600">{f.a}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <p className="text-xs text-slate-400">Source: {topic.source}</p>
        <Link
          href={`/find-care?category=${encodeURIComponent(topic.categories[0] ?? "Hospital")}`}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
        >
          Find Help Near Me →
        </Link>
      </div>
    </article>
  );
}

export function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{provider.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[provider.category] ?? "bg-slate-100 text-slate-700"}`}
        >
          {provider.category}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {provider.city}, {provider.state}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {provider.services.map((s) => (
          <span key={s} className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
            {s}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">{provider.hours}</p>
      <div className="mt-auto flex items-center gap-2 pt-3">
        <a
          href={`tel:${provider.phone}`}
          className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Call {provider.phone}
        </a>
        <a
          href={directionsUrl(provider)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Directions ↗
        </a>
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