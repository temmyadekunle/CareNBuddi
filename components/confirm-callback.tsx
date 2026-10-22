"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import {
  detectConfirmLink,
  safeNext,
  scrubConfirmParams,
} from "@/lib/auth-confirm-link";
import { landingPathFor } from "@/lib/post-auth";
import { getSupabase, isCloudEnabled } from "@/lib/supabase/client";
import { fetchProfile } from "@/lib/supabase/sync";
import { confirmedUserMatches } from "@/lib/confirm-user-check";
import { clearAuthPending } from "@/components/auth-form";
import { useProviderApplications } from "@/lib/use-provider-application";
import { useT } from "@/lib/i18n";

/**
 * Consume an email-confirmation callback that landed outside the auth screens.
 *
 * The auth/verify screen already handles callbacks that arrive on
 * /auth/verify, and the (app) shell restores sessions on its own. But a
 * confirmation link whose redirect target is the site root (for example when
 * an email template no longer carries the client's redirect_to, or a link
 * created before redirect targets were configured) lands here, on the
 * marketing screens, where nothing used to consume the session in the URL —
 * leaving the account unconfirmed and the user stranded on the landing page.
 *
 * This component is mounted only where the verify screen is NOT, receives the
 * same treatment as the verify screen, and is a no-op unless the URL actually
 * carries confirmation material:
 *  - implicit-grant links are validated by the Supabase client itself
 *    (server-side verification, URL cleaned by the SDK),
 *  - token-hash links are verified explicitly and the URL is scrubbed before
 *    any await,
 *  - everything token-shaped is dropped from the address bar; nothing is
 *    logged or kept in state.
 *
 * Failure cannot silently look like success: it routes to /auth/verify, where
 * the six-digit code path can finish the job the link could not.
 */
export function ConfirmCallbackConsumer() {
  const t = useT();
  const router = useRouter();
  const { forUser } = useProviderApplications();
  // The only synchronous classification happens at first client render from
  // the URL alone — no network, no client construction. Effects then only set
  // state after awaits, from real auth results.
  const [status, setStatus] = useState<"confirming" | "confirmed" | "failed" | null>(() => {
    if (typeof window === "undefined") return null;
    return detectConfirmLink(window.location.href).kind === "none" ? null : "confirming";
  });
  const handled = useRef(false);

  const go = useCallback(
    (userId: string, delayMs = 1400) => {
      void (async () => {
        const params = new URLSearchParams(new URL(window.location.href).search);
        const next = safeNext(params.get("next"));
        let path: string;
        if (next) {
          path = next;
        } else {
          try {
            const profile = await fetchProfile(userId);
            path = landingPathFor(
              { id: userId, role: profile?.role ?? "consumer" },
              forUser(userId),
            );
          } catch {
            path = "/app";
          }
        }
        setTimeout(() => router.push(path), delayMs);
      })();
    },
    [forUser, router],
  );

  useEffect(() => {
    if (!isCloudEnabled || handled.current) return;
    handled.current = true;

    const supabase = getSupabase();
    if (!supabase) return;

    const info = detectConfirmLink(window.location.href);
    if (info.kind === "none") return;

    clearAuthPending();

    void (async () => {
      // Yield before touching React state so no status transition is
      // synchronous inside an effect body.
      await Promise.resolve();

      const fail = () => {
        window.history.replaceState(window.history.state, "", scrubConfirmParams(window.location.href));
        setStatus("failed");
        setTimeout(() => router.push("/auth/verify"), 1800);
      };

      try {
        if (info.kind === "error") {
          throw new Error("Confirmation callback reported an error");}
        if (info.kind === "implicit") {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error("No session in confirmation callback");
          // Belt and braces on top of the SDK's own URL-token verification:
          // re-fetch the identity from the server and fail closed unless the
          // session and identity agree.
          const { data: verified, error: verifyError } = await supabase.auth.getUser();
          if (verifyError) throw verifyError;
          if (!confirmedUserMatches(data.session.user, verified?.user ?? null)) {
            throw new Error("Session identity did not match the verified user");
          }
          setStatus("confirmed");
          go(data.session.user.id);
          return;
        }
        window.history.replaceState(window.history.state, "", scrubConfirmParams(window.location.href));
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: info.tokenHash,
          type: info.type,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Confirmation did not return a user");
        setStatus("confirmed");
        go(data.user.id);
      } catch {
        fail();
      }
    })();
  }, [t, go, router]);

  if (!status) return null;

  const message =
    status === "failed"
      ? t(
          "auth_callback_failed",
          "That confirmation link could not be completed. Taking you to enter your code…",
        )
      : status === "confirmed"
        ? t("auth_confirmed", "Email confirmed")
        : t(
            "auth_callback_working",
            "Confirming your account — please do not close this tab…",
          );

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-3 bottom-4 z-50 mx-auto flex w-fit max-w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
        status === "failed"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-brand-200 bg-white text-brand-800"
      }`}
    >
      {status === "failed" ? (
        <ShieldIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {message}
        {status === "confirmed" &&
          " " + t("auth_verified_redirect", "Redirecting you to CareNBuddi…")}
      </span>
    </div>
  );
}
