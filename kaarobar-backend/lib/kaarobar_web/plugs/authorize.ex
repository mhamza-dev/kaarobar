defmodule KaarobarWeb.Plugs.Authorize do
  @moduledoc """
  Enforces role ∧ plan entitlements at the API layer (TEN-FR-003 / ADM-FR-002 / SEC-NFR-002).
  Business owners pass most role bundles; `:employee_self` (staff tools) is excluded.
  Plan gating uses the business owner's subscription (`plan_feature_locked`).
  """
  import Plug.Conn

  alias Kaarobar.{Billing, Tenancy}

  def init(opts) do
    bundle = Keyword.get(opts, :bundle, :any_staff)
    %{bundle: bundle, require_business: Keyword.get(opts, :require_business, true)}
  end

  def call(conn, %{bundle: bundle, require_business: require_business}) do
    user = conn.assigns[:current_user] || Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    branch_id = conn.assigns[:branch_id]
    owner_id = conn.assigns[:owner_id]

    cond do
      is_nil(user) ->
        forbid(conn, "unauthenticated")

      require_business and is_nil(business_id) ->
        forbid(conn, "business_required")

      is_nil(business_id) ->
        conn

      not Tenancy.user_has_bundle_access?(user, business_id, branch_id, bundle) ->
        forbid(conn, "forbidden_role")

      not Billing.plan_allows_bundle?(owner_id || user.id, bundle) ->
        forbid(conn, "plan_feature_locked")

      true ->
        conn
    end
  end

  defp forbid(conn, reason) do
    body = Jason.encode!(%{error: reason})

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(403, body)
    |> halt()
  end
end
