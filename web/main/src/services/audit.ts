import { apiClient } from "@/lib/api/client";
import type { AuditEntry, AuditFilters } from "@/types/api/audit";
import type { CursorParams, Paginated } from "@/types/api/common";

/** `GET /audit-logs` — newest first, cursor-paginated: it's the fastest-growing table. */
export async function listAuditEntries(
  params: AuditFilters & CursorParams,
): Promise<Paginated<AuditEntry>> {
  const response = await apiClient.get<Paginated<AuditEntry>>("/audit-logs", { params });
  return response.data;
}
