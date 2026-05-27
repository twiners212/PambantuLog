import { NextResponse } from "next/server";
import { mockTickets, mockCategories, mockUsers } from "@/lib/mock-data";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/v1/tickets
 * POST /api/v1/tickets
 *
 * Mock-mode: returns hardcoded data.
 * Real-mode: Drizzle queries with RBAC.
 */
export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured) {
      // Mock mode — enrich tickets with populated relations
      const data = mockTickets.map((t) => ({
        ...t,
        category: mockCategories.find((c) => c.id === t.categoryId) ?? null,
        createdBy: mockUsers.find((u) => u.id === t.createdById) ?? null,
        assignedTo: mockUsers.find((u) => u.id === t.assignedToId) ?? null,
      }));
      return NextResponse.json({ success: true, data });
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

    const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!profile) {
      return NextResponse.json({ success: false, message: "User profile not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const viewType = url.searchParams.get("view");

    let result;
    if (viewType === "my_tickets" || profile.role === "karyawan") {
      result = await db.query.tickets.findMany({
        where: eq(tickets.createdById, user.id),
        with: {
          category: true,
          createdBy: { columns: { id: true, fullName: true, email: true, department: true } },
          assignedTo: { columns: { id: true, fullName: true, email: true, department: true } },
        },
        orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
      });
    } else if (profile.role === "agent") {
      result = await db.query.tickets.findMany({
        where: eq(tickets.assignedToId, user.id),
        with: {
          category: true,
          createdBy: { columns: { id: true, fullName: true, email: true, department: true } },
          assignedTo: { columns: { id: true, fullName: true, email: true, department: true } },
        },
        orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
      });
    } else {
      result = await db.query.tickets.findMany({
        with: {
          category: true,
          createdBy: { columns: { id: true, fullName: true, email: true, department: true } },
          assignedTo: { columns: { id: true, fullName: true, email: true, department: true } },
        },
        orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/v1/tickets]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let title, description, categoryId, priority, file;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      title = body.title;
      description = body.description;
      categoryId = body.categoryId;
      priority = body.priority;
    } else {
      const formData = await request.formData();
      title = formData.get("title") as string;
      description = formData.get("description") as string;
      categoryId = formData.get("categoryId") as string;
      priority = formData.get("priority") as string;
      file = formData.get("file") as File | null;
    }

    if (!title || !description || !categoryId) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: title, description, categoryId" },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      const newTicket = {
        id: `HD-${Math.floor(Math.random() * 10000)}`,
        title,
        description,
        status: "open",
        priority: priority || "medium",
        createdById: "user-3",
        assignedToId: null,
        categoryId,
        attachmentUrl: file ? "mock-url" : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, data: newTicket }, { status: 201 });
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { tickets } = await import("@/db/schema");

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let attachmentUrl = null;
    if (file && file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return NextResponse.json({ success: false, message: "Failed to upload file" }, { status: 500 });
      }

      const { data: publicUrlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(fileName);
      
      attachmentUrl = publicUrlData.publicUrl;
    }

    const [newTicket] = await db
      .insert(tickets)
      .values({ 
        title, 
        description, 
        categoryId, 
        priority: priority ?? "medium", 
        createdById: user.id,
        attachmentUrl 
      })
      .returning();

    return NextResponse.json({ success: true, data: newTicket }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/tickets]", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
