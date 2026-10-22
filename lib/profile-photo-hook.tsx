"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { readPhoto } from "@/lib/profile-photo";
import { hydrateServerPhoto } from "@/lib/profile-photo-server";
import { KEYS, onLocalChange } from "@/lib/storage";
import { useCloud } from "@/lib/supabase/cloud";

/**
 * Reactive profile photo for one account.
 *
 * Lives apart from lib/profile-photo-server.ts (whose decision logic is
 * unit-tested with no DOM and no react) and only wires that logic into
 * render: it re-renders whenever the device copy changes, locally or across
 * tabs, and kicks off a one-shot server hydration so a picture that exists
 * elsewhere reappears after sign-out, reinstall or on a new device — and a
 * picture that only ever existed here is pushed to the server instead of
 * being lost. Writes through both paths (crop save, adoption, hydration,
 * removal) arrive via the same local-change notification, so Home, Profile
 * and the nav bar — which all read through this hook — can never disagree.
 */

function subscribe(cb: () => void): () => void {
  const onChange = (key: string) => {
    if (key === KEYS.profilePhotos) cb();
  };
  const offLocal = onLocalChange(onChange);
  const onStorage = (e: StorageEvent) => {
    // Scoped key differs per account, so match the suffix; null key means a
    // clear() somewhere, worth re-reading too.
    if (e.key === null || e.key.endsWith(":profile-photos")) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    offLocal();
    window.removeEventListener("storage", onStorage);
  };
}

export function useProfilePhoto(userId: string | null | undefined): string | null {
  const cloud = useCloud();
  const hydrate = useCallback((id: string | null | undefined) => {
    if (id) void hydrateServerPhoto(id);
  }, []);

  // Hydrate only for the account that is actually signed in: a guest's local
  // slot id owns no server row, and asking Supabase for it would be waste.
  const cloudUserId = cloud.user?.id ?? null;
  const shouldHydrate = cloud.enabled && cloudUserId !== null && cloudUserId === userId;

  const getSnapshot = useMemo(() => () => readPhoto(userId), [userId]);

  useEffect(() => {
    if (shouldHydrate && userId) hydrate(userId);
  }, [shouldHydrate, userId, hydrate]);

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null,
  );
}
