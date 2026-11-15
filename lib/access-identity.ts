"use client";

import { KEYS, seedUsers, useSession, useStoredCollection } from "./storage";
import { useCloud } from "./supabase/cloud";
import { resolveAccessIdentity, type AccessIdentity } from "./auth-guard";

/**
 * The signed-in account as the UI is allowed to see it.
 *
 * Every role-gated screen uses this instead of reading `healthlink:users`
 * directly. In cloud mode the returned role comes from the server profile
 * (see resolveAccessIdentity) and is never taken from local storage.
 */
export function useAccessIdentity(): AccessIdentity {
  const cloud = useCloud();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);

  return resolveAccessIdentity({
    cloudEnabled: cloud.enabled,
    cloudReady: cloud.ready,
    cloudUserId: cloud.user?.id ?? null,
    cloudRole: cloud.profile?.role ?? null,
    localSessionUserId: session.userId,
    localUsers: users,
  });
}
