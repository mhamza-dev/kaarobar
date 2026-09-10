import type { Paginated } from "@/types/api/common";

/**
 * `getNextPageParam` for `useInfiniteQuery`, shared by every list hook.
 *
 * Matches the exact `has_more`/`next_cursor` field names the backend uses
 * (backend/lib/backend_web/pagination.ex) — a cursor page has no stable
 * page number or total count, so this is the only pagination contract
 * `DataTable` can rely on. See `src/components/shared/DataTable` for how
 * the flattened pages become rows.
 */
export function getNextCursorParam<T>(lastPage: Paginated<T>): string | undefined {
  return lastPage.meta.has_more ? (lastPage.meta.next_cursor ?? undefined) : undefined;
}

/** Flattens `useInfiniteQuery`'s `{ pages: Paginated<T>[] }` into one row array. */
export function flattenPages<T>(pages: Paginated<T>[] | undefined): T[] {
  return pages?.flatMap((page) => page.data) ?? [];
}
