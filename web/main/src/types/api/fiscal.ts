/** Mirrors `KaarobarWeb.FiscalJSON` — the tax-authority connection. */

export const FISCAL_ADAPTERS = ["none", "fbr", "generic"] as const;

export type FiscalConfig = {
  id: string;
  adapter: string;
  mode: string | null;
  taxpayer_number: string | null;
  pos_id: string | null;
  endpoint_url: string | null;
  is_active: boolean;
  block_on_failure: boolean;
  reporting: boolean;
  /** Whether a token is stored — never the token. */
  has_credentials: boolean;
  disabled_at: string | null;
};

export type FiscalConfigPayload = {
  adapter: string;
  mode?: string;
  taxpayer_number?: string | null;
  pos_id?: string | null;
  endpoint_url?: string | null;
  /** Write-only; omit to keep the stored token. */
  credentials?: { token: string };
  is_active?: boolean;
  block_on_failure?: boolean;
};

export type FiscalStatus = {
  reporting: boolean;
  blocking: boolean;
  adapter: string | null;
  mode: string | null;
  backlog: number;
  /** Server-computed: blocking is on and something is stuck — the till must not open. */
  selling_blocked: boolean;
};

export type FiscalSubmission = {
  id: string;
  sale_id: string | null;
  branch_id: string | null;
  adapter: string;
  kind: string;
  status: string;
  fiscal_number: string | null;
  qr_payload: string | null;
  authority_reference: string | null;
  attempts: number;
  /** The authority's own words — shown verbatim, they name the field to fix. */
  error_code: string | null;
  last_error: string | null;
  stamped: boolean;
  needs_attention: boolean;
  submitted_at: string | null;
  accepted_at: string | null;
  failed_at: string | null;
  retry_after: string | null;
  inserted_at: string | null;
};
