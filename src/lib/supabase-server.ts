import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerSession } from "./auth-session";
import type { User } from "@supabase/supabase-js";

/**
 * Supabase server client (anon key + cookie-based session).
 *
 * This respects Row-Level Security and reads the current user session
 * from the request cookies set by the Supabase Auth middleware/browser SDK.
 *
 * Call this inside Next.js Route Handlers and Server Components.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a mock-compatible client backed by cookie session
    const session = await getServerSession();
    const mockUser: User | null = session
      ? ({
          id: session.id,
          app_metadata: {},
          user_metadata: {
            full_name: session.fullName,
            role: session.role,
            department: session.department,
          },
          aud: "authenticated",
          created_at: new Date().toISOString(),
          email: session.email,
        } as unknown as User)
      : null;

    return {
      auth: {
        getUser: async () => ({
          data: { user: mockUser },
          error: null,
        }),
        getSession: async () => ({
          data: { session: null },
          error: null,
        }),
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Supabase is not configured."),
        }),
        signOut: async () => ({
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  return createServerClient(
    url,
    key,
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
