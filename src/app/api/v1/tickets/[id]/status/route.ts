import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { eq } from "drizzle-orm";

// ── Valid status transitions (state machine) ────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress"],
  in_progress: ["pending", "resolved"],
  pending: ["in_progress", "resolved"], // Allowed pending -> resolved
  resolved: ["closed", "in_progress"], 
  closed: ["open"], // Allowed closed -> open for cyclic sequence
};

/**
 * PATCH /api/v1/tickets/:id/status
 *
 * Updates a ticket's status.
 * Only 'agent' or 'admin' roles may call this endpoint.
 * The transition must be valid according to the state machine.
 *
 * Body: { status: string }
 */
export async function PATCH(
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

    // ── 2. Verify caller is agent or admin ──────────────────────────────
    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!profile || (profile.role !== "admin" && profile.role !== "agent")) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Agent or Admin role required" },
        { status: 403 }
      );
    }

    // ── 3. Parse body ───────────────────────────────────────────────────
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json(
        { success: false, message: "Missing required field: status" },
        { status: 400 }
      );
    }

    // ── 4. Fetch current ticket ─────────────────────────────────────────
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "Ticket not found" },
        { status: 404 }
      );
    }

    // ── 5. Validate state transition ────────────────────────────────────
    const allowed = VALID_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid transition: ${ticket.status} → ${newStatus}. Allowed: [${allowed.join(", ")}]`,
        },
        { status: 422 }
      );
    }

    // ── 6. Update ───────────────────────────────────────────────────────
    const [updated] = await db
      .update(tickets)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/v1/tickets/:id/status]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
