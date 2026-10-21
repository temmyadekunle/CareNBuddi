import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The app is fully usable without a backend: everything falls back to
 * localStorage. When these two variables are present the same screens talk to
 * Supabase instead. Both are safe to ship to the browser — row level security
 * in the database is what actually protects the data.
 */
export const isCloudEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isCloudEnabled) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /**
         * Email-confirmation links from a browser (implicit-grant) redirect
         * land with the session tokens in the URL fragment. Without this flag
         * nothing ever consumes them: the account stays unconfirmed and every
         * later sign-in fails. The client validates the token with the server
         * (it never merely adopts the hash), strips the fragment from the
         * address bar as soon as it has read it, and refuses to process the
         * same callback twice — see lib/auth-confirm-link.ts, which scrubs the
         * URL before any page-level async work starts.
         */
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}