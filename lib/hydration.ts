"use client";

import { useSyncExternalStore } from "react";

/** Nothing external changes hydration, so the subscription never fires. */
const subscribeToHydration = () => () => {};

/**
 * False while the static export is being rendered and hydrated, true after.
 *
 * `useSyncExternalStore` is the React-blessed way to expose a client-only
 * snapshot: the server snapshot is `false`, so markup that must not act before
 * React attaches stays inert, and the client snapshot becomes `true` once
 * hydration finishes. A `useEffect` + state flag would be equivalent at
 * runtime but is flagged by react-hooks/set-state-in-effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}
