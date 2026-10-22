/**
 * The last gate before any confirmation screen may claim success.
 *
 * Supabase's client already validates URL-granted tokens with the server
 * (auth-js `_getSessionFromURL` calls `_getUser(access_token)` and throws
 * before returning a session if verification fails), and `verifyOtp` returns
 * only server-verified users. This helper fails *closed* on top of that: an
 * "Email confirmed" banner is shown only when the session's user identity
 * matches the server-verified identity — so a session adopted from a URL can
 * never be presented as a confirmed account on its own.
 *
 * Deliberately structural: no Supabase types leak into pure tests, and no
 * comparison happens when either side is missing.
 */
export interface IdentityLike {
  id?: string | null;
}

export function confirmedUserMatches(
  sessionUser: IdentityLike | null | undefined,
  verifiedUser: IdentityLike | null | undefined,
): boolean {
  return Boolean(
    sessionUser?.id &&
      verifiedUser?.id &&
      typeof sessionUser.id === typeof verifiedUser.id &&
      sessionUser.id === verifiedUser.id,
  );
}
