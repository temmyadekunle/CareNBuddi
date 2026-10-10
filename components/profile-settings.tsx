"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/app-ui";

export const UNITS_KEY = "healthlink:prefs-units";
export const NOTIFICATIONS_KEY = "healthlink:prefs-notifications";

export type Units = "metric" | "imperial";

export interface NotificationPrefs {
  appointments: boolean;
  medication: boolean;
  tips: boolean;
}

export interface PassportPrefs {
  hmo: string;
  emergencyContact: string;
  emergencyPhone: string;
  nin: string;
  bvn: string;
}

export const PASSPORT_DEFAULTS: PassportPrefs = {
  hmo: "",
  emergencyContact: "",
  emergencyPhone: "",
  nin: "",
  bvn: "",
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  appointments: true,
  medication: true,
  tips: false,
};

const TONES = {
  brand: "bg-brand-50 text-brand-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
} as const;

type Tone = keyof typeof TONES;

export function SwitchRow({
  icon,
  tone,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className="flex min-h-11 shrink-0 items-center">
        <Switch checked={checked} onChange={onChange} label={title} />
      </span>
    </div>
  );
}

export function PrivacyBlock({
  icon,
  tone,
  title,
  body,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  );
}
