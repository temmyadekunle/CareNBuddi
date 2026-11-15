import {
  ActivityIcon,
  BookIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  HeartIcon,
  LanguageIcon,
  SparklesIcon,
  StethoscopeIcon,
} from "@/components/icons";
import { Reveal } from "@/components/marketing/reveal";
import { Section } from "@/components/marketing/section";
import { StatusBadge } from "@/components/marketing/status-badge";

const ACADEMY_FEATURES = [
  { icon: BookIcon, label: "Health education resources" },
  { icon: ActivityIcon, label: "Health awareness programmes" },
  { icon: ChatIcon, label: "Webinars" },
  { icon: LanguageIcon, label: "Health talks" },
  { icon: SparklesIcon, label: "Educational campaigns" },
  { icon: HeartIcon, label: "Wellness learning" },
  { icon: StethoscopeIcon, label: "Professional development" },
  { icon: CheckIcon, label: "Community learning programmes" },
];

/**
 * CareNBuddi Health Academy.
 *
 * A planned learning environment. The copy says so in every block, so no
 * visitor can read this as a working course platform.
 */
export function AcademySection() {
  return (
    <Section
      id="academy"
      eyebrow="Planned learning"
      title="CareNBuddi Health Academy"
      tone="tint"
    >
      <Reveal>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="roadmap" />
              <span className="text-xs font-medium text-slate-500">Planned expansion</span>
            </div>
            <p className="mt-4 text-lg leading-relaxed text-slate-700">
              A dedicated health education and learning environment for patients, families and
              healthcare professionals.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              The Health Academy is where health awareness, practical learning and professional
              development come together across the CareNBuddi ecosystem.
            </p>
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-[13px] leading-relaxed text-amber-900">
                <span className="font-semibold">Not available yet.</span> A complete learning
                platform does not exist today. These are planned capabilities of a future
                CareNBuddi release.
              </p>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {ACADEMY_FEATURES.map((feature) => (
              <li
                key={feature.label}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <feature.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-slate-800">{feature.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Section>
  );
}
