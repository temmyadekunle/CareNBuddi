import type { FeatureStatus } from "@/lib/landing-features";

const LABEL: Record<FeatureStatus, string> = {
  available: "Available now",
  "coming-soon": "Coming soon",
  roadmap: "On our roadmap",
  vision: "Our bigger vision",
};

const STYLES: Record<FeatureStatus, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-600/25",
  "coming-soon": "bg-amber-50 text-amber-900 ring-amber-600/30",
  roadmap: "bg-brand-50 text-brand-800 ring-brand-700/25",
  vision: "bg-white/10 text-white ring-white/30",
};

const DOT: Record<FeatureStatus, string> = {
  available: "bg-emerald-500",
  "coming-soon": "bg-amber-500",
  roadmap: "bg-brand-600",
  vision: "bg-brand-200",
};

/** The single badge used wherever a feature status appears. */
export function StatusBadge({
  status,
  showDot = true,
  className,
}: {
  status: FeatureStatus;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${STYLES[status]} ${className ?? ""}`}
    >
      {showDot ? <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} /> : null}
      {LABEL[status]}
    </span>
  );
}
