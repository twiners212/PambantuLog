import { NextResponse } from "next/server";
import {
  mockTickets,
  mockCategories,
  mockUsers,
  mockComments,
} from "@/lib/mock-data";
import { getServerSession } from "@/lib/auth-session";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

    // ── 1. Mock Mode (local dev without Supabase) ────────────────────────
    if (!isSupabaseConfigured) {
      const session = await getServerSession();
      if (!session) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }

      const mockTicket = mockTickets.find((t) => t.id === id);
      if (!mockTicket) {
        return NextResponse.json(
          { success: false, message: "Ticket not found" },
          { status: 404 }
        );
      }

      // Check permissions in mock mode
      if (session.role === "karyawan" && mockTicket.createdById !== session.id) {
        return NextResponse.json(
          { success: false, message: "Forbidden: You didn't create this ticket" },
          { status: 403 }
        );
      }

      // Agent can view if unassigned (assignedToId == null) or assigned to them
      if (
        session.role === "agent" &&
        mockTicket.assignedToId &&
        mockTicket.assignedToId !== session.id
      ) {
        return NextResponse.json(
          { success: false, message: "Forbidden: Assigned to another agent" },
          { status: 403 }
        );
      }

      const category = mockCategories.find((c) => c.id === mockTicket.categoryId) ?? null;
      const createdBy = mockUsers.find((u) => u.id === mockTicket.createdById) ?? null;
      const assignedTo = mockUsers.find((u) => u.id === mockTicket.assignedToId) ?? null;

      const ticketComments = mockComments
        .filter((c) => c.ticketId === id)
        .map((c) => {
          const user = mockUsers.find((u) => u.id === c.authorId);
          return {
            id: c.id,
            ticketId: c.ticketId,
            userId: c.authorId,
            message: c.content,
            attachmentUrl: null,
            createdAt: c.createdAt,
            user: user
              ? { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
              : null,
          };
        });

      return NextResponse.json({
        success: true,
        data: {
          ...mockTicket,
          category,
          createdBy,
          assignedTo,
          comments: ticketComments,
        },
      });
    }

    // ── 2. Real Mode (Supabase Auth + Drizzle) ──────────────────────────
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { tickets, users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

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

    // Fetch ticket with all relations
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

    // Check Permissions
    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    if (!profile) {
      return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
    }

    if (profile.role === "karyawan" && ticket.createdBy?.id !== user.id) {
      return NextResponse.json({ success: false, message: "Forbidden: You didn't create this ticket" }, { status: 403 });
    }

    // Agent can view if assigned to them OR unassigned (assignedToId == null)
    if (profile.role === "agent" && ticket.assignedTo?.id && ticket.assignedTo.id !== user.id) {
      return NextResponse.json({ success: false, message: "Forbidden: Assigned to another agent" }, { status: 403 });
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
