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
    const { getServerSession } = await import("@/lib/auth-session");
    const session = await getServerSession();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && session) {
      return NextResponse.json({
        success: true,
        user: {
          id: session.id,
          fullName: session.fullName,
          email: session.email,
          role: session.role,
          department: session.department ?? null,
        },
      });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      if (session) {
        return NextResponse.json({
          success: true,
          user: {
            id: session.id,
            fullName: session.fullName,
            email: session.email,
            role: session.role,
            department: session.department ?? null,
          },
        });
      }
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (session) {
        return NextResponse.json({
          success: true,
          user: {
            id: session.id,
            fullName: session.fullName,
            email: session.email,
            role: session.role,
            department: session.department ?? null,
          },
        });
      }
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
      if (session) {
        return NextResponse.json({
          success: true,
          user: {
            id: session.id,
            fullName: session.fullName,
            email: session.email,
            role: session.role,
            department: session.department ?? null,
          },
        });
      }
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

    const { getServerSession, setSessionCookie } = await import("@/lib/auth-session");
    const session = await getServerSession();

    // Check mock mode
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      if (!session) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
      const updatedUser = {
        id: session.id,
        email: session.email,
        fullName: fullName || session.fullName,
        role: session.role,
        department: department !== undefined ? department : session.department,
      };
      const response = NextResponse.json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
      return setSessionCookie(response, updatedUser);
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || session?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const updateData: { fullName?: string; department?: string } = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (department !== undefined) updateData.department = department;

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    const [updatedProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const response = NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedProfile,
    });

    if (updatedProfile) {
      return setSessionCookie(response, {
        id: updatedProfile.id,
        email: updatedProfile.email,
        fullName: updatedProfile.fullName,
        role: updatedProfile.role as "admin" | "agent" | "karyawan",
        department: updatedProfile.department,
      });
    }

    return response;
  } catch (error) {
    console.error("[PATCH /api/v1/auth/me]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
