import { NextResponse } from "next/server";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { assignedToId } = body;

    if (assignedToId === undefined) {
      return NextResponse.json(
        { success: false, message: "Missing assignedToId" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      // Mock mode
      return NextResponse.json({ success: true, data: { id, assignedToId } });
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { tickets, users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Optional: check if the logged in user is admin/agent before allowing assignment
    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!profile || profile.role === "karyawan") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Handle null or valid UUID
    const updatedTicket = await db
      .update(tickets)
      .set({ 
        assignedToId: assignedToId || null,
      })
      .where(eq(tickets.id, id))
      .returning();

    if (updatedTicket.length === 0) {
      return NextResponse.json({ success: false, message: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedTicket[0] });
  } catch (error) {
    console.error("[PATCH /api/v1/tickets/[id]/assign]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
