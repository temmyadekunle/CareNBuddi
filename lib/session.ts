import {
  currentPrincipal,
  keysForPrincipal,
  principalForUser,
  purgePrincipal,
  rotateGuestId,
  type Principal,
} from "./storage-scope";
import { dropCacheForPrincipal } from "./storage";

/**
 * Ending a session.
 *
 * There were four sign-out implementations and none of them removed anything
 * from the device, so the next person to open the app read the previous
 * person's records. This is the single operation they all call now.
 *
 * ## What this is, and what it is not
 *
 * This is client-side cleanup. It removes the signed-in user's private data
 * from the browser and stops the app displaying it.
 *
 * It is NOT sign-out as an authentication control. With no authentication
 * service configured there is no session token to revoke and no server-side
 * state to invalidate - nothing has left the device, so nothing needs
 * revoking *there*. Until a real authentication service exists, a determined
 * person with devtools can still read anything they previously wrote. Treat
 * this as data minimisation, not as a guarantee.
 */

export type SessionEndReason =
  | "signout"
  /** The authentication service reported the session is no longer valid. */
  | "expired"
  | "switch-account"
  | "provider-review";

export interface SessionEndResult {
  reason: SessionEndReason;
  /** Whose data was removed. */
  principal: Principal["kind"];
  /** Which principal was actually acted on, for callers auditing the outcome. */
  userId: string | null;
  /** How many private keys were deleted from storage. */
  removed: number;
  /** How many in-memory cache entries were dropped. */
  invalidated: number;
  /** Keys deliberately kept: preferences, catalogues, the account registry. */
  preserved: string[];
}

/**
 * Keys that are intentionally never deleted by sign-out.
 *
 * Theme, units and the language choice are device preferences - wiping them
 * every time someone signs out is hostile and loses nothing sensitive. The
 * account registry stays too, because `healthlink:users` is how the device
 * knows which accounts exist; it holds names and email addresses, which is a
 * recorded residual risk rather than something this function can fix.
 */
const PRESERVED_PREFIXES = [
  "healthlink:theme",
  "healthlink:prefs-units",
  "healthlink:prefs-notifications",
  "healthlink:onboarded",
  "healthlink:guide-events",
  "healthlink:geocode-cache",
  "healthlink:worker-online",
  "healthlink:health-days",
  "healthlink:users",
  "healthlink:providers",
  "healthlink:topics",
  "healthlink:session",
  "healthlink:guest-id",
  "healthlink:scoped-migration-v1",
];

function isPreserved(key: string): boolean {
  if (key.startsWith("healthlink:quarantine:")) return true;
  if (key.startsWith("healthlink:synced-at:")) return true;
  return PRESERVED_PREFIXES.some((p) => key === p || key.startsWith(`${p}:`));
}

/**
 * Re-entrancy guard.
 *
 * An expired session can produce more than one event, and the auth listener,
 * the sign-out buttons and a manual call can overlap. A second pass must not
 * start deleting while the first is mid-flight, or the second would resolve a
 * different principal (the session pointer is gone by then) and purge the
 * guest namespace instead.
 */
let cleaning = false;

function emptyResult(reason: SessionEndReason): SessionEndResult {
  return { reason, principal: "none", userId: null, removed: 0, invalidated: 0, preserved: [] };
}

/**
 * Ends a session for an explicitly named principal.
 *
 * Use this when the owner of the data is known rather than discoverable -
 * an expired authentication session, for example, where the SDK has already
 * cleared the active session and `healthlink:session` may already point at
 * the guest. Passing the wrong principal here is worse than doing nothing:
 * it would delete somebody else's namespace.
 */
export function endSessionFor(
  principal: Principal,
  reason: SessionEndReason = "signout",
): SessionEndResult {
  if (cleaning || principal.kind === "none") return emptyResult(reason);
  cleaning = true;
  try {
    // Purge first, then drop the in-memory copies. Both orderings are safe
    // because `dropCacheForPrincipal` keys off the principal we were given,
    // not off whatever the session pointer says now - the previous version of
    // this loop ran after the purge and so resolved against the guest, leaving
    // the departing user's stale records in memory where useSyncExternalStore
    // would keep serving them.
    const removed = purgePrincipal(principal);
    const dropped = dropCacheForPrincipal(principal);

    const preserved: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && isPreserved(k)) preserved.push(k);
      }
    } catch {
      /* storage unavailable; nothing else to do */
    }

    // The session pointer goes last: while it is present, `resolve()` in
    // storage.ts would keep reading the namespace we just emptied.
    //
    // Only remove it when it still names this principal. If another account
    // has signed in since, their session must not be torn down by our
    // cleanup.
    try {
      const raw = localStorage.getItem("healthlink:session");
      const current = raw ? (JSON.parse(raw) as { userId?: unknown }).userId : null;
      if (principal.kind === "user" && current === principal.userId) {
        localStorage.removeItem("healthlink:session");
      } else if (principal.kind === "guest") {
        localStorage.removeItem("healthlink:session");
      }
    } catch {
      /* ignore */
    }

    // A guest visitor who leaves hands the next guest an empty namespace
    // rather than whatever they typed.
    try {
      if (principal.kind === "guest") {
        sessionStorage.removeItem(
          `healthlink:guest:${principal.guestId}:support-active`,
        );
      }
      rotateGuestId();
    } catch {
      /* ignore */
    }

    return {
      reason,
      principal: principal.kind,
      userId: principal.kind === "user" ? principal.userId : null,
      removed,
      invalidated: dropped.length,
      preserved,
    };
  } finally {
    cleaning = false;
  }
}

/**
 * Ends the session that storage says is current.
 *
 * Correct for an explicit sign-out, where the session pointer is still ours.
 * For an expired or remotely revoked authentication session use
 * `endSessionFor(principalForUser(userId), "expired")` instead, because by
 * then the pointer may no longer name the right person.
 *
 * Deliberately does not call `localStorage.clear()`: that would take the
 * user's language and theme with it, and would look like a fix while quietly
 * destroying unrelated state.
 */
export function endSession(reason: SessionEndReason = "signout"): SessionEndResult {
  return endSessionFor(currentPrincipal(), reason);
}

/**
 * Ends the named user's session. Convenience wrapper for the auth listener.
 */
export function endUserSession(
  userId: string | null | undefined,
  reason: SessionEndReason = "expired",
): SessionEndResult {
  if (!userId) return emptyResult(reason);
  return endSessionFor(principalForUser(userId), reason);
}

/** Counts what a sign-out would remove, without removing it. Used by tests. */
export function pendingPrivateKeys(): number {
  return keysForPrincipal(currentPrincipal()).length;
}