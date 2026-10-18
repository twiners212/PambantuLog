import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  rawBody?: unknown;
}

export interface ValidationFailure {
  success: false;
  response: NextResponse;
  errors: Record<string, string[]>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Format ZodError into a clean field-to-messages dictionary:
 * { title: ["Judul minimal 5 karakter"], priority: ["..."] }
 */
export function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_global";
    if (!formatted[key]) {
      formatted[key] = [];
    }
    formatted[key].push(issue.message);
  }

  return formatted;
}

/**
 * Creates a standardized 400 Bad Request JSON response for validation errors
 */
export function createValidationErrorResponse(
  error: ZodError | Record<string, string[]> | string
): NextResponse {
  const errors =
    error instanceof ZodError
      ? formatZodErrors(error)
      : typeof error === "string"
      ? { _global: [error] }
      : error;

  return NextResponse.json(
    {
      success: false,
      message: "Validasi data gagal. Periksa kembali input yang dikirimkan.",
      errors,
    },
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Validates request body (supports JSON and FormData) against a given Zod schema.
 */
export async function validateRequestBody<T>(
  schema: ZodSchema<T>,
  request: Request
): Promise<ValidationResult<T>> {
  try {
    const contentType = request.headers.get("content-type") || "";
    let rawData: unknown;

    if (contentType.includes("application/json")) {
      rawData = await request.json();
    } else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await request.formData();
      const entries: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        if (key in entries) {
          const existing = entries[key];
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            entries[key] = [existing, value];
          }
        } else {
          entries[key] = value;
        }
      });

      rawData = entries;
    } else {
      return {
        success: false,
        errors: { _global: ["Tipe konten tidak didukung"] },
        response: NextResponse.json(
          { success: false, message: "Content-Type header must be application/json or multipart/form-data" },
          { status: 415 }
        ),
      };
    }

    const parseResult = schema.safeParse(rawData);
    if (!parseResult.success) {
      return {
        success: false,
        errors: formatZodErrors(parseResult.error),
        response: createValidationErrorResponse(parseResult.error),
      };
    }

    return {
      success: true,
      data: parseResult.data,
      rawBody: rawData,
    };
  } catch (err) {
    return {
      success: false,
      errors: { _global: ["Gagal membaca request body"] },
      response: NextResponse.json(
        {
          success: false,
          message: "Request body tidak valid atau format JSON rusak",
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validates search / query parameters from URL against a Zod schema.
 */
export function validateQueryParams<T>(
  schema: ZodSchema<T>,
  searchParams: URLSearchParams
): ValidationResult<T> {
  const params: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    params[key] = val;
  });

  const parseResult = schema.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      errors: formatZodErrors(parseResult.error),
      response: createValidationErrorResponse(parseResult.error),
    };
  }

  return {
    success: true,
    data: parseResult.data,
  };
}
