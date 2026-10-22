"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import { endSession, endUserSession } from "@/lib/session";
import { getSupabase, isCloudEnabled } from "./client";
import {
  fetchProfile,
  pullDocuments,
  pushDocuments,
  SYNCED_KEYS,
  type CloudProfile,
} from "./sync";
import { KEYS, onLocalChange, readLocal, writeLocal, type Session } from "@/lib/storage";
import { adoptedLang } from "@/lib/lang-decision";
import { resetPhotoHydration } from "@/lib/profile-photo-server";
import type { Role, User } from "@/lib/types";

export type SyncState = "off" | "idle" | "syncing" | "synced" | "error";

export interface SignUpMeta {
  name: string;
  phone?: string;
  role: Role;
  lang: string;
  /** Same-site destination requested before signup, preserved through the confirmation email link. */
  next?: string;
}

interface CloudValue {
  enabled: boolean;
  ready: boolean;
  user: SupabaseUser | null;
  profile: CloudProfile | null;
  syncState: SyncState;
  lastSyncedAt: number | null;
  error: string | null;
  notice: string | null;
  signUp: (email: string, password: string, meta: SignUpMeta) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

const CloudContext = createContext<CloudValue | null>(null);

const SYNCABLE = new Set<string>(SYNCED_KEYS);
const PUSH_DEBOUNCE_MS = 900;

/**
 * The local mirror of a cloud account.
 *
 * `role` is taken from the server profile only. It used to fall back to
 * `user.user_metadata.role`, which is client-supplied, so a user who asked for
 * 'admin' at signup would have been mirrored locally as an administrator even
 * though the database never granted it - enough to show staff-only screens
 * locally while every query behind them was denied. The profile row is the
 * only authority for a role.
 */
function localUserFor(user: SupabaseUser, profile: CloudProfile | null): User {
  return {
    id: user.id,
    name: profile?.full_name || (user.user_metadata?.name as string) || "CareNBuddi Member",
    email: user.email ?? profile?.email ?? "",
    phone: profile?.phone ?? ((user.user_metadata?.phone as string) || undefined),
    role: profile?.role ?? "consumer",
    lang: profile?.lang ?? "en",
    createdAt: user.created_at,
  };
}

/**
 * Which auth events mean "this session is no longer valid".
 *
 * Supabase emits `SIGNED_OUT` when it establishes the session is gone - an
 * expired refresh token, a revocation, or a sign-out from another device. It
 * does not emit it for a failed network call, so a flaky connection cannot
 * destroy a valid user's records.
 *
 * `INITIAL_SESSION` with a null session is explicitly NOT in this list. That
 * is simply "nobody is signed in", and it fires on every page load for anyone
 * using a local profile rather than a cloud account. Purging on it would delete
 * their data on the first refresh.
 */
const REVOKING_EVENTS = new Set<string>(["SIGNED_OUT", "USER_SIGNED_OUT"]);

/**
 * Keeps the existing local session/users collections in step with the cloud account.
 *
 * The language follows the conflict rule in lib/lang-decision.ts: a saved
 * server preference wins when it is supported, otherwise the device's current
 * choice stands (a guest's pre-signup choice survives into the session). The
 * session is only rewritten when something actually changed, so a plain
 * restore never wakes language subscribers for nothing.
 */
function adoptCloudUser(user: SupabaseUser, profile: CloudProfile | null) {
  const me = localUserFor(user, profile);
  const session = readLocal<Session>(KEYS.session);
  const { lang } = adoptedLang(session, profile?.lang);
  const next: Session = { userId: user.id, lang };
  if (
    !session ||
    session.userId !== next.userId ||
    session.lang !== next.lang
  ) {
    writeLocal<Session>(KEYS.session, next);
  }

  const users = readLocal<User[]>(KEYS.users) ?? [];
  const index = users.findIndex((u) => u.id === user.id);
  if (index === -1) writeLocal<User[]>(KEYS.users, [...users, me]);
  else if (JSON.stringify(users[index]) !== JSON.stringify(me))
    writeLocal<User[]>(KEYS.users, users.map((u) => (u.id === user.id ? me : u)));
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [ready, setReady] = useState(!isCloudEnabled);
  const [syncState, setSyncState] = useState<SyncState>(isCloudEnabled ? "idle" : "off");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyingRemote = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;

  const runSync = useCallback(
    async (id: string, docKeys?: readonly string[]) => {
      setSyncState("syncing");
      setError(null);
      try {
        applyingRemote.current = true;
        if (docKeys) await pushDocuments(id, docKeys);
        else {
          await pushDocuments(id);
          await pullDocuments(id);
        }
        setLastSyncedAt(Date.now());
        setSyncState("synced");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed");
        setSyncState("error");
      } finally {
        applyingRemote.current = false;
      }
    },
    [],
  );

  // Restore the existing session and keep local data in step with it.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    /* The user id of the cloud session we are currently acting for. Tracked
       separately from React state because by the time a SIGNED_OUT event
       arrives the SDK has already dropped the session, and `healthlink:session`
       may have been rewritten - so the owner of the data has to be remembered
       from before the event, not rediscovered after it. */
    let cloudUserId: string | null = null;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const current = data.session?.user ?? null;
      setUser(current);
      if (current) {
        cloudUserId = current.id;
        try {
          const p = await fetchProfile(current.id);
          if (!active) return;
          setProfile(p);
          adoptCloudUser(current, p);
          await runSync(current.id);
        } catch {
          setSyncState("error");
        }
      }
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session: SupabaseSession | null) => {
      const next = session?.user ?? null;
      setUser(next);
      setProfile(null);

      if (!next) {
        /* An account's session has ended here — both for a confirmed
           revocation and for a plain sign-out: this branch is the single
           funnel for `next === null`, and `cloudUserId` still holds the id
           of the user who was signed in before this event. Releasing the
           profile-photo hydration gate BEFORE the cleanup paths lets the
           next sign-in of that same account fetch a fresh server photo in
           this SPA session (sign-out purges the device cache, so without
           this the photo could never come back until a full page reload). */
        if (cloudUserId) resetPhotoHydration(cloudUserId);

        /* Only a confirmed revocation clears data. A transient network failure
           does not raise SIGNED_OUT, and INITIAL_SESSION with no session just
           means nobody is signed in - neither should cost anyone their records. */
        if (REVOKING_EVENTS.has(event) && cloudUserId) {
          endUserSession(cloudUserId, "expired");
        } else {
          // Not a revocation: keep the data, just drop the session pointer —
          // and with it nothing else, language included.
          const session_ = readLocal<Session>(KEYS.session);
          writeLocal<Session>(KEYS.session, {
            userId: null,
            lang: session_?.lang ?? "en",
          });
        }
        cloudUserId = null;
        setSyncState("idle");
        setLastSyncedAt(null);
        return;
      }

      cloudUserId = next.id;
      fetchProfile(next.id)
        .then(async (p) => {
          adoptCloudUser(next, p);
          setProfile(p);
          await runSync(next.id);
        })
        .catch(() => setSyncState("error"));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [runSync]);

