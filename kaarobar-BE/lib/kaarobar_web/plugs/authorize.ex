defmodule KaarobarWeb.Plugs.Authorize do
  @moduledoc """
  Enforces role bundles at the API layer (TEN-FR-003 / SEC-NFR-002).
  Business owners pass most bundles; `:employee_self` (staff tools) is excluded.
  """
  import Plug.Conn

  alias Kaarobar.Tenancy

  def init(opts) do
    bundle = Keyword.get(opts, :bundle, :any_staff)
    %{bundle: bundle, require_business: Keyword.get(opts, :require_business, true)}
  end

  def call(conn, %{bundle: bundle, require_business: require_business}) do
    user = conn.assigns[:current_user] || Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    branch_id = conn.assigns[:branch_id]

    cond do
      is_nil(user) ->
        forbid(conn, "unauthenticated")

      require_business and is_nil(business_id) ->
        forbid(conn, "business_required")

      is_nil(business_id) ->
        conn

      Tenancy.user_has_bundle_access?(user, business_id, branch_id, bundle) ->
        conn

      true ->
        forbid(conn, "forbidden_role")
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
