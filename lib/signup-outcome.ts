/**
 * Interprets a Supabase signUp response.
 *
 * Kept pure so the shape of the response can be unit tested without a browser
 * or a network. Two behaviours matter:
 *
 *  - With email confirmation enabled `data.session` is null but `data.user`
 *    still carries the account id. Callers need that id to key a local draft,
 *    and must never invent one with `uid()` in cloud mode.
 *  - For an email that already has an account Supabase deliberately returns a
 *    user-shaped response with an empty `identities` array instead of an error,
 *    so the caller cannot tell whether the address is taken. The flag below may
 *    be used to avoid writing data into an existing account's namespace, but it
 *    must never reach user-facing copy.
 */

export interface SignUpOutcome {
  needsConfirmation: boolean;
  userId: string | null;
  /** True when Supabase reported a user with no identities (existing account). */
  existingAccount: boolean;
}

interface SignUpData {
  user?: { id?: string | null; identities?: unknown[] | null } | null;
  session?: { user?: { id?: string | null } | null } | null;
}

export function describeSignUpResult(data: SignUpData | null | undefined): SignUpOutcome {
  const sessionId = data?.session?.user?.id;
  const userId =
    typeof sessionId === "string" && sessionId.length > 0
      ? sessionId
      : typeof data?.user?.id === "string" && data.user.id.length > 0
        ? data.user.id
        : null;

  const identities = data?.user?.identities;
  const existingAccount =
    Boolean(data?.user) && Array.isArray(identities) && identities.length === 0;

  return {
    needsConfirmation: !data?.session,
    userId,
    existingAccount,
  };
}
