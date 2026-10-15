/**
 * Where the header back arrow goes on each auth screen.
 *
 * It used to point at "/app" on every auth screen. That is the patient
 * dashboard, which is not the "Back to CareNBuddi" the arrow's label promised,
 * and on the role screens it competed with the "Back" link already sitting in
 * the page body: two back arrows, two different destinations, same screen.
 *
 * The targets are declared per screen rather than derived from browser history.
 * The app is statically exported, so a deep link has no history to pop, and a
 * pop from a deep link throws the user out of the app entirely. The correct
 * parent of a screen is a property of the flow, not of how the user reached it.
 */

/** Screens that the header arrow should send back to. */
const BACK_TARGET: Record<string, string> = {
  // Reached by finishing onboarding, so onboarding is its parent.
  "/auth/choice": "/onboarding",
  // Both are entered from role selection.
  "/auth/sign-in": "/auth/sign-in/role",
  "/auth/sign-up": "/auth/sign-up/role",
};

/**
 * Screens that already render their own back control. The header arrow is
 * suppressed here so each screen has exactly one back affordance.
 */
const HAS_OWN_BACK = new Set([
  "/auth/sign-in/role",
  "/auth/sign-up/role",
  "/auth/verify",
  "/auth/forgot-password",
]);

/**
 * The back destination for a screen, or null when that screen should not show
 * the header arrow at all.
 *
 * The path is normalised first: the static export is served with trailing
 * slashes, so usePathname() can hand back "/auth/choice/" and an exact lookup
 * would silently miss and drop the arrow off the screen.
 */
export function headerBackFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (HAS_OWN_BACK.has(path)) return null;
  return BACK_TARGET[path] ?? null;
}