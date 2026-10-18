/**
 * Storage scoping: which principal owns a given collection.
 *
 * The app keeps personal data in the browser. Before this module every
 * collection lived at one flat key (`healthlink:records`, `healthlink:journal`,
 * ...), so anyone who opened the app on the same device read the previous
 * person's records - and signing out changed nothing on disk.
 *
 * Private collections are now addressed by owner:
 *
 *     healthlink:u:<userId>:<collection>       a signed-in account
 *     healthlink:guest:<guestId>:<collection>   an unsigned-in visitor
 *
 * ## What this does and does not buy you
 *
 * It prevents *accidental* cross-person exposure: a shared family phone, a
 * sign-out that forgot to clean up, switching between two accounts, a guest
 * wandering into the previous user's data.
 *
 * It is NOT a security boundary and must never be described as one. Every key
 * is still readable by anyone with devtools or file access, and the userId in
 * the session is still attacker-supplied until a real authentication service
 * exists. Tampering with `healthlink:session` to name another userId yields
 * that user's namespace - which is exactly the data they could read by opening
 * the storage inspector anyway. The difference is that the app no longer
 * *hands* it to them.
 *
 * Real protection comes from server-side authorisation (see
 * CARENBUDDI_SECURITY_REMEDIATION_PLAN.md).
 */

/* ------------------------------------------------------------ classification */

/**
 * Class A - sensitive health or identity information.
 *
 * These belong to exactly one person and must never be visible to anyone else:
 * clinical records, reproductive and mental health, medication, measurements,
 * biometrics, appointments, and anything carrying a provider's identity or
 * professional credentials.
 */
const PRIVATE_KEYS = new Set([
  // clinical and health records
  "healthlink:journal",
  "healthlink:records",
  "healthlink:reminders",
  "healthlink:passport",
  "healthlink:care-circle",
  // wellness
  "healthlink:menstrual-cycles",
  "healthlink:mood-entries",
  "healthlink:symptom-entries",
  "healthlink:health-preferences",
  "healthlink:fitness-profile",
  "healthlink:workouts",
  "healthlink:weigh-ins",
  "healthlink:exercise-reminder",
  // biometrics
  "healthlink:profile-photos",
  // appointments and care relationships (name, phone, reason for visit)
  "healthlink:bookings",
  // identity and professional credentials, including NIN
  "healthlink:provider-applications",
  "healthlink:auth-pending",
  // support transcripts (free-text health content plus contact details)
  "healthlink:support-conversations",
  "healthlink:support-messages",
  "healthlink:support-tickets",
  // community screening data
  "healthlink:worker-log",
  // practice configuration belongs to one provider
  "healthlink:practice-settings",
  // sessionStorage: which support thread the user has open
  "healthlink:support-active",
]);

/**
 * Keys that intentionally stay device-wide.
 *
 * - `healthlink:session` is how the principal is resolved at all; namespacing
 *   it would be circular.
 * - `healthlink:users` is this device's account registry. AppGuard resolves the
 *   session against it and registration detects duplicate emails, so it has to
 *   be visible to the whole device. It does hold names, emails and phone
 *   numbers, which is a known residual risk recorded in the report - it goes
 *   away once accounts live on a server.
 * - `healthlink:providers` and `healthlink:topics` are public catalogues.
 * - `healthlink:provider-requests` holds facility applications and
 *   `healthlink:reports` holds user-submitted reports. Both are read by the
 *   staff review screens, which have no server behind them and would find
 *   nothing if these were namespaced. They hold contact details, so this is a
 *   recorded residual risk rather than a clean bill of health.
 * - everything else is a preference with no personal content.
 */
export function isPrivateKey(key: string): boolean {
  return PRIVATE_KEYS.has(key);
}

/** Every private key, for cache eviction and for callers that need the list. */
export function privateKeys(): string[] {
  return [...PRIVATE_KEYS];
}

/**
 * The principal for a known user id, without consulting current storage.
 *
 * Needed when the session has already been torn down — an expired Supabase
 * session, for instance — and the owner of the data being purged is no longer
 * discoverable from `healthlink:session`. Without this, cleanup would resolve
 * the guest namespace and quietly delete the wrong person's keys, or none.
 */
export function principalForUser(userId: string): Principal {
  if (!userId) return { kind: "none", namespace: null };
  return {
    kind: "user",
    userId,
    namespace: `${USER_NS}${encodeURIComponent(userId)}:`,
  };
}

/* ------------------------------------------------------------- principals */

export type Principal =
  | { kind: "user"; userId: string; namespace: string }
  | { kind: "guest"; guestId: string; namespace: string }
  | { kind: "none"; namespace: null };



export const SESSION_KEY = "healthlink:session";
export const GUEST_ID_KEY = "healthlink:guest-id";
const USER_NS = "healthlink:u:";
const GUEST_NS = "healthlink:guest:";

/** Reads the raw session without going through the resolver below. */
function rawSession(): { userId?: unknown } | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as { userId?: unknown };
  } catch {
    // Malformed session state must not throw and must not resolve to an owner.
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The guest identifier for this browser, created on first use.
 *
 * It is a random handle, not a credential: it says "the visitor currently
 * using this device", nothing about who they are. It is rotated whenever a
 * guest session ends so a later visitor starts from an empty namespace.
 */
export function guestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomId();
    localStorage.setItem(GUEST_ID_KEY, next);
    return next;
  } catch {
    // Storage unavailable. The caller still gets a namespace, just not a
    // persistent one, which fails closed rather than falling back to a
    // shared key.
    return randomId();
  }
}

