import { createClient } from "@supabase/supabase-js";

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
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
