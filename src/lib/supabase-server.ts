import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client (anon key + cookie-based session).
 *
 * This respects Row-Level Security and reads the current user session
 * from the request cookies set by the Supabase Auth middleware/browser SDK.
 *
 * Call this inside Next.js Route Handlers and Server Components.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` can fail in Server Components where the response
            // headers are already sent. This is safe to ignore — the
            // middleware will refresh the session on the next request.
          }
        },
      },
    }
  );
}
