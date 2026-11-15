import {
  BrainIcon,
  CheckIcon,
  ClockIcon,
  GridIcon,
  SparklesIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/icons";
import { Reveal } from "@/components/marketing/reveal";
import { Section } from "@/components/marketing/section";
import { StatusBadge } from "@/components/marketing/status-badge";
import {
  AVAILABLE_NOW,
  COMING_SOON,
  ROADMAP_GROUPS,
  type RoadmapGroupId,
} from "@/lib/landing-features";

const GROUP_ICON: Record<RoadmapGroupId, typeof UserIcon> = {
  patient: UserIcon,
  provider: StethoscopeIcon,
  facility: GridIcon,
  ai: BrainIcon,
};

/**
 * The page's central product map.
 *
 * The four panels are deliberately unequal: availability is a strong promise,
 * so it gets the most space, while roadmap and vision are shown as direction
 * rather than delivery. Copy comes from `lib/landing-features.ts`.
 */
export function WhatsAhead() {
  return (
    <Section
      id="whats-ahead"
      eyebrow="Product map"
      title="CareNBuddi: What's Here & What's Ahead"
      tone="tint"
    >
      <p className="mt-3 max-w-3xl text-lg font-semibold leading-relaxed text-brand-800">
        Better healthcare experiences, built together &mdash; one step at a time.
      </p>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
        Some of what we are building is ready to use today. Some is in active development,
        some is planned, and some belongs to the larger healthcare experience we are working
        towards. Here is an honest view of each.
      </p>

      {/* ------------------------------------------------ available now */}
      <Reveal>
        <div className="mt-10 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/70 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <CheckIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Available now</h3>
                <p className="text-xs text-slate-600">Working in the app today</p>
              </div>
            </div>
            <StatusBadge status="available" />
          </div>
          <ul className="grid gap-px bg-emerald-200/60 sm:grid-cols-2 lg:grid-cols-3">
            {AVAILABLE_NOW.map((feature) => (
              <li key={feature.id} className="bg-white/85 p-5">
                <div className="flex items-start gap-2.5">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{feature.name}</h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                      {feature.description}
                    </p>
                    {feature.note ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                        {feature.note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* ------------------------------------------------- coming soon */}
      <Reveal delay={60}>
        <div className="mt-4 overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/50 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/70 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                <ClockIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Coming soon</h3>
                <p className="text-xs text-slate-600">Being prepared for the next releases</p>
              </div>
            </div>
            <StatusBadge status="coming-soon" />
          </div>
          <ul className="grid gap-px bg-amber-200/60 sm:grid-cols-2 lg:grid-cols-4">
            {COMING_SOON.map((feature, index) => (
              <li
                key={feature.id}
                className={`bg-white/85 p-4 ${
                  index === COMING_SOON.length - 1 && COMING_SOON.length % 4 === 1
                    ? "sm:col-span-2 lg:col-span-4"
                    : ""
                }`}
              >
                <h4 className="text-[13px] font-semibold text-slate-900">{feature.name}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{feature.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* -------------------------------------------------- on roadmap */}
      <Reveal delay={80}>
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <SparklesIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">On our roadmap</h3>
                <p className="text-xs text-slate-600">Planned, not yet in active build</p>
              </div>
            </div>
            <StatusBadge status="roadmap" />
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP_GROUPS.map((group) => {
              const Icon = GROUP_ICON[group.id];
              return (
                <div key={group.id}>
                  <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-800">
                    <Icon className="h-4 w-4" />
                    {group.label}
                  </h4>
                  <ul className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                        <span
                          aria-hidden
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* -------------------------------------------------- bigger vision */}
      <Reveal delay={100}>
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-brand-900 p-5 text-white shadow-lg sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-700/40 blur-3xl"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-brand-100">
                <SparklesIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">Our bigger vision</h3>
                <p className="text-xs text-brand-100/80">The direction, not the delivery plan</p>
              </div>
            </div>
            <StatusBadge status="vision" />
          </div>

          <p className="relative mt-4 max-w-3xl text-sm leading-relaxed text-brand-100/85">
            Eight long-term ambitions &mdash; from connected facilities to emergency response
            coordination &mdash; describe the direction we are working towards. None of them is
            available in the app today.
          </p>

          <a
            href="#our-vision"
            className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            Read our bigger vision
            <span aria-hidden>&rarr;</span>
          </a>

          <p className="relative mt-6 border-t border-white/15 pt-4 text-xs leading-relaxed text-brand-100/80">
            Emergency response coordination is a future ambition. CareNBuddi does not dispatch
            emergency services today; the app provides verified emergency numbers and guidance.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
