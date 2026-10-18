import { NextResponse } from "next/server";
import { mockComments, mockTickets, mockUsers } from "@/lib/mock-data";
import { getServerSession } from "@/lib/auth-session";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      const session = await getServerSession();
      if (!session) {
        return NextResponse.json({ success: true, data: [] });
      }

      // Filter mock comments by others on relevant tickets
      const notifs = mockComments
        .filter((c) => c.authorId !== session.id)
        .slice(0, 5)
        .map((c) => {
          const ticket = mockTickets.find((t) => t.id === c.ticketId);
          const author = mockUsers.find((u) => u.id === c.authorId);
          return {
            id: c.id,
            message: c.content,
            createdAt: c.createdAt,
            ticketId: c.ticketId,
            ticketTitle: ticket?.title || "Ticket Update",
            authorName: author?.fullName || "Support",
          };
        });

      return NextResponse.json({ success: true, data: notifs });
    }

    const { db } = await import("@/db");
    const { tickets, ticketComments, users } = await import("@/db/schema");
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { eq, ne, desc, and } = await import("drizzle-orm");

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!profile) {
      return NextResponse.json({ success: false, message: "User profile not found" }, { status: 404 });
    }

    let recentComments;

    if (profile.role === "karyawan") {
      recentComments = await db.select({
        id: ticketComments.id,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
        ticketId: tickets.id,
        ticketTitle: tickets.title,
        authorName: users.fullName
      })
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(
        and(
          eq(tickets.createdById, user.id),
          ne(ticketComments.userId, user.id)
        )
      )
      .orderBy(desc(ticketComments.createdAt))
      .limit(5);
    } else if (profile.role === "agent") {
      recentComments = await db.select({
        id: ticketComments.id,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
        ticketId: tickets.id,
        ticketTitle: tickets.title,
        authorName: users.fullName
      })
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(
        and(
          eq(tickets.assignedToId, user.id),
          ne(ticketComments.userId, user.id)
        )
      )
      .orderBy(desc(ticketComments.createdAt))
      .limit(5);
    } else {
      // admin sees all recent comments by others
      recentComments = await db.select({
        id: ticketComments.id,
        message: ticketComments.message,
        createdAt: ticketComments.createdAt,
        ticketId: tickets.id,
        ticketTitle: tickets.title,
        authorName: users.fullName
      })
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .where(ne(ticketComments.userId, user.id))
      .orderBy(desc(ticketComments.createdAt))
      .limit(5);
    }

    return NextResponse.json({ success: true, data: recentComments });
  } catch (error) {
    console.error("[GET /api/v1/notifications]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
