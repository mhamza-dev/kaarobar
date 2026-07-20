defmodule KaarobarWeb.Plugs.Authorize do
  @moduledoc """
  Enforces role bundles at the API layer (TEN-FR-003 / SEC-NFR-002).
  Owners of the business always pass.
  """
  import Plug.Conn

  alias Kaarobar.{Roles, Tenancy}

  def init(opts) do
    roles =
      cond do
        bundle = Keyword.get(opts, :bundle) -> Roles.bundle(bundle)
        roles = Keyword.get(opts, :roles) -> roles
        true -> Roles.bundle(:any_staff)
      end

    %{roles: roles, require_business: Keyword.get(opts, :require_business, true)}
  end

  def call(conn, %{roles: roles, require_business: require_business}) do
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

      Tenancy.user_has_any_role?(user, business_id, branch_id, roles) ->
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
