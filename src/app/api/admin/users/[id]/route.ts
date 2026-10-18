import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, tickets } from "@/db/schema";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq, count } from "drizzle-orm";

/**
 * DELETE /api/admin/users/:id
 *
 * Deletes a user from both the Drizzle `users` table and Supabase Auth.
 * Restricted to callers with the "admin" role.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;

    // ── 1. Authenticate the caller ──────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();

    if (!caller) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── 2. Verify caller is an admin ────────────────────────────────────
    const [callerProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }

    // ── 3. Prevent self-deletion ────────────────────────────────────────
    if (targetUserId === caller.id) {
      return NextResponse.json(
        { success: false, message: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Check if user has created tickets
    const [createdTicketCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(eq(tickets.createdById, targetUserId));

    if (createdTicketCount && createdTicketCount.count > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Tidak dapat menghapus akun karena memiliki ${createdTicketCount.count} tiket aktif yang dibuat. Silakan hapus atau arsipkan tiket terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // Safely unassign any tickets currently assigned to this user
    await db
      .update(tickets)
      .set({ assignedToId: null })
      .where(eq(tickets.assignedToId, targetUserId));

    // ── 4. Delete from Drizzle `users` table ─────────────────────────────
    const deleted = await db
      .delete(users)
      .where(eq(users.id, targetUserId))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // ── 5. Delete from Supabase Auth ────────────────────────────────────
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (authError) {
      // Profile row already removed — log and proceed.
      console.error(
        "[DELETE /api/admin/users] Auth cleanup failed:",
        authError.message
      );
    }

    return NextResponse.json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error("[DELETE /api/admin/users/:id]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
