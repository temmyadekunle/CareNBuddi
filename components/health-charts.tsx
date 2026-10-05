import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Hand-rolled, dependency-free chart primitives sized for a phone screen.
 * Everything is inline SVG or CSS so a dashboard can render dozens of them
 * without pulling a charting runtime into the bundle.
 */

export type ChartTone = "brand" | "green" | "amber" | "rose" | "coral" | "slate";

/** Stroke colour for SVG marks — applied via `text-*` so `currentColor` works. */
const TONE_TEXT: Record<ChartTone, string> = {
  brand: "text-brand-600",
  green: "text-green-700",
  amber: "text-amber-600",
  rose: "text-rose-600",
  coral: "text-coral-700",
  slate: "text-slate-400",
};

/** Fill colour for bars. */
const TONE_BAR: Record<ChartTone, string> = {
  brand: "bg-brand-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  coral: "bg-coral-500",
  slate: "bg-slate-400",
};

/** Soft tinted chip for the icon affordance. */
const TONE_SOFT: Record<ChartTone, string> = {
  brand: "bg-brand-50 text-brand-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  coral: "bg-coral-50 text-coral-700",
  slate: "bg-slate-100 text-slate-600",
};

/** Trend chips are coloured by favourability, not by the metric's identity. */
const TREND_CHIP = {
  good: "bg-green-50 text-green-700",
  bad: "bg-rose-50 text-rose-700",
  flat: "bg-slate-100 text-slate-600",
} as const;

export type TrendTone = keyof typeof TREND_CHIP;

const SPARK_W = 100;
const SPARK_H = 32;
const SPARK_PAD = 4;

const PANEL =
  "block rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-18px_rgba(15,23,42,0.25)]";

function fix(n: number): number {
  return Math.round(n * 100) / 100;
}

function finite(values: number[]): number[] {
  return values.filter((v) => typeof v === "number" && Number.isFinite(v));
}

/** Catmull-Rom control points converted to cubic beziers — no wobble at the ends. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${fix(pts[0][0])},${fix(pts[0][1])}`;
  let d = `M${fix(pts[0][0])},${fix(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${fix(c1x)},${fix(c1y)} ${fix(c2x)},${fix(c2y)} ${fix(p2[0])},${fix(p2[1])}`;
  }
  return d;
}

function toPoints(values: number[]): [number, number][] {
  const n = values.length;
  if (n === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const spanX = SPARK_W - SPARK_PAD * 2;
  const spanY = SPARK_H - SPARK_PAD * 2;
  return values.map((v, i) => {
    const x = n === 1 ? SPARK_W / 2 : SPARK_PAD + (i / (n - 1)) * spanX;
    const y = span === 0 ? SPARK_H / 2 : SPARK_PAD + (1 - (v - min) / span) * spanY;
    return [fix(x), fix(y)];
  });
}

/* --------------------------------------------------------------- sparkline */

/**
 * Smooth line + soft area over a 64px band. No axes, no labels, no library —
 * just the shape of the trend. Renders nothing when there is no data.
 */
export function Sparkline({
  points,
  tone = "brand",
  className = "",
}: {
  points: number[];
  tone?: ChartTone;
  className?: string;
}) {
  const values = finite(points);
  const pts = toPoints(values);

  if (pts.length < 2) {
    return <div className={`h-16 w-full ${className}`} aria-hidden />;
  }

  const line = smoothPath(pts);
  const area = `${line} L${fix(pts[pts.length - 1][0])},${SPARK_H} L${fix(pts[0][0])},${SPARK_H} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      aria-hidden
      className={`h-16 w-full overflow-visible ${TONE_TEXT[tone]} ${className}`}
    >
      <path d={area} fill="currentColor" fillOpacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill="currentColor" />
    </svg>
  );
}

/* ---------------------------------------------------------------- minibars */

/** Compact bar history for steps / sleep. The newest bar is highlighted. */
export function MiniBars({
  values,
  tone = "brand",
  className = "",
}: {
  values: number[];
  tone?: ChartTone;
  className?: string;
}) {
  const vals = finite(values);

  if (vals.length === 0) {
    return <div className={`h-11 w-full ${className}`} aria-hidden />;
  }

  const max = Math.max(...vals, 1);

  return (
    <div className={`flex h-11 items-end ${className}`} aria-hidden>
      {vals.map((v, i) => {
        const height = Math.max(4, Math.round((v / max) * 44));
        const newest = i === vals.length - 1;
        return (
          <span key={i} className="flex h-full flex-1 items-end justify-center">
            <span
              style={{ height: `${height}px` }}
              className={`w-[62%] max-w-[14px] rounded-full ${
                newest ? TONE_BAR[tone] : "bg-slate-200"
              }`}
            />
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- ring */

/** Circular progress ring. The centre shows the percentage, `label` sits below. */
export function Ring({
  value,
  max,
  label,
  tone = "brand",
  caption,
}: {
  value: number;
  max: number;
  label: string;
  tone?: ChartTone;
  caption?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const r = 20;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className={`relative flex h-[76px] w-[76px] items-center justify-center ${TONE_TEXT[tone]}`}>
        <svg viewBox="0 0 48 48" aria-hidden className="h-[76px] w-[76px] -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.16}
            strokeWidth={4}
          />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={fix(circumference)}
            strokeDashoffset={fix(circumference * (1 - ratio))}
          />
        </svg>
        <span className="absolute text-[15px] font-bold leading-none tracking-tight text-slate-900">
          {Math.round(ratio * 100)}%
        </span>
      </div>
      <p className="mt-2 w-full truncate text-center text-[11px] font-semibold text-slate-700">
        {label}
      </p>
      {caption && (
        <p className="mt-0.5 w-full truncate text-center text-[10px] text-slate-500">
          {caption}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------- measurement tile */

/**
 * One measurement card: icon + label, a big value, an optional trend chip and
 * an optional sparkline. Renders as a link when `href` is supplied.
 */
export function MeasurementTile({
  icon,
  label,
  value,
  unit,
  trend,
  trendTone = "flat",
  tone = "brand",
  spark,
  href,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendTone?: TrendTone;
  tone?: ChartTone;
  spark?: number[];
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_SOFT[tone]}`}
          >
            {icon}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-1.5">
        <p className="min-w-0 truncate text-[21px] font-bold leading-none tracking-tight text-slate-900">
          {value}
          {unit && (
            <span className="ml-1 align-baseline text-[11px] font-semibold text-slate-400">
              {unit}
            </span>
          )}
        </p>
        {trend && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-tight ${TREND_CHIP[trendTone]}`}
          >
            {trend}
          </span>
        )}
      </div>

      {spark && spark.length > 1 && (
        <div className="mt-2">
          <Sparkline points={spark} tone={tone} />
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${PANEL} tap h-full hover:border-brand-300`}>
        {body}
      </Link>
    );
  }

  return <div className={PANEL}>{body}</div>;
}
