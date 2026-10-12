/**
 * Strict Pagination & Query Protection Helper for Drizzle ORM / API Handlers
 * PambantuLog Helpdesk System
 */

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_HARD_CAP_LIMIT = 50;

/**
 * Parses and strictly bounds pagination parameters from URLSearchParams or query objects.
 * - Enforces minimum page = 1
 * - Default limit = 20
 * - Hard cap limit = 50 (Math.min(requestedLimit, 50))
 */
export function parsePaginationParams(
  input: URLSearchParams | { page?: string | number | null; limit?: string | number | null }
): PaginationParams {
  let rawPage: number | undefined;
  let rawLimit: number | undefined;

  if (input instanceof URLSearchParams) {
    const p = input.get("page");
    const l = input.get("limit");
    rawPage = p ? parseInt(p, 10) : undefined;
    rawLimit = l ? parseInt(l, 10) : undefined;
  } else {
    rawPage = typeof input.page === "number" ? input.page : input.page ? parseInt(input.page, 10) : undefined;
    rawLimit = typeof input.limit === "number" ? input.limit : input.limit ? parseInt(input.limit, 10) : undefined;
  }

  // Sanitize Page: strictly positive, default 1
  const page = !rawPage || isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : Math.floor(rawPage);

  // Sanitize Limit: default 20, min 1, hard cap 50
  const requestedLimit = !rawLimit || isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : Math.floor(rawLimit);
  const limit = Math.min(requestedLimit, MAX_HARD_CAP_LIMIT);

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

/**
 * Builds a standardized paginated response with metadata
 */
export function buildPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const safeTotal = Math.max(0, totalItems);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));
  const currentPage = Math.min(page, totalPages);

  return {
    success: true,
    data,
    pagination: {
      page: currentPage,
      limit,
      totalItems: safeTotal,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
}
