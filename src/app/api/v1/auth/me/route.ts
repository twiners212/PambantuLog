import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq } from "drizzle-orm";

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's profile from the Drizzle `users` table.
 * Used by the AuthProvider on the client side to populate the auth context.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user: profile });
  } catch (error) {
    console.error("[GET /api/v1/auth/me]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { fullName, department } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check mock mode
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
       return NextResponse.json({ success: true, message: "Mock profile updated" });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await db
      .update(users)
      .set({
        fullName,
        department,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("[PATCH /api/v1/auth/me]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
