import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/v1/auth/logout
 *
 * Server-side logout endpoint:
 * 1. Signs out from Supabase if configured.
 * 2. Clears the HttpOnly session cookie.
 */
export async function POST() {
  try {
    if (isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import(
        "@/lib/supabase-server"
      );
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }

    const response = NextResponse.json({
      success: true,
      message: "Berhasil keluar dari akun.",
    });

    return clearSessionCookie(response);
  } catch (error) {
    console.error("[POST /api/v1/auth/logout]", error);
    const response = NextResponse.json(
      { success: false, message: "Gagal memproses logout" },
      { status: 500 }
    );
    return clearSessionCookie(response);
  }
}
