"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button, Field, inputClass } from "@/components/app-ui";
import { AlertIcon, ShieldIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { readLocal, writeLocal } from "@/lib/storage";

/* --------------------------------------------------------- pending sign-up */

/** Remembers which address is waiting for confirmation between screens. */
export const AUTH_PENDING_KEY = "healthlink:auth-pending";

export interface AuthPending {
  email: string;
  at: number;
}

export function readAuthPending(): AuthPending | null {
  return readLocal<AuthPending>(AUTH_PENDING_KEY);
}

export function writeAuthPending(email: string): void {
  writeLocal<AuthPending>(AUTH_PENDING_KEY, { email, at: Date.now() });
}

export function clearAuthPending(): void {
  writeLocal<AuthPending | null>(AUTH_PENDING_KEY, null);
}

/* ------------------------------------------------------------------ blocks */

export function AuthIntro({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center">
      {icon && (
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          {icon}
        </span>
      )}
      <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mx-auto mt-1.5 max-w-[20rem] text-sm leading-relaxed text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-rose-700"
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

export function AuthSuccess({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-green-800">
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

export function OfflineNote() {
  const t = useT();
  return (
    <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
      <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        {t("a_sync_off", "Offline preview - records stay on this device")}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ fields */

export function AuthField({
  label,
  error,
  hint,
  className = "",
  ...props
}: { label: string; error?: string | null; hint?: string; className?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
>) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input {...props} className={`${inputClass} min-h-11 ${className}`} />
    </Field>
  );
}

export function AuthSubmit({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function AuthSwitch({
  question,
  actionLabel,
  href,
}: {
  question: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <p className="text-center text-xs leading-relaxed text-slate-500">
      {question}{" "}
      <Link href={href} className="tap font-semibold text-brand-700 underline">
        {actionLabel}
      </Link>
    </p>
  );
}

/* --------------------------------------------------------------------- otp */

export const OTP_LENGTH = 6;

export function emptyOtp(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export function isOtpComplete(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^\d$/.test(cell));
}

/**
 * Six separate boxes, but one value: typing or pasting a full code spreads it
 * across the boxes, and Backspace walks back through them.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const length = value.length;

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const focus = (index: number) => {
    const el = refs.current[index];
    if (!el) return;
    el.focus();
    el.select();
  };

  const write = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const next = [...value];
    if (digits.length === 0) {
      next[index] = "";
      onChange(next);
      return;
    }
    digits.split("").forEach((digit, offset) => {
      const at = index + offset;
      if (at < length) next[at] = digit;
    });
    onChange(next);
    const target = Math.min(index + digits.length, length - 1);
    if (target > index) focus(target);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...value];
      if (next[index]) next[index] = "";
      else if (index > 0) {
        next[index - 1] = "";
        onChange(next);
        focus(index - 1);
      } else {
        onChange(next);
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focus(index - 1);
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focus(index + 1);
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    write(index, event.clipboardData.getData("text"));
  };

  return (
    <div role="group" aria-label={label} className="grid grid-cols-6 gap-1.5">
      {value.map((cell, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={cell}
          onChange={(event) => write(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          aria-label={`${label} ${index + 1}`}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center text-xl font-bold text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
        />
      ))}
    </div>
  );
}
