import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

/**
 * GET /api/v1/tickets/:id
 *
 * Fetches a single ticket by UUID, including:
 *   - category
 *   - creator profile
 *   - assigned technician profile
 *   - full comment thread (with each comment's author)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── 1. Authenticate ─────────────────────────────────────────────────
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

    // ── 2. Fetch ticket with all relations ──────────────────────────────
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      with: {
        category: true,
        createdBy: {
          columns: { id: true, fullName: true, email: true, department: true, role: true },
        },
        assignedTo: {
          columns: { id: true, fullName: true, email: true, department: true, role: true },
        },
        comments: {
          with: {
            user: {
              columns: { id: true, fullName: true, email: true, role: true },
            },
          },
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "Ticket not found" },
        { status: 404 }
      );
    }

    // ── 3. Check Permissions ────────────────────────────────────────────
    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    if (!profile) {
      return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
    }

    if (profile.role === "karyawan" && ticket.createdBy?.id !== user.id) {
      return NextResponse.json({ success: false, message: "Forbidden: You didn't create this ticket" }, { status: 403 });
    }

    if (profile.role === "agent" && ticket.assignedTo?.id !== user.id) {
      return NextResponse.json({ success: false, message: "Forbidden: Not assigned to you" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("[GET /api/v1/tickets/:id]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
