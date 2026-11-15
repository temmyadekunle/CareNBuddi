/**
 * Classifies a failed sign-in so the screen can give useful guidance without
 * repeating Supabase's raw message or disclosing whether an account exists.
 *
 * A credentials failure and a network failure need different advice; everything
 * else is treated as credentials because Supabase's invalid-credentials and
 * not-yet-confirmed messages are both "check what you entered, then confirm".
 */

export type SignInFailureKind = "network" | "credentials";

export function classifySignInFailure(message: string | null | undefined): SignInFailureKind {
  const m = (message ?? "").toLowerCase();
  if (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("offline")
  ) {
    return "network";
  }
  return "credentials";
}
