"use client";

import { useCallback } from "react";

import {
  PROVIDER_APPLICATIONS_KEY,
  type ProviderApplication,
} from "./provider-application";
import { useStoredCollection } from "./storage";

const EMPTY: ProviderApplication[] = [];

/**
 * Reads and writes provider applications.
 *
 * Exactly one application per account: `upsert` matches on `userId`, so a
 * returning applicant resumes their existing application instead of creating a
 * second one. That is what stops "sign out, sign in, apply again" from
 * producing duplicates.
 */
export function useProviderApplications() {
  const [apps, setApps] = useStoredCollection<ProviderApplication>(
    PROVIDER_APPLICATIONS_KEY,
    EMPTY,
  );

  const forUser = useCallback(
    (userId: string | null | undefined) =>
      userId ? (apps.find((a) => a.userId === userId) ?? null) : null,
    [apps],
  );

  const upsert = useCallback(
    (next: ProviderApplication) => {
      setApps((prev) => {
        const at = prev.findIndex((a) => a.userId === next.userId);
        if (at === -1) return [...prev, next];
        const copy = [...prev];
        copy[at] = next;
        return copy;
      });
    },
    [setApps],
  );

  return { apps, forUser, upsert, setApps };
}