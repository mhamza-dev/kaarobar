/** Mirrors Serializers.audit_entry/1. */
export type AuditEntry = {
  id: string;
  /** e.g. "sale.voided", "membership.permission_granted". */
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  actor: { id: string | null; label: string | null; type: string | null };
  organization_id: string;
  business_id: string | null;
  branch_id: string | null;
  summary: string | null;
  /** Usually `{before, after}` — whatever the writer recorded. */
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  request_id: string | null;
  occurred_at: string;
};

export type AuditFilters = {
  action?: string;
  entity_type?: string;
  actor_user_id?: string;
  /** ISO datetimes. */
  from?: string;
  to?: string;
};
