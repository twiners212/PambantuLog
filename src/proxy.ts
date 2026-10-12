import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSession } from "./lib/auth-session";

/**
 * Server-Side Edge Proxy & RBAC Middleware
 * PambantuLog Helpdesk System
 *
 * 1. Refreshes Supabase session tokens when configured.
 * 2. Enforces Dual-Mode session reading (Supabase SSR & pambantulog_session cookie).
 * 3. Enforces strict Server-Side Role-Based Access Control (RBAC):
 *    - /admin/employees/* -> Admin only
 *    - /admin/* -> Admin & Agent
 *    - /employee/*, /tickets/*, /profile/* -> All authenticated users
 *    - /login -> Redirect authenticated users to their respective home dashboard
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });
  let supabaseUserRole: string | undefined;

  const isSupabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ── 1. Supabase Session Refresh (if configured) ─────────────────────
  if (isSupabaseConfigured) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value)
              );
              supabaseResponse = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.role) {
        supabaseUserRole = user.user_metadata.role;
      }
    } catch {
      // Ignore Supabase connection errors during edge invocation
    }
  }

  // ── 2. Read Session from Dual-Mode Store ────────────────────────────
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? decodeSession(sessionCookie) : null;

  const isAuthenticated = !!session || !!supabaseUserRole;
  const userRole = session?.role || supabaseUserRole;

  const isLoginPage = pathname === "/login";
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminEmployeesPath = pathname.startsWith("/admin/employees");
  const isEmployeePath = pathname.startsWith("/employee");
  const isTicketsPath = pathname.startsWith("/tickets");
  const isProfilePath = pathname.startsWith("/profile");

  const isProtectedRoute =
    isAdminPath || isEmployeePath || isTicketsPath || isProfilePath;

  // ── 3. Handle /login page access ────────────────────────────────────
  if (isLoginPage) {
    if (isAuthenticated) {
      if (userRole === "admin" || userRole === "agent") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL("/employee/tickets", request.url));
    }
    return supabaseResponse;
  }

  // ── 4. Handle Protected Routes (RBAC) ───────────────────────────────
  if (isProtectedRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based restrictions
    if (isAdminEmployeesPath) {
      if (userRole !== "admin") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    } else if (isAdminPath) {
      if (userRole !== "admin" && userRole !== "agent") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/employee/:path*",
    "/tickets/:path*",
    "/profile/:path*",
    "/login",
  ],
};
