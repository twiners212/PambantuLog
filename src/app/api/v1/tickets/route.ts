import { NextResponse } from "next/server";
import { mockTickets, mockCategories, mockUsers } from "@/lib/mock-data";
import {
  createTicketSchema,
  normalizePriorityToDb,
  serializeAttachments,
} from "@/lib/validations/ticket";
import { validateRequestBody } from "@/lib/validations/api-validator";
import {
  checkRateLimit,
  LIMIT_CONFIGS,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/rate-limit";
import {
  extractIdempotencyKey,
  checkIdempotency,
  resolveIdempotency,
  releaseIdempotency,
} from "@/lib/idempotency";
import {
  parsePaginationParams,
  buildPaginatedResponse,
} from "@/lib/pagination";

const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/v1/tickets
 *
 * Query parameters:
 * - view: 'my_tickets' | undefined
 * - search: string (optional)
 * - status: string (optional)
 * - category: string (optional)
 * - page: positive integer (default 1)
 * - limit: positive integer (default 20, hard cap 50)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const viewType = url.searchParams.get("view");
    const searchQuery = (url.searchParams.get("search") || "").toLowerCase().trim();
    const statusFilter = url.searchParams.get("status");
    const categoryFilter = url.searchParams.get("category");
    const assigneeFilter = url.searchParams.get("assignee");

    // ── Enforce strict pagination bounds (min 1, hard cap 50) ──────────
    const { page, limit, offset } = parsePaginationParams(url.searchParams);

    if (!isSupabaseConfigured) {
      const { getServerSession } = await import("@/lib/auth-session");
      const session = await getServerSession();

      // Mock mode
      let data = mockTickets.map((t) => ({
        ...t,
        category: mockCategories.find((c) => c.id === t.categoryId) ?? null,
        createdBy: mockUsers.find((u) => u.id === t.createdById) ?? null,
        assignedTo: mockUsers.find((u) => u.id === t.assignedToId) ?? null,
      }));

      // Apply view / role ownership filter in mock mode
      if (viewType === "my_tickets" || session?.role === "karyawan") {
        const userId = session?.id || "user-3";
        data = data.filter((t) => t.createdById === userId);
      } else if (session?.role === "agent") {
        if (assigneeFilter === "unassigned") {
          data = data.filter((t) => !t.assignedToId);
        } else if (assigneeFilter && assigneeFilter !== "all") {
          data = data.filter((t) => t.assignedToId === assigneeFilter);
        } else {
          data = data.filter(
            (t) => !t.assignedToId || t.assignedToId === session.id
          );
        }
      }

      // Apply search & filters
      if (searchQuery) {
        data = data.filter(
          (t) =>
            t.title.toLowerCase().includes(searchQuery) ||
            t.description.toLowerCase().includes(searchQuery) ||
            t.id.toLowerCase().includes(searchQuery)
        );
      }
      if (statusFilter && statusFilter !== "all") {
        data = data.filter((t) => t.status === statusFilter);
      }
      if (categoryFilter && categoryFilter !== "all") {
        data = data.filter((t) => t.categoryId === categoryFilter);
      }
      if (assigneeFilter && assigneeFilter !== "all" && session?.role !== "agent") {
        if (assigneeFilter === "unassigned") {
          data = data.filter((t) => !t.assignedToId);
        } else {
          data = data.filter((t) => t.assignedToId === assigneeFilter);
        }
      }

      const totalItems = data.length;
      const paginatedData = data.slice(offset, offset + limit);

      return NextResponse.json(
        buildPaginatedResponse(paginatedData, totalItems, page, limit)
      );
    }

    // Real mode (Drizzle + Supabase Auth)
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { tickets, users } = await import("@/db/schema");
    const { eq, ilike, or, and, count, isNull } = await import("drizzle-orm");

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
        { success: false, message: "User profile not found" },
        { status: 404 }
      );
    }

    // Role-based where conditions
    const conditions = [];

    if (viewType === "my_tickets" || profile.role === "karyawan") {
      conditions.push(eq(tickets.createdById, user.id));
    } else if (profile.role === "agent") {
      if (assigneeFilter === "unassigned") {
        conditions.push(isNull(tickets.assignedToId));
      } else if (assigneeFilter && assigneeFilter !== "all") {
        conditions.push(eq(tickets.assignedToId, assigneeFilter));
      } else {
        // By default, agents see tickets assigned to them AND unassigned tickets requiring pickup
        conditions.push(
          or(eq(tickets.assignedToId, user.id), isNull(tickets.assignedToId))
        );
      }
    } else if (assigneeFilter && assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        conditions.push(isNull(tickets.assignedToId));
      } else {
        conditions.push(eq(tickets.assignedToId, assigneeFilter));
      }
    }
    if (searchQuery) {
      conditions.push(
        or(
          ilike(tickets.title, `%${searchQuery}%`),
          ilike(tickets.description, `%${searchQuery}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total items
    const [totalResult] = await db
      .select({ total: count() })
      .from(tickets)
      .where(whereClause);

    const totalItems = totalResult?.total ?? 0;

    // Fetch bounded query
    const rows = await db.query.tickets.findMany({
      where: whereClause,
      limit,
      offset,
      with: {
        category: true,
        createdBy: {
          columns: { id: true, fullName: true, email: true, department: true },
        },
        assignedTo: {
          columns: { id: true, fullName: true, email: true, department: true },
        },
      },
      orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
    });

    return NextResponse.json(
      buildPaginatedResponse(rows, totalItems, page, limit)
    );
  } catch (error) {
    console.error("[GET /api/v1/tickets]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tickets
 *
 * Enforces:
 * 1. Rate limiting: max 5 tickets per 10 minutes per user/IP.
 * 2. Idempotency: anti-double submission token check.
 * 3. Zod schema validation: title (5-150 chars), description (1-3000 chars), strict priority enum.
 */
export async function POST(request: Request) {
  let idempotencyKey: string | null = null;

  try {
    // ── 1. Authentication check & identifier extraction ────────────────
    const clientIp = getClientIp(request);
    let userId: string = clientIp;
    let authUser: { id: string } | null = null;

    if (isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import("@/lib/supabase-server");
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { success: false, message: "Unauthorized. Silakan login terlebih dahulu." },
          { status: 401 }
        );
      }
      authUser = user;
      userId = user.id;
    }

    // ── 2. Rate Limiting Protection (Max 5 tickets / 10 minutes) ─────────
    const rateLimit = await checkRateLimit(userId, LIMIT_CONFIGS.TICKET_CREATE);
    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit,
        "Batas pembuatan tiket tercapai (maksimal 5 tiket per 10 menit). Silakan coba lagi beberapa saat lagi."
      );
    }

    // ── 3. Zod Schema Validation ────────────────────────────────────────
    const validation = await validateRequestBody(createTicketSchema, request);
    if (!validation.success) {
      return validation.response;
    }

    const { data: validData, rawBody } = validation;
    const {
      title,
      description,
      categoryId,
      priority,
      attachmentUrl: bodyAttachmentUrl,
      attachmentUrls: bodyAttachmentUrls,
    } = validData;

    // ── 4. Anti-Double Submission / Idempotency Check ────────────────────
    idempotencyKey = extractIdempotencyKey(
      request,
      rawBody as Record<string, unknown>
    );

    if (idempotencyKey) {
      const idemResult = checkIdempotency(idempotencyKey, 60);
      if (!idemResult.allowed) {
        return idemResult.response;
      }
    }

    // Extract optional file from raw body if formData was sent
    let file: File | null = null;
    if (rawBody && typeof rawBody === "object" && "file" in rawBody) {
      const rawFile = (rawBody as Record<string, unknown>).file;
      if (rawFile instanceof File && rawFile.size > 0) {
        file = rawFile;
      }
    }

    // ── 5. Create Ticket (Mock vs Real) ──────────────────────────────────
    const dbPriority = normalizePriorityToDb(priority);
    const serializedAttachment = serializeAttachments(
      bodyAttachmentUrls,
      bodyAttachmentUrl
    );

    if (!isSupabaseConfigured) {
      const { getServerSession } = await import("@/lib/auth-session");
      const session = await getServerSession();

      const newTicket = {
        id: `HD-${Math.floor(Math.random() * 10000)}`,
        title,
        description,
        status: "open",
        priority: dbPriority,
        createdById: session?.id || "user-3",
        assignedToId: null,
        categoryId,
        attachmentUrl: file ? "mock-url" : serializedAttachment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (idempotencyKey) {
        resolveIdempotency(idempotencyKey, { success: true, data: newTicket }, 201);
      }

      return NextResponse.json({ success: true, data: newTicket }, { status: 201 });
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { db } = await import("@/db");
    const { tickets } = await import("@/db/schema");

    const supabase = await createSupabaseServerClient();
    let attachmentUrl = serializedAttachment;

    if (file && file.size > 0) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${authUser!.id}-${Date.now()}.${fileExt}`;

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
        if (idempotencyKey) releaseIdempotency(idempotencyKey);
        return NextResponse.json(
          { success: false, message: "Gagal mengunggah berkas lampiran" },
          { status: 500 }
        );
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
        priority: dbPriority,
        createdById: authUser!.id,
        attachmentUrl,
      })
      .returning();

    const responsePayload = { success: true, data: newTicket };

    if (idempotencyKey) {
      resolveIdempotency(idempotencyKey, responsePayload, 201);
    }

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/tickets]", error);
    if (idempotencyKey) {
      releaseIdempotency(idempotencyKey);
    }
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
