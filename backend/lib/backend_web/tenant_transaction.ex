defmodule KaarobarWeb.TenantTransaction do
  @moduledoc """
  Sets the RLS tenant context for one controller action, when it has a
  tenant.

  Used from the `action/2` override in `KaarobarWeb, :controller` rather than
  as a plug, because a plug cannot wrap the plugs and the controller action
  that run after it — only the `action/2` boundary Phoenix already gives
  every controller can. See `Kaarobar.Repo.with_tenant_context/2` for why
  this pins a connection rather than opening a transaction around the
  action: most write actions open their own transaction already, several
  through `Repo.rollback/1` or `Ecto.Multi`, and an outer transaction here
  would make those nested instead of outermost.

  An action whose scope has no organization yet (`/me`, `/organizations`,
  registration, login, the invitation and webhook endpoints) runs unwrapped —
  there is no tenant to set, and every table those touch is one of the ones
  `priv/repo/migrations/20260909000000_enable_row_level_security.exs`
  deliberately leaves unprotected for exactly that reason.
  """

  alias Kaarobar.Repo
  alias Kaarobar.Scope

  @spec run(Plug.Conn.t(), (Plug.Conn.t() -> term())) :: term()
  def run(conn, action_fun) do
    case conn.assigns[:scope] do
      %Scope{organization: %{id: organization_id}} ->
        Repo.with_tenant_context(organization_id, fn -> action_fun.(conn) end)

      _no_tenant ->
        action_fun.(conn)
    end
  end
end
