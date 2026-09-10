/**
 * Shapes shared by every backend endpoint. Hand-written against the actual
 * Elixir source (no OpenAPI spec exists yet) — see:
 *   backend/lib/backend_web/error_envelope.ex
 *   backend/lib/backend_web/pagination.ex
 */

/** The `{"data": T}` envelope every non-list, non-document endpoint returns. */
export type ApiEnvelope<T> = {
  data: T;
};

/** The cursor-pagination `meta` block — see backend/lib/backend_web/pagination.ex. */
export type PaginationMeta = {
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
};

/** A cursor-paginated list response: `{"data": [...], "meta": {...}}`. */
export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

/** Request params accepted by every cursor-paginated list endpoint. */
export type CursorParams = {
  cursor?: string;
  limit?: number;
};

/** The backend's uniform error body: `{"error": {"code","message","details"}}`. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[] | string> | null;
  };
};
