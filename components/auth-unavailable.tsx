"use client";

import { ShieldIcon } from "./icons";
import { useT } from "@/lib/i18n";

/**
 * Shown wherever an action needs a trusted authentication service and none is
 * configured.
 *
 * The wording matters. This is not a degraded mode and it must never read as
 * one: the app has no way to check a password, so it refuses rather than
 * pretending. Anything that would imply a working account is deliberately
 * absent from this component — no demo roles, no on-screen codes, no local
 * fallback.
 *
 * `role="status"` announces the change without stealing focus, which matters
 * because this can replace an entire form mid-interaction.
 */
export function AuthUnavailableNote({
  action,
  className = "",
}: {
  /** What the user was trying to do, e.g. "sign in". */
  action?: string;
  className?: string;
}) {
  const t = useT();
  const verb = action
    ? t("authx_unavailable_action", "Secure {action} is temporarily unavailable.").replace(
        "{action}",
        action,
      )
    : t("authx_unavailable", "Secure account access is temporarily unavailable.");

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 ${className}`}
    >
      <p className="flex items-start gap-2 font-semibold">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{verb}</span>
      </p>
      <p className="mt-2 pl-6">
        {t(
          "authx_unavailable_d",
          "Signing in needs an authentication service, and this version of CareNBuddi does not have one connected. We will not sign you in without checking your password.",
        )}
      </p>
      <p className="mt-2 pl-6">
        {t(
          "authx_unavailable_guest",
          "You can keep browsing as a guest. Anything you save stays on this device and is not tied to an online account.",
        )}
      </p>
    </div>
  );
}