  // Any local edit to a synced collection is backed up shortly after it happens.
  useEffect(() => {
    if (!userId) return;
    return onLocalChange((key) => {
      if (applyingRemote.current || !SYNCABLE.has(key)) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void runSync(userId, [key]);
      }, PUSH_DEBOUNCE_MS);
    });
  }, [userId, runSync]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const signUp = useCallback<CloudValue["signUp"]>(async (email, password, meta) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sign-in is not configured");
    setError(null);
    setNotice(null);
    // Defence in depth, NOT the control. The database trigger is what actually
    // refuses to create an administrator (migration 0003); this just stops the
    // browser from claiming one in the first place. A caller could always edit
    // the request by hand, which is why the trigger matters.
    const requestedRole: Role = meta.role === "provider" ? "provider" : "consumer";
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: meta.name, phone: meta.phone ?? "", role: requestedRole, lang: meta.lang },
        /**
         * Route the confirmation email back to the verification screen instead
         * of the bare origin. Only that screen knows how to consume a link
         * callback — without this, the default template lands the user on the
         * site root and nothing ever confirms the account.
         */
        emailRedirectTo: `${window.location.origin}/auth/verify${
          meta.next ? `?next=${encodeURIComponent(meta.next)}` : ""
        }`,
      },
    });
    if (signUpError) throw new Error(signUpError.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback<CloudValue["signIn"]>(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sign-in is not configured");
    setError(null);
    setNotice(null);
    const { error: signInError, data } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) throw new Error(signInError.message);
    /* Restore the server preference BEFORE the caller navigates: the profile
       (role, name, language) is fetched and adopted here, so the screen the
       user lands on already renders in their account language instead of
       flashing the device default. The auth-listener path does the same work;
       whoever finishes first wins and both are idempotent. */
    const signedIn = data.user;
    if (signedIn) {
      try {
        const p = await fetchProfile(signedIn.id);
        setProfile(p);
        adoptCloudUser(signedIn, p);
      } catch {
        /* Profile fetch failed: the SIGNED_IN listener will retry; the
           sign-in itself must not fail because of this. */
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (timer.current) clearTimeout(timer.current);
    await supabase?.auth.signOut();
    // Clears this account's private collections from the device. Only the
    // Supabase call is authentication; the rest is local data cleanup.
    endSession("signout");
    setUser(null);
    setProfile(null);
    setSyncState("idle");
    setLastSyncedAt(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sign-in is not configured");
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signInWithApple = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sign-in is not configured");
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<CloudValue>(
    () => ({
      enabled: isCloudEnabled,
      ready,
      user,
      profile,
      syncState,
      lastSyncedAt,
      error,
      notice,
      signUp,
      signIn,
      signOut,
      sync: async () => {
        if (!userId) return;
        await runSync(userId);
      },
      signInWithGoogle,
      signInWithApple,
    }),
    [ready, user, profile, syncState, lastSyncedAt, error, notice, signUp, signIn, signOut, signInWithGoogle, signInWithApple, userId, runSync],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used inside CloudProvider");
  return ctx;
}

/**
 * For shared surface components (the language switcher) that render both
 * inside and outside a CloudProvider — e.g. the onboarding flow deliberately
 * runs without one. External to the provider the cloud path is simply off.
 */
export function useCloudOptional(): CloudValue | null {
  return useContext(CloudContext);
}