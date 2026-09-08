defmodule Kaarobar.Repo.Migrations.EnableRowLevelSecurity do
  use Ecto.Migration

  @moduledoc """
  Postgres RLS as the second isolation layer, alongside `Kaarobar.Repo.Scoped`.

  Every policy checks `organization_id` against the session variable
  `app.current_org_id`, which `Kaarobar.Repo.set_tenant_context/1` sets with
  `SET LOCAL` for the lifetime of one transaction — see
  `KaarobarWeb, :controller`'s `action/2` override, which wraps every
  authenticated controller action in exactly one such transaction. A query
  that runs without it — the scenario this exists to catch, a `Repo.Scoped`
  call site that forgot to scope, or one that bypassed it entirely — sees zero
  rows rather than another tenant's.

  `FORCE ROW LEVEL SECURITY` is required on every table: without it, Postgres
  exempts the table's own owning role, and this application connects as that
  role in every environment (there is no separate, lower-privileged runtime
  role). Without FORCE, these policies would be silently unenforced.

  **Caveat this does not close:** Postgres superusers bypass row-level
  security unconditionally, and `FORCE` cannot change that — it only closes
  the table-owner exemption. `DATABASE_USER` is `postgres`, the database's
  bootstrap superuser, in every environment this application runs in today,
  so these policies do not yet protect live traffic; they are real and
  enforced against anything else, which is what
  `priv/repo/migrations/20260909000200_create_restricted_app_role.exs` and
  `test/backend/row_level_security_test.exs` prove. Making the running
  application connect as something other than the bootstrap superuser is
  necessary follow-up work, deliberately left separate — see that
  migration's moduledoc for why.

  ## Tables deliberately left out

  Six tables carry `organization_id` but are excluded, because a request
  legitimately has to read them *before* a tenant is known, and each one is
  already scoped correctly in code — this is what establishes the tenant
  RLS then protects, not a second copy of the same check:

    * `businesses`, `branches` — resolving `X-Business-Id` / `X-Branch-Id`
      *is* how the organization is discovered; `Kaarobar.Scopes` already joins
      through the caller's own memberships to fetch them, which is a stronger
      check than "same organization" would be
    * `memberships` — the join `Kaarobar.Scopes` uses to do that, and what
      `GET /organizations` reads to list a user's tenants across all of them
      by design
    * `invitations` — accepted by an unauthenticated invitee holding an
      unguessable token; there is no session to attach a tenant to yet, and
      the token is the credential, the same trust boundary as a password
      reset link
    * `idempotency_keys` — claimed by `KaarobarWeb.Plugs.Idempotency`, which
      runs before `LoadScope`'s tenant is available to a transaction, and
      swept by `Kaarobar.Idempotency.prune_expired/0` across every
      organization at once; every query against it already carries an
      explicit `organization_id` predicate
    * `payment_providers` — how `Kaarobar.Payments.handle_webhook/3` resolves
      *which* tenant an inbound gateway callback belongs to before there is
      one to set; `Kaarobar.Payments` sets the tenant context itself once
      that lookup resolves, before touching anything else

  ## Tables with a nullable `organization_id`

  `audit_logs`, `roles` and `webhook_events` carry platform-level rows
  alongside per-organization ones (system role templates; a webhook event not
  yet matched to a tenant). Their policy admits `organization_id IS NULL` in
  addition to a match, so those rows stay visible to everyone rather than
  disappearing whenever no tenant context happens to be set.
  """

  @excluded ~w(businesses branches memberships invitations idempotency_keys payment_providers)
  @nullable ~w(audit_logs roles webhook_events)

  @all_tenant_tables ~w(
    appointments audit_logs bank_accounts batches branches brands businesses
    cash_movements categories commission_rules commissions customer_follow_ups
    customer_groups customer_ledger_entries customer_payment_allocations
    customer_payments customers daily_sales_rollups deliveries dining_tables
    document_sequences expense_categories expenses fiscal_configs
    fiscal_submissions floors gift_cards goods_receipts idempotency_keys
    invitations kitchen_stations kitchen_tickets loyalty_programs memberships
    modifier_groups option_types orders payment_intents payment_providers
    payments platform_invoices price_lists price_rules product_components
    product_daily_rollups product_variants products purchase_orders
    purchase_returns queue_entries quotes refund_requests registers
    regulated_sales rental_agreements rental_units resources roles
    sale_returns sales serial_numbers service_jobs settlements shifts
    stock_counts stock_items stock_moves stock_transfers store_credits
    subscriptions supplier_bills supplier_ledger_entries supplier_payments
    suppliers table_sessions tax_groups taxes time_entries units
    webhook_events
  )

  @strict Enum.sort(@all_tenant_tables -- (@excluded ++ @nullable))

  # `current_setting('app.current_org_id', true)` is `''`, not `NULL`, once
  # the session has ever `RESET` it — Postgres resets a custom (placeholder)
  # GUC to the empty string, not to "unset". A bare `::uuid` cast on that
  # raises `invalid_text_representation` instead of just excluding the row,
  # turning "no context" into a 500 instead of the empty result these
  # policies exist to produce. `NULLIF(..., '')` turns the empty string back
  # into a real `NULL` first, so the cast is only ever attempted on a real
  # UUID or never attempted at all.
  @current_org_id "NULLIF(current_setting('app.current_org_id', true), '')::uuid"

  def up do
    for table <- @strict do
      execute """
      ALTER TABLE #{table} ENABLE ROW LEVEL SECURITY
      """

      execute """
      ALTER TABLE #{table} FORCE ROW LEVEL SECURITY
      """

      execute """
      CREATE POLICY tenant_isolation ON #{table}
        USING (organization_id = #{@current_org_id})
        WITH CHECK (organization_id = #{@current_org_id})
      """
    end

    for table <- @nullable do
      execute """
      ALTER TABLE #{table} ENABLE ROW LEVEL SECURITY
      """

      execute """
      ALTER TABLE #{table} FORCE ROW LEVEL SECURITY
      """

      execute """
      CREATE POLICY tenant_isolation ON #{table}
        USING (
          organization_id IS NULL
          OR organization_id = #{@current_org_id}
        )
        WITH CHECK (
          organization_id IS NULL
          OR organization_id = #{@current_org_id}
        )
      """
    end
  end

  def down do
    for table <- @strict ++ @nullable do
      execute "DROP POLICY IF EXISTS tenant_isolation ON #{table}"
      execute "ALTER TABLE #{table} NO FORCE ROW LEVEL SECURITY"
      execute "ALTER TABLE #{table} DISABLE ROW LEVEL SECURITY"
    end
  end
end
