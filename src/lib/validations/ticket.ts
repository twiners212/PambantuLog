import { z } from "zod";

/**
 * Strict Priority Enum matching user specification: LOW, MEDIUM, HIGH, URGENT.
 */
export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"], {
  message: "Prioritas harus salah satu dari: LOW, MEDIUM, HIGH, URGENT",
});

export type PriorityType = z.infer<typeof PriorityEnum>;

/**
 * Helper to normalize priority to database enum ("low" | "medium" | "high" | "urgent")
 */
export function normalizePriorityToDb(
  priority: string
): "low" | "medium" | "high" | "urgent" {
  const lower = priority.toLowerCase();
  if (lower === "urgent" || lower === "high" || lower === "medium" || lower === "low") {
    return lower;
  }
  return "medium";
}

/**
 * Schema for Ticket Creation
 */
export const createTicketSchema = z.object({
  title: z
    .string({ message: "Judul tiket wajib diisi" })
    .trim()
    .min(5, "Judul tiket minimal 5 karakter")
    .max(150, "Judul tiket maksimal 150 karakter"),

  description: z
    .string({ message: "Deskripsi tiket wajib diisi" })
    .trim()
    .min(1, "Deskripsi tiket wajib diisi")
    .max(3000, "Deskripsi tiket maksimal 3.000 karakter"),

  priority: z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    PriorityEnum
  ),

  categoryId: z
    .string({ message: "Kategori wajib dipilih" })
    .trim()
    .min(1, "Kategori tidak boleh kosong"),

  attachmentUrl: z.string().optional().nullable(),
  attachmentUrls: z
    .array(z.string().min(1))
    .max(5, "Maksimal 5 berkas lampiran yang diperbolehkan")
    .optional(),

  idempotencyKey: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/**
 * Helper to serialize attachments into backward-compatible string
 */
export function serializeAttachments(
  attachmentUrls?: string[] | null,
  attachmentUrl?: string | null
): string | null {
  if (attachmentUrls && attachmentUrls.length > 0) {
    return JSON.stringify(attachmentUrls);
  }
  return attachmentUrl || null;
}

/**
 * Schema for Ticket Comment Creation
 * Accepts either 'comment' or 'message' property for developer convenience
 */
export const createCommentSchema = z
  .object({
    comment: z.string().trim().max(1000, "Komentar maksimal 1.000 karakter").optional(),
    message: z.string().trim().max(1000, "Komentar maksimal 1.000 karakter").optional(),
    attachmentUrl: z.string().url("URL lampiran tidak valid").optional().nullable(),
    idempotencyKey: z.string().optional(),
  })
  .refine(
    (data) => {
      const text = (data.comment || data.message || "").trim();
      return text.length >= 1 && text.length <= 1000;
    },
    {
      message: "Isi komentar wajib diisi (minimal 1 karakter dan maksimal 1.000 karakter)",
      path: ["comment"],
    }
  );

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/**
 * Schema for Ticket Export Filter
 */
export const exportQuerySchema = z.object({
  startDate: z
    .string({ message: "Tanggal awal (startDate) wajib diisi" })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "Format tanggal awal (startDate) tidak valid (contoh: YYYY-MM-DD)",
    }),
  endDate: z
    .string({ message: "Tanggal akhir (endDate) wajib diisi" })
    .refine((date) => !isNaN(Date.parse(date)), {
      message: "Format tanggal akhir (endDate) tidak valid (contoh: YYYY-MM-DD)",
    }),
  format: z.enum(["csv", "pdf"]).default("csv"),
});

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
