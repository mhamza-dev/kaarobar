import { useInfiniteQuery } from "@tanstack/react-query";

import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import { listAuditEntries } from "@/services/audit";
import type { AuditFilters } from "@/types/api/audit";

import { useTenantKey } from "./keys";

export function useAuditLog(filters: AuditFilters = {}) {
  const tenant = useTenantKey();
  const query = useInfiniteQuery({
    queryKey: ["audit", tenant, filters],
    queryFn: ({ pageParam }) => listAuditEntries({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });
  return { ...query, rows: flattenPages(query.data?.pages) };
}
