import { NextResponse } from "next/server";
import { checkRateLimit, LIMIT_CONFIGS, createRateLimitResponse } from "./rate-limit";

export interface DateRangeValidationResult {
  isValid: boolean;
  error?: string;
  startDate?: Date;
  endDate?: Date;
}

export const MAX_EXPORT_RANGE_DAYS = 30;
export const MAX_EXPORT_ROW_LIMIT = 1000;

/**
 * Validates export date range:
 * 1. Must be valid date objects.
 * 2. Start date must be before or equal to end date.
 * 3. Range between start and end must not exceed 30 days.
 * 4. Start date cannot be in the future.
 */
export function validateExportDateRange(
  rawStart: string | Date,
  rawEnd: string | Date
): DateRangeValidationResult {
  const start = new Date(rawStart);
  const end = new Date(rawEnd);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      isValid: false,
      error: "Format tanggal tidak valid. Gunakan format ISO atau YYYY-MM-DD.",
    };
  }

  // Set start to beginning of day and end to end of day if only date supplied
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (start > end) {
    return {
      isValid: false,
      error: "Tanggal awal (startDate) tidak boleh lebih besar dari tanggal akhir (endDate).",
    };
  }

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  if (start > now) {
    return {
      isValid: false,
      error: "Tanggal awal tidak boleh berada di masa depan.",
    };
  }

  // Calculate day difference
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_EXPORT_RANGE_DAYS) {
    return {
      isValid: false,
      error: `Rentang tanggal ekspor melebihi batas maksimal (${MAX_EXPORT_RANGE_DAYS} hari). Terdeteksi ${diffDays} hari.`,
    };
  }

  return {
    isValid: true,
    startDate: start,
    endDate: end,
  };
}

/**
 * Checks cooldown for export operations (1 request per 2 minutes per user)
 */
export async function checkExportCooldown(
  userIdOrIp: string
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const result = await checkRateLimit(userIdOrIp, LIMIT_CONFIGS.REPORT_EXPORT);

  if (!result.success) {
    return {
      allowed: false,
      response: createRateLimitResponse(
        result,
        "Cooldown ekspor aktif. Anda hanya dapat mengunduh laporan 1 kali setiap 2 menit."
      ),
    };
  }

  return { allowed: true };
}

/**
 * Escapes fields for CSV compliance (RFC 4180)
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // If string contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}
