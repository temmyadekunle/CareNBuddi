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
import { getSupabase, isCloudEnabled } from "./client";
import {
  fetchProfile,
  pullDocuments,
  pushDocuments,
  SYNCED_KEYS,
  type CloudProfile,
} from "./sync";
import { KEYS, onLocalChange, readLocal, writeLocal } from "@/lib/storage";
import type { Role, User } from "@/lib/types";

export type SyncState = "off" | "idle" | "syncing" | "synced" | "error";

export interface SignUpMeta {
  name: string;
  phone?: string;
  role: Role;
  lang: string;
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
}

const CloudContext = createContext<CloudValue | null>(null);

const SYNCABLE = new Set<string>(SYNCED_KEYS);
const PUSH_DEBOUNCE_MS = 900;

function localUserFor(user: SupabaseUser, profile: CloudProfile | null): User {
  return {
    id: user.id,
    name: profile?.full_name || (user.user_metadata?.name as string) || "HealthLink Member",
    email: user.email ?? profile?.email ?? "",
    phone: profile?.phone ?? ((user.user_metadata?.phone as string) || undefined),
    role: profile?.role ?? ((user.user_metadata?.role as Role) ?? "consumer"),
    lang: profile?.lang ?? "en",
    createdAt: user.created_at,
  };
}

/** Keeps the existing local session/users collections in step with the cloud account. */
function adoptCloudUser(user: SupabaseUser, profile: CloudProfile | null) {
  const me = localUserFor(user, profile);
  const session = readLocal<{ userId: string | null; lang: string }>(KEYS.session);
  const lang = session?.lang ?? "en";
  writeLocal<{ userId: string | null; lang: string }>(KEYS.session, { userId: user.id, lang });

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

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const current = data.session?.user ?? null;
      setUser(current);
      if (current) {
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: SupabaseSession | null) => {
      const next = session?.user ?? null;
      setUser(next);
      setProfile(null);
      if (!next) {
        const session_ = readLocal<{ userId: string | null; lang: string }>(KEYS.session);
        writeLocal(KEYS.session, { userId: null, lang: session_?.lang ?? "en" });
        setSyncState("idle");
        setLastSyncedAt(null);
        return;
      }
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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: meta.name, phone: meta.phone ?? "", role: meta.role, lang: meta.lang } },
    });
    if (signUpError) throw new Error(signUpError.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback<CloudValue["signIn"]>(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sign-in is not configured");
    setError(null);
    setNotice(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) throw new Error(signInError.message);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (timer.current) clearTimeout(timer.current);
    await supabase?.auth.signOut();
    setUser(null);
    setProfile(null);
    setSyncState("idle");
    setLastSyncedAt(null);
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
    }),
    [ready, user, profile, syncState, lastSyncedAt, error, notice, signUp, signIn, signOut, userId, runSync],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used inside CloudProvider");
  return ctx;
}