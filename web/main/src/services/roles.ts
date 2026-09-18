import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { PermissionCatalogue, Role, RolePayload } from "@/types/api/staffing";

export async function listRoles(): Promise<Role[]> {
  const response = await apiClient.get<ApiEnvelope<Role[]>>("/roles");
  return response.data.data;
}

export async function getRole(id: string): Promise<Role> {
  const response = await apiClient.get<ApiEnvelope<Role>>(`/roles/${id}`);
  return response.data.data;
}

export async function createRole(payload: RolePayload): Promise<Role> {
  const response = await apiClient.post<ApiEnvelope<Role>>("/roles", payload);
  return response.data.data;
}

export async function updateRole(id: string, payload: Partial<RolePayload>): Promise<Role> {
  const response = await apiClient.patch<ApiEnvelope<Role>>(`/roles/${id}`, payload);
  return response.data.data;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`);
}

/**
 * `GET /roles/permissions` — the whole permission catalogue, already grouped
 * and ordered server-side (`AccessControl.Permissions.by_group/0`). The
 * frontend never keeps its own copy of these ~140 keys.
 */
export async function getPermissionCatalogue(): Promise<PermissionCatalogue> {
  const response = await apiClient.get<ApiEnvelope<PermissionCatalogue>>("/roles/permissions");
  return response.data.data;
}
