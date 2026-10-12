import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_adminClient) return _adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _adminClient;
}

/**
 * Supabase Admin client (service-role key).
 *
 * ⚠️  This client bypasses Row-Level Security.
 * Use ONLY in trusted server-side contexts such as:
 *   - Admin user creation (`auth.admin.createUser`)
 *   - Admin user deletion (`auth.admin.deleteUser`)
 *
 * Never expose this client or its key to the browser.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    if (!client) {
      console.warn(
        `[supabaseAdmin] Properti '${String(prop)}' diakses namun variabel SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.`
      );
      return undefined;
    }
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