/** Replaces the guest identifier so the next guest starts empty. */
export function rotateGuestId(): void {
  try {
    localStorage.removeItem(GUEST_ID_KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Who owns data on this device right now.
 *
 * A malformed or missing userId falls through to the guest namespace rather
 * than to some shared default, so unrecognised ownership information fails
 * closed.
 */
export function currentPrincipal(): Principal {
  const session = rawSession();
  const userId = session?.userId;
  if (typeof userId === "string" && userId.length > 0) {
    return {
      kind: "user",
      userId,
      namespace: `${USER_NS}${encodeURIComponent(userId)}:`,
    };
  }
  const id = guestId();
  return { kind: "guest", guestId: id, namespace: `${GUEST_NS}${encodeURIComponent(id)}:` };
}

/**
 * The real storage key for a collection under a given principal.
 *
 * Non-private keys are returned untouched so preferences keep working exactly
 * as before.
 */
export function scopedKey(principal: Principal, key: string): string {
  if (!isPrivateKey(key)) return key;
  if (!principal.namespace) return key;
  return principal.namespace + key.slice("healthlink:".length);
}

/** Convenience: resolve a collection against the principal right now. */
export function currentScopedKey(key: string): string {
  return scopedKey(currentPrincipal(), key);
}

/** Every key belonging to a principal. Used by sign-out. */
export function keysForPrincipal(principal: Principal): string[] {
  if (principal.kind === "none") return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(principal.namespace)) out.push(k);
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

/** Removes every key belonging to a principal. Returns how many went. */
export function purgePrincipal(principal: Principal): number {
  const keys = keysForPrincipal(principal);
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* keep going: one failure should not strand the rest */
    }
  }
  return keys.length;
}

/* -------------------------------------------------------------- quarantine */

/** Where unscoped legacy data is parked. Never read by ordinary app flow. */
export const QUARANTINE_NS = "healthlink:quarantine:";
const MIGRATION_FLAG = "healthlink:scoped-migration-v1";

function quarantineKey(key: string): string {
  return QUARANTINE_NS + key.slice("healthlink:".length);
}

/**
 * Parks pre-existing unscoped private data instead of attributing it.
 *
 * The old keys have no recorded owner, so nobody can say whose journal or
 * menstrual history they are. Copying them into whichever account signs in
 * next would hand one person's health records to another, which is precisely
 * the failure this module exists to stop - and it would do it invisibly, to
 * the first person who happened to open the app.
 *
 * So legacy data is moved aside to a quarantine namespace that no application
 * screen reads. Nothing is destroyed: the report documents how a user can
 * recover their own records deliberately.
 *
 * Idempotent by construction. Once the flag is set nothing moves again, and a
 * key that is already in quarantine is never overwritten by a repeat run.
 */
export function quarantineLegacyData(): { moved: string[]; skipped: string[] } {
  const moved: string[] = [];
  const skipped: string[] = [];

  let alreadyDone = false;
  try {
    alreadyDone = localStorage.getItem(MIGRATION_FLAG) === "1";
  } catch {
    /* treat as not done */
  }

  for (const key of PRIVATE_KEYS) {
    const target = quarantineKey(key);
    let raw: string | null = null;
    let targetAlreadyExists = false;
    try {
      targetAlreadyExists = localStorage.getItem(target) !== null;
    } catch {
      /* assume it exists so we never clobber */
      targetAlreadyExists = true;
    }

    if (alreadyDone || targetAlreadyExists) {
      skipped.push(key);
      continue;
    }

    try {
      raw = localStorage.getItem(key);
      if (raw === null) {
        skipped.push(key);
        continue;
      }
      localStorage.setItem(target, raw);
      localStorage.removeItem(key);
      moved.push(key);
    } catch {
      // Leave the original in place rather than risk losing it.
      skipped.push(key);
    }
  }

  try {
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    /* non-fatal */
  }

  return { moved, skipped };
}

/** True once the legacy sweep has run at least once. */
export function migrationComplete(): boolean {
  try {
    return localStorage.getItem(MIGRATION_FLAG) === "1";
  } catch {
    return false;
  }
}

/**
 * Explicit, user-initiated recovery of quarantined data.
 *
 * Deliberately not called from anywhere in the app: attributing old records to
 * an account is a decision for the person who owns them, never something the
 * software does on their behalf. The report documents the console invocation.
 */
export function recoverQuarantinedFor(principal: Principal): string[] {
  if (principal.kind === "none") return [];
  const recovered: string[] = [];
  for (const key of PRIVATE_KEYS) {
    const from = quarantineKey(key);
    try {
      const raw = localStorage.getItem(from);
      if (raw === null) continue;
      const to = scopedKey(principal, key);
      // Never clobber data the account already has.
      if (localStorage.getItem(to) !== null) continue;
      localStorage.setItem(to, raw);
      recovered.push(key);
    } catch {
      /* skip this key */
    }
  }
  return recovered;
}