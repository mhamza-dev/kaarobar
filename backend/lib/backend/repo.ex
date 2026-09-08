defmodule Kaarobar.Repo do
  use Ecto.Repo,
    otp_app: :backend,
    adapter: Ecto.Adapters.Postgres

  @doc """
  Runs `fun` on one pinned connection with the RLS tenant context set.

  This is `Repo.checkout/2`, not `Repo.transaction/2`, and that is
  deliberate. Ecto has no true nested transactions: `Kaarobar.Sales.Checkout`,
  `Kaarobar.Purchasing.create_business`'s `Ecto.Multi`, and every other
  `Repo.rollback/1` call in this codebase assume they are the *outermost*
  transaction, and Ecto only lets the outermost one catch a rollback — see the
  warning in `Kaarobar.Fiscal`'s moduledoc. Wrapping every action in an outer
  `Repo.transaction/2` would make all of those nested instead, so a validation
  failure three calls down would abort silently and surface to the client as
  a bare `{"code": "rollback"}` with the real reason gone. `checkout/2` pins
  the same physical connection for `fun` without opening a transaction, so
  whatever `Repo.transaction/2` call `fun` makes is still the genuine
  outermost one.

  `app.current_org_id` is set with `set_config/3`'s session form (`is_local:
  false`) rather than `SET LOCAL`, because there may be no open transaction
  for `LOCAL` to scope itself to. Session-scoped state on a pooled connection
  is exactly how a leak between two tenants' requests would happen, so this
  always clears it again in an `after` block — even when `fun` raises — before
  the connection goes back to the pool.

  This is the second isolation layer, alongside `Kaarobar.Repo.Scoped`: a
  query against a protected table that runs without this set first returns
  zero rows rather than another tenant's data. See
  `priv/repo/migrations/20260909000000_enable_row_level_security.exs` for the
  policies and for which tables are deliberately exempt (the ones a request
  has to read *before* a tenant is known, such as resolving `X-Business-Id`).
  """
  @spec with_tenant_context(Ecto.UUID.t(), (-> result)) :: result when result: term()
  def with_tenant_context(organization_id, fun) when is_binary(organization_id) do
    checkout(fn ->
      set_tenant_context(organization_id)

      try do
        fun.()
      after
        query!("RESET app.current_org_id")
      end
    end)
  end

  @doc """
  Sets `app.current_org_id` on the current connection for the rest of the
  session, or the current transaction if `local: true`.

  Prefer `with_tenant_context/2`, which also clears it again. This exists
  directly for callers that already own the connection for longer than one
  function call — `test/support/factory.ex`'s `owner_scope/1`, which runs
  inside the sandbox's single per-test transaction, where `local: true` scopes
  it correctly to that transaction without the test needing its own cleanup.
  """
  @spec set_tenant_context(Ecto.UUID.t(), local: boolean()) :: :ok
  def set_tenant_context(organization_id, opts \\ []) when is_binary(organization_id) do
    is_local = Keyword.get(opts, :local, false)
    query!("SELECT set_config('app.current_org_id', $1, $2)", [organization_id, is_local])
    :ok
  end

  @doc """
  Runs `fun` as `backend_system`, the one role RLS policies do not apply to.

  For the handful of jobs whose whole purpose is cross-tenant: chasing every
  organization's overdue invoice, retrying every tenant's stuck fiscal
  submission. There is no `app.current_org_id` to set for "all of them", and
  looping a batch job business-by-business just to satisfy RLS would turn an
  O(1) query into an O(businesses) one for no safety benefit — nothing here
  reaches a client, so there is no request boundary for RLS to protect.

  `checkout/2` rather than `transaction/2`, for the same reason as
  `with_tenant_context/2`: `Kaarobar.Fiscal.process_due/1` and the payment
  capture path both call `Repo.rollback/1` internally and must stay the
  outermost transaction. `SET ROLE` (not `SET LOCAL ROLE`, with no
  transaction to scope it to) always reverts in an `after` block before the
  connection returns to the pool — a leaked `backend_system` role would let
  the next unrelated request's connection bypass RLS entirely.

  `backend_system` is created by
  `priv/repo/migrations/20260909000100_create_system_role.exs` with
  `BYPASSRLS`, and only background jobs on the `:maintenance` and `:fiscal`
  Oban queues use this — never a request handler.
  """
  @spec as_system((-> result)) :: result when result: term()
  def as_system(fun) do
    checkout(fn ->
      query!("SET ROLE backend_system")

      try do
        fun.()
      after
        query!("RESET ROLE")
      end
    end)
  end
end
