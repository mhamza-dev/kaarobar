defmodule KaarobarWeb.Plugs.TenantScope do
  @moduledoc """
  Resolves x-business-id / x-branch-id and enforces TEN-FR-004 access.
  """
  import Plug.Conn

  alias Kaarobar.Tenancy

  def init(opts), do: opts

  def call(conn, _opts) do
    user = Guardian.Plug.current_resource(conn)
    business_id = header(conn, "x-business-id")
    branch_id = header(conn, "x-branch-id")

    cond do
      is_nil(user) ->
        conn

      is_nil(business_id) ->
        assign_tenant(conn, user, nil, nil, user.id)

      not Tenancy.user_can_access_business?(user, business_id) ->
        forbid(conn, "forbidden_business")

      not Tenancy.business_active?(business_id) ->
        forbid(conn, "business_inactive")

      is_binary(branch_id) and branch_id != "" and
          not Tenancy.user_can_access_branch?(user, business_id, branch_id) ->
        forbid(conn, "forbidden_branch")

      is_binary(branch_id) and branch_id != "" and not Tenancy.branch_active?(branch_id) ->
        forbid(conn, "branch_inactive")

      true ->
        owner_id = Tenancy.owner_id_for_business(business_id) || user.id
        assign_tenant(conn, user, business_id, blank_to_nil(branch_id), owner_id)
    end
  end

  defp assign_tenant(conn, user, business_id, branch_id, owner_id) do
    conn
    |> assign(:current_user, user)
    |> assign(:current_business_id, business_id)
    |> assign(:current_branch_id, branch_id)
    |> assign(:current_owner_id, owner_id)
    |> assign(:business_id, business_id)
    |> assign(:branch_id, branch_id)
    |> assign(:owner_id, owner_id)
  end

  defp forbid(conn, reason) do
    body = Jason.encode!(%{error: reason})

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(403, body)
    |> halt()
  end

  defp header(conn, name) do
    case get_req_header(conn, name) |> List.first() do
      nil -> nil
      "" -> nil
      value -> value
    end
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil
  defp blank_to_nil(value), do: value
end
