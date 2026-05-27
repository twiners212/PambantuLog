import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client (anon key).
 *
 * Use this in "use client" components. It reads/writes auth cookies
 * automatically via the browser and respects RLS.
 *
 * Returns `null` if env vars are not configured (e.g. during local
 * development before connecting to Supabase).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}
