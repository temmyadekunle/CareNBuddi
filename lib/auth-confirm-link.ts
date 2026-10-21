/**
 * Detection and scrubbing of Supabase email-confirmation callbacks.
 *
 * A confirmation email arrives in one of two shapes:
 *
 * 1. An implicit-grant link (the shape Supabase generates by default for
 *    browser clients) whose redirect target carries
 *    `#access_token=...&refresh_token=...&expires_in=...&token_type=bearer`.
 *    The Supabase client consumes this itself when `detectSessionInUrl` is
 *    enabled and the page merely calls `getSession()`; this module only
 *    detects that the URL in fact was such a callback and cleans it up, so
 *    the raw tokens never linger in the address bar or in history.
 *
 * 2. An OTP-hash link of the form
 *    `?token_hash=<hash>&type=signup|email_change&next=...`, which the client
 *    has to verify explicitly with `verifyOtp({ token_hash, type })`.
 *
 * This module is pure — it never touches `window` and never logs — so the
 * URL-shape decisions (including the same-site `next` rule) are unit-testable
 * the same way lib/post-auth.ts is. The verify screen decides *what to do*
 * with whatever this returns; here we only decide *what the URL is*.
 */

/** `next` values must be same-site paths — identical rule to the sign-in and sign-up screens. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  /* "Browsers historically treat /\ as //, and some runtimes map backslashes
     onto forward slashes before resolution — so anything containing a
     backslash is treated as a proto-relative URL and rejected. Control
     characters can make an URL disagree with itself between components. */
  if (value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export type ConfirmOtpType = "signup" | "email";

/**
 * What a URL says about being an email-confirmation callback.
 *
 * - "implicit": a hash grant the Supabase client has to consume. No token
 *   material is ever echoed back here by design.
 * - "otp-hash": a `token_hash` link this page must verify explicitly.
 * - "error": the URL announces a failed callback (error params). The raw
 *   description from the URL is deliberately kept out of React state — it is
 *   attacker-craftable text and its full content is nobody's business; the
 *   screen shows its own message instead.
 * - "none": an ordinary page load with no confirmation material at all.
 */
export type ConfirmLink =
  | { kind: "none" }
  | { kind: "implicit" }
  | { kind: "otp-hash"; tokenHash: string; type: ConfirmOtpType }
  | { kind: "error" };

const ALLOWED_OTP_TYPES = new Set<string>(["signup", "email", "email_change", "invite", "recovery", "magiclink"]);
const HASH_TOKEN_FIELDS = new Set(["access_token", "refresh_token", "expires_in", "expires_at", "token_type"]);

/**
 * Classify one URL. Only ever returns *kinds* and a token **hash** — never an
 * access token, never a refresh token.
 */
export function detectConfirmLink(href: string): ConfirmLink {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "none" };
  }

  const query = url.searchParams;

  if (query.has("error") || query.has("error_description") || query.has("error_code")) {
    return { kind: "error" };
  }

  const tokenHash = query.get("token_hash");
  if (tokenHash) {
    const raw = query.get("type") ?? "signup";
    if (!ALLOWED_OTP_TYPES.has(raw)) return { kind: "error" };
    // Only the two types that verify an email address on signup return a
    // session that can be adopted into the app; other link types are verified
    // but must not be treated as "you are confirmed" navigation triggers.
    if (raw !== "signup" && raw !== "email") {
      return { kind: "error" };
    }
    return { kind: "otp-hash", tokenHash, type: raw as ConfirmOtpType };
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const field of HASH_TOKEN_FIELDS) {
    if (hashParams.get(field)) return { kind: "implicit" };
  }

  return { kind: "none" };
}

/**
 * A URL with every confirmation parameter removed, safe to write to the
 * address bar with `history.replaceState` before any async verification
 * starts. This is what guarantees a refresh (or a link sent to somebody)
 * cannot re-run the same callback: by the time anything async happens the
 * token material is already gone.
 *
 * - implicit grant: the entire hash is dropped.
 * - otp-hash: `token_hash` and `type` are dropped, `email`/`error` params are
 *   dropped, everything else (notably a same-site `next`) is preserved.
 * - error: the three error params are dropped.
 */
export function scrubConfirmParams(href: string): string {
  try {
    const url = new URL(href);
    url.hash = "";
    for (const field of ["token_hash", "type", "email", "error", "error_description", "error_code", "code"]) {
      url.searchParams.delete(field);
    }
    return url.toString();
  } catch {
    return href;
  }
}
