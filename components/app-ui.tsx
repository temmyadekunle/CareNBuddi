"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  StarIcon,
} from "@/components/icons";

/* ------------------------------------------------------------------ layout */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="animate-fade-rise px-4 pb-6 pt-3 flex-1">
      {children}
    </div>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-18px_rgba(15,23,42,0.25)] ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  href,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="mb-2.5 mt-6 flex items-end justify-between gap-3 first:mt-0">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action &&
        (href ? (
          <Link
            href={href}
            className="tap flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-700"
          >
            {action}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-brand-700">{action}</span>
        ))}
    </div>
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

const TONES: Record<ButtonTone, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

export function Button({
  children,
  tone = "primary",
  className = "",
  full,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone; full?: boolean }) {
  return (
    <button
      {...props}
      className={`tap inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${TONES[tone]} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      {...props}
      className={`tap inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  onClick,
  className = "",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold ${
        active
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- lists */

export function ListRow({
  icon,
  title,
  subtitle,
  meta,
  href,
  onClick,
  chevron = true,
  tone = "brand",
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  tone?: "brand" | "green" | "coral" | "slate" | "rose";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-green-50 text-green-700",
    coral: "bg-coral-50 text-coral-700",
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-50 text-rose-700",
  };
  const inner = (
    <>
      {icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>}
      </span>
      {meta}
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />}
    </>
  );
  const cls =
    "tap flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50";

  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "brand" | "green" | "amber" | "rose" | "slate";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Rating({ value, reviews }: { value: number; reviews?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
      <StarIcon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
      {reviews !== undefined && <span className="font-normal text-slate-400">({reviews})</span>}
    </span>
  );
}

/* -------------------------------------------------------------- feedback */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function SkeletonCards({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="mt-3 h-8 w-full" />
        </Card>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </span>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {body && <p className="max-w-[16rem] text-xs text-slate-500">{body}</p>}
      {action}
    </Card>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertIcon className="h-6 w-6" />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {body && <p className="max-w-[16rem] text-xs text-slate-500">{body}</p>}
      {onRetry && (
        <Button tone="secondary" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`tap relative min-h-9 shrink-0 rounded-full px-4 text-xs font-semibold ${
              active
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 ${active ? "text-white/70" : "text-slate-400"}`}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-slate-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`tap min-h-9 flex-1 rounded-lg text-xs font-semibold ${
            value === opt.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- overlays */

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-backdrop-in absolute inset-0 bg-slate-900/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-in relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-white px-4 pb-5 pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        {title && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <IconButton label="Close" onClick={onClose} className="h-8 w-8">
              <CloseIcon className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        {children}
        {footer && <div className="safe-bottom mt-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Close" onClick={onCancel} className="animate-backdrop-in absolute inset-0 bg-slate-900/45" />
      <div className="animate-sheet-in relative w-full max-w-[19rem] rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {body && <p className="mt-1.5 text-sm text-slate-600">{body}</p>}
        <div className="mt-5 flex gap-2">
          <Button tone="secondary" full onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button tone={tone === "danger" ? "danger" : "primary"} full onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

const ToastContext = createContext<{ push: (message: string, tone?: Toast["tone"]) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`animate-toast-in flex w-full max-w-[20rem] items-start gap-2 rounded-xl px-3.5 py-3 text-xs font-medium shadow-lg ${
              toast.tone === "success"
                ? "bg-slate-900 text-white"
                : toast.tone === "error"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-800 text-white"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* ------------------------------------------------------------------ inputs */

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`tap relative h-7 w-12 shrink-0 rounded-full ${checked ? "bg-brand-600" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ avatar */

const SKIN = ["#8d5524", "#a86a33", "#c68642", "#e0ac69"];
const HAIR = ["#1c1310", "#2b1b12", "#3d2415", "#120d0b"];

/**
 * Original flat illustrations rather than stock photography: no licensing
 * questions, no network requests, and they read clearly at 40px.
 */
export function Avatar({
  name,
  role = "patient",
  size = 44,
  seed = 0,
}: {
  name: string;
  role?: "doctor" | "nurse" | "patient";
  size?: number;
  seed?: number;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const skin = SKIN[seed % SKIN.length];
  const hair = HAIR[(seed + 1) % HAIR.length];
  const coat = role === "doctor" ? "#ffffff" : role === "nurse" ? "#e8f6f4" : "#dbe7f5";
  const coatEdge = role === "doctor" ? "#cbd5e1" : role === "nurse" ? "#bfe3df" : "#c7d7ea";

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, background: coat, border: `1px solid ${coatEdge}` }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
        <circle cx="24" cy="24" r="24" fill={coat} />
        {role !== "patient" && (
          <path d="M8 48c0-8.8 7.2-16 16-16s16 7.2 16 16Z" fill={coat} stroke={coatEdge} strokeWidth="1" />
        )}
        <circle cx="24" cy="20" r="10" fill={skin} />
        <path
          d="M14 19c0-6 4.5-10 10-10s10 4 10 10c-2-3-4-4.5-10-4.5S16 16 14 19Z"
          fill={hair}
        />
        {role !== "patient" && (
          <>
            <path d="M18.5 36h5l-2.5 6Z" fill={skin} />
            <path d="M24 33.5 25.5 39h-3Z" fill="#087F8C" />
          </>
        )}
      </svg>
      <span className="sr-only">{initials}</span>
    </span>
  );
}

/**
 * Larger, friendlier avatar for the profile header. Pass `src` to show the
 * person's own photo instead of the generated illustration.
 */
export function AvatarLarge({
  name,
  size = 84,
  src,
}: {
  name: string;
  size?: number;
  src?: string | null;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      // A profile photo is a data URL the user just picked on this device, so
      // there is no network request to optimise and next/image cannot process it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-4 ring-white"
        style={{ width: size, height: size }}
      />
    );
  }

  const skin = SKIN[name.length % SKIN.length];
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-4 ring-white"
      style={{ width: size, height: size, background: "#EAF7F5" }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
        <circle cx="24" cy="24" r="24" fill="#EAF7F5" />
        <path d="M6 48c0-9.9 8.1-18 18-18s18 8.1 18 18Z" fill={skin} />
        <circle cx="24" cy="19" r="10.5" fill={skin} />
        <path
          d="M13.5 18c0-6.4 4.7-10.5 10.5-10.5S34.5 11.6 34.5 18c-2.2-3.4-4.6-5-10.5-5s-8.3 1.6-10.5 5Z"
          fill="#1c1310"
        />
      </svg>
      <span className="sr-only">{initials}</span>
    </span>
  );
}