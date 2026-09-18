import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { StaffMember } from "@/types/api/staffing";

/**
 * `GET /staff` — a plain array, not cursor-paginated: the backend returns
 * the whole roster for the scoped business (`Staffing.list_memberships/1`),
 * which is bounded by how many people a business employs.
 */
export async function listStaff(): Promise<StaffMember[]> {
  const response = await apiClient.get<ApiEnvelope<StaffMember[]>>("/staff");
  return response.data.data;
}

export async function getStaff(id: string): Promise<StaffMember> {
  const response = await apiClient.get<ApiEnvelope<StaffMember>>(`/staff/${id}`);
  return response.data.data;
}

export async function updateStaff(
  id: string,
  payload: { employee_code?: string | null; job_title?: string | null },
): Promise<StaffMember> {
  const response = await apiClient.patch<ApiEnvelope<StaffMember>>(`/staff/${id}`, payload);
  return response.data.data;
}

export async function setStaffStatus(id: string, status: string): Promise<StaffMember> {
  const response = await apiClient.put<ApiEnvelope<StaffMember>>(`/staff/${id}/status`, { status });
  return response.data.data;
}

/** Replaces the member's roles wholesale — the backend expects the full list. */
export async function setStaffRoles(id: string, roleIds: string[]): Promise<StaffMember> {
  const response = await apiClient.put<ApiEnvelope<StaffMember>>(`/staff/${id}/roles`, {
    role_ids: roleIds,
  });
  return response.data.data;
}

/** Replaces branch scoping. An empty list means *every* branch, not none. */
export async function setStaffBranches(id: string, branchIds: string[]): Promise<StaffMember> {
  const response = await apiClient.put<ApiEnvelope<StaffMember>>(`/staff/${id}/branches`, {
    branch_ids: branchIds,
  });
  return response.data.data;
}

export async function removeStaff(id: string): Promise<void> {
  await apiClient.delete(`/staff/${id}`);
}
